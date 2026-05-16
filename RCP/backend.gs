// SYSTEM RCP v2.0 — Rejestracja Czasu Pracy

const CONFIG = {
  ARKUSZ_ID:        "1n9dPIfRiJuPxZS4lfh-QA-gUSv1rnNQgqLQJEfZ-rUY",
  TAB_EWIDENCJA:    "Ewidencja Czasu",
  TAB_PRACOWNICY:   "Pracownicy",
  TAB_KLINIKI:      "Kliniki",
  TAB_LOGI:         "Logi Audytowe",
  TAB_ANOMALIE:     "Anomalie",
  EMAIL_ADMIN:      "graczyk.arkadiusz.work@gmail.com",
  NAZWA_ORG:        "We SMILE",
  RADIUS_M:         100,
  TOLERANCJA_M:     10,
  MAX_PROB:         5,
  BLOKADA_MIN:      10,
  MIN_ZMIANA_MIN:   15,
  MAX_ZMIANA_H:     12,
  ALERT_WEEKEND:    false,
  ALERT_NOC:        true
};

// Serwuje strone — bez szablonow, dane ladowane osobnym wywolaniem
function doGet(e) {
  var email = Session.getActiveUser().getEmail();
  if (!email) {
    return HtmlService.createHtmlOutput(
      "<h2>Zaloguj sie kontem Google aby korzystac z systemu RCP.</h2>"
    );
  }
  return HtmlService.createHtmlOutputFromFile("index")
    .setTitle("RCP - Rejestracja Czasu");
}

// Pobiera dane startowe — wywolywane przez google.script.run
function pobierzDaneStartowe() {
  var email = Session.getActiveUser().getEmail();
  if (!email) return { blad: "Brak autoryzacji" };

  var pracownik = znajdzPracownika(email);
  if (!pracownik) return { blad: "Email " + email + " nie jest zarejestrowany. Skontaktuj sie z: " + CONFIG.EMAIL_ADMIN };

  var kliniki = pobierzKliniki();
  return {
    pracownik: pracownik,
    kliniki:   kliniki,
    radius:    CONFIG.RADIUS_M + CONFIG.TOLERANCJA_M,
    emailAdmin: CONFIG.EMAIL_ADMIN
  };
}

// Rejestracja czasu — wywolywana przez google.script.run
function clientRejestruj(dane) {
  try {
    var email = Session.getActiveUser().getEmail();
    if (!email) return { sukces: false, komunikat: "Brak autoryzacji. Odswiez strone." };

    var blokada = sprawdzBlokade(email);
    if (blokada.zablokowany) {
      return { sukces: false, komunikat: "Konto zablokowane na " + blokada.minut + " min." };
    }

    var pracownik = znajdzPracownika(email);
    if (!pracownik) return { sukces: false, komunikat: "Nie znaleziono pracownika." };

    var klinika = znajdzKlinike(dane.klinikaId);
    if (!klinika) return { sukces: false, komunikat: "Nie znaleziono kliniki." };

    if (!dane.gps || typeof dane.gps.lat !== "number") {
      return { sukces: false, komunikat: "Brak GPS. Zezwol na lokalizacje i sprobuj ponownie." };
    }

    var dystans = obliczOdleglosc(dane.gps.lat, dane.gps.lng, klinika.lat, klinika.lng);
    var maxD = CONFIG.RADIUS_M + CONFIG.TOLERANCJA_M;

    if (dystans > maxD) {
      zwiekszLicznik(email);
      loguj("GPS_ODMOWA", email, klinika.nazwa, "Dystans: " + Math.round(dystans) + "m, limit: " + maxD + "m");
      return { sukces: false, komunikat: "Jestes " + Math.round(dystans) + "m od kliniki. Maksimum: " + maxD + "m." };
    }

    if (dane.typ !== "P" && dane.typ !== "W") {
      return { sukces: false, komunikat: "Nieprawidlowy typ zdarzenia." };
    }

    var ostatni = pobierzOstatniWpis(pracownik.id, klinika.id);
    if (dane.typ === "P" && ostatni && ostatni.typ === "P") {
      return { sukces: false, komunikat: pracownik.imie + ", masz juz zarejestrowane przyj�cie dzis." };
    }
    if (dane.typ === "W" && (!ostatni || ostatni.typ === "W")) {
      return { sukces: false, komunikat: pracownik.imie + ", nie masz zarejestrowanego przyj�cia dzis." };
    }

    var now  = new Date();
    var id   = Utilities.getUuid().replace(/-/g, "").substring(0, 12).toUpperCase();
    var tz   = Session.getScriptTimeZone();

    var sheet = SpreadsheetApp.openById(CONFIG.ARKUSZ_ID).getSheetByName(CONFIG.TAB_EWIDENCJA);
    sheet.appendRow([
      id,
      pracownik.id,
      Utilities.formatDate(now, tz, "yyyy-MM-dd"),
      klinika.id,
      dane.typ,
      Utilities.formatDate(now, tz, "HH:mm:ss"),
      Utilities.formatDate(now, tz, "EEEE"),
      Math.round(dystans),
      "ZATWIERDZONE",
      now.toISOString(),
      ""
    ]);

    resetujLicznik(email);
    loguj("SUKCES", email, klinika.nazwa, dane.typ + " | " + Math.round(dystans) + "m");
    wykryjAnomalie(pracownik, klinika, dane.typ, now, ostatni);
    wyslijEmail(pracownik, klinika, dane.typ, now);

    var godzina  = Utilities.formatDate(now, tz, "HH:mm");
    var typPelny = dane.typ === "P" ? "Przyjscie" : "Wyjscie";
    return { sukces: true, komunikat: typPelny + " zarejestrowane o " + godzina, klinika: klinika.nazwa, godzina: godzina };

  } catch (err) {
    Logger.log("clientRejestruj ERROR: " + err);
    return { sukces: false, komunikat: "Blad serwera: " + err.toString() };
  }
}

