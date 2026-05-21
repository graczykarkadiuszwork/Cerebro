// ================================================================
// RCP v4 — System Rejestracji Czasu Pracy
// Klinika stomatologiczna We SMILE, Warszawa
// Code.gs — backend Google Apps Script
// ================================================================
// ES5 (var/function) dla maksymalnej kompatybilnosci z V8 runtime.
// Brak polskich znakow w nazwach zmiennych/funkcji.
// ================================================================

// ── Konfiguracja ─────────────────────────────────────────────────

var CONFIG = {
  HMAC_SECRET: '',
  SHEET_ID: '',
  ADMIN_EMAIL: '',
  KLINIKA_ID: '1',
  TOKEN_WINDOW: 60000,       // ms — rotacja co 60s
  TOKEN_ACCEPT_DELTA: 1,     // akceptuj slot biezacy ± 1
  RATE_LIMIT_MAX: 5,         // maks blednych prob w oknie
  RATE_LIMIT_WINDOW: 10 * 60 * 1000,  // 10 min
  RATE_LIMIT_LOCKOUT: 30 * 60 * 1000, // 30 min blokady
  PIN_LENGTH: 4,             // cyfry PIN
  GAS_SCRIPT_LOCK_MS: 10000, // timeout LockService [ms]
};

var ZAKLADKI = {
  PRACOWNICY: 'Pracownicy',
  KLINIKI: 'Kliniki',
  EWIDENCJA: 'Ewidencja_Czasu',
  LOGI: 'Logi_Audytowe',
  ANOMALIE: 'Anomalie',
};

// Oczekiwane naglowki kolumn arkuszy (uzyte do walidacji schematu)
var SCHEMA = {
  PRACOWNICY: ['ID','IMIE','NAZWISKO','INICJAL_NAZWISKA','ROK_URODZENIA','ROLA','EMAIL','STATUS','PIN_HASH','DATA_DODANIA'],
  EWIDENCJA:  ['ID','ID_PRACOWNIKA','IMIE_NAZWISKO','DATA','GODZINA','DZIEN_TYGODNIA','TYP','ID_KLINIKI','TOKEN_SKROT','TIMESTAMP_UNIX','STATUS','UWAGI'],
  LOGI:       ['ID','TIMESTAMP','TYP_ZDARZENIA','ID_PRACOWNIKA','SZCZEGOLY'],
  ANOMALIE:   ['ID','TIMESTAMP','ID_PRACOWNIKA','IMIE_NAZWISKO','TYP','OPIS','STATUS'],
};

// ── doGet — routing ──────────────────────────────────────────────

