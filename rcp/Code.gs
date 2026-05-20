// ================================================================
// RCP v3 — Code.gs
// System Rejestracji Czasu Pracy · Klinika We SMILE, Warszawa
// ================================================================
// ES5 (var/function) dla kompatybilnosci z Apps Script V8.
// Brak polskich znakow w nazwach zmiennych i kluczach obiektow.
// ================================================================

// ── Konfiguracja globalna ────────────────────────────────────────

var CONFIG = {
  HMAC_SECRET:          '',
  SHEET_ID:             '',
  ADMIN_EMAIL:          '',
  KLINIKA_ID:           '1',
  TOKEN_WINDOW:         15000,          // 15 sekund — krotsze okno = trudniejszy replay
  RATE_LIMIT_MAX:       5,              // max prob w oknie
  RATE_LIMIT_WINDOW:    10 * 60 * 1000, // 10 minut w ms
  RATE_LIMIT_LOCKOUT:   30 * 60 * 1000, // 30 minut blokady
  LOCK_WAIT_MS:         10000,          // timeout na LockService
};

var ZAKLADKI = {
  PRACOWNICY: 'Pracownicy',
  KLINIKI:    'Kliniki',
  EWIDENCJA:  'Ewidencja_Czasu',
  LOGI:       'Logi_Audytowe',
  ANOMALIE:   'Anomalie',
};

// ── Ladowanie konfiguracji z PropertiesService ───────────────────

function zaladujKonfig() {
  var props = PropertiesService.getScriptProperties();
  CONFIG.HMAC_SECRET = props.getProperty('HMAC_SECRET') || '';
  CONFIG.SHEET_ID    = props.getProperty('SHEET_ID')    || '';
  CONFIG.ADMIN_EMAIL = props.getProperty('ADMIN_EMAIL') || '';
  CONFIG.KLINIKA_ID  = props.getProperty('KLINIKA_ID')  || '1';
}

// ── Routing ──────────────────────────────────────────────────────

