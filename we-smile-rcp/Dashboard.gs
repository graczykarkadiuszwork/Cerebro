// ============================================================
// Dashboard.gs — We SMILE RCP v12.0
// ============================================================

const DASH_TTL = 3600;

// ── Sesja ────────────────────────────────────────────────────

function _dashOk(token) {
  if (!token) return false;
  const k = 'ds_' + String(token).slice(0, 50);
  if (_cache().get(k) !== '1') return false;
  _cache().put(k, '1', DASH_TTL);
  return true;
}

// ── Logi admina → arkusz Logi_Admin ──────────────────────────

function _logAdmin(action, empId, details) {
  try {
    const ss = _ss();
    let sh = ss.getSheetByName('Logi_Admin');
    if (!sh) {
      sh = ss.insertSheet('Logi_Admin');
      sh.appendRow(['Timestamp', 'Akcja', 'EmpID', 'Szczegoly']);
    }
    sh.appendRow([new Date().toISOString(), String(action), String(empId || '—'), String(details || '')]);
  } catch (e) {
    Logger.log('_logAdmin error: ' + e);
  }
  // Zwierciadło na Dysku Google (patrz Drive.gs) — osobny plik CSV per
  // rok, żeby dało się ustalić co się stało nawet bez wchodzenia
  // do samego arkusza. Celowo osobny try/catch: awaria Dysku nie może
  // ubić zapisu do arkusza powyżej (to on jest źródłem prawdy).
  if (typeof _logRoczny === 'function') _logRoczny(action, empId, details);
}

// ── Historia zmian pracownika ─────────────────────────────────
// Logi_Admin już rejestruje kto/kiedy/co przy każdej edycji (forma
// zatrudnienia, tagi specjalizacji, nieobecności, dodanie/archiwizacja/
// przywrócenie, korekty dnia…) — to po prostu odczyt tego samego arkusza
// przefiltrowany do jednej osoby, bez osobnego modelu danych.

function masterGetHistoriaPracownika(token, empId) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  if (!empId) return { ok: false, msg: 'Brak pracownika.' };
  const sh = _ss().getSheetByName('Logi_Admin');
  if (!sh || sh.getLastRow() < 2) return { ok: true, wpisy: [] };
  const wpisy = sh.getDataRange().getValues().slice(1)
    .filter(r => String(r[2]) === String(empId))
    .map(r => ({ czas: String(r[0]), akcja: String(r[1]), szczegoly: String(r[3] || '') }))
    .sort((a, b) => b.czas < a.czas ? -1 : b.czas > a.czas ? 1 : 0)
    .slice(0, 200);
  return { ok: true, wpisy };
}

// ── Mapy nieobecności i przekroczeń ──────────────────────────

// { 'EmpID_yyyy-MM-dd': { code, typ, note } }
function _absenceMapAll() {
  const sh = _ss().getSheetByName('Nieobecnosci');
  const rows = (sh && sh.getLastRow() >= 2) ? sh.getDataRange().getValues().slice(1) : [];
  const map = {};
  rows.forEach(r => {
    const ds = _sheetDate(r[4]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ds)) return;
    map[String(r[1]) + '_' + ds] = {
      code: String(r[5] || ''),
      typ:  String(r[6] || ''),
      note: String(r[7] || '')
    };
  });
  return map;
}

// { 'EmpID_yyyy-MM-dd': 'uzasadnienie' }
function _overtimeNotesAll() {
  const sh = _ss().getSheetByName('Przekroczenia');
  const rows = (sh && sh.getLastRow() >= 2) ? sh.getDataRange().getValues().slice(1) : [];
  const map = {};
  rows.forEach(r => {
    const ds = _sheetDate(r[2]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ds)) return;
    map[String(r[1]) + '_' + ds] = String(r[3] || '');
  });
  return map;
}

// { 'EmpID_yyyy-MM-dd_HH:mm': 'powód' } — adnotacja obowiązkowa przy
// starcie przerwy (klucz zawiera godzinę, bo w jednym dniu może być
// więcej niż jedna przerwa).
function _przerwyNotesAll() {
  const sh = _ss().getSheetByName('Przerwy');
  const rows = (sh && sh.getLastRow() >= 2) ? sh.getDataRange().getValues().slice(1) : [];
  const map = {};
  rows.forEach(r => {
    const ds = _sheetDate(r[2]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ds)) return;
    map[String(r[1]) + '_' + ds + '_' + _sheetTime(r[3])] = String(r[4] || '');
  });
  return map;
}

// ── Login ─────────────────────────────────────────────────────

function dashLogin(pin) {
  if (!pin || !/^\d{4}$/.test(String(pin))) {
    return { ok: false, msg: 'PIN musi mieć 4 cyfry.' };
  }
  if (!_checkRate('dlog')) {
    return { ok: false, msg: 'Zbyt wiele prób. Odczekaj 5 minut.' };
  }
  const worker = _getWorkers().find(r => _pinMatch(r[5], pin));
  if (!worker) {
    return { ok: false, msg: 'Nieprawidłowy PIN.' };
  }
  _resetRate('dlog');
  const token = Utilities.getUuid();
  _cache().put('ds_' + token, '1', DASH_TTL);
  const name = String(worker[1]) + ' ' + String(worker[2]);
  _logAdmin('Logowanie', String(worker[0]), 'Zalogowano: ' + name);
  return { ok: true, token, name };
}

// ── Kto jest teraz w pracy / kto już skończył dziś ────────────

function getActiveNow(token) {
  if (!_dashOk(token)) {
    return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  }
  return _activeNowData();
}

// Wariant dla panelu Właściciela — właściciel jest już uwierzytelniony
// swoim PIN-em (masterLogin), nie potrzebuje osobnej sesji Raportów.
function masterGetActive(token) {
  if (!_masterOk(token)) {
    return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  }
  return _activeNowData();
}

function _activeNowData() {
  const today = _todayPL();
  const ewidSh = _ss().getSheetByName('Ewidencja');
  const rows = (ewidSh && ewidSh.getLastRow() >= 2)
    ? ewidSh.getDataRange().getValues().slice(1) : [];

  const byEmp = {};
  rows.forEach(r => {
    const ds = _sheetDate(r[5]);
    if (ds !== today) return;
    const empId = String(r[1]);
    const akcja = String(r[4]).trim();
    // Przerwy (PRZERWA_START/PRZERWA_KONIEC) nie liczą się do stanu
    // obecności — inaczej pracownik na przerwie zniknąłby z obu list
    // (ani "aktywny", ani "zakończony"), bo śledzimy tu tylko ostatnie
    // zdarzenie dnia, a to akurat mogłaby być przerwa.
    if (akcja !== 'WEJSCIE' && akcja !== 'WYJSCIE') return;
    const godz  = _sheetTime(r[6]);
    if (!byEmp[empId]) byEmp[empId] = { e: [], x: [], last: null, lastGodz: null };
    if (akcja === 'WEJSCIE') byEmp[empId].e.push(godz);
    else if (akcja === 'WYJSCIE') byEmp[empId].x.push(godz);
    if (!byEmp[empId].lastGodz || _t2m(godz) >= _t2m(byEmp[empId].lastGodz)) {
      byEmp[empId].last = akcja;
      byEmp[empId].lastGodz = godz;
    }
  });

  const workers = _getWorkers();
  const active = [];
  const finished = [];

  Object.keys(byEmp).forEach(empId => {
    const w = workers.find(row => String(row[0]) === empId);
    if (!w) return;
    const rec = byEmp[empId];
    const wejscie = rec.e.length ? rec.e.slice().sort()[0] : null;
    const wyjscie = rec.x.length ? rec.x.slice().sort().reverse()[0] : null;
    const entry = { id: empId, imie: String(w[1]), nazwisko: String(w[2]), wejscie, wyjscie };

    if (rec.last === 'WEJSCIE') {
      active.push(entry);
    } else if (rec.last === 'WYJSCIE') {
      finished.push(entry);
    }
  });

  active.sort((a, b) => _t2m(a.wejscie) - _t2m(b.wejscie));
  finished.sort((a, b) => _t2m(a.wyjscie) - _t2m(b.wyjscie));

  return { ok: true, active, finished };
}

// ── Dane miesiąca (widok panelu) ──────────────────────────────

function getDashboard(token, year, month) {
  if (!_dashOk(token)) {
    return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła. Zaloguj się ponownie.' };
  }
  return _dashboardData(year, month);
}

// Wariant dla panelu Właściciela — jego własna sesja (masterLogin) wystarcza.
// ── Raport obecności ───────────────────────────────────────────
// Inny kąt niż istniejący raport godzin (masterGetDashboard sumuje CZAS
// pracy): tu chodzi o same DNI — ile dni roboczych klinika miała w
// miesiącu, ile z nich pracownik faktycznie odbił, ile było
// usprawiedliwioną nieobecnością, a ile to dni bez odbicia i bez
// nieobecności w Nieobecnosciach (czyli luka wymagająca wyjaśnienia).
// Tylko personel odbijający się w RCP (_isRcpWorker) — lekarze nie mają
// tu czego liczyć, ich obecność widać w Grafiku, nie w Ewidencji.

function masterGetRaportObecnosci(token, rok, mies) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  const y = parseInt(rok, 10), m = parseInt(mies, 10);
  if (isNaN(y) || isNaN(m) || m < 1 || m > 12) return { ok: false, msg: 'Nieprawidłowy miesiąc.' };

  const pracownicy = _getWorkers().filter(_isRcpWorker);
  const ileDni = new Date(y, m, 0).getDate();
  const pfx = y + '-' + String(m).padStart(2, '0');
  const dniRobocze = [];
  for (let d = 1; d <= ileDni; d++) {
    const ds = pfx + '-' + String(d).padStart(2, '0');
    if (_clinicHoursFor(ds)) dniRobocze.push(ds);
  }

  const ewidSh = _ss().getSheetByName('Ewidencja');
  const rows = (ewidSh && ewidSh.getLastRow() >= 2) ? ewidSh.getDataRange().getValues().slice(1) : [];
  const odbiciaWg = {}; // empId -> { data: true }
  rows.forEach(r => {
    if (String(r[4]).trim() !== 'WEJSCIE') return;
    const ds = _sheetDate(r[5]);
    if (!ds.startsWith(pfx)) return;
    const id = String(r[1]);
    if (!odbiciaWg[id]) odbiciaWg[id] = {};
    odbiciaWg[id][ds] = true;
  });

  const absMap = _absenceMapAll();

  const pracownicyRaport = pracownicy.map(w => {
    const id = String(w[0]);
    let obecnych = 0, nieobecnychUspr = 0, brakujacych = 0;
    const brakujaceDaty = [];
    dniRobocze.forEach(ds => {
      if (odbiciaWg[id] && odbiciaWg[id][ds]) { obecnych++; return; }
      if (absMap[id + '_' + ds]) { nieobecnychUspr++; return; }
      brakujacych++;
      brakujaceDaty.push(ds);
    });
    const oczekiwane = dniRobocze.length - nieobecnychUspr;
    const frekwencja = oczekiwane > 0 ? Math.round((obecnych / oczekiwane) * 1000) / 10 : null;
    return {
      id, imie: String(w[1]), nazwisko: String(w[2]), rola: String(w[3]),
      obecnych, nieobecnychUspr, brakujacych, brakujaceDaty, frekwencja
    };
  });

  pracownicyRaport.sort((a, b) => {
    const fa = a.frekwencja == null ? 999 : a.frekwencja, fb = b.frekwencja == null ? 999 : b.frekwencja;
    return fa - fb;
  });

  return { ok: true, rok: y, mies: m, dniRoboczeMiesiaca: dniRobocze.length, pracownicy: pracownicyRaport };
}

function masterGetDashboard(token, year, month) {
  if (!_masterOk(token)) {
    return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  }
  return _dashboardData(year, month);
}

