// ============================================================
// We SMILE — RCP v7.0
// ============================================================
//
// Schemat arkusza (ID poniżej):
//   Pracownicy    : [ID, Imię, Nazwisko, Rola, Status, PIN]
//   Ewidencja     : [Timestamp, EmpID, Imię, Nazwisko, Akcja, Data, Godzina, Źródło]
//   Anomalie      : [Timestamp, EmpID, Opis]
//   Nieobecnosci  : [Timestamp, EmpID, Imię, Nazwisko, Data, Kod, Typ, Adnotacja, Źródło]
//   Przekroczenia : [Timestamp, EmpID, Data, Uzasadnienie, Źródło]
//
// Po wgraniu do GAS uruchom raz ręcznie: setupRCP()
// ============================================================

const SS_ID          = '1wI3ysrolzGea5nNi7GYBo09t38y8oUgPoqGG3wn-ZsA';
const TOKEN_WIN_SEC  = 30;
const TOKEN_GRACE    = 1;    // ±1 okno tolerancji
const DEDUP_SEC      = 90;
const RATE_MAX       = 5;
const RATE_WIN_SEC   = 300;

// ── Godziny pracy Kliniki ────────────────────────────────────
// Pn–Pt 8:00–21:00, Sb 9:00–16:00, Nd — nieczynne.

function _clinicHoursFor(ds) {
  const dow = new Date(ds + 'T12:00:00').getDay(); // 0=Nd
  if (dow === 0) return null;
  if (dow === 6) return { open: 9 * 60, close: 16 * 60 };
  return { open: 8 * 60, close: 21 * 60 };
}

// Czy dzień (na podstawie pierwszego wejścia / ostatniego wyjścia)
// wykracza poza regularne godziny Kliniki.
function _dayOutsideClinic(ds, wejscie, wyjscie) {
  if (!wejscie && !wyjscie) return false;
  const h = _clinicHoursFor(ds);
  if (!h) return true; // niedziela
  if (wejscie && _t2m(wejscie) < h.open)  return true;
  if (wyjscie && _t2m(wyjscie) > h.close) return true;
  return false;
}

// ── Forma zatrudnienia ───────────────────────────────────────
// Ustawiana raz na pracownika (panel Właściciela → Pracownicy).
// Decyduje o: (1) liście typów nieobecności widocznej w samoobsłudze,
// (2) czy dzień urlopu dolicza 8h do miesięcznej sumy (tylko UoP).

const FORMA_UOP = 'UoP', FORMA_ZLC = 'Zlecenie', FORMA_B2B = 'B2B';
const EMPLOYMENT_FORMS = [FORMA_UOP, FORMA_ZLC, FORMA_B2B];

// ── Typy nieobecności ────────────────────────────────────────
// Pokrywają UoP, umowę zlecenie i B2B — `forms` ogranicza widoczność
// w samoobsłudze pracownika do jego formy zatrudnienia.

const ABSENCE_TYPES = [
  { code: 'DW',   label: 'Dzień wolny — Klinika zamknięta',                forms: [] },
  { code: 'L4',   label: 'L4 — zwolnienie lekarskie',                      forms: EMPLOYMENT_FORMS },
  { code: 'UW',   label: 'Urlop wypoczynkowy',                             forms: [FORMA_UOP] },
  { code: 'UZ',   label: 'Urlop na żądanie',                               forms: [FORMA_UOP] },
  { code: 'UB',   label: 'Urlop bezpłatny',                                forms: [FORMA_UOP] },
  { code: 'UOK',  label: 'Urlop okolicznościowy',                          forms: [FORMA_UOP] },
  { code: 'UMR',  label: 'Urlop macierzyński / rodzicielski',              forms: [FORMA_UOP] },
  { code: 'UOJ',  label: 'Urlop ojcowski',                                 forms: [FORMA_UOP] },
  { code: 'UWY',  label: 'Urlop wychowawczy',                              forms: [FORMA_UOP] },
  { code: 'OPD',  label: 'Opieka nad dzieckiem (art. 188 KP)',             forms: [FORMA_UOP] },
  { code: 'ZOP',  label: 'Zasiłek opiekuńczy — opieka nad chorym',         forms: [FORMA_UOP] },
  { code: 'SW',   label: 'Zwolnienie — siła wyższa (art. 148¹ KP)',        forms: [FORMA_UOP] },
  { code: 'HK',   label: 'Honorowe krwiodawstwo',                         forms: [FORMA_UOP] },
  { code: 'ODB',  label: 'Odbiór nadgodzin / dzień wolny',                 forms: [FORMA_UOP] },
  { code: 'NUN',  label: 'Nieobecność usprawiedliwiona niepłatna',         forms: EMPLOYMENT_FORMS },
  { code: 'NN',   label: 'Nieobecność nieusprawiedliwiona',                forms: EMPLOYMENT_FORMS },
  { code: 'PZL',  label: 'Przerwa w realizacji zlecenia (umowa zlecenie)', forms: [FORMA_ZLC] },
  { code: 'B2B',  label: 'Przerwa w świadczeniu usług (B2B)',              forms: [FORMA_B2B] },
  { code: 'DEL',  label: 'Delegacja / szkolenie',                          forms: EMPLOYMENT_FORMS },
  { code: 'INNE', label: 'Inne (wymagana adnotacja)',                      forms: EMPLOYMENT_FORMS }
];
const ABSENCE_MAX_DAYS = 62;