function doGet(e) {
  zaladujKonfig();
  var page = (e.parameter && e.parameter.page) ? e.parameter.page : '';
  var output;

  if (page === 'tablet') {
    output = HtmlService.createHtmlOutputFromFile('Tablet')
      .setTitle('RCP · We SMILE · Tablet');
  } else if (page === 'admin') {
    output = HtmlService.createHtmlOutputFromFile('Admin')
      .setTitle('RCP · We SMILE · Admin');
  } else {
    output = HtmlService.createHtmlOutputFromFile('Index')
      .setTitle('RCP · We SMILE');
  }

  if (HtmlService.XFrameOptionsMode && HtmlService.XFrameOptionsMode.ALLOWALL) {
    output.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  return output;
}

// ── Ladowanie konfiguracji ────────────────────────────────────────

function zaladujKonfig() {
  var props = PropertiesService.getScriptProperties();
  CONFIG.HMAC_SECRET  = props.getProperty('HMAC_SECRET')  || '';
  CONFIG.SHEET_ID     = props.getProperty('SHEET_ID')     || '';
  CONFIG.ADMIN_EMAIL  = props.getProperty('ADMIN_EMAIL')  || '';
  CONFIG.KLINIKA_ID   = props.getProperty('KLINIKA_ID')   || '1';
}

// ── Walidacja schematu arkusza ────────────────────────────────────
// Zwraca tablice brakujacych naglowkow lub [] jesli OK.

function walidujSchematArkusza(sheet, expectedHeaders) {
  if (!sheet) return ['BRAK ARKUSZA'];
  var firstRow = sheet.getRange(1, 1, 1, expectedHeaders.length).getValues()[0];
  var missing = [];
  for (var i = 0; i < expectedHeaders.length; i++) {
    if (String(firstRow[i]).trim() !== expectedHeaders[i]) {
      missing.push(expectedHeaders[i] + ' (kol.' + (i + 1) + ')');
    }
  }
  return missing;
}

// ── sanitizeString — usuwa znaki sterujace, ogranicza dlugosc ─────

function sanitizeString(val, maxLen) {
  if (typeof val !== 'string') val = String(val);
  // Usun znaki niedrukowalne (kontrolne)
  val = val.replace(/[\x00-\x1F\x7F]/g, '');
  // Ogranicz dlugosc
  if (maxLen && val.length > maxLen) val = val.substring(0, maxLen);
  return val.trim();
}

// ── pobierzDaneStartowe ───────────────────────────────────────────

function pobierzDaneStartowe() {
  zaladujKonfig();
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);

  var sheetPrac = ss.getSheetByName(ZAKLADKI.PRACOWNICY);
  var pracownicy = [];

  if (sheetPrac) {
    var data = pobierzDaneOgraniczone(sheetPrac, 500);
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[0]) continue; // Pusta linia
      var status = sanitizeString(String(row[7]), 20).toLowerCase();
      if (status === 'aktywny') {
        pracownicy.push({
          id:     sanitizeString(String(row[0]), 20),
          name:   sanitizeString(String(row[1]), 30) + ' ' + sanitizeString(String(row[3]), 10),
          imie:   sanitizeString(String(row[1]), 30),
          inicjal:sanitizeString(String(row[3]), 10),
          year:   sanitizeString(String(row[4]), 4),
          role:   sanitizeString(String(row[5]), 40),
        });
      }
    }
  }

  var sheetKlin = ss.getSheetByName(ZAKLADKI.KLINIKI);
  var klinika = { nazwa: 'We SMILE', miasto: 'Warszawa' };
  if (sheetKlin) {
    var kData = sheetKlin.getDataRange().getValues();
    for (var j = 1; j < kData.length; j++) {
      if (String(kData[j][0]) === CONFIG.KLINIKA_ID) {
        klinika = {
          nazwa:  sanitizeString(String(kData[j][1]), 60),
          miasto: sanitizeString(String(kData[j][3]), 40),
        };
        break;
      }
    }
  }

  return { pracownicy: pracownicy, klinika: klinika, tokenWindow: 60 };
}

// Pobiera do maxRows wierszy z arkusza (zabezpieczenie przed freeze)
function pobierzDaneOgraniczone(sheet, maxRows) {
  var last = sheet.getLastRow();
  if (last <= 1) return [sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]];
  var rows = Math.min(last, maxRows + 1); // +1 naglowek
  return sheet.getRange(1, 1, rows, sheet.getLastColumn()).getValues();
}

// ── generujTokenTablet ────────────────────────────────────────────

function generujTokenTablet() {
  zaladujKonfig();
  var ts = new Date().getTime();
  var slot = Math.floor(ts / CONFIG.TOKEN_WINDOW);
  var prevSlot = slot - 1;
  return {
    token:     obliczToken(slot * CONFIG.TOKEN_WINDOW).toUpperCase(),
    prevToken: obliczToken(prevSlot * CONFIG.TOKEN_WINDOW).toUpperCase(),
    timestamp: ts,
    secsLeft:  60 - Math.floor((ts % 60000) / 1000),
  };
}

// ── obliczToken — HMAC-SHA256 ──────────────────────────────────────

function obliczToken(timestamp) {
  if (!CONFIG.HMAC_SECRET) return '0000000000000000';
  var slot = Math.floor(timestamp / CONFIG.TOKEN_WINDOW);
  var message = Utilities.newBlob(String(slot)).getBytes();
  var key = Utilities.newBlob(CONFIG.HMAC_SECRET).getBytes();
  var hash = Utilities.computeHmacSha256Signature(message, key);
  var hex = hash.map(function(b) {
    return ('0' + (b & 0xFF).toString(16)).slice(-2);
  }).join('');
  return hex.substring(0, 16);
}

// ── weryfikujToken — okno ±delta ──────────────────────────────────

