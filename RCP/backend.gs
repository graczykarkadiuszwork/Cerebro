/**
 * SYSTEM RCP v2.0 — Rejestracja Czasu Pracy dla Klinik Stomatologicznych
 *
 * PODSTAWY PRAWNE:
 *   - Art. 149 KP  — obowiązek prowadzenia ewidencji czasu pracy
 *   - Art. 94(9a) KP — retencja dokumentacji pracowniczej 10 lat
 *   - RODO Art. 6(1)(b)(c) — podstawa prawna przetwarzania
 *   - RODO Art. 32 — bezpieczeństwo przetwarzania
 *   - RODO Art. 33 — zgłaszanie naruszeń do UODO w ciągu 72h
 */

// ============================================================
// KONFIGURACJA — ZMIEŃ PRZED WDROŻENIEM
// ============================================================

const CONFIG = {
  // ID arkusza Google Sheets (skopiuj z URL: /spreadsheets/d/TUTAJ_ID/edit)
  ARKUSZ_ID: "1n9dPIfRiJuPxZS4lfh-QA-gUSv1rnNQgqLQJEfZ-rUY",

  // Nazwy zakładek — muszą się DOKŁADNIE zgadzać z nazwami w arkuszu
  ZAKLADKI: {
    EWIDENCJA:  "Ewidencja Czasu",
    PRACOWNICY: "Pracownicy",
    KLINIKI:    "Kliniki",
    LOGI:       "Logi Audytowe",
    ANOMALIE:   "Anomalie"
  },

  EMAIL_ADMIN:        "graczyk.arkadiusz.work@gmail.com",
  NAZWA_ORGANIZACJI:  "We SMILE",

  RADIUS_GPS_METRY:     100,  // promień akceptacji GPS w metrach
  TOLERANCJA_GPS_METRY:  10,  // dodatkowa tolerancja

  MAX_PROB_NA_GODZINE:   5,   // po ilu nieudanych próbach blokada
  BLOKADA_MINUT:        10,   // czas blokady

  // Anomaly detection
  MIN_CZAS_ZMIANY_MINUT:  15,
  MAX_CZAS_ZMIANY_GODZIN: 12,
  ALERT_WEEKEND: false,
  ALERT_NOC:     true,

  // Retencja (Art. 94(9a) KP)
  RETENCJA_EWIDENCJI_LAT: 10,
  RETENCJA_LOGOW_LAT:      3
};

// ============================================================
// PUNKT WEJŚCIA — SERWOWANIE STRONY (GET)
// ============================================================

function doGet(e) {
  const email = Session.getActiveUser().getEmail();
  Logger.log("doGet — email: " + email);

  if (!email) {
    return HtmlService.createHtmlOutput(
      "<h2>Zaloguj się kontem Google aby korzystać z systemu RCP.</h2>"
    );
  }

  const pracownik = znajdzPracownika(email);

  if (!pracownik) {
    logujZdarzenie("BRAK_PRACOWNIKA", email, "", "Email nie w bazie");
    return HtmlService.createHtmlOutput(
      "<h2>Brak dostępu.</h2><p>Email <b>" + email +
      "</b> nie jest zarejestrowany. Skontaktuj się z administratorem.</p>" +
      "<p>Admin: " + CONFIG.EMAIL_ADMIN + "</p>"
    );
  }

  const kliniki = pobierzKlinikiPracownika();

  const template = HtmlService.createTemplateFromFile("index");

  // WAŻNE: przekazuj jako JSON string — w HTML użyj <?!= ?> (bez escape)
  template.pracownikJson = JSON.stringify(pracownik);
  template.klinikiJson   = JSON.stringify(kliniki);
  template.configJson    = JSON.stringify({
    radius: CONFIG.RADIUS_GPS_METRY + CONFIG.TOLERANCJA_GPS_METRY,
    emailAdmin: CONFIG.EMAIL_ADMIN
  });

  return template
    .evaluate()
    .setTitle("RCP — Rejestracja Czasu");
}