function _dashboardData(year, month) {
  try {
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    if (isNaN(y) || isNaN(m) || m < 1 || m > 12) {
      return { ok: false, msg: 'Nieprawidłowy miesiąc/rok.' };
    }

    const daysInMonth = new Date(y, m, 0).getDate();
    const pfx = y + '-' + String(m).padStart(2, '0');
    const props = PropertiesService.getScriptProperties();

    const etatKey = 'etat_' + y + '_' + String(m).padStart(2, '0');
    const etatZapisana = props.getProperty(etatKey);
    const etat = (etatZapisana !== null) ? (parseFloat(etatZapisana) || 0) : _domyslnaNormaMiesiaca(y, m);
    const etatAuto = (etatZapisana === null);

    const ewidSh = _ss().getSheetByName('Ewidencja');
    const ewidRows = (ewidSh && ewidSh.getLastRow() >= 2)
      ? ewidSh.getDataRange().getValues().slice(1) : [];

    const rcpMap = {};
    ewidRows.forEach(r => {
      const ds = _sheetDate(r[5]);
      if (!ds.startsWith(pfx)) return;
      const k = String(r[1]) + '_' + ds;
      if (!rcpMap[k]) rcpMap[k] = { e: [], x: [] };
      const akcja = String(r[4]).trim();
      const godz  = _sheetTime(r[6]);
      if (akcja === 'WEJSCIE') rcpMap[k].e.push(godz);
      else if (akcja === 'WYJSCIE') rcpMap[k].x.push(godz);
    });

    const absMap   = _absenceMapAll();
    const ovrNotes = _overtimeNotesAll();
    const urlopOverrideAll = _urlopGodzinyOverrideAll();

    const DOW = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];

    const employees = _getWorkers()
      .filter(_isRcpWorker)
      .map(w => {
        const id = String(w[0]);
        const forma = String(w[6] || '');
        let totalMins = 0;
        let absDays = 0;
        let paidAbsDays = 0;
        let ovrDays = 0;
        let ovrMinutes = 0;

        // Proporcjonalne (edytowalne) godziny urlopu tego pracownika w tym
        // miesiącu — wyliczone raz przed pętlą dni, bo zależą od sumy
        // za CAŁY miesiąc, nie da się ich policzyć dzień po dniu w locie.
        const urlopDomyslne = _urlopGodzinyUoPDomyslne(id, forma, y, m, rcpMap, absMap);

        const days = [];
        for (let d = 1; d <= daysInMonth; d++) {
          const ds  = pfx + '-' + String(d).padStart(2, '0');
          const key = id + '_' + ds;
          const rcp = rcpMap[key];

          // Dzień może mieć kilka sesji (wyjście i powrót w ciągu dnia) —
          // godziny to SUMA sesji, nie rozpiętość od pierwszego wejścia do
          // ostatniego wyjścia (ta doliczałaby przerwę jako czas pracy).
          const sesje = _sesjeZOdbic(rcp);
          const rama = _ramaDnia(sesje);
          let wejscie = rama.wejscie, wyjscie = rama.wyjscie, mins = null;
          const przepracowane = _minutyZSesji(sesje);
          if (przepracowane > 0) { mins = przepracowane; totalMins += przepracowane; }

          const absence  = absMap[key] || null;
          const overtime = _dayOutsideClinicSesje(ds, sesje);
          const overtimeMinutes = _overtimeMinutesSesje(ds, sesje);
          const overtimeNote = ovrNotes[key] || '';
          if (absence)  absDays++;
          if (overtime) { ovrDays++; ovrMinutes += overtimeMinutes; }

          // Urlop UoP z kodem płatnym dolicza się do sumy miesięcznej,
          // niezależnie od tego, że w tym dniu nie ma odbić w Ewidencji —
          // domyślnie proporcjonalnie do brakujących godzin (patrz
          // _urlopGodzinyUoPDomyslne), a nie sztywne 8h; ręczne nadpisanie
          // (masterSetUrlopGodzinyDnia) zawsze ma pierwszeństwo.
          let urlopKredytMin = null, urlopReczny = false;
          if (absence && forma === FORMA_UOP && PAID_8H_CODES.indexOf(absence.code) !== -1) {
            const nadpisane = urlopOverrideAll[key];
            urlopKredytMin = (nadpisane !== undefined) ? nadpisane : (urlopDomyslne[ds] || 0);
            urlopReczny = (nadpisane !== undefined);
            mins = urlopKredytMin;
            totalMins += urlopKredytMin;
            paidAbsDays++;
          }

          const dow = DOW[new Date(ds + 'T12:00:00').getDay()];
          days.push({
            date: ds, dow, wejscie, wyjscie, mins, absence, overtime, overtimeMinutes, overtimeNote,
            sesje: sesje,
            dzielony: sesje.length > 1, // dzień z przerwą — patrz _sesjeZOdbic
            urlopKredytGodz: urlopKredytMin !== null ? Math.round((urlopKredytMin / 60) * 100) / 100 : null,
            urlopReczny
          });
        }

        const noteKey = 'note_' + id + '_' + y + '_' + String(m).padStart(2, '0');
        const note = props.getProperty(noteKey) || '';

        return {
          id,
          imie:         String(w[1]),
          nazwisko:     String(w[2]),
          rola:         String(w[3]),
          totalMinutes: totalMins,
          totalHours:   Math.round((totalMins / 60) * 10) / 10,
          absDays,
          paidAbsDays,
          ovrDays,
          ovrMinutes,
          ovrHours: Math.round((ovrMinutes / 60) * 10) / 10,
          note,
          days
        };
      });

    return { ok: true, year: y, month: m, etat, etatAuto, employees };

  } catch (e) {
    Logger.log('getDashboard error: ' + e);
    return { ok: false, msg: 'Błąd serwera: ' + e.toString() };
  }
}

// ── Domyślna norma godzin (wymiar czasu pracy) ────────────────
// Standardowe polskie wyliczenie: dni robocze pon–pt w miesiącu,
// pomniejszone o święta ustawowe przypadające w dzień roboczy, razy 8h.
// To tylko PUNKT WYJŚCIA — każdy miesiąc można nadpisać ręcznie
// (masterSetEtat/setEtat), a nadpisanie zawsze wygrywa z wyliczeniem.
// Korzysta z tego samego kalendarza świąt, co zakładka Dni wolne.

function _domyslnaNormaMiesiaca(rok, mies) {
  const dni = new Date(rok, mies, 0).getDate();
  const swietaDaty = _swietaDlaRoku(rok).map(s => s.data);
  const pfx = rok + '-' + String(mies).padStart(2, '0') + '-';
  let robocze = 0;
  for (let d = 1; d <= dni; d++) {
    const dow = new Date(rok, mies - 1, d).getDay();
    if (dow < 1 || dow > 5) continue;
    const ds = pfx + String(d).padStart(2, '0');
    if (swietaDaty.indexOf(ds) !== -1) continue;
    robocze++;
  }
  return robocze * 8;
}

// ── Proporcjonalne godziny urlopu dla UoP ──────────────────────
// Domyślnie (edytowalnie) każdy płatny dzień nieobecności UoP
// (PAID_8H_CODES) dostaje NIE sztywne 8h, tylko (norma miesiąca —
// godziny już zarejestrowane w tym miesiącu) / liczba takich dni —
// tak żeby suma miesięczna dokładnie wypełniała ustaloną normę.
// Np. brakuje 12h do normy, 2 dni urlopu → 6h/dzień; 15h, 3 dni → 5h/dzień.
// Zwraca { 'yyyy-MM-dd': minuty } tylko dla dni z płatnym kodem tego
// miesiąca; nie-UoP i miesiące bez takich dni dostają pustą mapę.

function _urlopGodzinyUoPDomyslne(empId, forma, rok, mies, rcpMapCaly, absMapCaly) {
  if (forma !== FORMA_UOP) return {};
  const pfx = rok + '-' + String(mies).padStart(2, '0');
  const ile = new Date(rok, mies, 0).getDate();
  const etatKey = 'etat_' + rok + '_' + String(mies).padStart(2, '0');
  const etatZapisana = PropertiesService.getScriptProperties().getProperty(etatKey);
  const normaGodz = (etatZapisana !== null) ? (parseFloat(etatZapisana) || 0) : _domyslnaNormaMiesiaca(rok, mies);
  const normaMin = normaGodz * 60;

  let zarejestrowaneMin = 0;
  const dniUrlopowe = [];
  for (let d = 1; d <= ile; d++) {
    const ds = pfx + '-' + String(d).padStart(2, '0');
    const key = empId + '_' + ds;
    const abs = absMapCaly[key] || null;
    if (abs && PAID_8H_CODES.indexOf(abs.code) !== -1) { dniUrlopowe.push(ds); continue; }
    // Suma sesji, nie rozpiętość dnia — dzień dzielony (np. 9-15 i 17-18)
    // ma wnieść 7h, inaczej zaniżyłby brakujące godziny do rozdzielenia
    // na dni urlopowe.
    zarejestrowaneMin += _minutyZSesji(_sesjeZOdbic(rcpMapCaly[key]));
  }
  if (!dniUrlopowe.length) return {};

  const brakujaceMin = Math.max(0, normaMin - zarejestrowaneMin);
  const naDzienMin = Math.round(brakujaceMin / dniUrlopowe.length);
  const mapa = {};
  dniUrlopowe.forEach(ds => { mapa[ds] = naDzienMin; });
  return mapa;
}

// Ręczne nadpisania proporcjonalnego wyliczenia — jeden wiersz na
// EmpID+Data. Bez wpisu = wartość wyliczona automatycznie obowiązuje.
function _urlopGodzinyOverrideAll() {
  const sh = _arkusz('UrlopGodzinyOverride', ['EmpID', 'Data', 'Minuty', 'Zmodyfikowano']);
  const rows = (sh.getLastRow() >= 2) ? sh.getDataRange().getValues().slice(1) : [];
  const mapa = {};
  rows.forEach(r => {
    const ds = _sheetDate(r[1]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ds)) return;
    mapa[String(r[0]) + '_' + ds] = parseFloat(r[2]) || 0;
  });
  return mapa;
}

function masterSetUrlopGodzinyDnia(token, empId, data, godziny) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  empId = String(empId || '');
  data = String(data || '');
  if (!empId || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return { ok: false, msg: 'Nieprawidłowe dane.' };

  const sh = _arkusz('UrlopGodzinyOverride', ['EmpID', 'Data', 'Minuty', 'Zmodyfikowano']);
  const rows = (sh.getLastRow() >= 2) ? sh.getDataRange().getValues() : [];
  for (let i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][0]) === empId && _sheetDate(rows[i][1]) === data) sh.deleteRow(i + 1);
  }

  if (godziny === null || godziny === '' || godziny === undefined) {
    _logAdmin('UrlopGodzinyReset', empId, data + ' → z powrotem wyliczenie automatyczne');
    return { ok: true };
  }
  const h = parseFloat(godziny);
  if (isNaN(h) || h < 0 || h > 24) return { ok: false, msg: 'Nieprawidłowa liczba godzin (0–24).' };

  sh.appendRow([empId, data, Math.round(h * 60), new Date().toISOString()]);
  _logAdmin('UrlopGodzinyOverride', empId, data + ' → ' + h + ' h (ręcznie)');
  return { ok: true };
}

// Przegląd normy na kilka lat do przodu naraz — punkt wyjścia do
// zaplanowania z góry, z jawnym rozróżnieniem które miesiące są
// wyliczone automatycznie, a które ktoś już ręcznie nadpisał.
const NORMA_LAT_MAX = 5;

function masterGetNormaLat(token, rokOd, iloscLat) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  const y1 = parseInt(rokOd, 10);
  const lat = Math.min(NORMA_LAT_MAX, Math.max(1, parseInt(iloscLat, 10) || NORMA_LAT_MAX));
  if (isNaN(y1)) return { ok: false, msg: 'Nieprawidłowy rok.' };

  const props = PropertiesService.getScriptProperties();
  const lata = [];
  for (let r = y1; r < y1 + lat; r++) {
    const miesiace = [];
    for (let m = 1; m <= 12; m++) {
      const key = 'etat_' + r + '_' + String(m).padStart(2, '0');
      const zapisana = props.getProperty(key);
      const godziny = (zapisana !== null) ? (parseFloat(zapisana) || 0) : _domyslnaNormaMiesiaca(r, m);
      miesiace.push({ miesiac: m, godziny, auto: zapisana === null });
    }
    lata.push({ rok: r, miesiace });
  }
  return { ok: true, lata };
}

// ── Zapis normy godzin ────────────────────────────────────────

function setEtat(token, year, month, hours) {
  if (!_dashOk(token)) {
    return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  }
  return _setEtatData(year, month, hours);
}

function masterSetEtat(token, year, month, hours) {
  if (!_masterOk(token)) {
    return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  }
  return _setEtatData(year, month, hours);
}

function _setEtatData(year, month, hours) {
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  const h = parseFloat(hours);
  if (isNaN(y) || isNaN(m) || isNaN(h) || h < 0 || h > 800) {
    return { ok: false, msg: 'Nieprawidłowe dane.' };
  }
  const key = 'etat_' + y + '_' + String(m).padStart(2, '0');
  PropertiesService.getScriptProperties().setProperty(key, String(h));
  _logAdmin('SetNorma', '—', 'Norma ' + y + '-' + String(m).padStart(2, '0') + ': ' + h + 'h');
  return { ok: true };
}

// ── Zapis adnotacji ───────────────────────────────────────────

function setNote(token, empId, year, month, note) {
  if (!_dashOk(token)) {
    return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  }
  return _setNoteData(empId, year, month, note);
}

function masterSetNote(token, empId, year, month, note) {
  if (!_masterOk(token)) {
    return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  }
  return _setNoteData(empId, year, month, note);
}