function weryfikujToken(tokenInput) {
  var ts = new Date().getTime();
  var slot = Math.floor(ts / CONFIG.TOKEN_WINDOW);
  // Normalizuj wejscie
  var input = tokenInput.toLowerCase().replace(/[^a-f0-9]/g, '');
  if (input.length < 4) return false;

  for (var delta = -CONFIG.TOKEN_ACCEPT_DELTA; delta <= CONFIG.TOKEN_ACCEPT_DELTA; delta++) {
    var valid = obliczToken((slot + delta) * CONFIG.TOKEN_WINDOW).toLowerCase();
    // Porownanie staloczasowe (nie zatrzymujemy na pierwszym znaku)
    if (timingSafeEqual(valid.substring(0, input.length), input)) return true;
  }
  return false;
}

// Porownanie staloczasowe — zapobiega timing attacks
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// ── weryfikujPIN ──────────────────────────────────────────────────
// PIN jest przechowywany jako skrot SHA-256 w kolumnie PIN_HASH.
// W Apps Script nie ma bcrypt — uzywamy SHA-256 z soltem = employee ID.

function weryfikujPIN(employeeId, pinInput) {
  pinInput = sanitizeString(String(pinInput), 10).replace(/\D/g, '');
  if (pinInput.length !== CONFIG.PIN_LENGTH) return false;

  var pracownik = pobierzPracownika(employeeId);
  if (!pracownik) return false;

  var storedHash = pracownik.pinHash;
  if (!storedHash || storedHash === '' || storedHash === 'BRAK') return false;

  var computedHash = obliczPinHash(pinInput, employeeId);
  return timingSafeEqual(computedHash, storedHash.toLowerCase());
}

function obliczPinHash(pin, salt) {
  var message = Utilities.newBlob(salt + ':' + pin).getBytes();
  var hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, message);
  return hash.map(function(b) {
    return ('0' + (b & 0xFF).toString(16)).slice(-2);
  }).join('');
}

// Eksportowana — uzywana przez panel admina do ustawiania PINu
function ustawPINPracownika(employeeId, nowyPin) {
  zaladujKonfig();
  employeeId = sanitizeString(String(employeeId), 20);
  nowyPin = sanitizeString(String(nowyPin), 10).replace(/\D/g, '');

  if (nowyPin.length !== CONFIG.PIN_LENGTH) {
    return { success: false, message: 'PIN musi miec dokladnie 4 cyfry.' };
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.GAS_SCRIPT_LOCK_MS);
  } catch (e) {
    return { success: false, message: 'Serwer zajety. Sprobuj za chwile.' };
  }

  try {
    var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    var sheet = ss.getSheetByName(ZAKLADKI.PRACOWNICY);
    if (!sheet) return { success: false, message: 'Brak arkusza Pracownicy.' };

    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(employeeId)) {
        var hash = obliczPinHash(nowyPin, employeeId);
        sheet.getRange(i + 1, 9).setValue(hash); // Kolumna 9 = PIN_HASH
        zapiszLog('PIN_ZMIANA', employeeId, 'PIN zaktualizowany przez admina');
        return { success: true };
      }
    }
    return { success: false, message: 'Nie znaleziono pracownika.' };
  } finally {
    lock.releaseLock();
  }
}

// ── Rate limiting — LockService-safe ─────────────────────────────

function sprawdzRateLimit(employeeId) {
  var props = PropertiesService.getScriptProperties();
  var key = 'rl_' + employeeId;
  var now = new Date().getTime();

  var raw = props.getProperty(key);
  var state = raw
    ? JSON.parse(raw)
    : { count: 0, windowStart: now, locked: false, lockUntil: 0 };

  if (state.locked && now < state.lockUntil) {
    var minsLeft = Math.ceil((state.lockUntil - now) / 60000);
    return {
      allowed: false,
      reason: 'Konto zablokowane. Sprobuj ponownie za ' + minsLeft + ' min.',
      lockUntil: state.lockUntil,
    };
  }

  if (state.locked && now >= state.lockUntil) {
    state = { count: 0, windowStart: now, locked: false, lockUntil: 0 };
  }

  if (now - state.windowStart > CONFIG.RATE_LIMIT_WINDOW) {
    state = { count: 0, windowStart: now, locked: false, lockUntil: 0 };
  }

  return {
    allowed: true,
    state: state,
    key: key,
    now: now,
    attemptsLeft: CONFIG.RATE_LIMIT_MAX - state.count,
  };
}