// ============================================================
// FUNKCJE WYWOŁYWANE PRZEZ google.script.run (CLIENT-SIDE)
// Muszą zwracać zwykłe obiekty JS — NIE ContentService
// ============================================================

/**
 * Rejestracja czasu — wywoływana przez google.script.run z przeglądarki.
 */
function clientRejestruj(dane) {
  try {
    const email = Session.getActiveUser().getEmail();
    if (!email) return { sukces: false, komunikat: "Brak autoryzacji. Odśwież stronę." };

    // Rate limiting
    const blokada = sprawdzBlokade(email);
    if (blokada.zablokowany) {
      return { sukces: false, komunikat: "Konto zablokowane na " + blokada.pozostalychMinut + " min." };
    }

    const pracownik = znajdzPracownika(email);
    if (!pracownik) {
      return { sukces: false, komunikat: "Nie znaleziono pracownika." };
    }

    const klinika = znajdzKlinike(dane.klinikaId);
    if (!klinika) {
      return { sukces: false, komunikat: "Nie znaleziono kliniki." };
    }

    if (!dane.gps || typeof dane.gps.lat !== "number") {
      return { sukces: false, komunikat: "Brak danych GPS. Zezwól na lokalizację i spróbuj ponownie." };
    }

    const dystans = obliczOdleglosc(dane.gps.lat, dane.gps.lng, klinika.lat, klinika.lng);
    const maxDystans = CONFIG.RADIUS_GPS_METRY + CONFIG.TOLERANCJA_GPS_METRY;

    if (dystans > maxDystans) {
      zwiekszLicznikProb(email);
      logujZdarzenie("GPS_ODMOWA", email, klinika.nazwa,
        "Dystans: " + Math.round(dystans) + "m, limit: " + maxDystans + "m");
      return {
        sukces: false,
        komunikat: "Jesteś " + Math.round(dystans) + "m od kliniki. Maksimum: " + maxDystans + "m."
      };
    }

    if (dane.typ !== "P" && dane.typ !== "W") {
      return { sukces: false, komunikat: "Nieprawidłowy typ zdarzenia." };
    }

    // Sprawdź spójność sekwencji
    const ostatni = pobierzOstatniWpis(pracownik.id, klinika.id);

    if (dane.typ === "P" && ostatni && ostatni.typ === "P") {
      return { sukces: false, komunikat: pracownik.imie + ", masz już zarejestrowane przyjście dziś. Skontaktuj się z administratorem jeśli to błąd." };
    }
    if (dane.typ === "W" && (!ostatni || ostatni.typ === "W")) {
      return { sukces: false, komunikat: pracownik.imie + ", nie masz zarejestrowanego przyjścia dziś." };
    }

    // Zapis do arkusza
    const now = new Date();
    const id  = Utilities.getUuid().replace(/-/g, "").substring(0, 12).toUpperCase();

    const sheet = SpreadsheetApp
      .openById(CONFIG.ARKUSZ_ID)
      .getSheetByName(CONFIG.ZAKLADKI.EWIDENCJA);

    sheet.appendRow([
      id,
      pracownik.id,
      Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd"),
      klinika.id,
      dane.typ,
      Utilities.formatDate(now, Session.getScriptTimeZone(), "HH:mm:ss"),
      Utilities.formatDate(now, Session.getScriptTimeZone(), "EEEE"),
      Math.round(dystans),
      "ZATWIERDZONE",
      now.toISOString(),
      ""
    ]);

    resetujLicznikProb(email);
    logujZdarzenie("SUKCES", email, klinika.nazwa, dane.typ + " | " + Math.round(dystans) + "m");

    // Anomaly detection (nie blokuje rejestracji)
    wykryjAnomalieASync(pracownik, klinika, dane.typ, now, dystans, ostatni);

    // Email potwierdzający
    wyslijPotwierdzenie(pracownik, klinika, dane.typ, now);

    const godzina = Utilities.formatDate(now, Session.getScriptTimeZone(), "HH:mm");
    const typPelny = dane.typ === "P" ? "Przyjście" : "Wyjście";

    return {
      sukces: true,
      komunikat: typPelny + " zarejestrowane o " + godzina,
      dane: { godzina: godzina, klinika: klinika.nazwa }
    };

  } catch (err) {
    Logger.log("clientRejestruj ERROR: " + err);
    return { sukces: false, komunikat: "Błąd serwera: " + err.toString() };
  }
}

