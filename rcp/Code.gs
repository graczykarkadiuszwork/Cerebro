// ============================================================
// RCP v3 — Code.gs
// Google Apps Script backend — klinika We SMILE, Warszawa
// ============================================================

// ============================================================
// ROUTING
// ============================================================

function doGet(e) {
  var page = e.parameter.page;
  var output;
  if (page === 'tablet') {
    output = HtmlService.createHtmlOutputFromFile('Tablet')
      .setTitle('RCP · We SMILE · Tablet');
  } else {
    output = HtmlService.createHtmlOutputFromFile('Index')
      .setTitle('RCP · We SMILE');
  }
  if (HtmlService.XFrameOptionsMode && HtmlService.XFrameOptionsMode.ALLOWALL) {
    output.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  return output;
}

// ============================================================
// KONFIGURACJA
// ============================================================

function getConfig() {
  var props = PropertiesService.getScriptProperties();
  return {
    HMAC_SECRET:  props.getProperty('HMAC_SECRET')  || '',
    SHEET_ID:     props.getProperty('SHEET_ID')     || '',
    ADMIN_EMAIL:  props.getProperty('ADMIN_EMAIL')  || '',
    KLINIKA_ID:   props.getProperty('KLINIKA_ID')   || '1'
  };
}

var ZAKLADKI = {
  PRACOWNICY:    'Pracownicy',
  KLINIKI:       'Kliniki',
  EWIDENCJA:     'Ewidencja_Czasu',
  LOGI:          'Logi_Audytowe',
  ANOMALIE:      'Anomalie'
};

// ============================================================
// HMAC-SHA256 TOKEN
// ============================================================

function obliczToken(timestampMs) {
  var cfg = getConfig();
  if (!cfg.HMAC_SECRET) {
    throw new Error('HMAC_SECRET nie jest skonfigurowany w Script Properties');
  }
  var timeSlot = Math.floor(timestampMs / 60000);
  var message = Utilities.newBlob(String(timeSlot)).getBytes();
  var key     = Utilities.newBlob(cfg.HMAC_SECRET).getBytes();
  var hash    = Utilities.computeHmacSha256Signature(message, key);
  var hex = hash.map(function(b) {
    return ('0' + (b & 0xFF).toString(16)).slice(-2);
  }).join('');
  return hex.substring(0, 16);
}

function weryfikujToken(tokenInput) {
  if (!tokenInput) return false;
  var now = Date.now();
  var input = tokenInput.toLowerCase().replace(/[^0-9a-f]/g, '');
  for (var delta = -1; delta <= 1; delta++) {
    var slotMs = (Math.floor(now / 60000) + delta) * 60000;
    var token  = obliczToken(slotMs);
    // Akceptuj pierwsze 4 znaki (1 sekcja) lub pelny token 16 znakow
    if (input.length >= 4 && token.substring(0, input.length) === input) {
      return true;
    }
  }
  return false;
}

// ============================================================
// DANE STARTOWE (wywolywane przez google.script.run)
// ============================================================

function pobierzDaneStartowe() {
  var cfg    = getConfig();
  var ss     = SpreadsheetApp.openById(cfg.SHEET_ID);
  var shPrac = ss.getSheetByName(ZAKLADKI.PRACOWNICY);
  var shKlin = ss.getSheetByName(ZAKLADKI.KLINIKI);

  var pracownicy = [];
  if (shPrac) {
    var data = shPrac.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (String(row[7]).toLowerCase() === 'aktywny') {
        pracownicy.push({
          id:      String(row[0]),
          imie:    String(row[1]),
          inicjal: String(row[3]),
          rok:     String(row[4]),
          rola:    String(row[5]),
          name:    String(row[1]) + ' ' + String(row[3]) + '.'
        });
      }
    }
  }

  var klinika = { nazwa: 'We SMILE', miasto: 'Warszawa' };
  if (shKlin) {
    var kdata = shKlin.getDataRange().getValues();
    for (var j = 1; j < kdata.length; j++) {
      if (String(kdata[j][0]) === cfg.KLINIKA_ID) {
        klinika.nazwa  = String(kdata[j][1]);
        klinika.miasto = String(kdata[j][3]);
        break;
      }
    }
  }

  return {
    pracownicy:  pracownicy,
    klinika:     klinika,
    tokenWindow: 60
  };
}