function zapiszNieudanaProbe(employeeId) {
  // LockService zapobiega race condition wielu pracownikow
  var lock = LockService.getScriptLock();
  try { lock.waitLock(CONFIG.GAS_SCRIPT_LOCK_MS); } catch(e) { return; }

  try {
    var props = PropertiesService.getScriptProperties();
    var key = 'rl_' + employeeId;
    var now = new Date().getTime();

    var raw = props.getProperty(key);
    var state = raw
      ? JSON.parse(raw)
      : { count: 0, windowStart: now, locked: false, lockUntil: 0 };

    if (now - state.windowStart > CONFIG.RATE_LIMIT_WINDOW) {
      state = { count: 0, windowStart: now, locked: false, lockUntil: 0 };
    }

    state.count++;
    if (state.count >= CONFIG.RATE_LIMIT_MAX) {
      state.locked = true;
      state.lockUntil = now + CONFIG.RATE_LIMIT_LOCKOUT;
      wyslijAlert('RATE_LIMIT',
        'Pracownik ID=' + employeeId + ' przekroczyl limit ' + CONFIG.RATE_LIMIT_MAX +
        ' blednych prob w 10 min. Blokada 30 min.', null);
    }
    props.setProperty(key, JSON.stringify(state));
  } finally {
    lock.releaseLock();
  }
}

function resetRateLimit(employeeId) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(CONFIG.GAS_SCRIPT_LOCK_MS); } catch(e) { return; }
  try {
    PropertiesService.getScriptProperties().deleteProperty('rl_' + employeeId);
  } finally {
    lock.releaseLock();
  }
}

// ── deduplikacja — zapobiega podwojnej rejestracji w tej samej sekundzie

function sprawdzDeduplikacje(employeeId, akcja) {
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    var sheet = ss.getSheetByName(ZAKLADKI.EWIDENCJA);
    if (!sheet) return false;

    var now = new Date().getTime();
    var data = pobierzDaneOgraniczone(sheet, 1000);
    var ostatnich10s = now - 10000;

    for (var i = data.length - 1; i >= 1; i--) {
      var ts = Number(data[i][9]);
      if (ts < ostatnich10s) break; // Wiersze sa chronologiczne
      if (String(data[i][1]) === String(employeeId) && String(data[i][6]) === akcja) {
        return true; // Duplikat w oknie 10s
      }
    }
    return false;
  } catch(e) {
    return false;
  }
}

// ── weryfikujIRejestruj — glowna funkcja rejestracji ──────────────
// payload = { employeeId, tokenInput, pinInput, akcja, timestamp }

function weryfikujIRejestruj(payload) {
  zaladujKonfig();

  // Walidacja i sanitizacja wejscia
  var employeeId = sanitizeString(String(payload.employeeId || ''), 20);
  var tokenInput = sanitizeString(String(payload.tokenInput || ''), 32);
  var pinInput   = sanitizeString(String(payload.pinInput   || ''), 10).replace(/\D/g, '');
  var akcja      = sanitizeString(String(payload.akcja      || ''), 2);

  if (!employeeId || !tokenInput || !pinInput || (akcja !== 'P' && akcja !== 'W')) {
    return { success: false, message: 'Nieprawidlowe dane wejsciowe.' };
  }

  // 1. Rate limiting (sprawdz przed lockiem — szybka sciezka odrzucen)
  var rl = sprawdzRateLimit(employeeId);
  if (!rl.allowed) {
    zapiszLog('RATE_LIMIT_BLOKADA', employeeId, rl.reason);
    return { success: false, message: rl.reason, attemptsLeft: 0 };
  }

  // 2. Weryfikacja tokenu (HMAC)
  if (!weryfikujToken(tokenInput)) {
    zapiszNieudanaProbe(employeeId);
    zapiszLog('NIEPRAWIDLOWY_TOKEN', employeeId, 'Podano: ' + tokenInput.substring(0, 8));
    var rl2 = sprawdzRateLimit(employeeId);
    var left = rl2.allowed ? rl2.attemptsLeft : 0;
    return {
      success: false,
      message: 'Nieprawidlowy token. Pozostalo prob: ' + left + '.',
      attemptsLeft: left,
    };
  }

  // 3. Weryfikacja PINu
  if (!weryfikujPIN(employeeId, pinInput)) {
    zapiszNieudanaProbe(employeeId);
    zapiszLog('NIEPRAWIDLOWY_PIN', employeeId, 'Bledny PIN');
    var rl3 = sprawdzRateLimit(employeeId);
    var left3 = rl3.allowed ? rl3.attemptsLeft : 0;
    return {
      success: false,
      message: 'Nieprawidlowy PIN. Pozostalo prob: ' + left3 + '.',
      attemptsLeft: left3,
    };
  }

  // 4. Pobierz i zweryfikuj pracownika
  var pracownik = pobierzPracownika(employeeId);
  if (!pracownik) {
    zapiszLog('REJESTRACJA_BLAD', employeeId, 'Nieznany pracownik');
    return { success: false, message: 'Nie znaleziono pracownika.' };
  }
  if (pracownik.status !== 'aktywny') {
    zapiszLog('REJESTRACJA_BLAD', employeeId, 'Konto nieaktywne');
    return { success: false, message: 'Konto pracownika jest nieaktywne.' };
  }

  // 5. Deduplikacja — blokuj podwojny wpis w 10s
  if (sprawdzDeduplikacje(employeeId, akcja)) {
    return { success: false, message: 'Rejestracja zostala juz zarejestrowana. Odczekaj chwile.' };
  }

  // 6. Zapis — caly blok pod LockService
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.GAS_SCRIPT_LOCK_MS);
  } catch(e) {
    return { success: false, message: 'Serwer zajety — sprobuj za chwile.' };
  }

  try {
    resetRateLimit(employeeId);

    var now = new Date();
    var tokenSkrot = obliczToken(now.getTime()).substring(0, 8);
    var rekordId = zapiszEwidencje(pracownik, akcja, now, tokenSkrot);

    zapiszLog('REJESTRACJA_OK', employeeId,
      'Akcja=' + akcja + ' Godz=' + formatGodzina(now) + ' Token=' + tokenSkrot);

    sprawdzAnomalie(pracownik, akcja, now);

    return {
      success: true,
      message: 'Zarejestrowano pomyslnie.',
      rekordId: rekordId,
      godzina: formatGodzina(now),
      data: formatData(now),
    };
  } finally {
    lock.releaseLock();
  }
}

