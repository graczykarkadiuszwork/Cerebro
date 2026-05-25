/**
 * We SMILE — RCP v5.1 — Kompletny backend
 *
 * Schemat arkuszy:
 *   Pracownicy : [ID, Imię, Nazwisko, Rola, Status, PIN_HASH]
 *   Ewidencja  : [Timestamp, EmpID, Imię, Nazwisko, Akcja, Data, Godzina, Źródło]
 *   Anomalie   : [Timestamp, EmpID, Opis]
 *   Logi       : [Timestamp, EmpID, Kontekst, Opis]
 *
 * Przed pierwszym wdrożeniem uruchom:
 *   1. setupSheets()         — tworzy arkusze z nagłówkami
 *   2. setupInitialAdminPin('TWÓJ_PIN')  — ustawia hash PIN-u administratora
 *   3. setupHmacSecret()     — generuje losowy sekret HMAC
 */

const CONFIG = {
  APP_NAME: 'We SMILE — RCP',
  APP_VERSION: '5.1.0',
  TOKEN_LENGTH: 4,
  TOKEN_WINDOW_SECONDS: 30,
  TOKEN_GRACE_WINDOWS: 1,
  WORKER_PIN_LENGTH: 4,
  RATE_MAX_ATTEMPTS: 5,
  RATE_WINDOW_SECONDS: 300,
  DEDUP_SECONDS: 90,
  SESSION_TTL_SECONDS: 3600,
  MAX_MISSING_DAYS: 3
};

const SHEETS = {
  PRACOWNICY: 'Pracownicy',
  EWIDENCJA: 'Ewidencja',
  ANOMALIE: 'Anomalie',
  LOGI: 'Logi'
};

// ============================================================
//  ENTRY POINTS
// ============================================================

function doGet(e) {
  const params = (e && e.parameter) || {};
  let page = sanitize(params.page || 'tablet', 20).toLowerCase();
  if (['tablet', 'worker', 'admin'].indexOf(page) === -1) page = 'tablet';

  const t = HtmlService.createTemplateFromFile('Index');
  t.APP_PAGE = page;
  return t.evaluate()
    .setTitle(CONFIG.APP_NAME)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Jednolity dyspozytor wywoływany z frontendu przez:
 *   google.script.run.callBackend(action, JSON.stringify(args))
 */
function callBackend(action, argsJson) {
  try {
    const args = JSON.parse(argsJson || '[]');
    const dispatch = {
      generujBiezacyToken:      () => generujBiezacyToken(),
      identyfikujPracownikaPoPIN: () => identyfikujPracownikaPoPIN(args[0]),
      pobierzHistoriePracownika:  () => pobierzHistoriePracownika(args[0]),
      uzupelnijBrakujaceOdbicie:  () => uzupelnijBrakujaceOdbicie(args[0], args[1], args[2], args[3]),
      weryfikujIRejestruj:        () => weryfikujIRejestruj(args[0], args[1], args[2], args[3]),
      weryfikujAdminPIN:          () => weryfikujAdminPIN(args[0]),
      pobierzPanelAdmina:         () => pobierzPanelAdmina(args[0]),
      zapiszPracownika:           () => zapiszPracownika(args[0], args[1]),
      usunPracownika:             () => usunPracownika(args[0], args[1]),
      wyczyscCacheZabezpieczen:   () => wyczyscCacheZabezpieczen(args[0])
    };

    if (!Object.prototype.hasOwnProperty.call(dispatch, action)) {
      return { ok: false, message: 'Nieznana akcja: ' + sanitize(action, 50) };
    }
    return dispatch[action]();
  } catch (err) {
    _logError('callBackend[' + sanitize(String(action), 50) + ']', err);
    return { ok: false, message: 'Błąd wewnętrzny serwera.' };
  }
}

// ============================================================
//  POMOCNICZE
// ============================================================

function _ss()       { return SpreadsheetApp.getActiveSpreadsheet(); }
function _sheet(n)   { return _ss().getSheetByName(n); }
function _cache()    { return CacheService.getScriptCache(); }
function _props()    { return PropertiesService.getScriptProperties(); }

function sanitize(v, max) {
  if (v === null || v === undefined) return '';
  return String(v).trim().substring(0, max || 200);
}

/** SHA-256 z solą z PropertiesService */
function hashPin(pin) {
  const salt = _props().getProperty('PIN_SALT') || 'wesmile_rcp_salt_v1';
  const raw  = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(pin) + salt);
  return raw.map(b => ((b < 0 ? b + 256 : b)).toString(16).padStart(2, '0')).join('');
}