function _setNoteData(empId, year, month, note) {
  if (!empId) return { ok: false, msg: 'Brak danych.' };
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  if (isNaN(y) || isNaN(m)) return { ok: false, msg: 'Nieprawidłowy miesiąc.' };
  const key = 'note_' + String(empId) + '_' + y + '_' + String(m).padStart(2, '0');
  const text = String(note || '').slice(0, 500);
  PropertiesService.getScriptProperties().setProperty(key, text);
  _logAdmin('SetAdnotacja', String(empId), text.slice(0, 100));
  return { ok: true };
}

// ── Metadane do okna eksportu ──────────────────────────────────

function getExportMeta(token) {
  if (!_dashOk(token)) {
    return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  }
  return _exportMetaData();
}

function masterGetExportMeta(token) {
  if (!_masterOk(token)) {
    return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  }
  return _exportMetaData();
}

function _exportMetaData() {
  const { minDate } = _buildEwidMap();
  const today = _todayPL();
  const employees = _getWorkers()
    .filter(_isRcpWorker)
    .map(w => ({
      id: String(w[0]), imie: String(w[1]), nazwisko: String(w[2]),
      rola: String(w[3] || ''), grupa: _grupaZawodowa(w[3]), forma: String(w[6] || '')
    }));

  return {
    ok: true,
    earliest: minDate || today,
    today,
    employees,
    grupy: [
      { id: GRUPA_ASYSTENTKA, label: 'Asystentki' },
      { id: GRUPA_HIGIENISTKA, label: 'Higienistki' },
      { id: GRUPA_INNE, label: 'Rejestracja / pozostali' }
    ],
    formy: [
      { id: FORMA_UOP, label: 'Umowa o pracę' },
      { id: 'Zlecenie', label: 'Umowa zlecenie' },
      { id: 'B2B', label: 'B2B' }
    ]
  };
}

// ── Eksport Excel (arkusz na pracownika, zakres + filtr) ───────

function dashExportXlsx(token, opts) {
  if (!_dashOk(token)) {
    return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  }
  return _dashExportXlsxData(opts);
}

function masterDashExportXlsx(token, opts) {
  if (!_masterOk(token)) {
    return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  }
  return _dashExportXlsxData(opts);
}

function _dashExportXlsxData(opts) {
  opts = opts || {};

  let fromStr, toStr;
  if (opts.mode === 'range') {
    fromStr = String(opts.from || '');
    toStr   = String(opts.to || '');
  } else {
    const y = parseInt(opts.year, 10);
    const m = parseInt(opts.month, 10);
    if (isNaN(y) || isNaN(m) || m < 1 || m > 12) {
      return { ok: false, msg: 'Nieprawidłowy miesiąc.' };
    }
    const dim = new Date(y, m, 0).getDate();
    fromStr = y + '-' + String(m).padStart(2, '0') + '-01';
    toStr   = y + '-' + String(m).padStart(2, '0') + '-' + String(dim).padStart(2, '0');
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromStr) || !/^\d{4}-\d{2}-\d{2}$/.test(toStr) || fromStr > toStr) {
    return { ok: false, msg: 'Nieprawidłowy zakres dat.' };
  }

  let workers = _getWorkers().filter(_isRcpWorker);

  // Dodatkowe wymiary filtrowania — zawężają pulę PRZED wyborem konkretnych
  // osób, więc można je swobodnie łączyć z listą employeeIds.
  if (Array.isArray(opts.grupy) && opts.grupy.length) {
    const grupy = opts.grupy.map(String);
    workers = workers.filter(w => grupy.indexOf(_grupaZawodowa(w[3])) !== -1);
  }
  if (Array.isArray(opts.formy) && opts.formy.length) {
    const formy = opts.formy.map(String);
    workers = workers.filter(w => formy.indexOf(String(w[6] || '')) !== -1);
  }

  const wantedIds = Array.isArray(opts.employeeIds) && opts.employeeIds.length
    ? opts.employeeIds.map(String)
    : workers.map(w => String(w[0]));

  const selected = workers.filter(w => wantedIds.indexOf(String(w[0])) !== -1);
  if (selected.length === 0) {
    return { ok: false, msg: 'Nie wybrano żadnego pracownika (sprawdź filtry — mogły wykluczyć wszystkich).' };
  }

  const { map } = _buildEwidMap();
  const absMap   = _absenceMapAll();
  const ovrNotes = _overtimeNotesAll();
  const urlopOverrideAll = _urlopGodzinyOverrideAll();
  const urlopDomyslneCache = {}; // 'empId_rok_mies' -> mapa dnia->minuty, liczona raz na parę
  const DOW = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];

  const tmpName = 'WeSMILE_Raport_' + fromStr + '_' + toStr + '_' + Utilities.getUuid().slice(0, 8);
  const tmpSs = SpreadsheetApp.create(tmpName);
  const defaultSheet = tmpSs.getSheets()[0];

  // Zbiorcze wiersze do arkusza "Podsumowanie" — jeden wgląd na cały wybór
  // naraz, zamiast otwierania każdego arkusza osobno, żeby wyciągnąć wnioski.
  const podsumowanie = [];

  selected.forEach(w => {
    const id = String(w[0]);
    const forma = String(w[6] || '');
    const rawName = String(w[1]) + ' ' + String(w[2]);
    const safeName = rawName.replace(/[\\\/\?\*\[\]:]/g, ' ').slice(0, 90) || id;
    const sh = tmpSs.insertSheet(safeName);
    const header = ['Data', 'Dzień', 'Wejście', 'Wyjście', 'Godziny', 'Nieobecność', 'Uwagi'];
    sh.appendRow(header);

    let totalMins = 0, dniNieobecnosci = 0, dniPozaGodzinami = 0;
    const cursor = new Date(fromStr + 'T12:00:00');
    const end = new Date(toStr + 'T12:00:00');
    while (cursor <= end) {
      const ds = Utilities.formatDate(cursor, 'Europe/Warsaw', 'yyyy-MM-dd');
      // Dzień dzielony (wyjście i powrót) rozpisujemy jako "9:00, 17:00" /
       // "15:00, 18:00" w kolumnach Wejście/Wyjście, a Godziny to suma
      // sesji — inaczej eksport pokazywałby 9h zamiast faktycznych 7h.
      const sesje = _sesjeZOdbic(map[id + '_' + ds]);
      const wejscie = sesje.map(s => s.od).join(', ');
      const wyjscie = sesje.filter(s => s.do).map(s => s.do).join(', ');
      let godzTxt = '';
      const przepracowane = _minutyZSesji(sesje);
      if (przepracowane > 0) { totalMins += przepracowane; godzTxt = _fmtHM(przepracowane); }

      const abs = absMap[id + '_' + ds] || null;
      if (abs) dniNieobecnosci++;
      if (abs && forma === FORMA_UOP && PAID_8H_CODES.indexOf(abs.code) !== -1) {
        // Proporcjonalnie do brakujących godzin danego miesiąca (patrz
        // _urlopGodzinyUoPDomyslne), z uwzględnieniem ręcznego nadpisania —
        // ta sama zasada co w widoku Miesiąc, żeby liczby się zgadzały.
        const rok = parseInt(ds.slice(0, 4), 10), mies = parseInt(ds.slice(5, 7), 10);
        const cacheKey = id + '_' + rok + '_' + mies;
        if (!urlopDomyslneCache[cacheKey]) {
          urlopDomyslneCache[cacheKey] = _urlopGodzinyUoPDomyslne(id, forma, rok, mies, map, absMap);
        }
        const nadpisane = urlopOverrideAll[id + '_' + ds];
        const kredytMin = (nadpisane !== undefined) ? nadpisane : (urlopDomyslneCache[cacheKey][ds] || 0);
        totalMins += kredytMin;
        godzTxt = _fmtHM(kredytMin);
      }
      const uwagi = [];
      if (abs && abs.note) uwagi.push(abs.note);
      if (sesje.length > 1) uwagi.push('Dzielony czas pracy (' + sesje.length + ' sesje)');
      if (_dayOutsideClinicSesje(ds, sesje)) {
        dniPozaGodzinami++;
        const ovrNote = ovrNotes[id + '_' + ds] || '';
        uwagi.push('Poza godzinami Kliniki' + (ovrNote ? ': ' + ovrNote : ' (brak uzasadnienia)'));
      }

      sh.appendRow([ds, DOW[cursor.getDay()], wejscie, wyjscie, godzTxt,
                    abs ? abs.typ : '', uwagi.join(' | ')]);
      cursor.setDate(cursor.getDate() + 1);
    }

    sh.appendRow(['', '', '', 'RAZEM', _fmtHM(totalMins), '', '']);
    sh.getRange(1, 1, 1, header.length).setFontWeight('bold');
    sh.autoResizeColumns(1, header.length);

    podsumowanie.push([rawName, w[3] || '', forma || '—', _fmtHM(totalMins), dniNieobecnosci, dniPozaGodzinami]);
  });

  const podsumowaniaSh = tmpSs.insertSheet('Podsumowanie', 0);
  const podsumowanieHeader = ['Pracownik', 'Rola', 'Forma zatrudnienia', 'Suma godzin', 'Dni z nieobecnością', 'Dni poza godzinami Kliniki'];
  podsumowaniaSh.appendRow(podsumowanieHeader);
  podsumowanie.forEach(r => podsumowaniaSh.appendRow(r));
  podsumowaniaSh.getRange(1, 1, 1, podsumowanieHeader.length).setFontWeight('bold');
  podsumowaniaSh.autoResizeColumns(1, podsumowanieHeader.length);

  tmpSs.deleteSheet(defaultSheet);
  SpreadsheetApp.flush();

  const fileId = tmpSs.getId();
  const url = 'https://docs.google.com/spreadsheets/d/' + fileId + '/export?format=xlsx';
  const resp = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }
  });
  const b64 = Utilities.base64Encode(resp.getContent());

  try { DriveApp.getFileById(fileId).setTrashed(true); } catch (e) { Logger.log('cleanup error: ' + e); }

  _logAdmin('ExportXLSX', '—', 'Eksport ' + fromStr + ' — ' + toStr + ' (' + selected.length + ' os.)');

  return {
    ok: true,
    filename: 'WeSMILE_' + fromStr + '_' + toStr + '.xlsx',
    base64: b64
  };
}

// ── Pomocnicze — konwersja wartości z Sheets ──────────────────

function _t2m(t) {
  const p = String(t).split(':');
  return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
}

function _fmtHM(mins) {
  if (mins === null || mins === undefined || isNaN(mins)) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h + ':' + String(m).padStart(2, '0');
}

function _sheetDate(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Europe/Warsaw', 'yyyy-MM-dd');
  return String(v);
}

function _sheetTime(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Europe/Warsaw', 'HH:mm');
  const s = String(v);
  if (s !== '' && !isNaN(s) && s.indexOf(':') === -1) {
    const mins = Math.round(parseFloat(s) * 1440);
    return String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
  }
  return s;
}

// Buduje pełną mapę EmpID_Data -> {e:[], x:[]} z całej Ewidencji + najwcześniejszą datę
function _buildEwidMap() {
  const ewidSh = _ss().getSheetByName('Ewidencja');
  const rows = (ewidSh && ewidSh.getLastRow() >= 2)
    ? ewidSh.getDataRange().getValues().slice(1) : [];
  const map = {};
  let minDate = null;
  rows.forEach(r => {
    const ds = _sheetDate(r[5]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ds)) return;
    if (!minDate || ds < minDate) minDate = ds;
    const k = String(r[1]) + '_' + ds;
    if (!map[k]) map[k] = { e: [], x: [] };
    const akcja = String(r[4]).trim();
    const godz  = _sheetTime(r[6]);
    if (akcja === 'WEJSCIE') map[k].e.push(godz);
    else if (akcja === 'WYJSCIE') map[k].x.push(godz);
  });
  return { map, minDate };
}

function diagEwidencja() {
  const sh = _ss().getSheetByName('Ewidencja');
  if (!sh || sh.getLastRow() < 2) { Logger.log('Brak danych'); return; }
  const rows = sh.getDataRange().getValues().slice(1);
  Logger.log('Liczba wierszy: ' + rows.length);
  rows.forEach((r, i) => Logger.log('W' + (i+2) + ': emp=' + r[1] + ' akcja=' + r[4] +
    ' data=' + _sheetDate(r[5]) + ' godz=' + _sheetTime(r[6])));
}

// ============================================================
// Panel Właściciela (owner) — ręczna edycja czasu
// ============================================================

const MASTER_TTL = 3600;

function _masterOk(token) {
  if (!token) return false;
  const k = 'mo_' + String(token).slice(0, 50);
  if (_cache().get(k) !== '1') return false;
  _cache().put(k, '1', MASTER_TTL);
  return true;
}