// Kody urlopu, które dla pracowników na UoP doliczają 8h/dzień do
// miesięcznej sumy godzin (art. odpowiadające płatnym nieobecnościom KP).
const PAID_8H_CODES = ['UW', 'UZ', 'L4', 'UOK', 'UMR', 'UOJ', 'ZOP', 'SW', 'HK', 'ODB'];

function _absType(code) {
  for (let i = 0; i < ABSENCE_TYPES.length; i++) {
    if (ABSENCE_TYPES[i].code === String(code)) return ABSENCE_TYPES[i];
  }
  return null;
}

// Lista typów nieobecności dostępna w samoobsłudze pracownika o danej
// formie zatrudnienia. Brak ustawionej formy → pełna lista (poza DW),
// żeby nigdy nie zablokować zgłoszenia — właściciel uzupełnia formę osobno.
function _absTypesForForma(forma) {
  if (!forma) return ABSENCE_TYPES.filter(t => t.code !== 'DW');
  return ABSENCE_TYPES.filter(t => t.forms.indexOf(forma) !== -1);
}

// pin obecny (samoobsługa pracownika) → lista zawężona do jego formy zatrudnienia.
// pin brak (panel Właściciela) → pełna lista, właściciel ma pełne uprawnienia.
function getAbsenceTypes(pin) {
  if (!pin) return { ok: true, types: ABSENCE_TYPES };
  const worker = _findActiveByPin(pin);
  if (!worker) return { ok: true, types: ABSENCE_TYPES.filter(t => t.code !== 'DW') };
  return { ok: true, types: _absTypesForForma(String(worker[6] || '')) };
}

// ── Współdzielone partiale HTML (style itp.) ──────────────────

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ── Entry point ──────────────────────────────────────────────