function doGet(e) {
  zaladujKonfig();
  var page = e.parameter.page;
  var output;

  if (page === 'tablet') {
    output = HtmlService.createHtmlOutputFromFile('Tablet')
      .setTitle('RCP · We SMILE · Tablet');
  } else {
    output = HtmlService.createHtmlOutputFromFile('Index')
      .setTitle('RCP · We SMILE');
  }

  // PULAPKA 1 — XFrameOptionsMode moze byc null w niektorych srodowiskach
  if (HtmlService.XFrameOptionsMode && HtmlService.XFrameOptionsMode.ALLOWALL) {
    output.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  return output;
}

// ── pobierzDaneStartowe ──────────────────────────────────────────

function pobierzDaneStartowe() {
  zaladujKonfig();
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);

  var sheetPrac = ss.getSheetByName(ZAKLADKI.PRACOWNICY);
  var pracownicy = [];
  if (sheetPrac) {
    var data = sheetPrac.getDataRange().getValues();
    // Naglowek: ID|IMIE|NAZWISKO|INICJAL_NAZWISKA|ROK_URODZENIA|ROLA|EMAIL|STATUS|DATA_DODANIA
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (String(row[7]).toLowerCase() === 'aktywny') {
        pracownicy.push({
          id:      String(row[0]),
          name:    String(row[1]) + ' ' + String(row[3]) + '.',
          imie:    String(row[1]),
          inicjal: String(row[3]),
          year:    String(row[4]),
          role:    String(row[5]),
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
        klinika = { nazwa: String(kData[j][1]), miasto: String(kData[j][3]) };
        break;
      }
    }
  }

  return {
    pracownicy:  pracownicy,
    klinika:     klinika,
    tokenWindow: CONFIG.TOKEN_WINDOW / 1000,
  };
}

// ── generujTokenTablet ───────────────────────────────────────────

function generujTokenTablet() {
  zaladujKonfig();
  var ts = new Date().getTime();
  var token = obliczToken(ts);
  var secsWindow = CONFIG.TOKEN_WINDOW / 1000;
  var secsLeft = secsWindow - Math.floor((ts % CONFIG.TOKEN_WINDOW) / 1000);

  return {
    token:        token.toUpperCase(),
    secsLeft:     secsLeft,
    secsWindow:   secsWindow,
    timestamp:    ts,
  };
}

// ── HMAC-SHA256 ──────────────────────────────────────────────────

function obliczToken(timestamp) {
  if (!CONFIG.HMAC_SECRET) {
    throw new Error('HMAC_SECRET nie jest skonfigurowany w Script Properties');
  }
  var timeSlot = Math.floor(timestamp / CONFIG.TOKEN_WINDOW);
  var message  = Utilities.newBlob(String(timeSlot)).getBytes();
  var key      = Utilities.newBlob(CONFIG.HMAC_SECRET).getBytes();
  var hash     = Utilities.computeHmacSha256Signature(message, key);
  var hex = hash.map(function(b) {
    return ('0' + (b & 0xFF).toString(16)).slice(-2);
  }).join('');
  return hex.substring(0, 16);
}

// Okno weryfikacji ±1 — tolerancja na roznice zegara i granice okna
function weryfikujToken(tokenInput) {
  var ts    = new Date().getTime();
  var slot  = Math.floor(ts / CONFIG.TOKEN_WINDOW);
  var input = String(tokenInput).toLowerCase().replace(/[^a-f0-9]/g, '');
  if (input.length < 4) return false;

  for (var delta = -1; delta <= 1; delta++) {
    var valid = obliczToken((slot + delta) * CONFIG.TOKEN_WINDOW);
    if (valid.substring(0, input.length) === input) return true;
  }
  return false;
}

// ── Rate limiting z LockService ──────────────────────────────────

function sprawdzRateLimit(employeeId) {
  var props = PropertiesService.getScriptProperties();
  var key   = 'rl_' + String(employeeId);
  var now   = new Date().getTime();
  var raw   = props.getProperty(key);
  var state = raw ? JSON.parse(raw) : { count: 0, windowStart: now, locked: false, lockUntil: 0 };

  // Sprawdz blokade
  if (state.locked && now < state.lockUntil) {
    var minLeft = Math.ceil((state.lockUntil - now) / 60000);
    return {
      allowed:      false,
      attemptsLeft: 0,
      reason:       'Konto zablokowane. Sprobuj ponownie za ' + minLeft + ' min.',
    };
  }

  // Reset okna jesli minelo
  if (now - state.windowStart > CONFIG.RATE_LIMIT_WINDOW) {
    state = { count: 0, windowStart: now, locked: false, lockUntil: 0 };
  }

  var attemptsLeft = CONFIG.RATE_LIMIT_MAX - state.count;
  return { allowed: true, attemptsLeft: attemptsLeft, state: state, key: key, now: now };
}

function zapiszNieudanaProbe(employeeId) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.LOCK_WAIT_MS);
    var props = PropertiesService.getScriptProperties();
    var key   = 'rl_' + String(employeeId);
    var now   = new Date().getTime();
    var raw   = props.getProperty(key);
    var state = raw ? JSON.parse(raw) : { count: 0, windowStart: now, locked: false, lockUntil: 0 };

    if (now - state.windowStart > CONFIG.RATE_LIMIT_WINDOW) {
      state = { count: 0, windowStart: now, locked: false, lockUntil: 0 };
    }
    state.count++;

    if (state.count >= CONFIG.RATE_LIMIT_MAX) {
      state.locked    = true;
      state.lockUntil = now + CONFIG.RATE_LIMIT_LOCKOUT;
      wyslijAlert('RATE_LIMIT',
        'Pracownik ID=' + employeeId + ' przekroczyl limit ' + CONFIG.RATE_LIMIT_MAX + ' blednych tokenow w 10 min. Blokada 30 min.',
        null);
    }
    props.setProperty(key, JSON.stringify(state));
    return CONFIG.RATE_LIMIT_MAX - state.count;
  } catch(e) {
    Logger.log('LockService error zapiszNieudanaProbe: ' + e.message);
    return 0;
  } finally {
    lock.releaseLock();
  }
}

function resetRateLimit(employeeId) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.LOCK_WAIT_MS);
    PropertiesService.getScriptProperties().deleteProperty('rl_' + String(employeeId));
  } catch(e) {
    Logger.log('LockService error resetRateLimit: ' + e.message);
  } finally {
    lock.releaseLock();
  }
}