/**
 * Pobiera dzisiejsze wpisy pracownika — wywoływana przez google.script.run.
 */
function clientStatus() {
  try {
    const email = Session.getActiveUser().getEmail();
    if (!email) return { sukces: false, wpisyDzisiaj: [] };

    const pracownik = znajdzPracownika(email);
    if (!pracownik) return { sukces: false, wpisyDzisiaj: [] };

    const sheet = SpreadsheetApp
      .openById(CONFIG.ARKUSZ_ID)
      .getSheetByName(CONFIG.ZAKLADKI.EWIDENCJA);

    const dane  = sheet.getDataRange().getValues();
    const dzis  = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
    const wpisy = [];

    for (let i = 1; i < dane.length; i++) {
      if (dane[i][1] === pracownik.id && dane[i][2] === dzis) {
        const klinika = znajdzKlinike(dane[i][3]);
        wpisy.push({
          typ:     dane[i][4],
          godzina: dane[i][5],
          klinika: klinika ? klinika.nazwa : dane[i][3]
        });
      }
    }

    return { sukces: true, wpisyDzisiaj: wpisy };

  } catch (err) {
    Logger.log("clientStatus ERROR: " + err);
    return { sukces: false, wpisyDzisiaj: [] };
  }
}

// ============================================================
// DANE — PRACOWNICY
// ============================================================

function znajdzPracownika(email) {
  const sheet = SpreadsheetApp
    .openById(CONFIG.ARKUSZ_ID)
    .getSheetByName(CONFIG.ZAKLADKI.PRACOWNICY);

  const dane      = sheet.getDataRange().getValues();
  const emailHash = hashuj(email.toLowerCase().trim());

  Logger.log("Szukam hash: " + emailHash);

  for (let i = 1; i < dane.length; i++) {
    const row = dane[i];
    // Kolumna D (index 3) = EMAIL_HASH, kolumna H (index 7) = STATUS
    if (String(row[3]) === emailHash && String(row[7]) === "AKTYWNY") {
      return {
        id:       String(row[0]),
        imie:     String(row[1]),
        nazwisko: String(row[2]),
        rola:     String(row[5]),
        email:    email
      };
    }
  }

  Logger.log("Nie znaleziono pracownika dla hash: " + emailHash);
  return null;
}

// ============================================================
// DANE — KLINIKI
// ============================================================