// ── pobierzPracownika ─────────────────────────────────────────────

function pobierzPracownika(id) {
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var sheet = ss.getSheetByName(ZAKLADKI.PRACOWNICY);
  if (!sheet) return null;

  var data = pobierzDaneOgraniczone(sheet, 500);
  for (var i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    if (String(data[i][0]) === String(id)) {
      return {
        id:         sanitizeString(String(data[i][0]), 20),
        imie:       sanitizeString(String(data[i][1]), 30),
        nazwisko:   sanitizeString(String(data[i][2]), 40),
        inicjal:    sanitizeString(String(data[i][3]), 10),
        rok:        sanitizeString(String(data[i][4]), 4),
        rola:       sanitizeString(String(data[i][5]), 40),
        email:      sanitizeString(String(data[i][6]), 80),
        status:     sanitizeString(String(data[i][7]), 20).toLowerCase(),
        pinHash:    sanitizeString(String(data[i][8] || ''), 64).toLowerCase(),
        name:       sanitizeString(String(data[i][1]), 30) + ' ' + sanitizeString(String(data[i][3]), 10),
      };
    }
  }
  return null;
}

// ── zapiszEwidencje ───────────────────────────────────────────────

function zapiszEwidencje(pracownik, akcja, now, tokenSkrot) {
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var sheet = ss.getSheetByName(ZAKLADKI.EWIDENCJA);
  if (!sheet) return null;

  var lastRow = sheet.getLastRow();
  var id = 'E' + String(lastRow + 1);
  var dni = ['Niedziela','Poniedzialek','Wtorek','Sroda','Czwartek','Piatek','Sobota'];

  sheet.appendRow([
    id,
    pracownik.id,
    pracownik.name,
    formatData(now),
    formatGodzina(now),
    dni[now.getDay()],
    akcja,
    CONFIG.KLINIKA_ID,
    tokenSkrot,
    now.getTime(),
    'OK',
    '',
  ]);

  return id;
}

// ── zapiszLog ─────────────────────────────────────────────────────

function zapiszLog(typZdarzenia, employeeId, szczegoly) {
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    var sheet = ss.getSheetByName(ZAKLADKI.LOGI);
    if (!sheet) return;

    var now = new Date();
    var lastRow = sheet.getLastRow();
    sheet.appendRow([
      'L' + (lastRow + 1),
      Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ssZ"),
      sanitizeString(String(typZdarzenia), 40),
      sanitizeString(String(employeeId), 20),
      sanitizeString(String(szczegoly), 200),
    ]);
  } catch (e) {
    Logger.log('Blad zapisu logu: ' + e.message);
  }
}