// ── weryfikujIRejestruj — glowna funkcja rejestracji ─────────────

function weryfikujIRejestruj(payload) {
  zaladujKonfig();

  // Sanitizacja wejscia — obrona przed injection i za-dlugimi stringami
  var employeeId = sanitizeEmployeeId(payload.employeeId);
  var tokenInput = sanitizeTokenInput(payload.tokenInput);
  var akcja      = String(payload.akcja || '').replace(/[^PW]/g, '').substring(0, 1); // tylko 'P' lub 'W'

  // 1. Rate limiting
  var rl = sprawdzRateLimit(employeeId);
  if (!rl.allowed) {
    zapiszLog('RATE_LIMIT_BLOKADA', employeeId, rl.reason);
    return { success: false, message: rl.reason, attemptsLeft: 0 };
  }

  // 2. Weryfikacja tokenu
  if (!weryfikujToken(tokenInput)) {
    var attLeft = zapiszNieudanaProbe(employeeId);
    zapiszLog('NIEPRAWIDLOWY_TOKEN', employeeId, 'Token: ' + tokenInput.substring(0, 8));

    var msg = attLeft > 0
      ? 'Nieprawidlowy token. Pozostale proby: ' + attLeft + '. Sprawdz tablet.'
      : 'Nieprawidlowy token. Konto zostalo zablokowane na 30 minut.';
    return { success: false, message: msg, attemptsLeft: attLeft };
  }

  // 2b. Walidacja akcji
  if (akcja !== 'P' && akcja !== 'W') {
    return { success: false, message: 'Nieprawidlowa akcja rejestracji.', attemptsLeft: 0 };
  }

  // 3. Pobierz pracownika
  var pracownik = pobierzPracownika(employeeId);
  if (!pracownik) {
    zapiszLog('REJESTRACJA_BLAD', employeeId, 'Nieznany pracownik ID=' + employeeId);
    return { success: false, message: 'Nie znaleziono pracownika w systemie. Skontaktuj sie z administratorem.', attemptsLeft: rl.attemptsLeft };
  }
  if (pracownik.status !== 'aktywny') {
    zapiszLog('REJESTRACJA_BLAD', employeeId, 'Pracownik nieaktywny ID=' + employeeId);
    return { success: false, message: 'Konto pracownika jest nieaktywne. Skontaktuj sie z administratorem.', attemptsLeft: 0 };
  }

  // 4. Reset rate limit po udanej weryfikacji
  resetRateLimit(employeeId);

  // 4b. Sprawdz duplikat — ta sama akcja w ciagu 60s
  var ss0 = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  if (sprawdzDuplikat(employeeId, akcja, ss0)) {
    zapiszLog('DUPLIKAT', employeeId, 'Duplikat ' + akcja + ' w ciagu 60s');
    return { success: false, message: 'Rejestracja juz zostala zapisana (duplikat w ciagu 60s).', attemptsLeft: rl.attemptsLeft };
  }

  // 5. Zapisz wpis (z lockiem aby uniknac race condition przy rownoczesnych rejestracjach)
  var now       = new Date();
  var tokenSkrot = obliczToken(now.getTime()).substring(0, 8);
  var rekordId  = zapiszEwidencje(pracownik, akcja, now, tokenSkrot);

  // 6. Log audytowy
  zapiszLog('REJESTRACJA_OK', employeeId,
    'Akcja=' + akcja + ' Godz=' + formatGodzina(now) + ' Token=' + tokenSkrot);

  // 7. Anomalie
  sprawdzAnomalie(pracownik, akcja, now);

  return {
    success:    true,
    message:    'Zarejestrowano pomyslnie.',
    rekordId:   rekordId,
    godzina:    formatGodzina(now),
    data:       formatData(now),
    imie:       pracownik.imie,
    inicjal:    pracownik.inicjal,
    year:       pracownik.rok_urodzenia,
    role:       pracownik.rola,
  };
}

// ── pobierzPracownika ────────────────────────────────────────────