function masterLogin(pin) {
  if (!pin || !/^\d{4}$/.test(String(pin))) {
    return { ok: false, msg: 'Nieprawidłowy PIN.' };
  }
  if (!_checkRate('mlog')) {
    return { ok: false, msg: 'Zbyt wiele prób. Odczekaj 5 minut.' };
  }
  const worker = _getWorkers().find(r => _pinMatch(r[5], pin));
  if (!worker || String(worker[3]).toLowerCase() !== 'admin') {
    return { ok: false, msg: 'Brak dostępu.' };
  }
  _resetRate('mlog');
  const token = Utilities.getUuid();
  _cache().put('mo_' + token, '1', MASTER_TTL);
  _logAdmin('MasterLogin', String(worker[0]), 'Zalogowano do panelu edycji: ' + worker[1] + ' ' + worker[2]);
  return { ok: true, token };
}

function masterGetEmployees(token) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  const employees = _getWorkers()
    .filter(w => String(w[4]).toLowerCase() === 'aktywny')
    .map(_workerToObj);
  return { ok: true, employees, tagiDostepne: DOCTOR_SPECIALIZATION_TAGS };
}

// Wspólne mapowanie wiersza arkusza na obiekt dla frontendu.
function _workerToObj(w) {
  const tagiRaw = String(w[7] || '').trim();
  return {
    id: String(w[0]),
    imie: String(w[1]),
    nazwisko: String(w[2]),
    rola: String(w[3]),
    status: String(w[4]),
    forma: String(w[6] || ''),
    tagi: tagiRaw ? tagiRaw.split(',').map(t => t.trim()).filter(t => t) : [],
    grupa: _grupaZawodowa(w[3]),
    maPin: !!String(w[5] == null ? '' : w[5]).trim()
  };
}

// ── Archiwum pracowników — usunięcie z zespołu = zmiana statusu,
// nigdy usunięcie wiersza. Historia (Ewidencja, Nieobecnosci, Logi)
// pozostaje nietknięta i wraca w pełni po przywróceniu. ──

function masterGetArchivedEmployees(token) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  const employees = _getWorkers()
    .filter(w => String(w[4]).toLowerCase() !== 'aktywny')
    .map(_workerToObj);
  return { ok: true, employees };
}

function masterRemoveEmployee(token, empId) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  if (!empId) return { ok: false, msg: 'Brak pracownika.' };

  const sh = _arkusz('Pracownicy', NAGLOWKI_PRACOWNICY);
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(empId)) {
      if (String(rows[i][3]).toLowerCase() === 'admin') {
        return { ok: false, msg: 'Nie można zarchiwizować konta Admina.' };
      }
      sh.getRange(i + 1, 5).setValue('Zarchiwizowany');
      _logAdmin('ArchiwizacjaPracownika', String(empId), rows[i][1] + ' ' + rows[i][2]);
      return { ok: true };
    }
  }
  return { ok: false, msg: 'Pracownik nie istnieje.' };
}

function masterRestoreEmployee(token, empId) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  if (!empId) return { ok: false, msg: 'Brak pracownika.' };

  const sh = _arkusz('Pracownicy', NAGLOWKI_PRACOWNICY);
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(empId)) {
      sh.getRange(i + 1, 5).setValue('Aktywny');
      _logAdmin('PrzywroceniePracownika', String(empId), rows[i][1] + ' ' + rows[i][2]);
      return { ok: true };
    }
  }
  return { ok: false, msg: 'Pracownik nie istnieje.' };
}

function masterAddEmployee(token, imie, nazwisko, rola, pin) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  imie = String(imie || '').trim();
  nazwisko = String(nazwisko || '').trim();
  rola = String(rola || '').trim();
  pin = String(pin || '').trim();

  if (!imie || !nazwisko) return { ok: false, msg: 'Podaj imię i nazwisko.' };

  // Lekarze nie odbijają się w RCP — PIN jest dla nich opcjonalny. Trzymamy ich
  // jednak w tej samej tabeli Pracownicy, żeby cała kadra miała spójną strukturę
  // (jedna lista, jedno archiwum, jedne nieobecności).
  const grupa = _grupaZawodowa(rola);
  const pinOptional = (grupa === GRUPA_LEKARZ);

  if (!pin && !pinOptional) {
    return { ok: false, msg: 'PIN musi mieć dokładnie 4 cyfry.' };
  }
  if (pin && !/^\d{4}$/.test(pin)) {
    return { ok: false, msg: 'PIN musi mieć dokładnie 4 cyfry.' };
  }

  const sh = _arkusz('Pracownicy', NAGLOWKI_PRACOWNICY);
  const rows = sh.getDataRange().getValues().slice(1);
  if (pin && rows.some(r => _pinMatch(r[5], pin))) {
    return { ok: false, msg: 'Ten PIN jest już używany przez innego pracownika.' };
  }

  let maxNum = 0;
  rows.forEach(r => {
    const m = String(r[0]).match(/^WS(\d+)$/);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  });
  const id = 'WS' + String(maxNum + 1).padStart(2, '0');

  sh.appendRow([id, imie, nazwisko, rola || '—', 'Aktywny', pin, '', '']);
  _logAdmin('DodaniePracownika', id, imie + ' ' + nazwisko + ' (' + (rola || '—') + ')');
  return {
    ok: true,
    employee: {
      id, imie, nazwisko, rola: rola || '—', status: 'Aktywny',
      forma: '', tagi: [], grupa
    }
  };
}

// ── Tagi specjalizacji lekarza ────────────────────────────────
// Lista wielokrotnego wyboru z DOCTOR_SPECIALIZATION_TAGS; zapisywana
// jako CSV w kolumnie 8. Zasila silnik rekomendacji grafiku.

function masterSetDoctorTags(token, empId, tags) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  if (!empId) return { ok: false, msg: 'Brak pracownika.' };

  const list = (Array.isArray(tags) ? tags : String(tags || '').split(','))
    .map(t => String(t).trim())
    .filter(t => t && DOCTOR_SPECIALIZATION_TAGS.indexOf(t) !== -1);

  const unique = [];
  list.forEach(t => { if (unique.indexOf(t) === -1) unique.push(t); });

  const sh = _arkusz('Pracownicy', NAGLOWKI_PRACOWNICY);
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(empId)) {
      sh.getRange(i + 1, 8).setValue(unique.join(', '));
      _logAdmin('SetTagiSpecjalizacji', String(empId), unique.join(', ') || '(wyczyszczono)');
      return { ok: true, tagi: unique };
    }
  }
  return { ok: false, msg: 'Pracownik nie istnieje.' };
}

// ── Forma zatrudnienia — edycja przez właściciela ──────────────
// Puste forma = "nieustawiona" (samoobsługa pokaże wtedy pełną listę
// typów nieobecności, a urlop nie doliczy godzin do sumy miesięcznej).

function masterSetEmploymentForm(token, empId, forma) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  if (!empId) return { ok: false, msg: 'Brak pracownika.' };
  forma = String(forma || '').trim();
  if (forma && EMPLOYMENT_FORMS.indexOf(forma) === -1) {
    return { ok: false, msg: 'Nieprawidłowa forma zatrudnienia.' };
  }

  const sh = _arkusz('Pracownicy', NAGLOWKI_PRACOWNICY);
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(empId)) {
      sh.getRange(i + 1, 7).setValue(forma);
      _logAdmin('SetFormaZatrudnienia', String(empId), forma || '(usunięto)');
      return { ok: true };
    }
  }
  return { ok: false, msg: 'Pracownik nie istnieje.' };
}

// ── Nieobecność w zakresie dat — edycja przez właściciela ──────
// Jeden pracownik, jeden zapis dla całego zakresu (zamiast dzień po dniu).
// Puste typeCode = usunięcie nieobecności w całym zakresie.

function masterSetAbsenceRange(token, empId, dateFrom, dateTo, typeCode, note) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  if (!empId) return { ok: false, msg: 'Wybierz pracownika.' };

  const re = /^\d{4}-\d{2}-\d{2}$/;
  dateFrom = String(dateFrom || '');
  dateTo   = String(dateTo || dateFrom);
  if (!re.test(dateFrom) || !re.test(dateTo) || dateFrom > dateTo) {
    return { ok: false, msg: 'Nieprawidłowy zakres dat.' };
  }

  const from = new Date(dateFrom + 'T12:00:00');
  const to   = new Date(dateTo + 'T12:00:00');
  const days = Math.round((to - from) / 86400000) + 1;
  if (days > ABSENCE_MAX_DAYS) {
    return { ok: false, msg: 'Maksymalny zakres to ' + ABSENCE_MAX_DAYS + ' dni.' };
  }

  const worker = _getWorkers().find(r => String(r[0]) === String(empId));
  if (!worker) return { ok: false, msg: 'Pracownik nie istnieje.' };

  typeCode = String(typeCode || '').trim();
  const type = typeCode ? _absType(typeCode) : null;
  if (typeCode && !type) return { ok: false, msg: 'Nieprawidłowy typ nieobecności.' };
  if (type && type.code === 'DW') {
    return { ok: false, msg: 'Ten typ jest zastrzeżony dla narzędzia „Dni wolne”.' };
  }

  note = String(note || '').trim().slice(0, 500);
  _upsertAbsence(String(empId), String(worker[1]), String(worker[2]), dateFrom, dateTo, type, note, 'admin_range');

  _logAdmin('MasterAbsenceRange', String(empId),
    dateFrom + ' — ' + dateTo + ' → ' + (type ? type.label : 'usunięto') + (note ? ' [' + note.slice(0, 80) + ']' : ''));

  // Rejestracja nieobecności (nie jej czyszczenie) automatycznie zdejmuje
  // osobę z grafiku w tym zakresie — patrz komentarz przy funkcji w Grafik.gs.
  let grafik = null;
  // Odbicia RCP zostawione w tym samym zakresie (np. ktoś się faktycznie
  // odbił, zanim urlop wpisano wstecznie) archiwizujemy i USUWAMY z
  // Ewidencji — inaczej raporty pokazywałyby jednocześnie "na urlopie"
  // i "w pracy" tego samego dnia. Archiwum jest w pełni odwracalne,
  // patrz masterGetWersjeOdbic/masterPrzywrocOdbicia.
  let archiwum = null;
  if (type) {
    grafik = _zdejmijZGrafikuNaNieobecnosc(token, String(empId), worker[1] + ' ' + worker[2], dateFrom, dateTo, type.label);
    archiwum = _zarchiwizujOdbiciaUrlopu(String(empId), String(worker[1]), String(worker[2]), dateFrom, dateTo,
      'Zastąpione urlopem (' + type.label + ') ' + dateFrom + '–' + dateTo);
  }

  return { ok: true, count: days, grafik, archiwum };
}

// ── Wersjonowanie odbić RCP zastąpionych urlopem ─────────────────
// Usuwane odbicia trafiają do EwidencjaWersje zanim znikną z Ewidencji —
// świadoma, odwracalna operacja, nie ciche kasowanie danych.

function _zarchiwizujOdbiciaUrlopu(empId, imie, nazwisko, dateFrom, dateTo, powod) {
  const ewidSh = _ss().getSheetByName('Ewidencja');
  const rows = (ewidSh && ewidSh.getLastRow() >= 2) ? ewidSh.getDataRange().getValues() : [];
  const doUsuniecia = []; // numery wierszy w arkuszu (1-based, wliczając nagłówek)
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (String(r[1]) !== empId) continue;
    const ds = _sheetDate(r[5]);
    if (ds < dateFrom || ds > dateTo) continue;
    doUsuniecia.push(i + 1);
  }
  if (!doUsuniecia.length) return null;

  const wersjaId = Utilities.getUuid();
  const wersjeSh = _arkusz('EwidencjaWersje',
    ['WersjaId', 'RowIdx', 'Timestamp', 'EmpID', 'Imie', 'Nazwisko', 'Akcja', 'Data', 'Godzina', 'Zrodlo', 'Powod', 'Przywrocono']);
  let idx = 0;
  doUsuniecia.forEach(wiersz => {
    const r = rows[wiersz - 1];
    wersjeSh.appendRow([wersjaId, idx++, r[0], r[1], r[2], r[3], r[4], _sheetDate(r[5]), _sheetTime(r[6]), String(r[7] || ''), powod, false]);
  });
  // Usuwamy od najwyższego numeru wiersza — inaczej kolejne usunięcia
  // przesuwałyby numerację wcześniej zapisanych do skasowania wierszy.
  doUsuniecia.slice().sort((a, b) => b - a).forEach(wiersz => ewidSh.deleteRow(wiersz));

  return { wersjaId, liczba: doUsuniecia.length };
}