function doGet(e) {
  const p = e && e.parameter && e.parameter.page;
  // URL bieżącego wdrożenia — wstrzykiwana do każdego widoku, żeby przyciski
  // nawigacji (Raporty/Odbicia/Panel Właściciela) mogły przejść na sztywny,
  // absolutny adres w tej samej karcie zamiast liczyć na location.pathname
  // (niemiarodajny wewnątrz sandboxa HtmlService).
  const baseUrl = ScriptApp.getService().getUrl();

  if (p === 'dashboard') {
    const tmpl = HtmlService.createTemplateFromFile('DashboardGUI');
    tmpl.BASE_URL = baseUrl;
    return tmpl.evaluate()
      .setTitle('We SMILE — Panel Raportowy')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  if (p === 'owner') {
    const tmpl = HtmlService.createTemplateFromFile('MasterGUI');
    tmpl.BASE_URL = baseUrl;
    return tmpl.evaluate()
      .setTitle('We SMILE')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  const page = (p === 'admin') ? 'admin' : 'worker';
  const tmpl = HtmlService.createTemplateFromFile('Index');
  tmpl.PAGE     = page;
  tmpl.BASE_URL = baseUrl;
  return tmpl.evaluate()
    .setTitle('We SMILE — RCP')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ── Dispatcher ───────────────────────────────────────────────

function callRCP(action, argsJson) {
  try {
    const args = JSON.parse(argsJson || '[]');
    switch (action) {
      case 'getToken':        return _getTokenResponse(!!args[0]);
      case 'checkPin':        return checkPin(args[0]);
      case 'clockIn':         return clock(args[0], args[1], 'WEJSCIE');
      case 'clockOut':        return clock(args[0], args[1], 'WYJSCIE');
      case 'getAbsenceTypes': return getAbsenceTypes(args[0]);
      case 'reportAbsence':   return reportAbsence(args[0], args[1], args[2], args[3], args[4]);
      case 'setOvertimeNote': return setOvertimeNote(args[0], args[1]);
      // Widok "Mój miesiąc" (pracownik — niedytowalne godziny, edytowalne adnotacje)
      case 'getMyMonth':           return getMyMonth(args[0], args[1], args[2]);
      case 'setMyOvertimeNote':    return setMyOvertimeNote(args[0], args[1], args[2]);
      case 'setMyAbsenceNote':     return setMyAbsenceNote(args[0], args[1], args[2]);
      // Dashboard
      case 'dashLogin':      return dashLogin(args[0]);
      case 'getDashboard':   return getDashboard(args[0], args[1], args[2]);
      case 'setEtat':        return setEtat(args[0], args[1], args[2], args[3]);
      case 'setNote':        return setNote(args[0], args[1], args[2], args[3], args[4]);
      case 'getExportMeta':  return getExportMeta(args[0]);
      case 'dashExportXlsx': return dashExportXlsx(args[0], args[1]);
      case 'getActive':      return getActiveNow(args[0]);
      // Owner (edycja czasu / nieobecności / uzasadnień)
      case 'masterLogin':           return masterLogin(args[0]);
      case 'masterGetEmployees':    return masterGetEmployees(args[0]);
      case 'masterGetDay':          return masterGetDay(args[0], args[1], args[2]);
      case 'masterSetDay':          return masterSetDay(args[0], args[1], args[2], args[3], args[4]);
      case 'masterGetMonth':        return masterGetMonth(args[0], args[1], args[2], args[3]);
      case 'masterSetAbsence':      return masterSetAbsence(args[0], args[1], args[2], args[3], args[4]);
      case 'masterSetOvertimeNote': return masterSetOvertimeNote(args[0], args[1], args[2], args[3]);
      case 'masterSetClinicDayOff': return masterSetClinicDayOff(args[0], args[1], args[2], args[3], args[4]);
      case 'masterSetAbsenceRange': return masterSetAbsenceRange(args[0], args[1], args[2], args[3], args[4], args[5]);
      case 'masterSetEmploymentForm': return masterSetEmploymentForm(args[0], args[1], args[2]);
      default:               return { ok: false, msg: 'Nieznana akcja.' };
    }
  } catch (err) {
    Logger.log('RCP error [' + action + ']: ' + err);
    return { ok: false, msg: 'Błąd serwera.' };
  }
}

// ── Token HMAC-SHA256 ────────────────────────────────────────

function _tokenForWindow(w) {
  const secret = PropertiesService.getScriptProperties().getProperty('RCP_SECRET') || 'wesmile_rcp_default_v1';
  const bytes  = Utilities.computeHmacSha256Signature('RCP:' + w, secret);
  const n      = Math.abs(bytes.reduce((a, b) => (a * 256 + (b < 0 ? b + 256 : b)) % 10000, 0));
  return String(n).padStart(4, '0');
}

function _currentToken() {
  return _tokenForWindow(Math.floor(Date.now() / 1000 / TOKEN_WIN_SEC));
}

// Ile sekund pozostało do zmiany bieżącego kodu.
function _tokenSecLeft() {
  const s = Math.floor(Date.now() / 1000);
  return TOKEN_WIN_SEC - (s % TOKEN_WIN_SEC);
}

// next=true → kod kolejnego okna, pokazany z wyprzedzeniem (przycisk "Odśwież").
// Bezpieczne: _verifyToken akceptuje okno ±1 (TOKEN_GRACE), więc kod jest
// ważny już w momencie wyświetlenia, mimo że bieżące okno jeszcze trwa.
function _getTokenResponse(next) {
  const base    = Math.floor(Date.now() / 1000 / TOKEN_WIN_SEC) + (next ? 1 : 0);
  const secLeft = _tokenSecLeft() + (next ? TOKEN_WIN_SEC : 0);
  return { ok: true, token: _tokenForWindow(base), secLeft, winSec: TOKEN_WIN_SEC };
}

function _verifyToken(code) {
  if (!code || String(code).length !== 4) return false;
  const base = Math.floor(Date.now() / 1000 / TOKEN_WIN_SEC);
  for (let d = -TOKEN_GRACE; d <= TOKEN_GRACE; d++) {
    if (_tokenForWindow(base + d) === String(code)) return true;
  }
  return false;
}

// ── Helpers ──────────────────────────────────────────────────

function _ss()     { return SpreadsheetApp.openById(SS_ID); }
function _cache()  { return CacheService.getScriptCache(); }
function _nowPL()  { return Utilities.formatDate(new Date(), 'Europe/Warsaw', 'HH:mm'); }
function _todayPL(){ return Utilities.formatDate(new Date(), 'Europe/Warsaw', 'yyyy-MM-dd'); }

function _getWorkers() {
  const sh = _ss().getSheetByName('Pracownicy');
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getDataRange().getValues().slice(1);
  // cols: 0=ID, 1=Imię, 2=Nazwisko, 3=Rola, 4=Status, 5=PIN, 6=FormaZatrudnienia (może być puste)
}

function _findActiveByPin(pin) {
  return _getWorkers().find(r =>
    _pinMatch(r[5], pin) && String(r[4]).toLowerCase() === 'aktywny'
  ) || null;
}

// Porównuje PINy z uwzględnieniem wiodących zer
// (Sheets może zapisać "0371" jako liczbę 371)
function _pinMatch(stored, entered) {
  const a = String(stored).padStart(4, '0');
  const b = String(entered).padStart(4, '0');
  return a === b;
}

// ── Rate limiter ─────────────────────────────────────────────

function _checkRate(key) {
  const k = 'rl_' + key;
  const v = parseInt(_cache().get(k) || '0', 10);
  if (v >= RATE_MAX) return false;
  _cache().put(k, String(v + 1), RATE_WIN_SEC);
  return true;
}

function _resetRate(key) {
  _cache().remove('rl_' + key);
}

// ── checkPin — weryfikacja PIN (krok 1) ──────────────────────

function checkPin(pin) {
  if (!pin || String(pin).length !== 4 || !/^\d{4}$/.test(String(pin))) {
    return { ok: false, msg: 'PIN musi mieć dokładnie 4 cyfry.' };
  }
  if (!_checkRate('pin')) {
    return { ok: false, msg: 'Zbyt wiele prób. Odczekaj 5 minut.' };
  }

  const worker = _findActiveByPin(pin);
  if (!worker) {
    return { ok: false, msg: 'Nieprawidłowy PIN lub konto nieaktywne.' };
  }

  _resetRate('pin');
  return {
    ok:       true,
    id:       String(worker[0]),
    imie:     String(worker[1]),
    nazwisko: String(worker[2]),
    rola:     String(worker[3]),
    pendingJustifications: _countPendingJustifications(String(worker[0]))
  };
}

// Dni z tego i poprzedniego miesiąca, w których pracownik pracował poza
// godzinami Kliniki (na podstawie realnych odbić), a nikt — ani on sam
// na kiosku, ani właściciel ręcznie — nie zostawił uzasadnienia. Obejmuje
// też dni wpisane/nadpisane ręcznie przez właściciela (masterSetDay),
// które nigdy nie przechodzą przez ekran uzasadnienia na kiosku.
function _countPendingJustifications(empId) {
  const w = _myEditWindow();
  const ewidSh = _ss().getSheetByName('Ewidencja');
  const rows = (ewidSh && ewidSh.getLastRow() >= 2) ? ewidSh.getDataRange().getValues().slice(1) : [];
  const map = {};
  rows.forEach(r => {
    if (String(r[1]) !== empId) return;
    const ds = _sheetDate(r[5]);
    if (ds < w.min || ds > w.max) return;
    if (!map[ds]) map[ds] = { e: [], x: [] };
    const akcja = String(r[4]).trim();
    const godz  = _sheetTime(r[6]);
    if (akcja === 'WEJSCIE') map[ds].e.push(godz);
    else if (akcja === 'WYJSCIE') map[ds].x.push(godz);
  });

  const ovrNotes = _overtimeNotesAll();
  let count = 0;
  Object.keys(map).forEach(ds => {
    const rcp = map[ds];
    const wejscie = rcp.e.length ? rcp.e.slice().sort()[0] : null;
    const wyjscie = rcp.x.length ? rcp.x.slice().sort().reverse()[0] : null;
    if (_dayOutsideClinic(ds, wejscie, wyjscie) && !ovrNotes[empId + '_' + ds]) count++;
  });
  return count;
}

// ── clock — rejestracja zdarzenia (krok 2) ───────────────────

function clock(pin, tokenCode, action) {
  if (!pin || !tokenCode) {
    return { ok: false, msg: 'Brak wymaganych danych.' };
  }

  const worker = _findActiveByPin(pin);
  if (!worker) return { ok: false, msg: 'Pracownik nie istnieje.' };

  const empId = String(worker[0]);

  if (!_checkRate('clk_' + empId)) {
    return { ok: false, msg: 'Zbyt wiele prób. Odczekaj 5 minut.' };
  }

  if (!_verifyToken(String(tokenCode))) {
    return { ok: false, msg: 'Nieprawidłowy kod autoryzacyjny lub wygasł.' };
  }

  const dedupKey = 'dup_' + empId;
  if (_cache().get(dedupKey)) {
    return { ok: false, msg: 'Zdarzenie już zarejestrowane. Chwilę odczekaj.' };
  }
  _cache().put(dedupKey, '1', DEDUP_SEC);

  const today   = _todayPL();
  const ewidSh  = _ss().getSheetByName('Ewidencja');
  const allRows = (ewidSh && ewidSh.getLastRow() >= 2)
    ? ewidSh.getDataRange().getValues().slice(1) : [];
  const todayEmp = allRows.filter(r => String(r[1]) === empId && String(r[5]) === today);

  if (todayEmp.length > 0) {
    const lastAction = String(todayEmp[todayEmp.length - 1][4]);
    if (lastAction === action) {
      _ss().getSheetByName('Anomalie').appendRow([
        new Date().toISOString(), empId,
        'Duplikacja ' + action + ': ' + worker[1] + ' ' + worker[2]
      ]);
      const label = action === 'WEJSCIE' ? 'WEJŚCIE' : 'WYJŚCIE';
      return { ok: false, msg: 'Błąd sekwencji: ostatnie zdarzenie to już ' + label + '.' };
    }
  }

  const godzina = _nowPL();
  ewidSh.appendRow([
    new Date().toISOString(), empId,
    String(worker[1]), String(worker[2]),
    action, today, godzina, 'worker'
  ]);

  _resetRate('clk_' + empId);

  // Wykrycie pracy poza regularnymi godzinami Kliniki:
  // wejście przed otwarciem lub wyjście po zamknięciu (Nd — zawsze).
  const h = _clinicHoursFor(today);
  let overtime = false;
  if (!h) overtime = true;
  else if (action === 'WEJSCIE' && _t2m(godzina) < h.open)  overtime = true;
  else if (action === 'WYJSCIE' && _t2m(godzina) > h.close) overtime = true;

  return { ok: true, imie: String(worker[1]), godzina, overtime };
}

// ── reportAbsence — zgłoszenie nieobecności przez pracownika ─
// Nie wymaga kodu z tabletu (pracownik zgłasza zdalnie, np. L4).

function reportAbsence(pin, dateFrom, dateTo, typeCode, note) {
  if (!pin) return { ok: false, msg: 'Brak danych.' };
  if (!_checkRate('pin')) {
    return { ok: false, msg: 'Zbyt wiele prób. Odczekaj 5 minut.' };
  }

  const worker = _findActiveByPin(pin);
  if (!worker) return { ok: false, msg: 'Nieprawidłowy PIN lub konto nieaktywne.' };
  _resetRate('pin');

  const re = /^\d{4}-\d{2}-\d{2}$/;
  dateFrom = String(dateFrom || '');
  dateTo   = String(dateTo || dateFrom);
  if (!re.test(dateFrom) || !re.test(dateTo) || dateFrom > dateTo) {
    return { ok: false, msg: 'Nieprawidłowy zakres dat.' };
  }

  const type = _absType(typeCode);
  if (!type) return { ok: false, msg: 'Wybierz typ nieobecności.' };

  note = String(note || '').trim().slice(0, 500);
  if (type.code === 'INNE' && !note) {
    return { ok: false, msg: 'Dla typu „Inne” adnotacja jest wymagana.' };
  }

  const from = new Date(dateFrom + 'T12:00:00');
  const to   = new Date(dateTo + 'T12:00:00');
  const days = Math.round((to - from) / 86400000) + 1;
  if (days > ABSENCE_MAX_DAYS) {
    return { ok: false, msg: 'Maksymalny zakres to ' + ABSENCE_MAX_DAYS + ' dni.' };
  }

  _upsertAbsence(String(worker[0]), String(worker[1]), String(worker[2]),
                 dateFrom, dateTo, type, note, 'worker');

  return { ok: true, imie: String(worker[1]), typ: type.label, dni: days };
}

// Nadpisuje nieobecności pracownika w zakresie dat (jeden wiersz na dzień).
function _upsertAbsence(empId, imie, nazwisko, dateFrom, dateTo, type, note, source) {
  const ss = _ss();
  let sh = ss.getSheetByName('Nieobecnosci');
  if (!sh) {
    sh = ss.insertSheet('Nieobecnosci');
    sh.appendRow(['Timestamp', 'EmpID', 'Imię', 'Nazwisko', 'Data', 'Kod', 'Typ', 'Adnotacja', 'Źródło']);
  }
  const rows = (sh.getLastRow() >= 2) ? sh.getDataRange().getValues().slice(1) : [];
  for (let i = rows.length - 1; i >= 0; i--) {
    const ds = _sheetDate(rows[i][4]);
    if (String(rows[i][1]) === empId && ds >= dateFrom && ds <= dateTo) {
      sh.deleteRow(i + 2);
    }
  }
  if (!type) return; // samo usunięcie
  const ts = new Date().toISOString();
  const cursor = new Date(dateFrom + 'T12:00:00');
  const end    = new Date(dateTo + 'T12:00:00');
  while (cursor <= end) {
    const ds = Utilities.formatDate(cursor, 'Europe/Warsaw', 'yyyy-MM-dd');
    sh.appendRow([ts, empId, imie, nazwisko, ds, type.code, type.label, note, source]);
    cursor.setDate(cursor.getDate() + 1);
  }
}

// ── setOvertimeNote — uzasadnienie pracy poza godzinami ──────
// Wpisywane przez pracownika zaraz po odbiciu poza godzinami Kliniki.
// Adnotacja przypisana do dnia (dzisiejszego).

function setOvertimeNote(pin, note) {
  if (!pin) return { ok: false, msg: 'Brak danych.' };
  if (!_checkRate('pin')) {
    return { ok: false, msg: 'Zbyt wiele prób. Odczekaj 5 minut.' };
  }
  const worker = _findActiveByPin(pin);
  if (!worker) return { ok: false, msg: 'Nieprawidłowy PIN.' };
  _resetRate('pin');

  note = String(note || '').trim().slice(0, 500);
  if (!note) return { ok: false, msg: 'Wpisz uzasadnienie.' };

  _saveOvertimeNote(String(worker[0]), _todayPL(), note, 'worker');
  return { ok: true };
}

// ── "Mój miesiąc" — niedytowalne podsumowanie własnych godzin ─
// Pracownik widzi swój miesiąc (bez możliwości zmiany wejść/wyjść) i może
// dopisać/zmienić adnotację nieobecności lub uzasadnienie pracy poza
// godzinami Kliniki dla dowolnego dnia z okna [1. dzień poprz. miesiąca; dziś].

// Okno dat, w którym pracownik może edytować własne adnotacje wstecz.
function _myEditWindow() {
  const today = new Date(_todayPL() + 'T12:00:00');
  const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1, 12);
  return {
    min: Utilities.formatDate(prevMonthStart, 'Europe/Warsaw', 'yyyy-MM-dd'),
    max: _todayPL()
  };
}

function _inMyEditWindow(ds) {
  const w = _myEditWindow();
  return ds >= w.min && ds <= w.max;
}

function getMyMonth(pin, year, month) {
  if (!pin) return { ok: false, msg: 'Brak danych.' };
  const worker = _findActiveByPin(pin);
  if (!worker) return { ok: false, msg: 'Nieprawidłowy PIN.' };

  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  if (isNaN(y) || isNaN(m) || m < 1 || m > 12) {
    return { ok: false, msg: 'Nieprawidłowy miesiąc/rok.' };
  }

  const empId = String(worker[0]);
  const forma = String(worker[6] || '');
  const daysInMonth = new Date(y, m, 0).getDate();
  const pfx = y + '-' + String(m).padStart(2, '0');

  const ewidSh = _ss().getSheetByName('Ewidencja');
  const rows = (ewidSh && ewidSh.getLastRow() >= 2) ? ewidSh.getDataRange().getValues().slice(1) : [];
  const map = {};
  rows.forEach(r => {
    if (String(r[1]) !== empId) return;
    const ds = _sheetDate(r[5]);
    if (!ds.startsWith(pfx)) return;
    if (!map[ds]) map[ds] = { e: [], x: [] };
    const akcja = String(r[4]).trim();
    const godz  = _sheetTime(r[6]);
    if (akcja === 'WEJSCIE') map[ds].e.push(godz);
    else if (akcja === 'WYJSCIE') map[ds].x.push(godz);
  });

  const absMap   = _absenceMapAll();
  const ovrNotes = _overtimeNotesAll();
  const editWindow = _myEditWindow();
  const DOW = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];

  let totalMins = 0, absDays = 0, paidAbsDays = 0, ovrDays = 0;
  const days = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const ds  = pfx + '-' + String(d).padStart(2, '0');
    const rcp = map[ds];
    let wejscie = null, wyjscie = null, mins = null;
    if (rcp) {
      if (rcp.e.length) wejscie = rcp.e.slice().sort()[0];
      if (rcp.x.length) wyjscie = rcp.x.slice().sort().reverse()[0];
      if (wejscie && wyjscie) {
        const diff = _t2m(wyjscie) - _t2m(wejscie);
        if (diff > 0) { mins = diff; totalMins += diff; }
      }
    }

    const key = empId + '_' + ds;
    const absence  = _isWeekend(ds) ? null : (absMap[key] || null);
    const overtime = _dayOutsideClinic(ds, wejscie, wyjscie);
    const overtimeNote = ovrNotes[key] || '';
    if (absence)  absDays++;
    if (overtime) ovrDays++;
    if (absence && forma === FORMA_UOP && PAID_8H_CODES.indexOf(absence.code) !== -1) {
      mins = 480;
      totalMins += 480;
      paidAbsDays++;
    }

    const dow = DOW[new Date(ds + 'T12:00:00').getDay()];
    days.push({
      date: ds, dow, wejscie, wyjscie, mins, absence, overtime, overtimeNote,
      editable: ds >= editWindow.min && ds <= editWindow.max
    });
  }

  return {
    ok: true, imie: String(worker[1]), nazwisko: String(worker[2]),
    totalMinutes: totalMins, absDays, paidAbsDays, ovrDays, days
  };
}