function nowPL() {
  return Utilities.formatDate(new Date(), 'Europe/Warsaw', 'HH:mm');
}

function todayPL() {
  return Utilities.formatDate(new Date(), 'Europe/Warsaw', 'yyyy-MM-dd');
}

function _logError(ctx, err) {
  try {
    _sheet(SHEETS.LOGI).appendRow([new Date().toISOString(), 'SYSTEM', ctx, String(err)]);
  } catch (_) {}
}

// ============================================================
//  RATE LIMITING  (CacheService)
// ============================================================

function _rlKey(k) { return 'rl_' + k; }

function checkRateLimit(key) {
  const cKey = _rlKey(key);
  const val  = parseInt(_cache().get(cKey) || '0', 10);
  if (val >= CONFIG.RATE_MAX_ATTEMPTS) return false;
  _cache().put(cKey, String(val + 1), CONFIG.RATE_WINDOW_SECONDS);
  return true;
}

function resetRateLimit(key) {
  _cache().remove(_rlKey(key));
}

// ============================================================
//  SESJE ADMINA
// ============================================================

function createAdminSession() {
  const token = Utilities.getUuid();
  _cache().put('admin_sess_' + token, '1', CONFIG.SESSION_TTL_SECONDS);
  return token;
}

function validateAdminSession(token) {
  if (!token) return false;
  return _cache().get('admin_sess_' + sanitize(token, 50)) === '1';
}

function refreshAdminSession(token) {
  if (validateAdminSession(token)) {
    _cache().put('admin_sess_' + sanitize(token, 50), '1', CONFIG.SESSION_TTL_SECONDS);
    return token;
  }
  return null;
}

function requireAdmin(token) {
  if (!validateAdminSession(token)) {
    return { ok: false, errorType: 'UNAUTHORIZED', message: 'Sesja wygasła. Zaloguj się ponownie.' };
  }
  return null;
}

// ============================================================
//  TOKEN TABLETU  (HMAC-SHA256)
// ============================================================

function _computeWindowToken(windowIndex) {
  const secret = _props().getProperty('HMAC_SECRET') || 'wesmile_hmac_default_v1';
  const raw    = Utilities.computeHmacSha256Signature('RCP:' + windowIndex, secret);
  const num    = Math.abs(raw.reduce((acc, b) => (acc * 256 + (b < 0 ? b + 256 : b)) % 10000, 0));
  return String(num).padStart(CONFIG.TOKEN_LENGTH, '0');
}

function generujBiezacyToken() {
  const win = Math.floor(Date.now() / 1000 / CONFIG.TOKEN_WINDOW_SECONDS);
  return _computeWindowToken(win);
}

function weryfikujToken(kod) {
  if (!kod || String(kod).length !== CONFIG.TOKEN_LENGTH) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  const baseWin = Math.floor(nowSec / CONFIG.TOKEN_WINDOW_SECONDS);

  for (let d = -CONFIG.TOKEN_GRACE_WINDOWS; d <= CONFIG.TOKEN_GRACE_WINDOWS; d++) {
    if (_computeWindowToken(baseWin + d) === String(kod)) return true;
  }
  return false;
}

// ============================================================
//  PRACOWNICY
// ============================================================

function _getPracownicy() {
  const sh = _sheet(SHEETS.PRACOWNICY);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getDataRange().getValues().slice(1);
  // Kolumny: 0=ID, 1=Imię, 2=Nazwisko, 3=Rola, 4=Status, 5=PIN_HASH
}

function identyfikujPracownikaPoPIN(pin) {
  if (!pin || String(pin).length !== CONFIG.WORKER_PIN_LENGTH) {
    return { ok: false, message: 'PIN musi mieć dokładnie ' + CONFIG.WORKER_PIN_LENGTH + ' cyfry.' };
  }
  if (!checkRateLimit('pin_global')) {
    return { ok: false, message: 'Zbyt wiele prób. Odczekaj ' + Math.ceil(CONFIG.RATE_WINDOW_SECONDS / 60) + ' minut.' };
  }

  const hash = hashPin(String(pin));
  const row  = _getPracownicy().find(r => String(r[5]) === hash && String(r[4]).toLowerCase() === 'aktywny');

  if (!row) {
    return { ok: false, message: 'Błędny PIN lub konto jest nieaktywne.' };
  }

  resetRateLimit('pin_global');
  return {
    ok: true,
    worker: { id: String(row[0]), imie: String(row[1]), nazwisko: String(row[2]), rola: String(row[3]) }
  };
}

// ============================================================
//  HISTORIA PRACOWNIKA
// ============================================================