function pobierzKlinikiPracownika() {
  const sheet = SpreadsheetApp
    .openById(CONFIG.ARKUSZ_ID)
    .getSheetByName(CONFIG.ZAKLADKI.KLINIKI);

  const dane   = sheet.getDataRange().getValues();
  const wynik  = [];

  for (let i = 1; i < dane.length; i++) {
    // Kolumna G (index 6) = STATUS
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
  return pobierzKlinikiPracownika().find(k => k.id === id) || null;
}

// ============================================================
// DANE — OSTATNI WPIS (do walidacji sekwencji)
// ============================================================

function pobierzOstatniWpis(pracownikId, klinikaId) {
  const sheet = SpreadsheetApp
    .openById(CONFIG.ARKUSZ_ID)
    .getSheetByName(CONFIG.ZAKLADKI.EWIDENCJA);

  const dane  = sheet.getDataRange().getValues();
  const dzis  = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  let ostatni = null;

  for (let i = 1; i < dane.length; i++) {
    if (dane[i][1] === pracownikId && dane[i][2] === dzis && dane[i][3] === klinikaId) {
      ostatni = { typ: dane[i][4], timestamp: new Date(dane[i][9]) };
    }
  }

  return ostatni;
}

// ============================================================
// RATE LIMITING
// ============================================================

function sprawdzBlokade(email) {
  const props = PropertiesService.getScriptProperties();
  const klucz = "bl_" + hashuj(email);
  const dane  = props.getProperty(klucz);

  if (!dane) return { zablokowany: false };

  const obj  = JSON.parse(dane);
  const teraz = Date.now();

  if (obj.licznik >= CONFIG.MAX_PROB_NA_GODZINE) {
    const koniec = obj.ostatnia + (CONFIG.BLOKADA_MINUT * 60 * 1000);
    if (teraz < koniec) {
      return { zablokowany: true, pozostalychMinut: Math.ceil((koniec - teraz) / 60000) };
    }
    props.deleteProperty(klucz);
  }

  return { zablokowany: false };
}

function zwiekszLicznikProb(email) {
  const props = PropertiesService.getScriptProperties();
  const klucz = "bl_" + hashuj(email);
  const dane  = props.getProperty(klucz);
  const obj   = dane ? JSON.parse(dane) : { licznik: 0, ostatnia: 0 };
  obj.licznik++;
  obj.ostatnia = Date.now();
  props.setProperty(klucz, JSON.stringify(obj));
}

function resetujLicznikProb(email) {
  PropertiesService.getScriptProperties().deleteProperty("bl_" + hashuj(email));
}

// ============================================================
// ANOMALY DETECTION
// ============================================================

function wykryjAnomalieASync(pracownik, klinika, typ, timestamp, dystans, ostatniWpis) {
  const anomalie = [];
  const godz     = timestamp.getHours();
  const dzien    = timestamp.getDay();

  if (CONFIG.ALERT_NOC && (godz >= 22 || godz < 6)) {
    anomalie.push("Rejestracja w godzinach nocnych (" + godz + ":00)");
  }
  if (CONFIG.ALERT_WEEKEND && (dzien === 0 || dzien === 6)) {
    anomalie.push("Rejestracja w weekend (" + (dzien === 0 ? "niedziela" : "sobota") + ")");
  }
  if (typ === "W" && ostatniWpis && ostatniWpis.typ === "P") {
    const min = (timestamp - ostatniWpis.timestamp) / 60000;
    if (min < CONFIG.MIN_CZAS_ZMIANY_MINUT) {
      anomalie.push("Bardzo krótka zmiana: " + Math.round(min) + " min");
    }
    if (min > CONFIG.MAX_CZAS_ZMIANY_GODZIN * 60) {
      anomalie.push("Zmiana powyżej " + CONFIG.MAX_CZAS_ZMIANY_GODZIN + "h: " + Math.round(min / 60) + "h");
    }
  }

  if (anomalie.length > 0) {
    zapiszAnomalie(pracownik, klinika, typ, timestamp, anomalie);
    wyslijAlertAnomalii(pracownik, klinika, typ, timestamp, anomalie);
  }
}

function zapiszAnomalie(pracownik, klinika, typ, timestamp, anomalie) {
  try {
    const sheet = SpreadsheetApp
      .openById(CONFIG.ARKUSZ_ID)
      .getSheetByName(CONFIG.ZAKLADKI.ANOMALIE);

    sheet.appendRow([
      Utilities.getUuid().substring(0, 12),
      Utilities.formatDate(timestamp, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss"),
      pracownik.id,
      pracownik.imie + " " + pracownik.nazwisko,
      klinika.nazwa,
      typ,
      anomalie.join(" | "),
      "NOWE"
    ]);
  } catch (e) { Logger.log("zapiszAnomalie: " + e); }
}

// ============================================================
// LOGI AUDYTOWE
// ============================================================

function logujZdarzenie(typ, email, kontekst, szczegoly) {
  try {
    const sheet = SpreadsheetApp
      .openById(CONFIG.ARKUSZ_ID)
      .getSheetByName(CONFIG.ZAKLADKI.LOGI);

    sheet.appendRow([
      Utilities.getUuid().substring(0, 12),
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss"),
      typ,
      email ? hashuj(email) : "—",  // email jako hash, nie plaintext
      kontekst || "—",
      szczegoly || "—"
    ]);
  } catch (e) { Logger.log("logujZdarzenie: " + e); }
}

// ============================================================
// EMAIL
// ============================================================

function wyslijPotwierdzenie(pracownik, klinika, typ, timestamp) {
  try {
    const godz     = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), "HH:mm");
    const data     = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), "dd.MM.yyyy");
    const typPelny = typ === "P" ? "PRZYJŚCIE" : "WYJŚCIE";
    const kolor    = typ === "P" ? "#d4edda" : "#f8d7da";
    const tKolor   = typ === "P" ? "#155724" : "#721c24";

    const temat = (typ === "P" ? "🟢" : "🔴") + " RCP: " + typPelny + " — " + godz;

    const tresc = `
<html><body style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:20px">
<div style="background:${kolor};border-radius:8px;padding:16px;margin-bottom:16px">
  <h2 style="margin:0;color:${tKolor}">${typ === "P" ? "🟢" : "🔴"} Rejestracja potwierdzona</h2>
</div>
<p>Cześć, <strong>${pracownik.imie}</strong>!</p>
<table style="width:100%;border-collapse:collapse">
  <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Zdarzenie</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${typPelny}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Godzina</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${godz}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Data</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${data}</td></tr>
  <tr><td style="padding:8px"><strong>Klinika</strong></td><td style="padding:8px">${klinika.nazwa}</td></tr>
</table>
<div style="background:#fff3cd;border-radius:4px;padding:12px;margin-top:16px">
  <strong>⚠️ To nie Ty?</strong> Natychmiast napisz do: <a href="mailto:${CONFIG.EMAIL_ADMIN}">${CONFIG.EMAIL_ADMIN}</a>
</div>
<p style="color:#aaa;font-size:11px;margin-top:16px">${CONFIG.NAZWA_ORGANIZACJI} — System RCP v2.0<br>
Dane przetwarzane na podstawie Art. 149 KP i RODO Art. 6(1)(b)(c).</p>
</body></html>`;

    GmailApp.sendEmail(pracownik.email, temat, "", { htmlBody: tresc });
  } catch (e) { Logger.log("wyslijPotwierdzenie: " + e); }
}