// ── sprawdzAnomalie ───────────────────────────────────────────────

function sprawdzAnomalie(pracownik, akcja, now) {
  var tz = Session.getScriptTimeZone();
  var godz = parseInt(Utilities.formatDate(now, tz, 'H'), 10);
  var dzien = parseInt(Utilities.formatDate(now, tz, 'u'), 10); // 1=Pon, 7=Niedziela

  if (godz >= 22 || godz < 6) {
    zapiszAnomalie(pracownik, 'NOCNA_REJESTRACJA',
      'Rejestracja o ' + formatGodzina(now) + ' (poza 06:00-22:00)', true);
  }

  if (dzien === 6 || dzien === 7) {
    zapiszAnomalie(pracownik, 'WEEKENDOWA_REJESTRACJA',
      'Rejestracja w ' + (dzien === 6 ? 'sobote' : 'niedziele') + ' ' + formatData(now), true);
  }

  if (akcja === 'W') {
    var ostatniePrzyjscie = znajdzOstatniePrzyjscie(pracownik.id, now);
    if (ostatniePrzyjscie) {
      var roznica = (now.getTime() - ostatniePrzyjscie) / 3600000;
      if (roznica < 2) {
        zapiszAnomalie(pracownik, 'KROTKA_ZMIANA',
          'Zmiana ' + roznica.toFixed(1) + 'h (min 2h)', false);
      }
      if (roznica > 12) {
        zapiszAnomalie(pracownik, 'DLUGA_ZMIANA',
          'Zmiana ' + roznica.toFixed(1) + 'h (max 12h)', true);
      }
    }
  }

  if (akcja === 'P') {
    sprawdzBrakWyjscia(pracownik, now);
  }
}

function znajdzOstatniePrzyjscie(employeeId, now) {
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    var sheet = ss.getSheetByName(ZAKLADKI.EWIDENCJA);
    if (!sheet) return null;

    var data = pobierzDaneOgraniczone(sheet, 1000);
    var dzisiaj = formatData(now);

    for (var i = data.length - 1; i >= 1; i--) {
      if (String(data[i][1]) === String(employeeId) &&
          String(data[i][3]) === dzisiaj &&
          String(data[i][6]) === 'P') {
        return Number(data[i][9]);
      }
    }
    return null;
  } catch(e) { return null; }
}

function sprawdzBrakWyjscia(pracownik, now) {
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    var sheet = ss.getSheetByName(ZAKLADKI.EWIDENCJA);
    if (!sheet) return;

    var data = pobierzDaneOgraniczone(sheet, 1000);
    var wczoraj = formatData(new Date(now.getTime() - 86400000));
    var maP = false, maW = false;

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][1]) === String(pracownik.id) && String(data[i][3]) === wczoraj) {
        if (data[i][6] === 'P') maP = true;
        if (data[i][6] === 'W') maW = true;
      }
    }

    if (maP && !maW) {
      zapiszAnomalie(pracownik, 'BRAK_WYJSCIA',
        'Przyjscie ' + wczoraj + ' bez wyjscia', true);
      // Auto-zamkniecie jest realizowane przez trigger (patrz autoZamknijOtwartZmiany)
    }
  } catch(e) {
    Logger.log('Blad sprawdzBrakWyjscia: ' + e.message);
  }
}

function zapiszAnomalie(pracownik, typ, opis, wyslijEmail) {
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    var sheet = ss.getSheetByName(ZAKLADKI.ANOMALIE);
    if (!sheet) return;

    var now = new Date();
    var tz = Session.getScriptTimeZone();
    sheet.appendRow([
      'A' + (sheet.getLastRow() + 1),
      Utilities.formatDate(now, tz, "yyyy-MM-dd'T'HH:mm:ssZ"),
      pracownik.id,
      pracownik.name,
      typ,
      opis,
      'NOWA',
    ]);

    if (wyslijEmail) wyslijAlert(typ, opis, pracownik);
  } catch(e) {
    Logger.log('Blad zapiszAnomalie: ' + e.message);
  }
}

// ── wyslijAlert ───────────────────────────────────────────────────