// Pobiera dzisiejsze wpisy — wywolywana przez google.script.run
function clientStatus() {
  try {
    var email = Session.getActiveUser().getEmail();
    if (!email) return { sukces: false, wpisy: [] };

    var pracownik = znajdzPracownika(email);
    if (!pracownik) return { sukces: false, wpisy: [] };

    var sheet = SpreadsheetApp.openById(CONFIG.ARKUSZ_ID).getSheetByName(CONFIG.TAB_EWIDENCJA);
    var dane  = sheet.getDataRange().getValues();
    var dzis  = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
    var wpisy = [];

    for (var i = 1; i < dane.length; i++) {
      if (String(dane[i][1]) === pracownik.id && String(dane[i][2]) === dzis) {
        var k = znajdzKlinike(String(dane[i][3]));
        wpisy.push({
          typ:     String(dane[i][4]),
          godzina: String(dane[i][5]),
          klinika: k ? k.nazwa : String(dane[i][3])
        });
      }
    }
    return { sukces: true, wpisy: wpisy };
  } catch (err) {
    return { sukces: false, wpisy: [] };
  }
}

// --- DANE ---

function znajdzPracownika(email) {
  var sheet = SpreadsheetApp.openById(CONFIG.ARKUSZ_ID).getSheetByName(CONFIG.TAB_PRACOWNICY);
  var dane  = sheet.getDataRange().getValues();
  var hash  = hashuj(email.toLowerCase().trim());
  Logger.log("Szukam hash: " + hash);
  for (var i = 1; i < dane.length; i++) {
    if (String(dane[i][3]) === hash && String(dane[i][7]) === "AKTYWNY") {
      return { id: String(dane[i][0]), imie: String(dane[i][1]), nazwisko: String(dane[i][2]), rola: String(dane[i][5]), email: email };
    }
  }
  Logger.log("Nie znaleziono dla hash: " + hash);
  return null;
}

function pobierzKliniki() {
  var sheet = SpreadsheetApp.openById(CONFIG.ARKUSZ_ID).getSheetByName(CONFIG.TAB_KLINIKI);
  var dane  = sheet.getDataRange().getValues();
  var wynik = [];
  for (var i = 1; i < dane.length; i++) {
    if (String(dane[i][6]) === "AKTYWNA") {
      wynik.push({
        id:    String(dane[i][0]),
        nazwa: String(dane[i][1]),
        adres: String(dane[i][2]),
        lat:   parseFloat(dane[i][3]),
        lng:   parseFloat(dane[i][4])
      });
    }
  }
  return wynik;
}