// ============================================================
// REJESTRACJA (wywolywana przez google.script.run)
// ============================================================

function weryfikujIRejestruj(payload) {
  // payload = { employeeId, tokenInput, akcja, timestamp }
  var cfg = getConfig();

  // Rate limiting
  var rlKey    = 'RL_' + Utilities.base64Encode(
    Utilities.computeDigest(Utilities.DigestAlgorithm.MD5,
    String(payload.employeeId || 'anon'))
  ).substring(0, 12);
  if (!sprawdzRateLimit(rlKey)) {
    zapiszLog(cfg, 'BLOKADA_RATE_LIMIT', payload.employeeId, 'Przekroczono limit prób');
    return { success: false, message: 'Zbyt wiele nieudanych prób. Spróbuj za 30 minut.' };
  }

  // Weryfikacja tokenu
  if (!weryfikujToken(payload.tokenInput)) {
    inkrementujNieudane(rlKey);
    zapiszLog(cfg, 'NIEPRAWIDLOWY_TOKEN', payload.employeeId,
              'Token: ' + String(payload.tokenInput).substring(0, 8));
    return { success: false, message: 'Nieprawidłowy token. Sprawdź wyświetlacz przy wejściu.' };
  }
  resetujNieudane(rlKey);

  // Weryfikacja pracownika
  var ss    = SpreadsheetApp.openById(cfg.SHEET_ID);
  var shPrac = ss.getSheetByName(ZAKLADKI.PRACOWNICY);
  if (!shPrac) {
    return { success: false, message: 'Błąd konfiguracji: brak arkusza Pracownicy.' };
  }

  var pdata     = shPrac.getDataRange().getValues();
  var pracownik = null;
  for (var i = 1; i < pdata.length; i++) {
    if (String(pdata[i][0]) === String(payload.employeeId) &&
        String(pdata[i][7]).toLowerCase() === 'aktywny') {
      pracownik = {
        id:      String(pdata[i][0]),
        imie:    String(pdata[i][1]),
        inicjal: String(pdata[i][3]),
        rok:     String(pdata[i][4]),
        rola:    String(pdata[i][5])
      };
      break;
    }
  }
  if (!pracownik) {
    return { success: false, message: 'Nie znaleziono aktywnego pracownika.' };
  }

  // Zapis wpisu
  var now           = new Date();
  var tokenSkrot    = obliczToken(Date.now()).substring(0, 8);
  var imieNazwisko  = pracownik.imie + ' ' + pracownik.inicjal + '.';
  var dzieniTygodnia = ['Niedziela','Poniedzialek','Wtorek','Sroda',
                        'Czwartek','Piatek','Sobota'][now.getDay()];
  var wpis = {
    id:            Utilities.getUuid(),
    idPracownika:  pracownik.id,
    imieNazwisko:  imieNazwisko,
    data:          Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    godzina:       Utilities.formatDate(now, Session.getScriptTimeZone(), 'HH:mm:ss'),
    dzien:         dzieniTygodnia,
    typ:           payload.akcja === 'arrive' ? 'P' : 'W',
    idKliniki:     cfg.KLINIKA_ID,
    tokenSkrot:    tokenSkrot,
    timestampUnix: String(Math.floor(now.getTime() / 1000)),
    status:        'OK',
    uwagi:         ''
  };

  zapiszWpis(ss, wpis);
  zapiszLog(cfg, 'REJESTRACJA_OK', pracownik.id,
            payload.akcja + ' ' + imieNazwisko);
  sprawdzAnomalie(ss, cfg, pracownik, wpis, now);

  return {
    success:     true,
    message:     'Zarejestrowano',
    imie:        pracownik.imie,
    inicjal:     pracownik.inicjal,
    rok:         pracownik.rok,
    rola:        pracownik.rola,
    godzina:     wpis.godzina,
    data:        wpis.data,
    tokenSkrot:  tokenSkrot
  };
}

// ============================================================
// TOKEN DLA TABLETU (wywolywana przez google.script.run)
// ============================================================

function generujTokenTablet() {
  var now   = Date.now();
  var token = obliczToken(now);
  var sekundy = 60 - (Math.floor(now / 1000) % 60);
  // Format: "a3f9 · 2e1c · 87b4 · f312"
  var fmt = token.substring(0, 4) + ' · ' +
            token.substring(4, 8) + ' · ' +
            token.substring(8, 12) + ' · ' +
            token.substring(12, 16);
  return {
    token:        token,
    tokenFormatted: fmt,
    tokenUpper:   fmt.toUpperCase(),
    sekundy:      sekundy,
    timestamp:    now
  };
}