function wyslijAlert(typ, opis, pracownik) {
  if (!CONFIG.ADMIN_EMAIL) {
    Logger.log('ADMIN_EMAIL nie skonfigurowany — pomijam alert: ' + typ);
    return;
  }
  try {
    var tz = Session.getScriptTimeZone();
    var temat = '[RCP We SMILE] ' + typ;
    var tresc =
      'System RCP v4 wykryl zdarzenie:\n\n' +
      'Typ: ' + typ + '\n' +
      'Opis: ' + opis + '\n' +
      (pracownik ? 'Pracownik: ' + pracownik.name + ' (ID: ' + pracownik.id + ')\n' : '') +
      'Czas: ' + Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm:ss z') + '\n\n' +
      'Klinika We SMILE, Warszawa · System RCP v4';
    GmailApp.sendEmail(CONFIG.ADMIN_EMAIL, temat, tresc);
  } catch(e) {
    Logger.log('Blad wysylania alertu [' + typ + ']: ' + e.message);
  }
}

// ── Trigger czasowy — codziennie o 23:55 ─────────────────────────
// Aby zainstalowac trigger: Apps Script → Triggers → Add Trigger
//   Funkcja: autoZamknijOtwartZmiany, Zdarzenie: Time-driven → Day timer → 11:00 PM to midnight

function autoZamknijOtwartZmiany() {
  zaladujKonfig();
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    var sheet = ss.getSheetByName(ZAKLADKI.EWIDENCJA);
    if (!sheet) return;

    var tz = Session.getScriptTimeZone();
    var now = new Date();
    var dzisiaj = formatData(now);

    // Zbierz dzisiejsze wpisy
    var data = pobierzDaneOgraniczone(sheet, 1000);
    var wejscia = {};  // employeeId -> { pracownik, timestamp }
    var wyjscia = {};  // employeeId -> true

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (String(row[3]) !== dzisiaj) continue;
      var eId = String(row[1]);
      if (row[6] === 'P') {
        wejscia[eId] = { name: String(row[2]), ts: Number(row[9]) };
      } else if (row[6] === 'W') {
        wyjscia[eId] = true;
      }
    }

    // Dla kazdego wejscia bez wyjscia — auto-zamkniecie
    for (var eid in wejscia) {
      if (!wyjscia[eid]) {
        var prac = wejscia[eid];
        sheet.appendRow([
          'E_AUTO_' + now.getTime() + '_' + eid,
          eid,
          prac.name,
          dzisiaj,
          '23:59:00',
          '',
          'W',
          CONFIG.KLINIKA_ID,
          'AUTO',
          new Date(dzisiaj + 'T23:59:00').getTime(),
          'AUTO_ZAMKNIETE',
          'Automatyczne zamkniecie triggera 23:55',
        ]);

        wyslijAlert('AUTO_ZAMKNIECIE',
          'Brak wyjscia dla ' + prac.name + ' (ID=' + eid + '). Auto-zamkniecie o 23:59.',
          { id: eid, name: prac.name });
      }
    }
  } catch(e) {
    Logger.log('Blad autoZamknijOtwartZmiany: ' + e.message);
  }
}

// ── Trigger na edycje arkusza Ewidencja_Czasu ────────────────────
// Apps Script → Triggers → Add Trigger
//   Funkcja: onEditEwidencja, Zdarzenie: From spreadsheet → On edit
// Wysyla email przy edycji istniejacego wpisu (wiersz > 1, juz istnieje).

function onEditEwidencja(e) {
  try {
    zaladujKonfig();
    var sheet = e.range.getSheet();
    if (sheet.getName() !== ZAKLADKI.EWIDENCJA) return;
    var row = e.range.getRow();
    if (row <= 1) return; // Naglowek — ignoruj

    // Buduj kontekst audytowy
    var edytowanaCelka = e.range.getA1Notation();
    var stara = e.oldValue !== undefined ? String(e.oldValue) : '?';
    var nowa  = e.value     !== undefined ? String(e.value)   : '?';
    var user  = Session.getActiveUser ? Session.getActiveUser().getEmail() : 'unknown';

    var msg =
      'EDYCJA ARKUSZA EWIDENCJA!\n\n' +
      'Uzytkownik: ' + user + '\n' +
      'Komorka: ' + edytowanaCelka + '\n' +
      'Stara wartosc: ' + stara + '\n' +
      'Nowa wartosc: ' + nowa + '\n' +
      'Czas: ' + new Date().toLocaleString('pl-PL');

    wyslijAlert('EDYCJA_EWIDENCJI', msg, null);
    zapiszLog('EDYCJA_EWIDENCJI', user, edytowanaCelka + ': ' + stara + ' -> ' + nowa);
  } catch(ex) {
    Logger.log('Blad onEditEwidencja: ' + ex.message);
  }
}