// Lista zarchiwizowanych (jeszcze nieprzywróconych) partii odbić danego
// pracownika — do popupu z checkboxami w zakładce Urlop.
function masterGetWersjeOdbic(token, empId) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  if (!empId) return { ok: false, msg: 'Wybierz pracownika.' };

  const sh = _arkusz('EwidencjaWersje',
    ['WersjaId', 'RowIdx', 'Timestamp', 'EmpID', 'Imie', 'Nazwisko', 'Akcja', 'Data', 'Godzina', 'Zrodlo', 'Powod', 'Przywrocono']);
  const rows = (sh.getLastRow() >= 2) ? sh.getDataRange().getValues().slice(1) : [];

  const grupy = {};
  rows.forEach(r => {
    if (String(r[3]) !== String(empId)) return;
    if (r[11] === true || String(r[11]).toUpperCase() === 'TRUE') return; // już przywrócone — nie pokazuj ponownie
    const wid = String(r[0]);
    if (!grupy[wid]) grupy[wid] = { wersjaId: wid, powod: String(r[10] || ''), wiersze: [] };
    grupy[wid].wiersze.push({
      rowIdx: parseInt(r[1], 10), akcja: String(r[6]),
      data: _sheetDate(r[7]), godzina: _sheetTime(r[8])
    });
  });

  const lista = Object.keys(grupy).map(k => grupy[k]);
  lista.forEach(g => g.wiersze.sort((a, b) => (a.data + a.godzina).localeCompare(b.data + b.godzina)));
  lista.sort((a, b) => {
    const da = a.wiersze.length ? a.wiersze[0].data : '', db = b.wiersze.length ? b.wiersze[0].data : '';
    return db.localeCompare(da); // najnowsze partie pierwsze
  });

  return { ok: true, wersje: lista };
}

// Przywraca ZAZNACZONE wiersze jednej partii z powrotem do Ewidencji.
function masterPrzywrocOdbicia(token, wersjaId, rowIdxs) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  wersjaId = String(wersjaId || '');
  rowIdxs = (Array.isArray(rowIdxs) ? rowIdxs : []).map(x => parseInt(x, 10));
  if (!wersjaId || !rowIdxs.length) return { ok: false, msg: 'Nie wybrano żadnych odbić do przywrócenia.' };

  const sh = _arkusz('EwidencjaWersje',
    ['WersjaId', 'RowIdx', 'Timestamp', 'EmpID', 'Imie', 'Nazwisko', 'Akcja', 'Data', 'Godzina', 'Zrodlo', 'Powod', 'Przywrocono']);
  const rows = (sh.getLastRow() >= 2) ? sh.getDataRange().getValues() : [];
  const ewidSh = _arkusz('Ewidencja', ['Timestamp', 'EmpID', 'Imię', 'Nazwisko', 'Akcja', 'Data', 'Godzina', 'Źródło']);

  let przywrocone = 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (String(r[0]) !== wersjaId) continue;
    if (rowIdxs.indexOf(parseInt(r[1], 10)) === -1) continue;
    if (r[11] === true || String(r[11]).toUpperCase() === 'TRUE') continue; // już przywrócone

    ewidSh.appendRow([new Date().toISOString(), r[3], r[4], r[5], r[6], r[7], r[8], 'admin_restore']);
    sh.getRange(i + 1, 12).setValue(true);
    przywrocone++;
  }

  if (!przywrocone) return { ok: false, msg: 'Nic nie przywrócono (być może już przywrócone wcześniej).' };
  _logAdmin('PrzywrocOdbicia', wersjaId, przywrocone + ' odbić');
  return { ok: true, przywrocone };
}

function masterGetDay(token, empId, date) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  if (!empId || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
    return { ok: false, msg: 'Nieprawidłowe dane.' };
  }
  const ewidSh = _ss().getSheetByName('Ewidencja');
  const rows = (ewidSh && ewidSh.getLastRow() >= 2) ? ewidSh.getDataRange().getValues().slice(1) : [];
  const rec = { e: [], x: [] };
  rows.forEach(r => {
    if (String(r[1]) !== String(empId)) return;
    if (_sheetDate(r[5]) !== date) return;
    const akcja = String(r[4]).trim();
    const godz  = _sheetTime(r[6]);
    if (akcja === 'WEJSCIE') rec.e.push(godz);
    else if (akcja === 'WYJSCIE') rec.x.push(godz);
  });

  // Dzień może mieć kilka sesji (wyjście i powrót) — zwracamy pełną listę,
  // a wejscie/wyjscie zostają jako rama dnia dla widoków pokazujących
  // jedną, zbiorczą godzinę od-do.
  const sesje = _sesjeZOdbic(rec);
  const rama = _ramaDnia(sesje);
  const wejscie = rama.wejscie || '', wyjscie = rama.wyjscie || '';

  const key = String(empId) + '_' + date;
  const absence  = _absenceMapAll()[key] || null;
  const ovrNote  = _overtimeNotesAll()[key] || '';
  const overtime = _dayOutsideClinicSesje(date, sesje);

  const worker = _getWorkers().find(r => String(r[0]) === String(empId));
  const forma = worker ? String(worker[6] || '') : '';
  let urlopKredytGodz = null, urlopReczny = false;
  if (absence && forma === FORMA_UOP && PAID_8H_CODES.indexOf(absence.code) !== -1) {
    const rok = parseInt(date.slice(0, 4), 10), mies = parseInt(date.slice(5, 7), 10);
    const { map: ewidCaly } = _buildEwidMap();
    const domyslne = _urlopGodzinyUoPDomyslne(String(empId), forma, rok, mies, ewidCaly, _absenceMapAll());
    const nadpisane = _urlopGodzinyOverrideAll()[key];
    const kredytMin = (nadpisane !== undefined) ? nadpisane : (domyslne[date] || 0);
    urlopKredytGodz = Math.round((kredytMin / 60) * 100) / 100;
    urlopReczny = (nadpisane !== undefined);
  }

  return {
    ok: true, wejscie, wyjscie, sesje, absence, overtime, overtimeNote: ovrNote,
    minutyPracy: _minutyZSesji(sesje),
    formaUoP: forma === FORMA_UOP, urlopKredytGodz, urlopReczny
  };
}

/**
 * Zapisuje czas pracy dnia. Obsługuje DZIELONY czas pracy: `sesje` to
 * lista par [{od, do}] — np. 9:00–15:00 i 17:00–18:00 to dwie sesje w
 * jednym dniu. Gdy `sesje` nie podano, działa po staremu (jedna para
 * wejscie/wyjscie) — zachowuje zgodność ze starszymi wywołaniami.
 *
 * UWAGA: zapis ZASTĘPUJE wszystkie odbicia tego dnia. Wywołanie z jedną
 * parą dla dnia, który ma kilka sesji, skasowałoby pozostałe — dlatego
 * interfejsy edytujące pojedynczą parę (wiersz w Miesiącu) muszą najpierw
 * sprawdzić `dzielony` i odesłać do zakładki Dzień zamiast nadpisywać.
 */
function masterSetDay(token, empId, date, wejscie, wyjscie, sesje) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  if (!empId || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
    return { ok: false, msg: 'Nieprawidłowe dane.' };
  }

  const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
  const doZapisu = [];

  if (Array.isArray(sesje)) {
    for (let i = 0; i < sesje.length; i++) {
      const od = String((sesje[i] && sesje[i].od) || '').trim();
      const do_ = String((sesje[i] && sesje[i].do) || '').trim();
      if (!od && !do_) continue; // pusty wiersz — po prostu pomijamy
      if (od && !timeRe.test(od)) return { ok: false, msg: 'Sesja ' + (i + 1) + ': nieprawidłowy format wejścia (HH:MM).' };
      if (do_ && !timeRe.test(do_)) return { ok: false, msg: 'Sesja ' + (i + 1) + ': nieprawidłowy format wyjścia (HH:MM).' };
      if (od && do_ && _t2m(do_) <= _t2m(od)) {
        return { ok: false, msg: 'Sesja ' + (i + 1) + ': wyjście musi być późniejsze niż wejście.' };
      }
      doZapisu.push({ od: od, do: do_ });
    }
    // Sesje nie mogą na siebie nachodzić — inaczej ten sam czas liczyłby
    // się podwójnie w sumie godzin.
    const posort = doZapisu.filter(s => s.od).slice().sort((a, b) => _t2m(a.od) - _t2m(b.od));
    for (let i = 1; i < posort.length; i++) {
      const poprz = posort[i - 1];
      if (poprz.do && _t2m(posort[i].od) < _t2m(poprz.do)) {
        return { ok: false, msg: 'Sesje nachodzą na siebie (' + poprz.od + '–' + poprz.do + ' i ' + posort[i].od + '–' + (posort[i].do || '…') + ').' };
      }
    }
  } else {
    wejscie = String(wejscie || '').trim();
    wyjscie = String(wyjscie || '').trim();
    if (wejscie && !timeRe.test(wejscie)) return { ok: false, msg: 'Nieprawidłowy format wejścia (HH:MM).' };
    if (wyjscie && !timeRe.test(wyjscie)) return { ok: false, msg: 'Nieprawidłowy format wyjścia (HH:MM).' };
    if (wejscie || wyjscie) doZapisu.push({ od: wejscie, do: wyjscie });
  }

  const worker = _getWorkers().find(r => String(r[0]) === String(empId));
  if (!worker) return { ok: false, msg: 'Pracownik nie istnieje.' };

  const ewidSh = _ss().getSheetByName('Ewidencja');
  const lastRow = ewidSh.getLastRow();
  const rows = (lastRow >= 2) ? ewidSh.getDataRange().getValues().slice(1) : [];

  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    if (String(r[1]) === String(empId) && _sheetDate(r[5]) === date) {
      const akcja = String(r[4]).trim();
      if (akcja === 'WEJSCIE' || akcja === 'WYJSCIE') {
        ewidSh.deleteRow(i + 2);
      }
    }
  }

  const teraz = new Date().toISOString();
  doZapisu.forEach(s => {
    if (s.od) ewidSh.appendRow([teraz, String(empId), String(worker[1]), String(worker[2]), 'WEJSCIE', date, s.od, 'admin_override']);
    if (s.do) ewidSh.appendRow([teraz, String(empId), String(worker[1]), String(worker[2]), 'WYJSCIE', date, s.do, 'admin_override']);
  });

  const opis = doZapisu.length
    ? doZapisu.map(s => (s.od || '—') + '-' + (s.do || '—')).join(', ')
    : 'wyczyszczono';
  _logAdmin('MasterEdit', String(empId), date + ' → ' + opis);

  // Zwróć aktualny stan po edycji — flagę przekroczenia godzin Kliniki
  // i sumę faktycznie przepracowanych minut (suma sesji, bez przerw).
  const zapisaneSesje = doZapisu.map(s => ({ od: s.od || null, do: s.do || null }));
  return {
    ok: true,
    overtime: _dayOutsideClinicSesje(date, zapisaneSesje),
    minutyPracy: _minutyZSesji(zapisaneSesje),
    sesje: zapisaneSesje
  };
}

// ── Notatki sesji ──────────────────────────────────────────────
// Wolny tekst przypięty do konkretnej osoby i daty — kilka notatek
// dziennie, każda ze swoim czasem dodania. Aplikacja nie modeluje
// pacjentów jako osobnych rekordów (to system obecności/grafiku, nie
// kartoteka medyczna), więc notatka to zwykły dziennik zdarzeń zmiany,
// nie ustrukturyzowana wizyta.

function _shNotatkiDnia() {
  return _arkusz('NotatkiDnia', ['ID', 'EmpID', 'Data', 'Tresc', 'Utworzono']);
}

function masterGetNotatkiDnia(token, empId, data) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  if (!empId || !/^\d{4}-\d{2}-\d{2}$/.test(String(data))) return { ok: false, msg: 'Nieprawidłowe dane.' };
  const sh = _shNotatkiDnia();
  if (sh.getLastRow() < 2) return { ok: true, notatki: [] };
  const notatki = sh.getDataRange().getValues().slice(1)
    .filter(r => String(r[1]) === String(empId) && _sheetDate(r[2]) === data)
    .map(r => ({ id: String(r[0]), tresc: String(r[3] || ''), utworzono: String(r[4]) }))
    .sort((a, b) => a.utworzono < b.utworzono ? -1 : a.utworzono > b.utworzono ? 1 : 0);
  return { ok: true, notatki };
}

function masterAddNotatkaDnia(token, empId, data, tresc) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  if (!empId || !/^\d{4}-\d{2}-\d{2}$/.test(String(data))) return { ok: false, msg: 'Nieprawidłowe dane.' };
  tresc = String(tresc || '').trim().slice(0, 1000);
  if (!tresc) return { ok: false, msg: 'Wpisz treść notatki.' };

  const sh = _shNotatkiDnia();
  const rows = sh.getLastRow() >= 2 ? sh.getDataRange().getValues().slice(1) : [];
  const id = _nextId(rows.map(r => ({ id: String(r[0]) })), 'NT');
  const teraz = new Date().toISOString();
  sh.appendRow([id, String(empId), data, tresc, teraz]);
  _logAdmin('DodanieNotatkiDnia', String(empId), data + ': ' + tresc.slice(0, 60));
  return { ok: true, id, utworzono: teraz };
}