function pobierzPracownika(id) {
  var ss    = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var sheet = ss.getSheetByName(ZAKLADKI.PRACOWNICY);
  if (!sheet) return null;

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      return {
        id:            String(data[i][0]),
        imie:          String(data[i][1]),
        nazwisko:      String(data[i][2]),
        inicjal:       String(data[i][3]),
        rok_urodzenia: String(data[i][4]),
        rola:          String(data[i][5]),
        email:         String(data[i][6]),
        status:        String(data[i][7]).toLowerCase(),
        name:          String(data[i][1]) + ' ' + String(data[i][3]) + '.',
      };
    }
  }
  return null;
}

// ── zapiszEwidencje (z LockService) ─────────────────────────────

function zapiszEwidencje(pracownik, akcja, now, tokenSkrot) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.LOCK_WAIT_MS);
    var ss    = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    var sheet = ss.getSheetByName(ZAKLADKI.EWIDENCJA);
    if (!sheet) return null;

    var dni = ['Niedziela','Poniedzialek','Wtorek','Sroda','Czwartek','Piatek','Sobota'];
    var id  = 'E' + (sheet.getLastRow() + 1);

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
  } catch(e) {
    Logger.log('LockService error zapiszEwidencje: ' + e.message);
    return null;
  } finally {
    lock.releaseLock();
  }
}

// ── zapiszLog ────────────────────────────────────────────────────

function zapiszLog(typZdarzenia, employeeId, szczegoly) {
  try {
    var ss    = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    var sheet = ss.getSheetByName(ZAKLADKI.LOGI);
    if (!sheet) return;

    var now = new Date();
    sheet.appendRow([
      'L' + (sheet.getLastRow() + 1),
      now.toISOString(),
      typZdarzenia,
      String(employeeId || ''),
      String(szczegoly   || ''),
      '',  // IP_HASH — niedostepny w Apps Script
    ]);
  } catch(e) {
    Logger.log('Blad zapisu logu: ' + e.message);
  }
}

// ── Detekcja anomalii ────────────────────────────────────────────

function sprawdzAnomalie(pracownik, akcja, now) {
  var godz  = now.getHours();
  var dzien = now.getDay(); // 0=niedziela, 6=sobota

  if (godz >= 22 || godz < 6) {
    zapiszAnomalie(pracownik, 'NOCNA_REJESTRACJA',
      'Rejestracja o ' + formatGodzina(now) + ' (poza godz. 06:00-22:00)', true);
  }

  if (dzien === 0 || dzien === 6) {
    zapiszAnomalie(pracownik, 'WEEKENDOWA_REJESTRACJA',
      'Rejestracja w ' + (dzien === 6 ? 'sobote' : 'niedziele') + ' ' + formatData(now), true);
  }

  if (akcja === 'W') {
    var ostatniePrzyjscie = znajdzOstatniePrzyjscie(pracownik.id, now);
    if (ostatniePrzyjscie) {
      var roznica = (now.getTime() - ostatniePrzyjscie) / (1000 * 60 * 60);
      if (roznica < 2) {
        zapiszAnomalie(pracownik, 'KROTKA_ZMIANA',
          'Zmiana ' + roznica.toFixed(1) + 'h (min. 2h) — ' + formatData(now), false);
      }
      if (roznica > 12) {
        zapiszAnomalie(pracownik, 'DLUGA_ZMIANA',
          'Zmiana ' + roznica.toFixed(1) + 'h (max. 12h) — ' + formatData(now), true);
      }
    }
  }

  if (akcja === 'P') {
    sprawdzBrakWyjscia(pracownik, now);
  }
}

function znajdzOstatniePrzyjscie(employeeId, now) {
  try {
    var ss    = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    var sheet = ss.getSheetByName(ZAKLADKI.EWIDENCJA);
    if (!sheet) return null;

    var data    = getRecentEwidencjaData(sheet);
    var dzisiaj = formatData(now);

    for (var i = data.length - 1; i >= 0; i--) {
      if (String(data[i][1]) === String(employeeId) &&
          String(data[i][3]) === dzisiaj &&
          String(data[i][6]) === 'P') {
        return Number(data[i][9]);
      }
    }
    return null;
  } catch(e) {
    return null;
  }
}