// ============================================================
// ZAPIS DO SHEETS
// ============================================================

function zapiszWpis(ss, wpis) {
  var sh = ss.getSheetByName(ZAKLADKI.EWIDENCJA);
  if (!sh) return;
  sh.appendRow([
    wpis.id, wpis.idPracownika, wpis.imieNazwisko, wpis.data,
    wpis.godzina, wpis.dzien, wpis.typ, wpis.idKliniki,
    wpis.tokenSkrot, wpis.timestampUnix, wpis.status, wpis.uwagi
  ]);
}

function zapiszLog(cfg, typZdarzenia, idPracownika, szczegoly) {
  try {
    var ss = SpreadsheetApp.openById(cfg.SHEET_ID);
    var sh = ss.getSheetByName(ZAKLADKI.LOGI);
    if (!sh) return;
    var now = new Date();
    sh.appendRow([
      Utilities.getUuid(),
      Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
      typZdarzenia,
      String(idPracownika || ''),
      String(szczegoly || ''),
      '' // IP hash - niedostepny w Apps Script
    ]);
  } catch(e) {
    // Nie blokuj rejestracji z powodu bledu logow
  }
}

function zapiszAnomalie(ss, idPracownika, imieNazwisko, typAnomAlii, opis) {
  var sh = ss.getSheetByName(ZAKLADKI.ANOMALIE);
  if (!sh) return;
  var now = new Date();
  sh.appendRow([
    Utilities.getUuid(),
    Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
    idPracownika,
    imieNazwisko,
    typAnomAlii,
    opis,
    'NOWA'
  ]);
}

// ============================================================
// DETEKCJA ANOMALII
// ============================================================

function sprawdzAnomalie(ss, cfg, pracownik, wpis, now) {
  var godzina = now.getHours();
  var dzienTygodnia = now.getDay();
  var imieNazwisko = pracownik.imie + ' ' + pracownik.inicjal + '.';
  var emailWyslany = false;

  // NOCNA_REJESTRACJA: 22:00-06:00
  if (godzina >= 22 || godzina < 6) {
    zapiszAnomalie(ss, pracownik.id, imieNazwisko, 'NOCNA_REJESTRACJA',
      'Rejestracja o ' + wpis.godzina + ' (' + wpis.typ + ')');
    wyslijAlert(cfg, 'Nocna rejestracja', imieNazwisko, wpis);
    emailWyslany = true;
  }

  // WEEKENDOWA_REJESTRACJA: sobota=6, niedziela=0
  if (dzienTygodnia === 0 || dzienTygodnia === 6) {
    zapiszAnomalie(ss, pracownik.id, imieNazwisko, 'WEEKENDOWA_REJESTRACJA',
      'Rejestracja w weekend: ' + wpis.dzien + ' ' + wpis.data + ' (' + wpis.typ + ')');
    if (!emailWyslany) {
      wyslijAlert(cfg, 'Weekendowa rejestracja', imieNazwisko, wpis);
    }
  }

  // Sprawdz poprzednie wpisy tylko dla WYJSCIA
  if (wpis.typ === 'W') {
    sprawdzAnomalieWyjscie(ss, cfg, pracownik, wpis, imieNazwisko);
  }

  // Sprawdz BRAK_WYJSCIA dla PRZYJSCIA
  if (wpis.typ === 'P') {
    sprawdzBrakWyjscia(ss, cfg, pracownik, wpis, imieNazwisko);
  }
}