function masterDeleteNotatkaDnia(token, notatkaId) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  notatkaId = String(notatkaId || '');
  const sh = _shNotatkiDnia();
  const rows = sh.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][0]) === notatkaId) {
      sh.deleteRow(i + 1);
      _logAdmin('UsuniecieNotatkiDnia', notatkaId, '');
      return { ok: true };
    }
  }
  return { ok: false, msg: 'Nie znaleziono notatki.' };
}

// ── Timeline dnia ────────────────────────────────────────────
// Jeden chronologiczny widok tego, co dla danej osoby i daty już
// istnieje rozproszone po kilku arkuszach (Ewidencja, Nieobecnosci,
// Grafik/GrafikDni, Logi_Admin) plus nowe notatki — bez duplikowania
// żadnych z tych danych, to czysty odczyt i scalenie.

function masterGetTimelineDnia(token, empId, data) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  if (!empId || !/^\d{4}-\d{2}-\d{2}$/.test(String(data))) return { ok: false, msg: 'Nieprawidłowe dane.' };
  const worker = _getWorkers().find(r => String(r[0]) === String(empId));
  if (!worker) return { ok: false, msg: 'Pracownik nie istnieje.' };

  const zdarzenia = [];

  const ewidSh = _ss().getSheetByName('Ewidencja');
  const ewidRows = (ewidSh && ewidSh.getLastRow() >= 2) ? ewidSh.getDataRange().getValues().slice(1) : [];
  const przerwyNotes = _przerwyNotesAll();
  const AKCJA_TYTUL = { WEJSCIE: 'Wejście', WYJSCIE: 'Wyjście', PRZERWA_START: 'Start przerwy', PRZERWA_KONIEC: 'Koniec przerwy' };
  ewidRows.forEach(r => {
    if (String(r[1]) !== String(empId) || _sheetDate(r[5]) !== data) return;
    const akcja = String(r[4]).trim();
    const godz  = _sheetTime(r[6]);
    let opis = String(r[7] || '') === 'admin_override' ? 'skorygowane ręcznie' : '';
    if (akcja === 'PRZERWA_START') opis = przerwyNotes[String(empId) + '_' + data + '_' + godz] || '';
    zdarzenia.push({
      czas: data + 'T' + godz + ':00',
      typ: 'rcp',
      tytul: AKCJA_TYTUL[akcja] || akcja,
      opis: opis
    });
  });

  const absencja = _absenceMapAll()[String(empId) + '_' + data];
  if (absencja) {
    zdarzenia.push({ czas: data + 'T00:00:01', typ: 'nieobecnosc', tytul: 'Nieobecność', opis: absencja.typ + (absencja.note ? ' — ' + absencja.note : '') });
  }

  const ovrNote = _overtimeNotesAll()[String(empId) + '_' + data];
  if (ovrNote) {
    zdarzenia.push({ czas: data + 'T23:59:57', typ: 'nadgodziny', tytul: 'Uzasadnienie nadgodzin', opis: ovrNote });
  }

  // Bloki grafiku tego dnia (jeśli osoba ma tam obsadę — głównie lekarze/higienistki).
  try {
    const y = parseInt(data.slice(0, 4), 10), m = parseInt(data.slice(5, 7), 10);
    const mies = masterGrafikMiesiac(token, y, m);
    if (mies.ok) {
      const dz = mies.dni.find(x => x.data === data);
      if (dz) {
        (dz.bloki || []).forEach(b => {
          if (String(b.osobaId) === String(empId)) {
            const gab = (mies.gabinety.find(g => g.id === b.gabinetId) || {}).nazwa || b.gabinetId;
            zdarzenia.push({ czas: data + 'T' + b.od + ':00', typ: 'grafik', tytul: 'Blok w grafiku: ' + gab, opis: b.od + '–' + b.do + (b.typ === 'Higienizacja' ? ' · higienizacja' : '') });
          }
          (b.asysta || []).forEach(a => {
            if (String(a.osobaId) === String(empId)) {
              const gab = (mies.gabinety.find(g => g.id === b.gabinetId) || {}).nazwa || b.gabinetId;
              zdarzenia.push({ czas: data + 'T' + (a.od || b.od) + ':00', typ: 'grafik', tytul: 'Asysta: ' + gab, opis: (a.od || b.od) + '–' + (a.do || b.do) });
            }
          });
        });
      }
    }
  } catch (e) { /* grafik nie jest krytyczny dla timeline — pomijamy po cichu przy błędzie */ }

  const logSh = _ss().getSheetByName('Logi_Admin');
  const logRows = (logSh && logSh.getLastRow() >= 2) ? logSh.getDataRange().getValues().slice(1) : [];
  logRows.forEach(r => {
    if (String(r[2]) !== String(empId)) return;
    const czasIso = String(r[0]);
    if (!czasIso.startsWith(data)) return;
    zdarzenia.push({ czas: czasIso, typ: 'log', tytul: String(r[1]), opis: String(r[3] || '') });
  });

  const notatkiRes = masterGetNotatkiDnia(token, empId, data);
  (notatkiRes.notatki || []).forEach(n => {
    zdarzenia.push({ czas: n.utworzono, typ: 'notatka', tytul: 'Notatka', opis: n.tresc, notatkaId: n.id });
  });

  zdarzenia.sort((a, b) => a.czas < b.czas ? -1 : a.czas > b.czas ? 1 : 0);
  return { ok: true, zdarzenia };
}

// ── Nieobecność — edycja przez właściciela ────────────────────
// Puste typeCode = usunięcie nieobecności danego dnia.

function masterSetAbsence(token, empId, date, typeCode, note) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  if (!empId || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
    return { ok: false, msg: 'Nieprawidłowe dane.' };
  }
  const worker = _getWorkers().find(r => String(r[0]) === String(empId));
  if (!worker) return { ok: false, msg: 'Pracownik nie istnieje.' };

  typeCode = String(typeCode || '').trim();
  note = String(note || '').trim().slice(0, 500);

  if (!typeCode) {
    _upsertAbsence(String(empId), String(worker[1]), String(worker[2]), date, date, null, '', 'admin_override');
    _logAdmin('MasterAbsence', String(empId), date + ' → usunięto nieobecność');
    return { ok: true };
  }

  const type = _absType(typeCode);
  if (!type) return { ok: false, msg: 'Nieprawidłowy typ nieobecności.' };

  _upsertAbsence(String(empId), String(worker[1]), String(worker[2]), date, date, type, note, 'admin_override');
  _logAdmin('MasterAbsence', String(empId), date + ' → ' + type.label + (note ? ' [' + note.slice(0, 80) + ']' : ''));
  return { ok: true };
}

// ── Uzasadnienie przekroczenia — edycja przez właściciela ─────
// Puste note = usunięcie uzasadnienia danego dnia.

function masterSetOvertimeNote(token, empId, date, note) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  if (!empId || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
    return { ok: false, msg: 'Nieprawidłowe dane.' };
  }
  note = String(note || '').trim().slice(0, 500);
  _saveOvertimeNote(String(empId), String(date), note, 'admin_override');
  _logAdmin('MasterOvertimeNote', String(empId), date + ' → ' + (note ? note.slice(0, 80) : 'usunięto uzasadnienie'));
  return { ok: true };
}

// ── Dzień wolny dla całej Kliniki — masowe oznaczenie ──────────
// Odrębne od edycji pojedynczego pracownika: jednym zapisem
// oznacza (lub czyści, gdy typeCode puste) nieobecność wszystkich
// aktywnych pracowników w podanym zakresie dat. Nie dotyka godzin
// w Ewidencji — tylko warstwy Nieobecnosci.

function masterSetClinicDayOff(token, dateFrom, dateTo, typeCode, note) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };

  const re = /^\d{4}-\d{2}-\d{2}$/;
  dateFrom = String(dateFrom || '');
  dateTo   = String(dateTo || dateFrom);
  if (!re.test(dateFrom) || !re.test(dateTo) || dateFrom > dateTo) {
    return { ok: false, msg: 'Nieprawidłowy zakres dat.' };
  }

  const from = new Date(dateFrom + 'T12:00:00');
  const to   = new Date(dateTo + 'T12:00:00');
  const days = Math.round((to - from) / 86400000) + 1;
  if (days > ABSENCE_MAX_DAYS) {
    return { ok: false, msg: 'Maksymalny zakres to ' + ABSENCE_MAX_DAYS + ' dni.' };
  }

  typeCode = String(typeCode || '').trim();
  const type = typeCode ? _absType(typeCode) : null;
  if (typeCode && !type) return { ok: false, msg: 'Nieprawidłowy typ.' };

  note = String(note || '').trim().slice(0, 500);

  const workers = _getWorkers().filter(_isRcpWorker);
  workers.forEach(w => {
    _upsertAbsence(String(w[0]), String(w[1]), String(w[2]), dateFrom, dateTo, type, note, 'admin_bulk');
  });

  _logAdmin('MasterBulkDayOff', '—',
    dateFrom + ' — ' + dateTo + ' → ' + (type ? type.label : 'usunięto') +
    ' (' + workers.length + ' os.)' + (note ? ' [' + note.slice(0, 80) + ']' : ''));

  return { ok: true, count: workers.length };
}

// ── Kalendarz świąt ustawowo wolnych od pracy (10 lat z góry) ─
// Wszystkie 13 polskich świąt ustawowych — daty wyliczane, nie wpisywane
// ręcznie, więc lista jest dokładna na dowolny rok bez utrzymywania jej
// co roku. Ruchome święta (zależne od Wielkanocy) liczone algorytmem
// Meeusa/Jonesa/Butchera (kalendarz gregoriański) — zweryfikowanym wobec
// znanych dat Wielkanocy 2024–2036 przed wdrożeniem.
//
// Zastosowanie święta = to samo co ręczne „Dni wolne" (masterSetClinicDayOff)
// dla jednego dnia — tylko przygotowane z góry, żeby nie wpisywać 130 dat
// ręcznie. Które daty są już zastosowane, pamiętamy w ScriptProperties
// (ten sam wzorzec, co _dniPusteAll w Grafik.gs) — nie w samej Nieobecnosci,
// bo tamta warstwa nie odróżnia „to było święto" od zwykłego urlopu.

function _wielkanocData(rok) {
  const a = rok % 19, b = Math.floor(rok / 100), c = rok % 100;
  const d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const miesiac = Math.floor((h + l - 7 * m + 114) / 31);
  const dzien = ((h + l - 7 * m + 114) % 31) + 1;
  return rok + '-' + String(miesiac).padStart(2, '0') + '-' + String(dzien).padStart(2, '0');
}

function _dataPlusDni(ds, dni) {
  const d = new Date(ds + 'T12:00:00');
  d.setDate(d.getDate() + dni);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function _swietaDlaRoku(rok) {
  const wielkanoc = _wielkanocData(rok);
  return [
    { data: rok + '-01-01', nazwa: 'Nowy Rok' },
    { data: rok + '-01-06', nazwa: 'Święto Trzech Króli' },
    { data: wielkanoc, nazwa: 'Niedziela Wielkanocna', ruchome: true },
    { data: _dataPlusDni(wielkanoc, 1), nazwa: 'Poniedziałek Wielkanocny', ruchome: true },
    { data: rok + '-05-01', nazwa: 'Święto Pracy' },
    { data: rok + '-05-03', nazwa: 'Święto Konstytucji 3 Maja' },
    { data: _dataPlusDni(wielkanoc, 49), nazwa: 'Zielone Świątki', ruchome: true },
    { data: _dataPlusDni(wielkanoc, 60), nazwa: 'Boże Ciało', ruchome: true },
    { data: rok + '-08-15', nazwa: 'Wniebowzięcie Najświętszej Maryi Panny' },
    { data: rok + '-11-01', nazwa: 'Wszystkich Świętych' },
    { data: rok + '-11-11', nazwa: 'Narodowe Święto Niepodległości' },
    { data: rok + '-12-25', nazwa: 'Boże Narodzenie (I dzień)' },
    { data: rok + '-12-26', nazwa: 'Boże Narodzenie (II dzień)' }
  ];
}

function _swietaZastosowaneAll() {
  const props = PropertiesService.getScriptProperties();
  try { return JSON.parse(props.getProperty('swieta_zastosowane') || '[]'); }
  catch (e) { return []; }
}
function _zapiszSwietaZastosowane(lista) {
  PropertiesService.getScriptProperties().setProperty('swieta_zastosowane', JSON.stringify(lista.slice(0, 500)));
}

const SWIETA_LAT_MAX = 10;

function masterGetSwieta(token, rokOd, rokDo) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  const y1 = parseInt(rokOd, 10), y2 = parseInt(rokDo, 10);
  if (isNaN(y1) || isNaN(y2) || y1 > y2 || (y2 - y1) >= SWIETA_LAT_MAX) {
    return { ok: false, msg: 'Nieprawidłowy zakres lat.' };
  }
  const zastosowane = _swietaZastosowaneAll();
  const lata = [];
  for (let r = y1; r <= y2; r++) {
    const dni = _swietaDlaRoku(r).map(s => Object.assign({}, s,
      { zastosowano: zastosowane.indexOf(s.data) !== -1 }));
    lata.push({ rok: r, dni });
  }
  return { ok: true, lata };
}