function pobierzHistoriePracownika(empId) {
  if (!empId) return { ok: false, message: 'Brak identyfikatora pracownika.' };

  const sh = _sheet(SHEETS.EWIDENCJA);
  const allRows = (sh && sh.getLastRow() >= 2) ? sh.getDataRange().getValues().slice(1) : [];
  // Kolumny: 0=Timestamp, 1=EmpID, 2=Imię, 3=Nazwisko, 4=Akcja, 5=Data, 6=Godzina, 7=Źródło

  const empRows = allRows.filter(r => String(r[1]) === String(empId));
  const today   = todayPL();

  // Dzisiejsze zdarzenia
  const todayRows = empRows.filter(r => String(r[5]) === today);
  let ostatniaAkcjaDzis  = null;
  let ostatniaGodzinaDzis = null;
  if (todayRows.length > 0) {
    const last = todayRows[todayRows.length - 1];
    ostatniaAkcjaDzis   = String(last[4]);
    ostatniaGodzinaDzis = String(last[6]);
  }

  // Brakujące odbicia (ostatnie zdarzenie danego dnia = WEJSCIE)
  const dayMap = {};
  empRows.forEach(r => {
    const d = String(r[5]);
    if (d === today) return;
    if (!dayMap[d]) dayMap[d] = [];
    dayMap[d].push({ akcja: String(r[4]), godzina: String(r[6]) });
  });

  const brakujaceOdbicia = [];
  Object.keys(dayMap).sort().forEach(d => {
    const events = dayMap[d];
    const last   = events[events.length - 1];
    if (last.akcja === 'WEJSCIE') {
      brakujaceOdbicia.push({ data: d, ostatniaGodzina: last.godzina, typ: 'WYJSCIE' });
    }
  });

  const showing = brakujaceOdbicia.slice(-CONFIG.MAX_MISSING_DAYS);

  return {
    ok: true,
    licznikBrakow: showing.length,
    brakujaceOdbicia: showing,
    ostatniaAkcjaDzis,
    ostatniaGodzinaDzis
  };
}

// ============================================================
//  UZUPEŁNIANIE BRAKUJĄCYCH ODBIĆ
// ============================================================

