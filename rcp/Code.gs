// ============================================================
// We SMILE — RCP v6.0
// ============================================================
//
// Schemat arkusza (ID poniżej):
//   Pracownicy : [ID, Imię, Nazwisko, Rola, Status, PIN]
//   Ewidencja  : [Timestamp, EmpID, Imię, Nazwisko, Akcja, Data, Godzina, Źródło]
//   Anomalie   : [Timestamp, EmpID, Opis]
//
// Po wgraniu do GAS uruchom raz ręcznie: setupRCP()
// ============================================================

const SS_ID          = '1wI3ysrolzGea5nNi7GYBo09t38y8oUgPoqGG3wn-ZsA';
const TOKEN_WIN_SEC  = 30;
const TOKEN_GRACE    = 1;    // ±1 okno tolerancji
const DEDUP_SEC      = 90;
const RATE_MAX       = 5;
const RATE_WIN_SEC   = 300;

// ── Entry point ──────────────────────────────────────────────

function doGet(e) {
  const p = e && e.parameter && e.parameter.page;
  if (p === 'dashboard') {
    return HtmlService.createTemplateFromFile('DashboardGUI')
      .evaluate()
      .setTitle('We SMILE — Panel Raportowy')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  const page = (p === 'admin') ? 'admin' : 'worker';
  const tmpl = HtmlService.createTemplateFromFile('Index');
  tmpl.PAGE  = page;
  return tmpl.evaluate()
    .setTitle('We SMILE — RCP')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ── Dispatcher ───────────────────────────────────────────────

function callRCP(action, argsJson) {
  try {
    const args = JSON.parse(argsJson || '[]');
    switch (action) {
      case 'getToken':       return { ok: true, token: _currentToken() };
      case 'checkPin':       return checkPin(args[0]);
      case 'clockIn':        return clock(args[0], args[1], 'WEJSCIE');
      case 'clockOut':       return clock(args[0], args[1], 'WYJSCIE');
      // Dashboard
      case 'dashLogin':      return dashLogin(args[0]);
      case 'getDashboard':   return getDashboard(args[0], args[1], args[2]);
      case 'saveStatus':     return saveStatus(args[0], args[1], args[2], args[3], args[4]);
      case 'dashExportCsv':  return dashExportCsv(args[0], args[1], args[2]);
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
  // cols: 0=ID, 1=Imię, 2=Nazwisko, 3=Rola, 4=Status, 5=PIN
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

  const worker = _getWorkers().find(r =>
    _pinMatch(r[5], pin) && String(r[4]).toLowerCase() === 'aktywny'
  );

  if (!worker) {
    return { ok: false, msg: 'Nieprawidłowy PIN lub konto nieaktywne.' };
  }

  _resetRate('pin');
  return {
    ok:       true,
    id:       String(worker[0]),
    imie:     String(worker[1]),
    nazwisko: String(worker[2]),
    rola:     String(worker[3])
  };
}

// ── clock — rejestracja zdarzenia (krok 2) ───────────────────

function clock(pin, tokenCode, action) {
  if (!pin || !tokenCode) {
    return { ok: false, msg: 'Brak wymaganych danych.' };
  }

  // Znajdź pracownika
  const worker = _getWorkers().find(r =>
    _pinMatch(r[5], pin) && String(r[4]).toLowerCase() === 'aktywny'
  );
  if (!worker) return { ok: false, msg: 'Pracownik nie istnieje.' };

  const empId = String(worker[0]);

  // Rate limit per pracownik
  if (!_checkRate('clk_' + empId)) {
    return { ok: false, msg: 'Zbyt wiele prób. Odczekaj 5 minut.' };
  }

  // Weryfikacja tokenu
  if (!_verifyToken(String(tokenCode))) {
    return { ok: false, msg: 'Nieprawidłowy kod autoryzacyjny lub wygasł.' };
  }

  // Deduplikacja
  const dedupKey = 'dup_' + empId;
  if (_cache().get(dedupKey)) {
    return { ok: false, msg: 'Zdarzenie już zarejestrowane. Chwilę odczekaj.' };
  }
  _cache().put(dedupKey, '1', DEDUP_SEC);

  // Sprawdzenie sekwencji (zakaz dwóch takich samych akcji pod rząd)
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

  // Zapis
  const godzina = _nowPL();
  ewidSh.appendRow([
    new Date().toISOString(), empId,
    String(worker[1]), String(worker[2]),
    action, today, godzina, 'worker'
  ]);

  _resetRate('clk_' + empId);
  return { ok: true, imie: String(worker[1]), godzina };
}

// ── setupRCP — uruchom raz po wgraniu ────────────────────────

function setupRCP() {
  const spreadsheet = _ss();

  // Utwórz arkusze jeśli brak
  [
    { name: 'Pracownicy', h: ['ID', 'Imię', 'Nazwisko', 'Rola', 'Status', 'PIN'] },
    { name: 'Ewidencja',  h: ['Timestamp', 'EmpID', 'Imię', 'Nazwisko', 'Akcja', 'Data', 'Godzina', 'Źródło'] },
    { name: 'Anomalie',   h: ['Timestamp', 'EmpID', 'Opis'] },
    { name: 'Statusy',    h: ['Date', 'EmpID', 'Status', 'Notes', 'Modified'] }
  ].forEach(def => {
    let sh = spreadsheet.getSheetByName(def.name);
    if (!sh) sh = spreadsheet.insertSheet(def.name);
    if (sh.getLastRow() === 0) sh.appendRow(def.h);
  });

  // Pracownicy
  const pSh = spreadsheet.getSheetByName('Pracownicy');

  // Dodaj pracowników tylko jeśli arkusz jest pusty (tylko nagłówek)
  if (pSh.getLastRow() <= 1) {
    const employees = [
      ['WS01', 'Arkadiusz',  'Graczyk',      'Admin',                           'Aktywny', '0371'],
      ['WS02', 'Kaja',       'Węglarek',     'rejestratorka medyczna',          'Aktywny', '1826'],
      ['WS03', 'Julia',      'Polishchuk',    'higienistka stomatologiczna',     'Aktywny', '0316'],
      ['WS04', 'Oksana',     'Revutska',      'asystentka stomatologiczna',      'Aktywny', '0484'],
      ['WS05', 'Kamila',     'Pruszczyńska', 'higienistka stomatologiczna',     'Aktywny', '4731'],
      ['WS06', 'Katarzyna',  'Graczyk',       'higienistka stomatologiczna',     'Aktywny', '9010']
    ];
    employees.forEach(row => pSh.appendRow(row));
    Logger.log('Dodano ' + employees.length + ' pracowników.');
  } else {
    Logger.log('Pracownicy już istnieją — pominięto import.');
  }

  // Generuj sekret HMAC jeśli brak
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('RCP_SECRET')) {
    props.setProperty('RCP_SECRET', Utilities.getUuid() + '-' + Utilities.getUuid());
    Logger.log('Wygenerowano nowy RCP_SECRET.');
  }

  Logger.log('setupRCP zakończony pomyślnie.');
}