function setMyOvertimeNote(pin, date, note) {
  if (!pin) return { ok: false, msg: 'Brak danych.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return { ok: false, msg: 'Nieprawidłowa data.' };
  if (!_checkRate('pin')) return { ok: false, msg: 'Zbyt wiele prób. Odczekaj 5 minut.' };

  const worker = _findActiveByPin(pin);
  if (!worker) return { ok: false, msg: 'Nieprawidłowy PIN.' };
  _resetRate('pin');

  if (!_inMyEditWindow(String(date))) {
    return { ok: false, msg: 'Adnotacje można edytować tylko dla bieżącego i poprzedniego miesiąca.' };
  }

  note = String(note || '').trim().slice(0, 500);
  _saveOvertimeNote(String(worker[0]), String(date), note, 'worker');
  return { ok: true };
}

function setMyAbsenceNote(pin, date, note) {
  if (!pin) return { ok: false, msg: 'Brak danych.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return { ok: false, msg: 'Nieprawidłowa data.' };
  if (!_checkRate('pin')) return { ok: false, msg: 'Zbyt wiele prób. Odczekaj 5 minut.' };

  const worker = _findActiveByPin(pin);
  if (!worker) return { ok: false, msg: 'Nieprawidłowy PIN.' };
  _resetRate('pin');

  if (!_inMyEditWindow(String(date))) {
    return { ok: false, msg: 'Adnotacje można edytować tylko dla bieżącego i poprzedniego miesiąca.' };
  }

  const empId = String(worker[0]);
  const sh = _ss().getSheetByName('Nieobecnosci');
  const rows = (sh && sh.getLastRow() >= 2) ? sh.getDataRange().getValues().slice(1) : [];
  note = String(note || '').trim().slice(0, 500);

  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][1]) === empId && _sheetDate(rows[i][4]) === String(date)) {
      sh.getRange(i + 2, 8).setValue(note); // kolumna 8 = Adnotacja
      return { ok: true };
    }
  }
  return { ok: false, msg: 'Brak nieobecności tego dnia — adnotację można dodać tylko do istniejącego wpisu.' };
}