function uzupelnijBrakujaceOdbicie(empId, data, godzina, typ) {
  if (!empId || !data || !godzina || !typ) {
    return { ok: false, message: 'Brak wymaganych danych.' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return { ok: false, message: 'Nieprawidłowy format daty.' };
  }
  if (!/^\d{2}:\d{2}$/.test(godzina)) {
    return { ok: false, message: 'Nieprawidłowy format godziny.' };
  }
  if (typ !== 'WEJSCIE' && typ !== 'WYJSCIE') {
    return { ok: false, message: 'Nieprawidłowy typ zdarzenia.' };
  }

  const rows   = _getPracownicy();
  const worker = rows.find(r => String(r[0]) === String(empId));
  if (!worker) return { ok: false, message: 'Pracownik nie istnieje.' };

  const ts = data + 'T' + godzina + ':00';
  _sheet(SHEETS.EWIDENCJA).appendRow([ts, empId, String(worker[1]), String(worker[2]), typ, data, godzina, 'uzupełnienie']);

  return { ok: true };
}

// ============================================================
//  REJESTRACJA ZDARZENIA
// ============================================================

function weryfikujIRejestruj(empId, tabletKod, pin, akcja) {
  if (!empId || !tabletKod || !pin || !akcja) {
    return { ok: false, message: 'Brak wymaganych parametrów.' };
  }
  if (akcja !== 'WEJSCIE' && akcja !== 'WYJSCIE') {
    return { ok: false, message: 'Nieprawidłowy typ akcji.' };
  }

  const rlKey = 'reg_' + sanitize(empId, 20);
  if (!checkRateLimit(rlKey)) {
    return { ok: false, message: 'Zbyt wiele prób rejestracji. Spróbuj za chwilę.' };
  }

  // Weryfikacja PIN
  const hash   = hashPin(String(pin));
  const rows   = _getPracownicy();
  const worker = rows.find(r => String(r[0]) === String(empId));

  if (!worker)                                         return { ok: false, message: 'Pracownik nie istnieje.' };
  if (String(worker[4]).toLowerCase() !== 'aktywny')  return { ok: false, message: 'Konto jest nieaktywne.' };
  if (String(worker[5]) !== hash)                     return { ok: false, message: 'Błędny PIN.' };

  // Weryfikacja tokenu tabletu
  if (!weryfikujToken(String(tabletKod))) {
    return { ok: false, message: 'Kod autoryzacyjny jest nieważny lub wygasł.' };
  }

  // Deduplikacja
  const dedupKey = 'dedup_' + sanitize(empId, 20);
  if (_cache().get(dedupKey)) {
    return { ok: false, message: 'Zdarzenie zostało już zarejestrowane. Chwilę odczekaj.' };
  }
  _cache().put(dedupKey, '1', CONFIG.DEDUP_SECONDS);

  // Sprawdzenie sekwencji (nie można dwa razy WEJSCIE lub WYJSCIE pod rząd)
  const ewidSh  = _sheet(SHEETS.EWIDENCJA);
  const allRows = (ewidSh && ewidSh.getLastRow() >= 2) ? ewidSh.getDataRange().getValues().slice(1) : [];
  const today   = todayPL();
  const todayRows = allRows.filter(r => String(r[1]) === String(empId) && String(r[5]) === today);

  if (todayRows.length > 0) {
    const lastAkcja = String(todayRows[todayRows.length - 1][4]);
    if (lastAkcja === akcja) {
      _sheet(SHEETS.ANOMALIE).appendRow([
        new Date().toISOString(),
        empId,
        'Duplikacja zdarzenia: ' + String(worker[1]) + ' ' + String(worker[2]) +
          ' — próba podwójnego ' + akcja
      ]);
      return { ok: false, message: 'Błąd sekwencji: poprzednie zdarzenie to już ' + akcja + '.' };
    }
  }

  const godzina = nowPL();
  ewidSh.appendRow([
    new Date().toISOString(),
    empId,
    String(worker[1]),
    String(worker[2]),
    akcja,
    today,
    godzina,
    'worker'
  ]);

  resetRateLimit(rlKey);
  return { ok: true, imie: String(worker[1]), godzina };
}

// ============================================================
//  AUTORYZACJA ADMINA
// ============================================================

function weryfikujAdminPIN(pin) {
  if (!pin || String(pin).trim() === '') {
    return { ok: false, message: 'Brak PIN.' };
  }
  if (!checkRateLimit('admin_login')) {
    return { ok: false, message: 'Zbyt wiele prób logowania. Odczekaj ' + Math.ceil(CONFIG.RATE_WINDOW_SECONDS / 60) + ' minut.' };
  }

  const savedHash = _props().getProperty('ADMIN_PIN_HASH');
  if (!savedHash) {
    return { ok: false, message: 'PIN administratora nie jest skonfigurowany. Uruchom setupInitialAdminPin().' };
  }

  if (hashPin(String(pin)) !== savedHash) {
    return { ok: false, message: 'Błędny PIN administratora.' };
  }

  resetRateLimit('admin_login');
  return { ok: true, token: createAdminSession() };
}

// ============================================================
//  PANEL ADMINA
// ============================================================

function pobierzPanelAdmina(token) {
  const authErr = requireAdmin(token);
  if (authErr) return authErr;
  refreshAdminSession(token);

  // Pracownicy
  const pracownicy = _getPracownicy().map(r => ({
    id:      String(r[0]),
    imie:    String(r[1]),
    nazwisko: String(r[2]),
    rola:    String(r[3]),
    aktywny: String(r[4]).toLowerCase() === 'aktywny',
    maPin:   Boolean(r[5] && String(r[5]).length > 0)
  }));

  // Ewidencja
  const ewidSh  = _sheet(SHEETS.EWIDENCJA);
  const ewidencja = (ewidSh && ewidSh.getLastRow() >= 2)
    ? ewidSh.getDataRange().getValues().slice(1).map(r => ({
        ts:       String(r[0]),
        id:       String(r[1]),
        imie:     String(r[2]),
        nazwisko: String(r[3]),
        akcja:    String(r[4]),
        data:     String(r[5]),
        godzina:  String(r[6]),
        zrodlo:   String(r[7])
      }))
    : [];

  // Anomalie
  const anomSh = _sheet(SHEETS.ANOMALIE);
  const anomalie = (anomSh && anomSh.getLastRow() >= 2)
    ? anomSh.getDataRange().getValues().slice(1).map(r => ({
        ts:   String(r[0]),
        id:   String(r[1]),
        opis: String(r[2])
      }))
    : [];

  return { ok: true, pracownicy, ewidencja, anomalie, dzisiaj: todayPL() };
}

// ============================================================
//  ZARZĄDZANIE PRACOWNIKAMI
// ============================================================

function zapiszPracownika(workerData, token) {
  const authErr = requireAdmin(token);
  if (authErr) return authErr;

  if (!workerData || !sanitize(workerData.imie, 1) || !sanitize(workerData.nazwisko, 1)) {
    return { ok: false, message: 'Imię i nazwisko są wymagane.' };
  }
  const pin = sanitize(workerData.pin, 10);
  if (pin.length > 0 && pin.length !== CONFIG.WORKER_PIN_LENGTH) {
    return { ok: false, message: 'PIN musi mieć dokładnie ' + CONFIG.WORKER_PIN_LENGTH + ' cyfry.' };
  }
  if (pin.length > 0 && !/^\d+$/.test(pin)) {
    return { ok: false, message: 'PIN może zawierać wyłącznie cyfry.' };
  }

  const sh     = _sheet(SHEETS.PRACOWNICY);
  const rows   = sh.getDataRange().getValues();
  const status = workerData.aktywny !== false ? 'aktywny' : 'nieaktywny';
  const id     = sanitize(workerData.id, 50);

  if (id) {
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === id) {
        const pinHash = pin ? hashPin(pin) : String(rows[i][5]);
        sh.getRange(i + 1, 1, 1, 6).setValues([[
          rows[i][0],
          sanitize(workerData.imie, 50),
          sanitize(workerData.nazwisko, 50),
          sanitize(workerData.rola, 100),
          status,
          pinHash
        ]]);
        return { ok: true };
      }
    }
    return { ok: false, message: 'Pracownik o podanym ID nie istnieje.' };
  }

  // Nowy pracownik
  const newId   = 'P' + Date.now();
  const pinHash = pin ? hashPin(pin) : '';
  sh.appendRow([
    newId,
    sanitize(workerData.imie, 50),
    sanitize(workerData.nazwisko, 50),
    sanitize(workerData.rola, 100),
    status,
    pinHash
  ]);
  return { ok: true };
}