function wyslijAlertAnomalii(pracownik, klinika, typ, timestamp, anomalie) {
  try {
    const godz = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), "HH:mm");
    const data = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), "dd.MM.yyyy");
    const lista = anomalie.map(a => "<li>" + a + "</li>").join("");

    const tresc = `
<html><body style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px">
<div style="background:#fff3cd;border:1px solid #ffc107;border-radius:8px;padding:16px">
  <h2 style="color:#856404;margin:0">⚠️ Anomalia RCP</h2>
</div>
<p><strong>${pracownik.imie} ${pracownik.nazwisko}</strong> — ${data} ${godz} — ${klinika.nazwa}</p>
<ul>${lista}</ul>
<p>Sprawdź zakładkę <strong>Anomalie</strong> w arkuszu.</p>
</body></html>`;

    GmailApp.sendEmail(CONFIG.EMAIL_ADMIN,
      "⚠️ Anomalia RCP: " + pracownik.imie + " " + pracownik.nazwisko + " — " + data + " " + godz,
      "", { htmlBody: tresc });
  } catch (e) { Logger.log("wyslijAlertAnomalii: " + e); }
}

// ============================================================
// MATEMATYKA GPS (Haversine)
// ============================================================

function obliczOdleglosc(lat1, lng1, lat2, lng2) {
  const R  = 6371000;
  const p1 = lat1 * Math.PI / 180;
  const p2 = lat2 * Math.PI / 180;
  const dp = (lat2 - lat1) * Math.PI / 180;
  const dl = (lng2 - lng1) * Math.PI / 180;
  const a  = Math.sin(dp / 2) * Math.sin(dp / 2) +
             Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ============================================================
// SHA-256
// ============================================================

function hashuj(tekst) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    tekst,
    Utilities.Charset.UTF_8
  );
  return bytes.map(b => ("0" + (b & 0xFF).toString(16)).slice(-2)).join("").substring(0, 32);
}

// ============================================================
// AUTOMATYCZNE TRIGGERY
// ============================================================