function sprawdzBrakWyjscia(pracownik, now) {
  try {
    var ss    = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    var sheet = ss.getSheetByName(ZAKLADKI.EWIDENCJA);
    if (!sheet) return;

    var data     = getRecentEwidencjaData(sheet);
    var wczoraj  = formatData(new Date(now.getTime() - 86400000));
    var maP = false;
    var maW = false;

    for (var i = 0; i < data.length; i++) {
      if (String(data[i][1]) === String(pracownik.id) && String(data[i][3]) === wczoraj) {
        if (data[i][6] === 'P') maP = true;
        if (data[i][6] === 'W') maW = true;
      }
    }

    if (maP && !maW) {
      zapiszAnomalie(pracownik, 'BRAK_WYJSCIA',
        'Przyjscie ' + wczoraj + ' bez rejestracji wyjscia — zamkniete automatycznie', true);

      var lock = LockService.getScriptLock();
      try {
        lock.waitLock(CONFIG.LOCK_WAIT_MS);
        sheet.appendRow([
          'E_AUTO_' + now.getTime(),
          pracownik.id,
          pracownik.name,
          wczoraj,
          '23:59:00',
          '',
          'W',
          CONFIG.KLINIKA_ID,
          'AUTO',
          new Date(now.getTime() - 86400000).setHours(23, 59, 0, 0),
          'AUTO_ZAMKNIETE',
          'Automatyczne zamkniecie — brak wyjscia',
        ]);
      } finally {
        lock.releaseLock();
      }
    }
  } catch(e) {
    Logger.log('Blad sprawdzBrakWyjscia: ' + e.message);
  }
}