function znajdzKlinike(id) {
  var kliniki = pobierzKliniki();
  for (var i = 0; i < kliniki.length; i++) {
    if (kliniki[i].id === id) return kliniki[i];
  }
  return null;
}

function pobierzOstatniWpis(pracId, klId) {
  var sheet = SpreadsheetApp.openById(CONFIG.ARKUSZ_ID).getSheetByName(CONFIG.TAB_EWIDENCJA);
  var dane  = sheet.getDataRange().getValues();
  var dzis  = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  var ostatni = null;
  for (var i = 1; i < dane.length; i++) {
    if (String(dane[i][1]) === pracId && String(dane[i][2]) === dzis && String(dane[i][3]) === klId) {
      ostatni = { typ: String(dane[i][4]), timestamp: new Date(dane[i][9]) };
    }
  }
  return ostatni;
}

// --- RATE LIMITING ---

function sprawdzBlokade(email) {
  var props = PropertiesService.getScriptProperties();
  var klucz = "bl_" + hashuj(email);
  var raw   = props.getProperty(klucz);
  if (!raw) return { zablokowany: false };
  var obj   = JSON.parse(raw);
  if (obj.licznik >= CONFIG.MAX_PROB) {
    var koniec = obj.ostatnia + (CONFIG.BLOKADA_MIN * 60000);
    if (Date.now() < koniec) return { zablokowany: true, minut: Math.ceil((koniec - Date.now()) / 60000) };
    props.deleteProperty(klucz);
  }
  return { zablokowany: false };
}

function zwiekszLicznik(email) {
  var props = PropertiesService.getScriptProperties();
  var klucz = "bl_" + hashuj(email);
  var raw   = props.getProperty(klucz);
  var obj   = raw ? JSON.parse(raw) : { licznik: 0, ostatnia: 0 };
  obj.licznik++;
  obj.ostatnia = Date.now();
  props.setProperty(klucz, JSON.stringify(obj));
}

function resetujLicznik(email) {
  PropertiesService.getScriptProperties().deleteProperty("bl_" + hashuj(email));
}

// --- ANOMALIE ---

function wykryjAnomalie(pracownik, klinika, typ, now, ostatni) {
  var anomalie = [];
  var h = now.getHours();
  var d = now.getDay();
  if (CONFIG.ALERT_NOC && (h >= 22 || h < 6)) anomalie.push("Rejestracja nocna (" + h + ":00)");
  if (CONFIG.ALERT_WEEKEND && (d === 0 || d === 6)) anomalie.push("Rejestracja w weekend");
  if (typ === "W" && ostatni && ostatni.typ === "P") {
    var min = (now - ostatni.timestamp) / 60000;
    if (min < CONFIG.MIN_ZMIANA_MIN) anomalie.push("Bardzo krotka zmiana: " + Math.round(min) + " min");
    if (min > CONFIG.MAX_ZMIANA_H * 60) anomalie.push("Zmiana powyzej " + CONFIG.MAX_ZMIANA_H + "h: " + Math.round(min / 60) + "h");
  }
  if (anomalie.length > 0) {
    try {
      var sheet = SpreadsheetApp.openById(CONFIG.ARKUSZ_ID).getSheetByName(CONFIG.TAB_ANOMALIE);
      var tz = Session.getScriptTimeZone();
      sheet.appendRow([
        Utilities.getUuid().substring(0, 12),
        Utilities.formatDate(now, tz, "yyyy-MM-dd HH:mm:ss"),
        pracownik.id,
        pracownik.imie + " " + pracownik.nazwisko,
        klinika.nazwa,
        typ,
        anomalie.join(" | "),
        "NOWE"
      ]);
      GmailApp.sendEmail(CONFIG.EMAIL_ADMIN,
        "Anomalia RCP: " + pracownik.imie + " " + pracownik.nazwisko,
        anomalie.join(", ") + " — Sprawdz zakladke Anomalie.");
    } catch (e) { Logger.log("wykryjAnomalie err: " + e); }
  }
}