function usunPracownika(id, token) {
  const authErr = requireAdmin(token);
  if (authErr) return authErr;

  const sh   = _sheet(SHEETS.PRACOWNICY);
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === sanitize(id, 50)) {
      sh.deleteRow(i + 1);
      return { ok: true };
    }
  }
  return { ok: false, message: 'Pracownik o podanym ID nie istnieje.' };
}

// ============================================================
//  RESET CACHE BLOKAD
// ============================================================

function wyczyscCacheZabezpieczen(token) {
  const authErr = requireAdmin(token);
  if (authErr) return authErr;

  _cache().removeAll(['rl_pin_global', 'rl_admin_login']);
  return { ok: true };
}

// ============================================================
//  NARZĘDZIA KONFIGURACYJNE (uruchamiaj ręcznie z edytora GAS)
// ============================================================

/** Tworzy arkusze z nagłówkami jeśli nie istnieją */
function setupSheets() {
  const ss = _ss();
  const defs = [
    { name: SHEETS.PRACOWNICY, headers: ['ID', 'Imię', 'Nazwisko', 'Rola', 'Status', 'PIN_HASH'] },
    { name: SHEETS.EWIDENCJA,  headers: ['Timestamp', 'EmpID', 'Imię', 'Nazwisko', 'Akcja', 'Data', 'Godzina', 'Źródło'] },
    { name: SHEETS.ANOMALIE,   headers: ['Timestamp', 'EmpID', 'Opis'] },
    { name: SHEETS.LOGI,       headers: ['Timestamp', 'EmpID', 'Kontekst', 'Opis'] }
  ];
  defs.forEach(def => {
    let sh = ss.getSheetByName(def.name);
    if (!sh) sh = ss.insertSheet(def.name);
    if (sh.getLastRow() === 0) sh.appendRow(def.headers);
  });
  Logger.log('Arkusze zainicjalizowane.');
}

/** Ustawia hash PIN-u administratora. Wywołaj z argumentem, np. setupInitialAdminPin('1234') */
function setupInitialAdminPin(pin) {
  if (!pin) throw new Error('Podaj PIN jako argument funkcji.');
  if (String(pin).length < 4) throw new Error('PIN musi mieć co najmniej 4 znaki.');
  _props().setProperty('ADMIN_PIN_HASH', hashPin(String(pin)));
  Logger.log('Hash PIN administratora został zapisany.');
}

/** Generuje losowy sekret HMAC i zapisuje go w PropertiesService */
function setupHmacSecret() {
  const secret = Utilities.getUuid() + '-' + Utilities.getUuid();
  _props().setProperty('HMAC_SECRET', secret);
  Logger.log('HMAC_SECRET wygenerowany i zapisany.');
}

/** Generuje losową sól dla PIN i zapisuje w PropertiesService */
function setupPinSalt() {
  const salt = Utilities.getUuid();
  _props().setProperty('PIN_SALT', salt);
  Logger.log('PIN_SALT wygenerowany i zapisany.');
}