function raportTygodniowy() {
  const temat = "📊 Raport tygodniowy RCP — " + CONFIG.NAZWA_ORGANIZACJI;
  const ss    = SpreadsheetApp.openById(CONFIG.ARKUSZ_ID);

  const sheetAnom = ss.getSheetByName(CONFIG.ZAKLADKI.ANOMALIE);
  const anomalie  = sheetAnom.getDataRange().getValues();
  const nowe      = anomalie.filter(r => r[7] === "NOWE").length;

  const tresc = `<html><body style="font-family:Arial">
<h2>Raport tygodniowy RCP</h2>
<p>Anomalie do przejrzenia: <strong style="color:${nowe > 0 ? "#dc3545" : "#28a745"}">${nowe}</strong></p>
<p>Otwórz arkusz RCP aby zobaczyć szczegóły.</p>
</body></html>`;

  GmailApp.sendEmail(CONFIG.EMAIL_ADMIN, temat, "", { htmlBody: tresc });
}

function czyszczenieMiesieczne() {
  const sheet = SpreadsheetApp
    .openById(CONFIG.ARKUSZ_ID)
    .getSheetByName(CONFIG.ZAKLADKI.LOGI);

  const granica = new Date();
  granica.setFullYear(granica.getFullYear() - CONFIG.RETENCJA_LOGOW_LAT);

  const dane    = sheet.getDataRange().getValues();
  const doUsuniecia = [];

  for (let i = dane.length - 1; i >= 1; i--) {
    if (new Date(dane[i][1]) < granica) doUsuniecia.push(i + 1);
  }

  doUsuniecia.forEach(nr => sheet.deleteRow(nr));
  Logger.log("Czyszczenie: usunięto " + doUsuniecia.length + " logów");
}

// ============================================================
// GENEROWANIE HASHY PRACOWNIKÓW (uruchom raz po dodaniu)
// ============================================================

function generujHashe() {
  const sheet = SpreadsheetApp
    .openById(CONFIG.ARKUSZ_ID)
    .getSheetByName(CONFIG.ZAKLADKI.PRACOWNICY);

  const dane = sheet.getDataRange().getValues();

  for (let i = 1; i < dane.length; i++) {
    const email = String(dane[i][4]).trim(); // Kolumna E = EMAIL_JAWNY
    if (email && email.includes("@")) {
      const hash = hashuj(email.toLowerCase());
      sheet.getRange(i + 1, 4).setValue(hash); // Kolumna D = EMAIL_HASH
      Logger.log("Hash dla " + email + ": " + hash);
    }
  }

  Logger.log("✅ Hashe wygenerowane!");
}

// ============================================================
// TEST SYSTEMU (uruchom przed wdrożeniem)
// ============================================================

function testSystemu() {
  Logger.log("=== TEST RCP v2.0 ===");

  // Test hashowania
  const h = hashuj("test@klinika.pl");
  Logger.log("Hash: " + h + " (len=" + h.length + ", oczekiwane=32)");

  // Test GPS
  const d = obliczOdleglosc(52.2297, 21.0122, 52.2298, 21.0124);
  Logger.log("Dystans testowy: " + Math.round(d) + "m (oczekiwane ~15m)");

  // Test arkusza
  try {
    const ss = SpreadsheetApp.openById(CONFIG.ARKUSZ_ID);
    Logger.log("Arkusz: " + ss.getName());
    ss.getSheets().forEach(s => Logger.log(" - " + s.getName()));
  } catch (e) {
    Logger.log("BŁĄD ARKUSZA: " + e);
    Logger.log("Sprawdź ARKUSZ_ID w konfiguracji!");
  }

  // Test pracowników
  try {
    const sheet = SpreadsheetApp.openById(CONFIG.ARKUSZ_ID).getSheetByName(CONFIG.ZAKLADKI.PRACOWNICY);
    const dane  = sheet.getDataRange().getValues();
    Logger.log("Pracownicy w arkuszu: " + (dane.length - 1));
  } catch (e) {
    Logger.log("BŁĄD PRACOWNICY: " + e);
  }

  Logger.log("=== TEST ZAKOŃCZONY ===");
}