function masterZastosujSwieto(token, data, nazwa, typeCode) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data))) return { ok: false, msg: 'Nieprawidłowa data.' };
  if (!String(typeCode || '').trim()) return { ok: false, msg: 'Wybierz typ dnia wolnego.' };
  const wynik = masterSetClinicDayOff(token, data, data, typeCode, String(nazwa || '').trim().slice(0, 200));
  if (!wynik.ok) return wynik;
  const zastosowane = _swietaZastosowaneAll();
  if (zastosowane.indexOf(data) === -1) { zastosowane.push(data); _zapiszSwietaZastosowane(zastosowane); }
  return wynik;
}

function masterCofnijSwieto(token, data) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data))) return { ok: false, msg: 'Nieprawidłowa data.' };
  const wynik = masterSetClinicDayOff(token, data, data, '', '');
  if (!wynik.ok) return wynik;
  _zapiszSwietaZastosowane(_swietaZastosowaneAll().filter(d => d !== data));
  return wynik;
}

function masterZastosujSwietaRoku(token, rok, typeCode) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  const r = parseInt(rok, 10);
  if (isNaN(r)) return { ok: false, msg: 'Nieprawidłowy rok.' };
  if (!String(typeCode || '').trim()) return { ok: false, msg: 'Wybierz typ dnia wolnego.' };
  const zastosowane = _swietaZastosowaneAll();
  const dni = _swietaDlaRoku(r);
  let zastosowano = 0;
  dni.forEach(s => {
    if (zastosowane.indexOf(s.data) !== -1) return;
    const wynik = masterSetClinicDayOff(token, s.data, s.data, typeCode, s.nazwa);
    if (wynik.ok) { zastosowane.push(s.data); zastosowano++; }
  });
  _zapiszSwietaZastosowane(zastosowane);
  return { ok: true, zastosowano };
}

function masterGetMonth(token, empId, year, month) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  if (!empId || isNaN(y) || isNaN(m) || m < 1 || m > 12) {
    return { ok: false, msg: 'Nieprawidłowe dane.' };
  }
  const worker = _getWorkers().find(r => String(r[0]) === String(empId));
  if (!worker) return { ok: false, msg: 'Pracownik nie istnieje.' };

  const daysInMonth = new Date(y, m, 0).getDate();
  const pfx = y + '-' + String(m).padStart(2, '0');
  const ewidSh = _ss().getSheetByName('Ewidencja');
  const rows = (ewidSh && ewidSh.getLastRow() >= 2) ? ewidSh.getDataRange().getValues().slice(1) : [];

  const map = {};
  rows.forEach(r => {
    if (String(r[1]) !== String(empId)) return;
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

  const DOW = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];
  const days = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const ds  = pfx + '-' + String(d).padStart(2, '0');
    const sesje = _sesjeZOdbic(map[ds]);
    const rama = _ramaDnia(sesje);
    const wejscie = rama.wejscie || '', wyjscie = rama.wyjscie || '';
    const dow = DOW[new Date(ds + 'T12:00:00').getDay()];
    const key = String(empId) + '_' + ds;
    days.push({
      date: ds, dow, wejscie, wyjscie,
      sesje: sesje, dzielony: sesje.length > 1,
      minutyPracy:     _minutyZSesji(sesje),
      absence:         absMap[key] || null,
      overtime:        _dayOutsideClinicSesje(ds, sesje),
      overtimeMinutes: _overtimeMinutesSesje(ds, sesje),
      overtimeNote:    ovrNotes[key] || ''
    });
  }

  return { ok: true, imie: String(worker[1]), nazwisko: String(worker[2]), days };
}

// ── Obecność całego zespołu w jednym miejscu — kalendarz miesiąca ──
// Każdy dzień: lista pracowników, którzy tego dnia mieli jakiekolwiek
// zdarzenie RCP (odbicie i/lub nieobecność). Pracownik bez żadnego
// zdarzenia po prostu nie pojawia się w liście danego dnia — pusty
// dzień (nikt nie pracował, np. niedziela) to po prostu pusta lista,
// interfejs pokazuje wtedy jawne „—”, zgodnie z zasadą: brak
// obecności ma być jednoznacznie widoczny, nie domyślać się z pustki.

function masterGetObecnoscMiesiac(token, rok, mies) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  const y = parseInt(rok, 10), m = parseInt(mies, 10);
  if (isNaN(y) || isNaN(m) || m < 1 || m > 12) return { ok: false, msg: 'Nieprawidłowy miesiąc.' };

  const pracownicy = _getWorkers().filter(_isRcpWorker).map(_workerToObj);
  const ewid = _buildEwidMap().map;
  const absMap = _absenceMapAll();

  const ile = new Date(y, m, 0).getDate();
  const pfx = y + '-' + String(m).padStart(2, '0') + '-';
  const DOW = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];
  const dni = [];

  for (let d = 1; d <= ile; d++) {
    const ds = pfx + String(d).padStart(2, '0');
    const dow = new Date(ds + 'T12:00:00').getDay();
    const czynny = !!_clinicHoursFor(ds);
    const osoby = [];

    pracownicy.forEach(p => {
      const absencja = absMap[p.id + '_' + ds] || null;
      const sesje = _sesjeZOdbic(ewid[p.id + '_' + ds]);
      const rama = _ramaDnia(sesje);
      const wejscie = rama.wejscie, wyjscie = rama.wyjscie;
      if (!wejscie && !wyjscie && !absencja) return; // nic do pokazania dla tej osoby tego dnia

      const przepracowane = _minutyZSesji(sesje);
      osoby.push({
        empId: p.id, imie: p.imie, nazwisko: p.nazwisko,
        inicjaly: (p.imie.charAt(0) || '') + (p.nazwisko.charAt(0) || ''),
        grupa: p.grupa,
        wejscie, wyjscie,
        sesje: sesje, dzielony: sesje.length > 1,
        minutyPracy: przepracowane > 0 ? przepracowane : null,
        absencja: absencja ? { code: absencja.code, typ: absencja.typ } : null,
        overtime: _dayOutsideClinicSesje(ds, sesje)
      });
    });

    osoby.sort((a, b) => (a.wejscie || '99:99').localeCompare(b.wejscie || '99:99'));
    dni.push({ data: ds, dzienTygodnia: dow, nazwaDnia: DOW[dow], czynny, osoby });
  }

  return { ok: true, rok: y, mies: m, pracownicyLiczba: pracownicy.length, dni };
}

// ── Dashboard zbiorczy strony głównej (#62) ───────────────────────
// Zbiorcze liczby dla całego zespołu RCP naraz — nie rozbite na osoby
// (do tego służy Obecność zespołu / Raporty, "zobacz pełną obecność"
// prowadzi właśnie tam). Świadomie oparte na _dashboardData zamiast
// osobnego przejścia po Ewidencji — jedno źródło prawdy dla sum
// miesięcznych, ten sam wynik co w widoku Miesiąc dla każdej osoby.

function masterGetHomeDashboard(token, rok, mies) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  const y = parseInt(rok, 10), m = parseInt(mies, 10);
  if (isNaN(y) || isNaN(m) || m < 1 || m > 12) return { ok: false, msg: 'Nieprawidłowy miesiąc.' };

  const dane = _dashboardData(y, m);
  if (!dane.ok) return dane;

  const grupaById = {};
  _getWorkers().forEach(w => { grupaById[String(w[0])] = _grupaZawodowa(w[3]); });

  const GRUPA_LABEL = { asystentka: 'Asystentki', higienistka: 'Higienistki', inne: 'Rejestracja / pozostali' };
  const perRolaMap = {};
  let sumaMin = 0, sumaOvrMin = 0, sumaOvrDni = 0;

  dane.employees.forEach(p => {
    sumaMin += p.totalMinutes;
    sumaOvrMin += p.ovrMinutes;
    sumaOvrDni += p.ovrDays;
    const grupa = grupaById[p.id] || 'inne';
    if (!perRolaMap[grupa]) perRolaMap[grupa] = { grupa, label: GRUPA_LABEL[grupa] || grupa, minuty: 0, osob: 0 };
    perRolaMap[grupa].minuty += p.totalMinutes;
    perRolaMap[grupa].osob++;
  });

  const ileDni = new Date(y, m, 0).getDate();
  const pfx = y + '-' + String(m).padStart(2, '0') + '-';
  const trend = [];
  for (let d = 1; d <= ileDni; d++) {
    const ds = pfx + String(d).padStart(2, '0');
    let minutyDnia = 0;
    dane.employees.forEach(p => {
      const dzien = p.days.find(x => x.date === ds);
      if (dzien && dzien.mins) minutyDnia += dzien.mins;
    });
    trend.push({ data: ds, minuty: minutyDnia });
  }

  const dzisiaj = _todayPL();
  const aktywniDzis = _activeNowData().active.length;
  const absMap = _absenceMapAll();
  const naUrlopieDzis = dane.employees.filter(p => absMap[p.id + '_' + dzisiaj]).length;

  const liczbaOsob = dane.employees.length;
  return {
    ok: true, rok: y, mies: m,
    pracownicyLiczba: liczbaOsob,
    sumaGodzin: Math.round((sumaMin / 60) * 10) / 10,
    sredniaGodzinNaOsobe: liczbaOsob ? Math.round((sumaMin / liczbaOsob / 60) * 10) / 10 : 0,
    ovrDni: sumaOvrDni,
    ovrGodzin: Math.round((sumaOvrMin / 60) * 10) / 10,
    aktywniDzis, naUrlopieDzis,
    perRola: Object.keys(perRolaMap).map(k => {
      const r = perRolaMap[k];
      return { grupa: r.grupa, label: r.label, godziny: Math.round((r.minuty / 60) * 10) / 10, osob: r.osob };
    }),
    trend
  };
}