// ── Panel admina — API ────────────────────────────────────────────

function pobierzDaneAdmina() {
  zaladujKonfig();
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var tz = Session.getScriptTimeZone();
  var now = new Date();
  var dzisiaj = formatData(now);

  // Pracownicy
  var sheetP = ss.getSheetByName(ZAKLADKI.PRACOWNICY);
  var pracownicy = [];
  if (sheetP) {
    var pData = pobierzDaneOgraniczone(sheetP, 500);
    for (var i = 1; i < pData.length; i++) {
      if (!pData[i][0]) continue;
      pracownicy.push({
        id:      String(pData[i][0]),
        name:    sanitizeString(String(pData[i][1]), 30) + ' ' + sanitizeString(String(pData[i][3]), 10),
        rola:    sanitizeString(String(pData[i][5]), 40),
        status:  sanitizeString(String(pData[i][7]), 20),
        hasPin:  !!(pData[i][8] && String(pData[i][8]).length > 10),
      });
    }
  }

  // Dzisiejsza ewidencja
  var sheetE = ss.getSheetByName(ZAKLADKI.EWIDENCJA);
  var ewidencja = [];
  if (sheetE) {
    var eData = pobierzDaneOgraniczone(sheetE, 1000);
    for (var j = 1; j < eData.length; j++) {
      if (String(eData[j][3]) !== dzisiaj) continue;
      ewidencja.push({
        id:      String(eData[j][0]),
        empId:   String(eData[j][1]),
        name:    String(eData[j][2]),
        godzina: String(eData[j][4]),
        typ:     String(eData[j][6]),
        status:  String(eData[j][10]),
      });
    }
  }

  // Anomalie — ostatnie 30 dni, status NOWA
  var sheetA = ss.getSheetByName(ZAKLADKI.ANOMALIE);
  var anomalie = [];
  if (sheetA) {
    var aData = pobierzDaneOgraniczone(sheetA, 500);
    var cutoff = now.getTime() - 30 * 86400000;
    for (var k = 1; k < aData.length; k++) {
      var ts = new Date(String(aData[k][1])).getTime();
      if (ts < cutoff) continue;
      anomalie.push({
        id:      String(aData[k][0]),
        ts:      String(aData[k][1]),
        empId:   String(aData[k][2]),
        name:    String(aData[k][3]),
        typ:     String(aData[k][4]),
        opis:    String(aData[k][5]),
        status:  String(aData[k][6]),
      });
    }
  }

  // Walidacja schematow
  var brakiPrac = walidujSchematArkusza(sheetP, SCHEMA.PRACOWNICY);
  var brakiEw   = walidujSchematArkusza(sheetE, SCHEMA.EWIDENCJA);

  return {
    pracownicy: pracownicy,
    ewidencja:  ewidencja,
    anomalie:   anomalie.slice(-50).reverse(), // ostatnie 50, najnowsze pierwsze
    dzisiaj:    dzisiaj,
    brakiSchematu: { pracownicy: brakiPrac, ewidencja: brakiEw },
  };
}

function zamknijAnomalie(anomaliaId) {
  zaladujKonfig();
  anomaliaId = sanitizeString(String(anomaliaId), 30);

  var lock = LockService.getScriptLock();
  try { lock.waitLock(CONFIG.GAS_SCRIPT_LOCK_MS); } catch(e) {
    return { success: false, message: 'Serwer zajety.' };
  }

  try {
    var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    var sheet = ss.getSheetByName(ZAKLADKI.ANOMALIE);
    if (!sheet) return { success: false, message: 'Brak arkusza.' };

    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === anomaliaId) {
        sheet.getRange(i + 1, 7).setValue('ZAMKNIETA');
        return { success: true };
      }
    }
    return { success: false, message: 'Nie znaleziono anomalii.' };
  } finally {
    lock.releaseLock();
  }
}

// ── Formatowanie dat — z uwzglednieniem strefy czasowej ──────────

function formatData(d) {
  var tz = Session.getScriptTimeZone();
  return Utilities.formatDate(d, tz, 'yyyy-MM-dd');
}

function formatGodzina(d) {
  var tz = Session.getScriptTimeZone();
  return Utilities.formatDate(d, tz, 'HH:mm:ss');
}