// Zapis uzasadnienia dnia (puste note = usunięcie).
function _saveOvertimeNote(empId, ds, note, source) {
  const ss = _ss();
  let sh = ss.getSheetByName('Przekroczenia');
  if (!sh) {
    sh = ss.insertSheet('Przekroczenia');
    sh.appendRow(['Timestamp', 'EmpID', 'Data', 'Uzasadnienie', 'Źródło']);
  }
  const rows = (sh.getLastRow() >= 2) ? sh.getDataRange().getValues().slice(1) : [];
  for (let i = rows.length - 1; i >= 0; i--) {
    if (String(rows[i][1]) === empId && _sheetDate(rows[i][2]) === ds) {
      sh.deleteRow(i + 2);
    }
  }
  if (note) {
    sh.appendRow([new Date().toISOString(), empId, ds, note, source]);
  }
}

// ── setupRCP — uruchom raz po wgraniu ────────────────────────

function setupRCP() {
  const spreadsheet = _ss();

  [
    { name: 'Pracownicy',    h: ['ID', 'Imię', 'Nazwisko', 'Rola', 'Status', 'PIN', 'FormaZatrudnienia'] },
    { name: 'Ewidencja',     h: ['Timestamp', 'EmpID', 'Imię', 'Nazwisko', 'Akcja', 'Data', 'Godzina', 'Źródło'] },
    { name: 'Anomalie',      h: ['Timestamp', 'EmpID', 'Opis'] },
    { name: 'Statusy',       h: ['Date', 'EmpID', 'Status', 'Notes', 'Modified'] },
    { name: 'Nieobecnosci',  h: ['Timestamp', 'EmpID', 'Imię', 'Nazwisko', 'Data', 'Kod', 'Typ', 'Adnotacja', 'Źródło'] },
    { name: 'Przekroczenia', h: ['Timestamp', 'EmpID', 'Data', 'Uzasadnienie', 'Źródło'] }
  ].forEach(def => {
    let sh = spreadsheet.getSheetByName(def.name);
    if (!sh) sh = spreadsheet.insertSheet(def.name);
    if (sh.getLastRow() === 0) {
      sh.appendRow(def.h);
      return;
    }
    // Arkusz już istnieje (np. produkcyjny) — dopisz tylko brakujące nagłówki
    // na końcu (np. nową kolumnę FormaZatrudnienia), nie ruszając danych.
    const curCols = sh.getLastColumn();
    if (curCols < def.h.length) {
      sh.getRange(1, curCols + 1, 1, def.h.length - curCols).setValues([def.h.slice(curCols)]);
    }
  });

  const pSh = spreadsheet.getSheetByName('Pracownicy');

  if (pSh.getLastRow() <= 1) {
    const employees = [
      ['WS01', 'Arkadiusz',  'Graczyk',      'Admin',                           'Aktywny', '0371', 'UoP'],
      ['WS02', 'Kaja',       'Węglarek',     'rejestratorka medyczna',          'Aktywny', '1826', 'UoP'],
      ['WS03', 'Julia',      'Polishchuk',    'higienistka stomatologiczna',     'Aktywny', '0316', 'UoP'],
      ['WS04', 'Oksana',     'Revutska',      'asystentka stomatologiczna',      'Aktywny', '0484', 'UoP'],
      ['WS05', 'Kamila',     'Pruszczyńska', 'higienistka stomatologiczna',     'Aktywny', '4731', 'UoP'],
      ['WS06', 'Katarzyna',  'Graczyk',       'higienistka stomatologiczna',     'Aktywny', '9010', 'UoP']
    ];
    employees.forEach(row => pSh.appendRow(row));
    Logger.log('Dodano ' + employees.length + ' pracowników.');
  } else {
    Logger.log('Pracownicy już istnieją — pominięto import.');
  }

  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('RCP_SECRET')) {
    props.setProperty('RCP_SECRET', Utilities.getUuid() + '-' + Utilities.getUuid());
    Logger.log('Wygenerowano nowy RCP_SECRET.');
  }

  Logger.log('setupRCP zakończony pomyślnie.');
}