// ── Strona główna: dodatkowe informacje/rekomendacje (#68) ─────────
// Nie jeden statyczny tekst, tylko silnik reguł nad realnymi danymi
// zespołu (bieżący miesiąc + porównanie do średniej z ostatnich 3) —
// każda reguła osobno decyduje, czy ma coś do powiedzenia w TYM
// konkretnym miesiącu, więc lista pokazuje tylko to, co faktycznie się
// wydarzyło, a nie 30 pustych "wszystko w normie". Część reguł jest
// sparametryzowana po roli/dniu tygodnia, więc jedna reguła w kodzie
// realnie generuje kilka niezależnych, konkretnych komunikatów.
function masterHomeInsighty(token, rok, mies) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  const y = parseInt(rok, 10), m = parseInt(mies, 10);
  if (isNaN(y) || isNaN(m) || m < 1 || m > 12) return { ok: false, msg: 'Nieprawidłowy miesiąc.' };

  const dane = _dashboardData(y, m);
  if (!dane.ok) return dane;

  // Trzy poprzednie miesiące — jedyne źródło porównań "vs średnia".
  const historia = [];
  let hy = y, hm = m;
  for (let i = 0; i < 3; i++) {
    hm--; if (hm < 1) { hm = 12; hy--; }
    const d = _dashboardData(hy, hm);
    if (d.ok) historia.push(d);
  }

  const out = [];
  function dodaj(tekst, waga) { out.push({ tekst: tekst, waga: waga || 'info' }); }
  const h1 = n => Math.round(n * 10) / 10;
  function sredniaHist(fn) {
    if (!historia.length) return null;
    return historia.reduce((s, d) => s + fn(d), 0) / historia.length;
  }
  function sumaGodzMies(d) { return d.employees.reduce((s, p) => s + p.totalMinutes, 0) / 60; }
  function sumaOvrDniMies(d) { return d.employees.reduce((s, p) => s + p.ovrDays, 0); }

  const grupaById = {};
  _getWorkers().forEach(w => { grupaById[String(w[0])] = _grupaZawodowa(w[3]); });
  const GRUPA_LABEL = { lekarz: 'Lekarze', asystentka: 'Asystentki', higienistka: 'Higienistki', inne: 'Rejestracja / pozostali' };

  const perRolaMin = {}, perRolaOsob = {};
  dane.employees.forEach(p => {
    const g = grupaById[p.id] || 'inne';
    perRolaMin[g] = (perRolaMin[g] || 0) + p.totalMinutes;
    perRolaOsob[g] = (perRolaOsob[g] || 0) + 1;
  });
  const sumaMin = dane.employees.reduce((s, p) => s + p.totalMinutes, 0);
  const sumaGodz = h1(sumaMin / 60);
  const sumaOvrDni = dane.employees.reduce((s, p) => s + p.ovrDays, 0);
  const sumaOvrMin = dane.employees.reduce((s, p) => s + p.ovrMinutes, 0);
  const liczbaOsob = dane.employees.length;

  // 1) Suma godzin zespołu vs średnia z ostatnich 3 mies.
  const histSumaGodz = sredniaHist(sumaGodzMies);
  if (histSumaGodz != null && histSumaGodz > 1) {
    const roznica = sumaGodz - histSumaGodz;
    if (Math.abs(roznica) >= 5) {
      const proc = Math.round(Math.abs(roznica) / histSumaGodz * 100);
      dodaj(sumaGodz + 'h zespołu — to ' + (roznica > 0 ? 'o ' + h1(roznica) + 'h więcej' : 'o ' + h1(-roznica) + 'h mniej') +
        ' niż średnia z ostatnich ' + historia.length + ' mies. (' + proc + '%).',
        Math.abs(roznica) > histSumaGodz * 0.25 ? 'wazna' : 'info');
    }
  }

  // 2) Per rola: godziny tej roli vs średnia z ostatnich 3 mies. TEJ SAMEJ roli.
  Object.keys(perRolaMin).forEach(g => {
    const godzTejRoli = h1(perRolaMin[g] / 60);
    const histTejRoli = sredniaHist(d => {
      let suma = 0;
      d.employees.forEach(p => { if ((grupaById[p.id] || 'inne') === g) suma += p.totalMinutes; });
      return suma / 60;
    });
    if (histTejRoli != null && histTejRoli > 1) {
      const roznica = godzTejRoli - histTejRoli;
      if (Math.abs(roznica) >= 3) {
        dodaj((GRUPA_LABEL[g] || g) + ': ' + godzTejRoli + 'h w tym miesiącu, ' +
          (roznica > 0 ? 'o ' + h1(roznica) + 'h więcej' : 'o ' + h1(-roznica) + 'h mniej') + ' niż zwykle.', 'info');
      }
    }
  });

  // 3) Per rola: udział % w całości godzin zespołu.
  Object.keys(perRolaMin).forEach(g => {
    if (sumaMin <= 0) return;
    const proc = Math.round(perRolaMin[g] / sumaMin * 100);
    dodaj((GRUPA_LABEL[g] || g) + ' odpowiadają za ' + proc + '% wszystkich przepracowanych godzin zespołu w tym miesiącu.', 'info');
  });

  // 4) Per rola: średnia godzin na osobę w tej roli.
  Object.keys(perRolaMin).forEach(g => {
    if (!perRolaOsob[g]) return;
    dodaj('Średnio ' + h1(perRolaMin[g] / 60 / perRolaOsob[g]) + 'h/osobę wśród: ' + (GRUPA_LABEL[g] || g).toLowerCase() + '.', 'info');
  });

  // 5) Liczba dni z nadgodzinami vs średnia z 3 mies.
  const histOvrDni = sredniaHist(sumaOvrDniMies);
  if (histOvrDni != null) {
    const roznica = sumaOvrDni - histOvrDni;
    if (Math.abs(roznica) >= 2) {
      dodaj(sumaOvrDni + ' dni z nadgodzinami w tym miesiącu — ' +
        (roznica > 0 ? 'o ' + Math.round(roznica) + ' więcej' : 'o ' + Math.round(-roznica) + ' mniej') + ' niż średnio.',
        roznica > 0 ? 'wazna' : 'info');
    }
  }

  // 6) Nadgodziny jako % wszystkich przepracowanych godzin.
  if (sumaMin > 0 && sumaOvrMin > 0) {
    const proc = Math.round(sumaOvrMin / sumaMin * 100);
    if (proc >= 3) dodaj('Nadgodziny stanowią ' + proc + '% wszystkich przepracowanych godzin zespołu.', proc >= 10 ? 'krytyczna' : 'wazna');
  }

  // 7) Osoba z największą liczbą nadgodzin.
  const topOvr = dane.employees.slice().sort((a, b) => b.ovrMinutes - a.ovrMinutes)[0];
  if (topOvr && topOvr.ovrMinutes > 0) {
    dodaj(topOvr.imie + ' ' + topOvr.nazwisko + ' ma najwięcej nadgodzin w zespole: ' + topOvr.ovrHours + 'h (' + topOvr.ovrDays + ' dni).',
      topOvr.ovrHours >= 10 ? 'krytyczna' : 'info');
  }

  // 8) Osoba z najwyższą liczbą przepracowanych godzin.
  const topGodz = dane.employees.slice().sort((a, b) => b.totalMinutes - a.totalMinutes)[0];
  if (topGodz && topGodz.totalMinutes > 0) {
    dodaj(topGodz.imie + ' ' + topGodz.nazwisko + ' przepracował(a) najwięcej godzin w tym miesiącu: ' + topGodz.totalHours + 'h.', 'info');
  }

  // 9) Osoby z zerową liczbą godzin mimo braku nieobecności (możliwy błąd danych).
  const zeroBezAbsencji = dane.employees.filter(p => p.totalMinutes === 0 && p.absDays === 0);
  if (zeroBezAbsencji.length) {
    dodaj(zeroBezAbsencji.length + ' ' + (zeroBezAbsencji.length === 1 ? 'osoba nie ma' : 'osób nie ma') +
      ' zarejestrowanych godzin ani nieobecności w tym miesiącu (' +
      zeroBezAbsencji.slice(0, 3).map(p => p.imie + ' ' + p.nazwisko).join(', ') + (zeroBezAbsencji.length > 3 ? '…' : '') + ').', 'wazna');
  }

  // 10) Liczba osób bez ani jednej nieobecności (perfect attendance).
  const bezNieobecnosci = dane.employees.filter(p => p.absDays === 0 && p.totalMinutes > 0).length;
  if (liczbaOsob > 0) {
    dodaj(bezNieobecnosci + ' z ' + liczbaOsob + ' osób nie miało w tym miesiącu ani jednej nieobecności.', 'info');
  }

  // 11) Dzień tygodnia (uśredniony po wszystkich wystąpieniach) z najwyższym obciążeniem.
  const DOW_LABEL = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
  const perDow = {};
  dane.employees.forEach(p => p.days.forEach(d => {
    if (!d.mins) return;
    const dow = new Date(d.date + 'T12:00:00').getDay();
    if (!perDow[dow]) perDow[dow] = { suma: 0, ile: 0 };
    perDow[dow].suma += d.mins; perDow[dow].ile++;
  }));
  const dowKeys = Object.keys(perDow);
  if (dowKeys.length >= 2) {
    const srednie = dowKeys.map(k => ({ dow: parseInt(k, 10), sr: perDow[k].suma / perDow[k].ile }));
    srednie.sort((a, b) => b.sr - a.sr);
    dodaj(DOW_LABEL[srednie[0].dow] + ' to zwykle najbardziej obciążony dzień tygodnia (śr. ' + h1(srednie[0].sr / 60) + 'h/zmianę).', 'info');
    const najspokojniejszy = srednie[srednie.length - 1];
    if (najspokojniejszy.dow !== srednie[0].dow) {
      dodaj(DOW_LABEL[najspokojniejszy.dow] + ' to zwykle najspokojniejszy dzień tygodnia (śr. ' + h1(najspokojniejszy.sr / 60) + 'h/zmianę).', 'info');
    }
  }

  // 12) Dzień z najwyższym sumarycznym obciążeniem w tym miesiącu (peak day).
  const perDzien = {};
  dane.employees.forEach(p => p.days.forEach(d => { if (d.mins) perDzien[d.date] = (perDzien[d.date] || 0) + d.mins; }));
  const dniPosortowane = Object.keys(perDzien).sort((a, b) => perDzien[b] - perDzien[a]);
  if (dniPosortowane.length) {
    const nr = parseInt(dniPosortowane[0].slice(8), 10);
    dodaj(nr + '. dzień miesiąca miał najwięcej łącznych godzin pracy zespołu: ' + h1(perDzien[dniPosortowane[0]] / 60) + 'h.', 'info');
  }

  // 13) Ile dni roboczych minęło vs jaki % typowej normy już wypracowano (pacing).
  const dzisiaj = _todayPL();
  if (dzisiaj.slice(0, 7) === (y + '-' + String(m).padStart(2, '0'))) {
    const dzienDzis = parseInt(dzisiaj.slice(8), 10);
    const dniWMiesiacu = new Date(y, m, 0).getDate();
    const procCzasu = Math.round(dzienDzis / dniWMiesiacu * 100);
    if (histSumaGodz != null && histSumaGodz > 1) {
      const procNormy = Math.round(sumaGodz / histSumaGodz * 100);
      if (Math.abs(procNormy - procCzasu) >= 15) {
        dodaj('Minęło ' + procCzasu + '% miesiąca, a zespół wypracował już ' + procNormy +
          '% typowej miesięcznej sumy godzin — ' + (procNormy > procCzasu ? 'tempo wyższe niż zwykle.' : 'tempo niższe niż zwykle.'),
          Math.abs(procNormy - procCzasu) >= 30 ? 'wazna' : 'info');
      }
    }
  }

  // 14) Liczba osób aktywnych dziś vs cały zespół.
  const aktywniDzis = _activeNowData().active.length;
  if (liczbaOsob > 0) {
    dodaj(aktywniDzis + ' z ' + liczbaOsob + ' osób jest aktywnych teraz (' + Math.round(aktywniDzis / liczbaOsob * 100) + '%).', 'info');
  }

  // 15) Liczba osób na urlopie/nieobecności dziś.
  const absMap = _absenceMapAll();
  const naUrlopieDzis = dane.employees.filter(p => absMap[p.id + '_' + dzisiaj]).length;
  if (naUrlopieDzis > 0) {
    dodaj(naUrlopieDzis + ' ' + (naUrlopieDzis === 1 ? 'osoba jest' : 'osób jest') + ' dziś nieobecna/na urlopie.',
      naUrlopieDzis >= Math.ceil(liczbaOsob * 0.3) ? 'wazna' : 'info');
  }

  // 16) Wielkość zespołu vs średnia z 3 mies. (rotacja).
  const histLiczbaOsob = sredniaHist(d => d.employees.length);
  if (histLiczbaOsob != null && Math.abs(liczbaOsob - histLiczbaOsob) >= 1) {
    const roznica = liczbaOsob - histLiczbaOsob;
    dodaj('Zespół liczy ' + liczbaOsob + ' ' + (liczbaOsob === 1 ? 'osobę' : 'osób') + ' — ' +
      (roznica > 0 ? 'o ' + Math.round(roznica) + ' więcej' : 'o ' + Math.round(-roznica) + ' mniej') + ' niż średnio ostatnio.', 'info');
  }

  // 17) Który z ostatnich 3 miesięcy był najsilniejszy/najsłabszy godzinowo — kontekst.
  if (historia.length >= 2) {
    const zSumami = historia.map(d => ({ etykieta: _miesiacKrotko(d.month, d.year), suma: sumaGodzMies(d) }));
    zSumami.sort((a, b) => b.suma - a.suma);
    dodaj('Najmocniejszy z ostatnich ' + historia.length + ' miesięcy pod względem godzin: ' + zSumami[0].etykieta + ' (' + h1(zSumami[0].suma) + 'h).', 'info');
  }

  // 18) Notatki miesiąca — ile osób ma zapisaną notatkę (uwaga administracyjna).
  const zNotatka = dane.employees.filter(p => p.note && p.note.trim()).length;
  if (zNotatka > 0) {
    dodaj(zNotatka + ' ' + (zNotatka === 1 ? 'osoba ma' : 'osób ma') + ' zapisaną notatkę administracyjną w tym miesiącu.', 'info');
  }

  // 19) Liczba unikalnych ról obecnych w zespole.
  const liczbaRol = Object.keys(perRolaOsob).length;
  dodaj('Zespół obejmuje ' + liczbaRol + ' ' + (liczbaRol === 1 ? 'kategorię ról' : 'kategorie ról') + ': ' +
    Object.keys(perRolaOsob).map(g => GRUPA_LABEL[g] || g).join(', ') + '.', 'info');

  return { ok: true, rok: y, mies: m, insighty: out };
}

function _miesiacKrotko(m, y) {
  const N = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
  return N[m - 1] + ' ' + y;
}