function sprawdzAnomalieWyjscie(ss, cfg, pracownik, wpis, imieNazwisko) {
  var sh = ss.getSheetByName(ZAKLADKI.EWIDENCJA);
  if (!sh) return;

  var data = sh.getDataRange().getValues();
  // Szukaj ostatniego PRZYJSCIA tego pracownika tego samego dnia
  var ostatniePrzyjscie = null;
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][1]) === pracownik.id &&
        String(data[i][3]) === wpis.data &&
        String(data[i][6]) === 'P') {
      ostatniePrzyjscie = data[i];
      break;
    }
  }
  if (!ostatniePrzyjscie) return;

  var gPrzyj = String(ostatniePrzyjscie[4]).split(':');
  var gWyj   = wpis.godzina.split(':');
  var minPrzyj = parseInt(gPrzyj[0]) * 60 + parseInt(gPrzyj[1]);
  var minWyj   = parseInt(gWyj[0]) * 60 + parseInt(gWyj[1]);
  var roznica  = minWyj - minPrzyj;

  if (roznica < 120 && roznica >= 0) {
    zapiszAnomalie(ss, pracownik.id, imieNazwisko, 'KROTKA_ZMIANA',
      'Zmiana: ' + roznica + ' min (min 2h). ' + wpis.data);
    // Brak emaila - moze byc przerwa
  }

  if (roznica > 720) {
    zapiszAnomalie(ss, pracownik.id, imieNazwisko, 'DLUGA_ZMIANA',
      'Zmiana: ' + Math.round(roznica / 60 * 10) / 10 + 'h (max 12h). ' + wpis.data);
    wyslijAlert(cfg, 'Długa zmiana (' + Math.round(roznica / 60) + 'h)',
                imieNazwisko, wpis);
  }
}

function sprawdzBrakWyjscia(ss, cfg, pracownik, wpis, imieNazwisko) {
  var sh = ss.getSheetByName(ZAKLADKI.EWIDENCJA);
  if (!sh) return;

  var wczoraj = new Date();
  wczoraj.setDate(wczoraj.getDate() - 1);
  var dataWczoraj = Utilities.formatDate(wczoraj, Session.getScriptTimeZone(), 'yyyy-MM-dd');

  var data = sh.getDataRange().getValues();
  var byloP = false;
  var byloW = false;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]) === pracownik.id && String(data[i][3]) === dataWczoraj) {
      if (String(data[i][6]) === 'P') byloP = true;
      if (String(data[i][6]) === 'W') byloW = true;
    }
  }

  if (byloP && !byloW) {
    zapiszAnomalie(ss, pracownik.id, imieNazwisko, 'BRAK_WYJSCIA',
      'Brak wyjścia z dnia ' + dataWczoraj + '. Automatyczne zamknięcie zmiany.');

    // Automatycznie zamknij poprzednia zmiane jako brak wyjscia
    var teraz = new Date();
    var cfg2  = getConfig();
    var szSs  = SpreadsheetApp.openById(cfg2.SHEET_ID);
    var shEw  = szSs.getSheetByName(ZAKLADKI.EWIDENCJA);
    if (shEw) {
      shEw.appendRow([
        Utilities.getUuid(), pracownik.id, imieNazwisko, dataWczoraj,
        '23:59:59', '', 'W', cfg2.KLINIKA_ID, 'AUTO', '',
        'BRAK_WYJSCIA_AUTO', 'Automatycznie dodane przez system'
      ]);
    }
    wyslijAlert(cfg, 'Brak wyjścia z poprzedniego dnia', imieNazwisko, wpis);
  }
}

// ============================================================
// ALERTY EMAIL
// ============================================================

function wyslijAlert(cfg, tytulAnomalii, imieNazwisko, wpis) {
  if (!cfg.ADMIN_EMAIL) return;
  try {
    var temat = '[RCP We SMILE] Anomalia: ' + tytulAnomalii + ' — ' + imieNazwisko;
    var tresc = 'Wykryto anomalię w systemie RCP v3.\n\n' +
      'Pracownik:  ' + imieNazwisko + '\n' +
      'Anomalia:   ' + tytulAnomalii + '\n' +
      'Data:       ' + wpis.data + '\n' +
      'Godzina:    ' + wpis.godzina + '\n' +
      'Typ wpisu:  ' + (wpis.typ === 'P' ? 'PRZYJŚCIE' : 'WYJŚCIE') + '\n\n' +
      'Sprawdź arkusz Anomalie w Google Sheets.\n\n' +
      '— RCP v3, We SMILE Warszawa';
    GmailApp.sendEmail(cfg.ADMIN_EMAIL, temat, tresc);
  } catch(e) {
    // Brak dostepu do Gmail - kontynuuj bez emaila
  }
}

// ============================================================
// RATE LIMITING
// ============================================================