// --- LOGI ---

function loguj(typ, email, kontekst, szczegoly) {
  try {
    var sheet = SpreadsheetApp.openById(CONFIG.ARKUSZ_ID).getSheetByName(CONFIG.TAB_LOGI);
    sheet.appendRow([
      Utilities.getUuid().substring(0, 12),
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss"),
      typ,
      email ? hashuj(email) : "-",
      kontekst || "-",
      szczegoly || "-"
    ]);
  } catch (e) { Logger.log("loguj err: " + e); }
}

// --- EMAIL ---

function wyslijEmail(pracownik, klinika, typ, now) {
  try {
    var tz      = Session.getScriptTimeZone();
    var godz    = Utilities.formatDate(now, tz, "HH:mm");
    var data    = Utilities.formatDate(now, tz, "dd.MM.yyyy");
    var typTxt  = typ === "P" ? "PRZYJSCIE" : "WYJSCIE";
    var kolor   = typ === "P" ? "#d4edda" : "#f8d7da";
    var temat   = (typ === "P" ? "[RCP] Przyj" : "[RCP] Wyj") + "scie — " + godz;
    var tresc   = "<h2 style='background:" + kolor + ";padding:12px'>" + typTxt + " " + godz + "</h2>"
                + "<p>Pracownik: <b>" + pracownik.imie + " " + pracownik.nazwisko + "</b></p>"
                + "<p>Klinika: " + klinika.nazwa + "</p>"
                + "<p>Data: " + data + "</p>"
                + "<p style='color:#888;font-size:11px'>" + CONFIG.NAZWA_ORG + " — System RCP v2.0</p>";
    GmailApp.sendEmail(pracownik.email, temat, "", { htmlBody: tresc });
  } catch (e) { Logger.log("wyslijEmail err: " + e); }
}

// --- GPS (Haversine) ---

function obliczOdleglosc(lat1, lng1, lat2, lng2) {
  var R  = 6371000;
  var p1 = lat1 * Math.PI / 180;
  var p2 = lat2 * Math.PI / 180;
  var dp = (lat2 - lat1) * Math.PI / 180;
  var dl = (lng2 - lng1) * Math.PI / 180;
  var a  = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// --- SHA-256 ---

function hashuj(tekst) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, tekst, Utilities.Charset.UTF_8);
  var hex = "";
  for (var i = 0; i < bytes.length; i++) {
    var b = bytes[i] & 0xFF;
    hex += (b < 16 ? "0" : "") + b.toString(16);
  }
  return hex.substring(0, 32);
}

// --- GENEROWANIE HASHY (uruchom raz po dodaniu pracownikow) ---

function generujHashe() {
  var sheet = SpreadsheetApp.openById(CONFIG.ARKUSZ_ID).getSheetByName(CONFIG.TAB_PRACOWNICY);
  var dane  = sheet.getDataRange().getValues();
  for (var i = 1; i < dane.length; i++) {
    var email = String(dane[i][4]).trim();
    if (email && email.indexOf("@") > -1) {
      var hash = hashuj(email.toLowerCase());
      sheet.getRange(i + 1, 4).setValue(hash);
      Logger.log("Hash dla " + email + ": " + hash);
    }
  }
  Logger.log("Hashe wygenerowane!");
}

// --- TEST ---

function testSystemu() {
  Logger.log("=== TEST RCP ===");
  var h = hashuj("test@klinika.pl");
  Logger.log("Hash test: " + h + " (dlugosc=" + h.length + ")");
  var d = obliczOdleglosc(52.2297, 21.0122, 52.2298, 21.0124);
  Logger.log("Dystans test: " + Math.round(d) + "m (ok jesli ~15m)");
  try {
    var ss = SpreadsheetApp.openById(CONFIG.ARKUSZ_ID);
    Logger.log("Arkusz: " + ss.getName());
    var sheets = ss.getSheets();
    for (var i = 0; i < sheets.length; i++) Logger.log(" - " + sheets[i].getName());
  } catch (e) { Logger.log("BLAD ARKUSZA: " + e); }
  Logger.log("=== KONIEC TESTU ===");
}