function zapiszAnomalie(pracownik, typ, opis, wyslijEmail) {
  try {
    var ss    = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    var sheet = ss.getSheetByName(ZAKLADKI.ANOMALIE);
    if (!sheet) return;

    var now = new Date();
    sheet.appendRow([
      'A' + (sheet.getLastRow() + 1),
      now.toISOString(),
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

// ── Alerty email ─────────────────────────────────────────────────

function wyslijAlert(typ, opis, pracownik) {
  if (!CONFIG.ADMIN_EMAIL) return;
  try {
    var temat = '[RCP We SMILE] Anomalia: ' + typ;
    var tresc = 'System RCP v3 wykryl anomalie.\n\n' +
      'Typ: ' + typ + '\n' +
      'Opis: ' + opis + '\n' +
      (pracownik ? 'Pracownik: ' + pracownik.name + ' (ID: ' + pracownik.id + ')\n' : '') +
      'Czas: ' + new Date().toLocaleString('pl-PL') + '\n\n' +
      'Sprawdz arkusz Anomalie w Google Sheets.\n' +
      'Klinika We SMILE, Warszawa · RCP v3';
    GmailApp.sendEmail(CONFIG.ADMIN_EMAIL, temat, tresc);
  } catch(e) {
    Logger.log('Blad wysylania alertu: ' + e.message);
  }
}

// ── Trigger dzienny — automatyczne zamykanie zmian o 23:55 ───────
// Uruchamiaj przez instalujTriggery() — dziala codziennie o 23:55.

function autoZamknijOtwarteZmiany() {
  zaladujKonfig();
  var ss      = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var sheet   = ss.getSheetByName(ZAKLADKI.EWIDENCJA);
  var shPrac  = ss.getSheetByName(ZAKLADKI.PRACOWNICY);
  if (!sheet || !shPrac) return;

  var dzisiaj = formatData(new Date());
  var data    = sheet.getDataRange().getValues();

  // Zbierz wszystkich pracownikow z P dzisiaj
  var maPMap = {};
  var maWMap = {};
  var nameMap = {};

  for (var i = 1; i < data.length; i++) {
    var dRow = data[i];
    if (String(dRow[3]) !== dzisiaj) continue;
    var pid = String(dRow[1]);
    if (dRow[6] === 'P') { maPMap[pid] = true; nameMap[pid] = String(dRow[2]); }
    if (dRow[6] === 'W') { maWMap[pid] = true; }
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.LOCK_WAIT_MS);
    for (var pid2 in maPMap) {
      if (!maWMap[pid2]) {
        sheet.appendRow([
          'E_AUTO_' + new Date().getTime() + '_' + pid2,
          pid2,
          nameMap[pid2] || pid2,
          dzisiaj,
          '23:59:00',
          '',
          'W',
          CONFIG.KLINIKA_ID,
          'AUTO',
          new Date().setHours(23, 59, 0, 0),
          'AUTO_ZAMKNIETE',
          'Trigger dobowy 23:55 — brak wyjscia',
        ]);

        // Log anomalii
        var shAno = ss.getSheetByName(ZAKLADKI.ANOMALIE);
        if (shAno) {
          shAno.appendRow([
            'A_AUTO_' + new Date().getTime() + '_' + pid2,
            new Date().toISOString(),
            pid2,
            nameMap[pid2] || pid2,
            'BRAK_WYJSCIA',
            'Zmiana ' + dzisiaj + ' zamknieta automatycznie przez trigger 23:55',
            'AUTO',
          ]);
        }

        // Alert email
        if (CONFIG.ADMIN_EMAIL) {
          try {
            GmailApp.sendEmail(CONFIG.ADMIN_EMAIL,
              '[RCP We SMILE] Auto-zamkniecie zmiany: ' + (nameMap[pid2] || pid2),
              'Pracownik: ' + (nameMap[pid2] || pid2) + '\n' +
              'Data: ' + dzisiaj + '\n' +
              'Zmiana zamknieta automatycznie o 23:59 przez trigger dobowy.\n' +
              'Brak rejestracji wyjscia.');
          } catch(e2) {}
        }
      }
    }
  } finally {
    lock.releaseLock();
  }
}

// ── Trigger onEdit — niezmienialnosc arkusza Ewidencja_Czasu ─────
// Instalowany przez instalujTriggery() jako trigger na zdarzenie Edit.

function onEditArkusza(e) {
  zaladujKonfig();
  try {
    var range = e.range;
    var sheet = range.getSheet();
    if (sheet.getName() !== ZAKLADKI.EWIDENCJA) return;

    // Zapisz alert audytowy
    var user  = Session.getActiveUser ? Session.getActiveUser().getEmail() : 'nieznany';
    var opis  = 'Edycja komorki ' + range.getA1Notation() +
                ' przez ' + user +
                ' — stara wartosc: ' + JSON.stringify(e.oldValue) +
                ' — nowa wartosc: ' + JSON.stringify(e.value);

    zapiszLog('EDYCJA_EWIDENCJI', user, opis);

    if (CONFIG.ADMIN_EMAIL) {
      GmailApp.sendEmail(CONFIG.ADMIN_EMAIL,
        '[RCP We SMILE] UWAGA: Edycja arkusza Ewidencja_Czasu',
        'Wykryto bezposrednia edycje arkusza ewidencji czasu pracy.\n\n' +
        opis + '\n\n' +
        'Sprawdz arkusz Logi_Audytowe.\n' +
        'Klinika We SMILE, Warszawa · RCP v3');
    }
  } catch(e2) {
    Logger.log('Blad onEditArkusza: ' + e2.message);
  }
}

// ── Instalacja triggerow (uruchamiana raz przez admina) ──────────

function instalujTriggery() {
  // Usun stare triggery RCP zeby nie duplikowac
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    var fn = triggers[i].getHandlerFunction();
    if (fn === 'autoZamknijOtwarteZmiany' || fn === 'onEditArkusza') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // Trigger dzienny o 23:55
  ScriptApp.newTrigger('autoZamknijOtwarteZmiany')
    .timeBased()
    .atHour(23)
    .nearMinute(55)
    .everyDays(1)
    .create();

  // Trigger onEdit dla arkusza Sheets
  zaladujKonfig();
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  ScriptApp.newTrigger('onEditArkusza')
    .forSpreadsheet(ss)
    .onEdit()
    .create();

  Logger.log('Triggery zainstalowane pomyslnie.');
  return 'Triggery zainstalowane: autoZamknijOtwarteZmiany (dobowy 23:55) + onEditArkusza.';
}

// ── Inicjalizacja arkusza ────────────────────────────────────────

function inicjalizujArkusz() {
  zaladujKonfig();
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);

  var sheetsDefs = [
    {
      name: ZAKLADKI.PRACOWNICY,
      headers: ['ID','IMIE','NAZWISKO','INICJAL_NAZWISKA','ROK_URODZENIA','ROLA','EMAIL','STATUS','DATA_DODANIA'],
    },
    {
      name: ZAKLADKI.KLINIKI,
      headers: ['ID','NAZWA','ADRES','MIASTO','STATUS'],
    },
    {
      name: ZAKLADKI.EWIDENCJA,
      headers: ['ID','ID_PRACOWNIKA','IMIE_NAZWISKO','DATA','GODZINA','DZIEN_TYGODNIA','TYP','ID_KLINIKI','TOKEN_SKROT','TIMESTAMP_UNIX','STATUS','UWAGI'],
    },
    {
      name: ZAKLADKI.LOGI,
      headers: ['ID','TIMESTAMP','TYP_ZDARZENIA','ID_PRACOWNIKA','SZCZEGOLY','IP_HASH'],
    },
    {
      name: ZAKLADKI.ANOMALIE,
      headers: ['ID','TIMESTAMP','ID_PRACOWNIKA','IMIE_NAZWISKO','TYP_ANOMALII','OPIS','STATUS'],
    },
  ];

  for (var i = 0; i < sheetsDefs.length; i++) {
    var def = sheetsDefs[i];
    var sh  = ss.getSheetByName(def.name) || ss.insertSheet(def.name);
    if (sh.getLastRow() === 0) {
      sh.appendRow(def.headers);
      sh.getRange(1, 1, 1, def.headers.length)
        .setFontWeight('bold')
        .setBackground('#f0f0f0');
    }
  }

  var shKlin = ss.getSheetByName(ZAKLADKI.KLINIKI);
  if (shKlin && shKlin.getLastRow() <= 1) {
    shKlin.appendRow(['1','We SMILE','ul. Przykladowa 1','Warszawa','aktywna']);
  }

  return 'Arkusz zainicjalizowany. Nastepny krok: uruchom instalujTriggery().';
}

// ── Helpers dat — Utilities.formatDate z timezone skryptu ────────
// Zapobiega roznicom miedzy UTC a lokalnym czasem serwera.

function getTz() {
  try { return Session.getScriptTimeZone(); } catch(e) { return 'Europe/Warsaw'; }
}

function formatData(d) {
  return Utilities.formatDate(d, getTz(), 'yyyy-MM-dd');
}

function formatGodzina(d) {
  return Utilities.formatDate(d, getTz(), 'HH:mm:ss');
}

// ── Sanitizacja wejscia ───────────────────────────────────────────

function sanitizeEmployeeId(val) {
  // Tylko alphanumeryczne i myslnik/podkreslenie, max 50 znakow
  return String(val || '').replace(/[^0-9a-zA-Z_\-]/g, '').substring(0, 50);
}

function sanitizeTokenInput(val) {
  // Tylko hex lowercase, max 16 znakow
  return String(val || '').toLowerCase().replace(/[^0-9a-f]/g, '').substring(0, 16);
}

// ── Optymalizacja Sheets — czytaj tylko ostatnie N wierszy ────────
// Zapobiega freeze przy arkuszach > 10k wierszy.

var SHEET_READ_LIMIT = 2000; // ostatnie 2000 wpisow = ~2 lata dla 10 pracownikow

function getRecentEwidencjaData(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  var startRow = Math.max(2, lastRow - SHEET_READ_LIMIT + 1);
  var numRows  = lastRow - startRow + 1;
  return sheet.getRange(startRow, 1, numRows, 12).getValues();
}

// ── Deduplication — blokada wielokrotnej rejestracji w 60s ───────

function sprawdzDuplikat(employeeId, akcja, ss) {
  var sheet = ss.getSheetByName(ZAKLADKI.EWIDENCJA);
  if (!sheet) return false;

  var data    = getRecentEwidencjaData(sheet);
  var nowTs   = Date.now();
  var dzisiaj = formatData(new Date());

  for (var i = data.length - 1; i >= 0; i--) {
    if (String(data[i][1]) === String(employeeId) &&
        String(data[i][3]) === dzisiaj &&
        String(data[i][6]) === akcja) {
      var recTs = Number(data[i][9]);
      if (nowTs - recTs < 60000) return true; // ten sam typ w ciagu 60s = duplikat
      break;
    }
  }
  return false;
}