function sprawdzRateLimit(klucz) {
  var props   = PropertiesService.getScriptProperties();
  var rlData  = props.getProperty('RL_' + klucz);
  var teraz   = Date.now();

  if (!rlData) return true;

  try {
    var obj = JSON.parse(rlData);
    // Resetuj jesli okno 10 minut minelo
    if (teraz - obj.oknoStart > 600000) {
      props.deleteProperty('RL_' + klucz);
      return true;
    }
    // Blokada po 5 nieudanych probach
    if (obj.nieudane >= 5) {
      // Blokada 30 minut od ostatniej proby
      if (teraz - obj.ostatnia < 1800000) return false;
      props.deleteProperty('RL_' + klucz);
      return true;
    }
    return true;
  } catch(e) {
    props.deleteProperty('RL_' + klucz);
    return true;
  }
}

function inkrementujNieudane(klucz) {
  var props  = PropertiesService.getScriptProperties();
  var rlData = props.getProperty('RL_' + klucz);
  var teraz  = Date.now();
  var obj;

  try {
    obj = rlData ? JSON.parse(rlData) : null;
  } catch(e) {
    obj = null;
  }

  if (!obj || teraz - obj.oknoStart > 600000) {
    obj = { oknoStart: teraz, nieudane: 0, ostatnia: teraz };
  }
  obj.nieudane++;
  obj.ostatnia = teraz;
  props.setProperty('RL_' + klucz, JSON.stringify(obj));

  if (obj.nieudane >= 5) {
    var cfg = getConfig();
    zapiszLog(cfg, 'NIEPRAWIDLOWY_TOKEN_WIELOKROTNY', klucz,
              obj.nieudane + ' nieudanych prob w 10 min');
    wyslijAlert(cfg, 'Wielokrotny nieprawidłowy token (' + obj.nieudane + ' prób)',
                'Nieznany (' + klucz + ')',
                { data: '', godzina: '', typ: '?' });
  }
}

function resetujNieudane(klucz) {
  PropertiesService.getScriptProperties().deleteProperty('RL_' + klucz);
}

// ============================================================
// INICJALIZACJA ARKUSZA (uruchamiana raz przez admina)
// ============================================================

function inicjalizujArkusz() {
  var cfg = getConfig();
  var ss  = SpreadsheetApp.openById(cfg.SHEET_ID);

  var sheetsDefs = [
    {
      name: ZAKLADKI.PRACOWNICY,
      headers: ['ID','IMIE','NAZWISKO','INICJAL_NAZWISKA','ROK_URODZENIA',
                'ROLA','EMAIL','STATUS','DATA_DODANIA']
    },
    {
      name: ZAKLADKI.KLINIKI,
      headers: ['ID','NAZWA','ADRES','MIASTO','STATUS']
    },
    {
      name: ZAKLADKI.EWIDENCJA,
      headers: ['ID','ID_PRACOWNIKA','IMIE_NAZWISKO','DATA','GODZINA',
                'DZIEN_TYGODNIA','TYP','ID_KLINIKI','TOKEN_SKROT',
                'TIMESTAMP_UNIX','STATUS','UWAGI']
    },
    {
      name: ZAKLADKI.LOGI,
      headers: ['ID','TIMESTAMP','TYP_ZDARZENIA','ID_PRACOWNIKA',
                'SZCZEGOLY','IP_HASH']
    },
    {
      name: ZAKLADKI.ANOMALIE,
      headers: ['ID','TIMESTAMP','ID_PRACOWNIKA','IMIE_NAZWISKO',
                'TYP_ANOMALII','OPIS','STATUS']
    }
  ];

  for (var i = 0; i < sheetsDefs.length; i++) {
    var def = sheetsDefs[i];
    var sh  = ss.getSheetByName(def.name);
    if (!sh) {
      sh = ss.insertSheet(def.name);
    }
    if (sh.getLastRow() === 0) {
      sh.appendRow(def.headers);
      sh.getRange(1, 1, 1, def.headers.length)
        .setFontWeight('bold')
        .setBackground('#f0f0f0');
    }
  }

  // Dodaj klinike jesli nie istnieje
  var shKlin = ss.getSheetByName(ZAKLADKI.KLINIKI);
  if (shKlin && shKlin.getLastRow() <= 1) {
    shKlin.appendRow(['1','We SMILE','ul. Przykladowa 1','Warszawa','aktywna']);
  }

  return 'Arkusz zainicjalizowany pomyslnie.';
}
