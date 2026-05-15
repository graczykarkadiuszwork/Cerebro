/**
 * SYSTEM RCP v2.0 — Rejestracja Czasu Pracy dla Klinik Stomatologicznych
 *
 * ARCHITEKTURA BEZPIECZEŃSTWA:
 *   - Uwierzytelnienie: Google OAuth (konto Google pracownika, nie PIN)
 *   - Lokalizacja: HTML5 Geolocation API (weryfikacja po stronie klienta + serwera)
 *   - Antyfraud: PropertiesService (rate limiting, anomaly detection)
 *   - Hashing: SHA-256 dla wrażliwych identyfikatorów
 *   - Retencja: 10 lat zgodnie z Art. 94(9a) KP
 *
 * PODSTAWY PRAWNE:
 *   - Art. 149 KP — obowiązek prowadzenia ewidencji czasu pracy
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
  ARKUSZ_ID: "WKLEJ_TUTAJ_ID_ARKUSZA",

  // Nazwy zakładek w arkuszu (nie zmieniaj po wdrożeniu)
  ZAKŁADKI: {
    EWIDENCJA:    "Ewidencja Czasu",
    PRACOWNICY:   "Pracownicy",
    KLINIKI:      "Kliniki",
    LOGI:         "Logi Audytowe",
    ANOMALIE:     "Anomalie",
    KONFIGURACJA: "Konfiguracja"
  },

  // Email administratora systemu
  EMAIL_ADMIN: "admin@twoja-klinika.pl",

  // Nazwa organizacji (do emaili i raportów)
  NAZWA_ORGANIZACJI: "Klinika Stomatologiczna XYZ",

  // Bezpieczeństwo
  MAX_PROB_NA_GODZINE: 5,       // po ilu próbach blokada
  BLOKADA_MINUT: 60,            // czas blokady w minutach
  RADIUS_GPS_METRY: 50,         // promień akceptacji GPS (metry)
  TOLERANCJA_GPS_METRY: 10,     // dodatkowa tolerancja dla GPS

  // Anomaly detection — progi alertów
  MIN_CZAS_ZMIANY_MINUT: 15,    // zmiana krótsza → alert
  MAX_CZAS_ZMIANY_GODZIN: 13,   // zmiana dłuższa → alert (max Art. 131 KP)
  ALERT_WEEKEND: true,          // alert przy rejestracji w weekend
  ALERT_NOC: true,              // alert między 22:00 a 06:00

  // Retencja danych (Art. 94(9a) KP — 10 lat)
  RETENCJA_EWIDENCJI_LAT: 10,
  RETENCJA_LOGOW_LAT: 3,        // logi audytowe: 3 lata

};

// ============================================================
// PUNKT WEJŚCIA — SERWOWANIE APLIKACJI (GET)
// ============================================================

function doGet(e) {
  const sesja = Session.getActiveUser();
  const email = sesja.getEmail();

  // Blokada dostępu dla niezalogowanych
  if (!email) {
    return HtmlService.createHtmlOutput(
      '<h2>Brak dostępu. Zaloguj się kontem Google kliniki.</h2>'
    );
  }

  // Sprawdź czy pracownik jest w systemie
  const pracownik = znajdzPracownika(email);

  // Panel administratora
  if (e.parameter.panel === "admin") {
    if (!czyAdmin(email)) {
      return HtmlService.createHtmlOutput('<h2>Brak uprawnień administratora.</h2>');
    }
    return serweAdminPanel();
  }

  // Sprawdź blokadę rate-limit
  const blokada = sprawdzBlokade(email);
  if (blokada.zablokowany) {
    return serweStroneBledu(
      "Konto tymczasowo zablokowane",
      `Zbyt wiele prób. Spróbuj za ${blokada.pozostalychMinut} min.`
    );
  }

  if (!pracownik) {
    logujZdarzenie("DOSTEP_ODMOWIONY", email, null, "Nieznany email");
    return serweStroneBledu(
      "Brak dostępu",
      "Twój email nie jest zarejestrowany w systemie. Skontaktuj się z administratorem."
    );
  }

  // Załaduj konfigurację klinik dla danego pracownika
  const kliniki = pobierzKlinikiPracownika(pracownik.id);

  const szablon = HtmlService.createTemplateFromFile("index");
  szablon.pracownik = pracownik;
  szablon.kliniki = JSON.stringify(kliniki);
  szablon.config = JSON.stringify({
    radiusMetry: CONFIG.RADIUS_GPS_METRY + CONFIG.TOLERANCJA_GPS_METRY
  });

  return szablon.evaluate()
    .setTitle("RCP — Rejestracja Czasu Pracy")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DENY)
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

// ============================================================
// PUNKT WEJŚCIA — REJESTRACJA CZASU (POST, AJAX)
// ============================================================

function doPost(e) {
  try {
    const email = Session.getActiveUser().getEmail();
    if (!email) return odpowiedz(false, "Brak uwierzytelnienia");

    const dane = JSON.parse(e.postData.contents);
    const akcja = dane.akcja;

    if (akcja === "rejestruj") {
      return zarejestrujCzas(email, dane);
    }

    if (akcja === "statusDzisiaj") {
      return pobierzStatusDzisiaj(email);
    }

    return odpowiedz(false, "Nieznana akcja");

  } catch (err) {
    logujZdarzenie("BŁĄD_SYSTEMU", null, null, err.toString());
    return odpowiedz(false, "Błąd systemu. Skontaktuj się z administratorem.");
  }
}

// ============================================================
// GŁÓWNA LOGIKA — REJESTRACJA CZASU
// ============================================================

function zarejestrujCzas(email, dane) {
  const timestamp = new Date();

  // 1. Rate limiting
  const blokada = sprawdzBlokade(email);
  if (blokada.zablokowany) {
    return odpowiedz(false, `Blokada bezpieczeństwa. Spróbuj za ${blokada.pozostalychMinut} min.`);
  }

  // 2. Weryfikacja pracownika
  const pracownik = znajdzPracownika(email);
  if (!pracownik) {
    rejestrujPróbę(email, false);
    logujZdarzenie("ODMOWA_REJESTRACJI", email, null, "Nieznany pracownik");
    return odpowiedz(false, "Nie znaleziono pracownika.");
  }

  // 3. Weryfikacja kliniki
  const klinika = znajdzKlinike(dane.klinikaId);
  if (!klinika) {
    logujZdarzenie("BŁĄD_KLINIKI", email, dane.klinikaId, "Nieznana klinika");
    return odpowiedz(false, "Nieznana klinika.");
  }

  // 4. Weryfikacja GPS (serwer ponownie sprawdza przesłane współrzędne)
  if (!dane.gps || typeof dane.gps.lat !== "number" || typeof dane.gps.lng !== "number") {
    logujZdarzenie("BRAK_GPS", email, klinika.nazwa, "Brak danych GPS");
    return odpowiedz(false, "Wymagana lokalizacja GPS. Zezwól na dostęp do lokalizacji.");
  }

  const odlegloscMetry = obliczOdleglosc(
    dane.gps.lat, dane.gps.lng,
    klinika.lat, klinika.lng
  );

  const radiusAkceptacji = CONFIG.RADIUS_GPS_METRY + CONFIG.TOLERANCJA_GPS_METRY;

  if (odlegloscMetry > radiusAkceptacji) {
    logujZdarzenie(
      "GPS_ODMOWA", email, klinika.nazwa,
      `Odległość: ${Math.round(odlegloscMetry)}m, limit: ${radiusAkceptacji}m`
    );
    zwiekszLicznikProb(email);
    return odpowiedz(false,
      `Jesteś ${Math.round(odlegloscMetry)}m od kliniki. ` +
      `Maksymalna odległość: ${radiusAkceptacji}m. ` +
      `Skontaktuj się z administratorem jeśli jesteś na miejscu.`
    );
  }

  // 5. Sprawdź typ zdarzenia (przyjście/wyjście)
  const typ = walidujTyp(dane.typ);
  if (!typ) return odpowiedz(false, "Nieprawidłowy typ zdarzenia.");

  // 6. Sprawdź spójność (nie można wyjść bez wcześniejszego wejścia)
  const ostatniWpis = pobierzOstatniWpis(pracownik.id, dane.klinikaId);
  const walidacjaSekwencji = walidujSekwencje(ostatniWpis, typ, pracownik.imie);
  if (!walidacjaSekwencji.ok) {
    return odpowiedz(false, walidacjaSekwencji.komunikat);
  }

  // 7. Zapisz ewidencję
  const idWpisu = zapiszEwidencje(pracownik, klinika, typ, timestamp, dane.gps, odlegloscMetry);

  // 8. Wykryj anomalie (asynchronicznie — nie blokuje rejestracji)
  wykryjAnomalieASync(pracownik, klinika, typ, timestamp, odlegloscMetry, ostatniWpis);

  // 9. Wyślij potwierdzenie
  wyslijPotwierdzenie(pracownik, klinika, typ, timestamp);

  // 10. Loguj sukces
  logujZdarzenie("SUKCES_REJESTRACJI", email, klinika.nazwa,
    `${typ} | GPS: ${Math.round(odlegloscMetry)}m | ID: ${idWpisu}`
  );

  // Resetuj licznik prób po udanej rejestracji
  resetujLicznikProb(email);

  const godzina = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), "HH:mm");
  const typPelny = typ === "P" ? "Przyjście" : "Wyjście";

  return odpowiedz(true,
    `✅ ${typPelny} zarejestrowane o ${godzina}`,
    { godzina, typ, klinika: klinika.nazwa, idWpisu }
  );
}

// ============================================================
// STATUS DZISIAJ
// ============================================================

function pobierzStatusDzisiaj(email) {
  const pracownik = znajdzPracownika(email);
  if (!pracownik) return odpowiedz(false, "Brak pracownika");

  const ss = SpreadsheetApp.openById(CONFIG.ARKUSZ_ID);
  const sheet = ss.getSheetByName(CONFIG.ZAKŁADKI.EWIDENCJA);
  const dzisiaj = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");

  const dane = sheet.getDataRange().getValues();
  const wpisyDzisiaj = [];

  for (let i = 1; i < dane.length; i++) {
    const wiersz = dane[i];
    if (wiersz[1] === pracownik.id && wiersz[2] === dzisiaj) {
      wpisyDzisiaj.push({
        typ:     wiersz[4],
        godzina: wiersz[5],
        klinika: wiersz[3]
      });
    }
  }

  return odpowiedz(true, "OK", { wpisyDzisiaj });
}

// ============================================================
// EWIDENCJA — ZAPIS DO ARKUSZA
// ============================================================

function zapiszEwidencje(pracownik, klinika, typ, timestamp, gps, odlegloscMetry) {
  const ss = SpreadsheetApp.openById(CONFIG.ARKUSZ_ID);
  const sheet = ss.getSheetByName(CONFIG.ZAKŁADKI.EWIDENCJA);

  const idWpisu = generujId();
  const data = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), "yyyy-MM-dd");
  const godz = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), "HH:mm:ss");
  const dzienTygodnia = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), "EEEE");

  sheet.appendRow([
    idWpisu,                    // A: ID wpisu
    pracownik.id,               // B: ID pracownika
    data,                       // C: Data
    klinika.id,                 // D: ID kliniki
    typ,                        // E: Typ (P/W)
    godz,                       // F: Godzina
    dzienTygodnia,              // G: Dzień tygodnia
    Math.round(odlegloscMetry), // H: Odległość GPS (m)
    "ZATWIERDZONE",             // I: Status
    new Date().toISOString(),   // J: Timestamp ISO (dla archiwum)
    ""                          // K: Uwagi (do ręcznych korekt)
  ]);

  return idWpisu;
}

// ============================================================
// ANOMALY DETECTION
// ============================================================

function wykryjAnomalieASync(pracownik, klinika, typ, timestamp, odlegloscMetry, ostatniWpis) {
  const anomalie = [];
  const godz = timestamp.getHours();
  const dzienTygodnia = timestamp.getDay(); // 0=niedziela, 6=sobota

  // Nocna rejestracja (22:00–06:00)
  if (CONFIG.ALERT_NOC && (godz >= 22 || godz < 6)) {
    anomalie.push(`Rejestracja w godzinach nocnych: ${godz}:00`);
  }

  // Rejestracja w weekend
  if (CONFIG.ALERT_WEEKEND && (dzienTygodnia === 0 || dzienTygodnia === 6)) {
    anomalie.push(`Rejestracja w weekend (${dzienTygodnia === 0 ? "niedziela" : "sobota"})`);
  }

  // Zbyt krótka zmiana (poniżej minimum)
  if (typ === "W" && ostatniWpis && ostatniWpis.typ === "P") {
    const minutyCzasuPracy = (timestamp - ostatniWpis.timestamp) / 60000;
    if (minutyCzasuPracy < CONFIG.MIN_CZAS_ZMIANY_MINUT) {
      anomalie.push(`Bardzo krótka zmiana: ${Math.round(minutyCzasuPracy)} minut`);
    }
    if (minutyCzasuPracy > CONFIG.MAX_CZAS_ZMIANY_GODZIN * 60) {
      anomalie.push(`Zmiana przekracza ${CONFIG.MAX_CZAS_ZMIANY_GODZIN}h: ${Math.round(minutyCzasuPracy / 60)}h`);
    }
  }

  if (anomalie.length > 0) {
    zapiszAnomalie(pracownik, klinika, typ, timestamp, anomalie);
    wyslijAlertAnomalii(pracownik, klinika, typ, timestamp, anomalie);
  }
}

function zapiszAnomalie(pracownik, klinika, typ, timestamp, anomalie) {
  const ss = SpreadsheetApp.openById(CONFIG.ARKUSZ_ID);
  const sheet = ss.getSheetByName(CONFIG.ZAKŁADKI.ANOMALIE);

  sheet.appendRow([
    generujId(),
    Utilities.formatDate(timestamp, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss"),
    pracownik.id,
    pracownik.imie + " " + pracownik.nazwisko,
    klinika.nazwa,
    typ,
    anomalie.join(" | "),
    "NOWE"
  ]);
}

// ============================================================
// RATE LIMITING
// ============================================================

function sprawdzBlokade(email) {
  const props = PropertiesService.getScriptProperties();
  const klucz = "blokada_" + hashuj(email);
  const dane = props.getProperty(klucz);

  if (!dane) return { zablokowany: false };

  const obj = JSON.parse(dane);
  const teraz = Date.now();

  if (obj.licznik >= CONFIG.MAX_PROB_NA_GODZINE) {
    const koniecBlokady = obj.ostatniaProba + (CONFIG.BLOKADA_MINUT * 60 * 1000);
    if (teraz < koniecBlokady) {
      const pozostale = Math.ceil((koniecBlokady - teraz) / 60000);
      return { zablokowany: true, pozostalychMinut: pozostale };
    } else {
      // Blokada wygasła — resetuj
      props.deleteProperty(klucz);
      return { zablokowany: false };
    }
  }

  return { zablokowany: false };
}

function rejestrujPróbę(email, sukces) {
  if (sukces) {
    resetujLicznikProb(email);
    return;
  }
  zwiekszLicznikProb(email);
}

function zwiekszLicznikProb(email) {
  const props = PropertiesService.getScriptProperties();
  const klucz = "blokada_" + hashuj(email);
  const dane = props.getProperty(klucz);
  const obj = dane ? JSON.parse(dane) : { licznik: 0, ostatniaProba: 0 };

  obj.licznik++;
  obj.ostatniaProba = Date.now();
  props.setProperty(klucz, JSON.stringify(obj));
}

function resetujLicznikProb(email) {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty("blokada_" + hashuj(email));
}

// ============================================================
// DANE — PRACOWNICY I KLINIKI (z arkusza)
// ============================================================

function znajdzPracownika(email) {
  const ss = SpreadsheetApp.openById(CONFIG.ARKUSZ_ID);
  const sheet = ss.getSheetByName(CONFIG.ZAKŁADKI.PRACOWNICY);
  const dane = sheet.getDataRange().getValues();

  const emailHash = hashuj(email.toLowerCase().trim());

  for (let i = 1; i < dane.length; i++) {
    const wiersz = dane[i];
    // Kolumna D: hash emaila (nie przechowujemy emaila w plaintext)
    if (wiersz[3] === emailHash && wiersz[7] === "AKTYWNY") {
      return {
        id:       wiersz[0],
        imie:     wiersz[1],
        nazwisko: wiersz[2],
        email:    email,          // pobrane z sesji Google, nie z arkusza
        rola:     wiersz[5],
        klinikiId: wiersz[6] ? wiersz[6].split(",") : []
      };
    }
  }
  return null;
}

function czyAdmin(email) {
  const pracownik = znajdzPracownika(email);
  return pracownik && (pracownik.rola === "ADMIN" || pracownik.rola === "KIEROWNIK");
}

function znajdzKlinike(klinikaId) {
  const ss = SpreadsheetApp.openById(CONFIG.ARKUSZ_ID);
  const sheet = ss.getSheetByName(CONFIG.ZAKŁADKI.KLINIKI);
  const dane = sheet.getDataRange().getValues();

  for (let i = 1; i < dane.length; i++) {
    const wiersz = dane[i];
    if (wiersz[0] === klinikaId && wiersz[6] === "AKTYWNA") {
      return {
        id:     wiersz[0],
        nazwa:  wiersz[1],
        adres:  wiersz[2],
        lat:    parseFloat(wiersz[3]),
        lng:    parseFloat(wiersz[4]),
        radius: parseInt(wiersz[5]) || CONFIG.RADIUS_GPS_METRY
      };
    }
  }
  return null;
}

function pobierzKlinikiPracownika(pracownikId) {
  const ss = SpreadsheetApp.openById(CONFIG.ARKUSZ_ID);
  const sheet = ss.getSheetByName(CONFIG.ZAKŁADKI.KLINIKI);
  const dane = sheet.getDataRange().getValues();

  const kliniki = [];
  for (let i = 1; i < dane.length; i++) {
    const wiersz = dane[i];
    if (wiersz[6] === "AKTYWNA") {
      kliniki.push({
        id:    wiersz[0],
        nazwa: wiersz[1],
        adres: wiersz[2],
        lat:   parseFloat(wiersz[3]),
        lng:   parseFloat(wiersz[4])
      });
    }
  }
  return kliniki;
}

function pobierzOstatniWpis(pracownikId, klinikaId) {
  const ss = SpreadsheetApp.openById(CONFIG.ARKUSZ_ID);
  const sheet = ss.getSheetByName(CONFIG.ZAKŁADKI.EWIDENCJA);
  const dane = sheet.getDataRange().getValues();
  const dzisiaj = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");

  let ostatni = null;
  for (let i = 1; i < dane.length; i++) {
    const wiersz = dane[i];
    if (wiersz[1] === pracownikId && wiersz[2] === dzisiaj && wiersz[3] === klinikaId) {
      ostatni = {
        id:        wiersz[0],
        typ:       wiersz[4],
        godzina:   wiersz[5],
        timestamp: new Date(wiersz[9])
      };
    }
  }
  return ostatni;
}

// ============================================================
// WALIDACJE
// ============================================================

function walidujTyp(typ) {
  if (typ === "P" || typ === "W") return typ;
  return null;
}

function walidujSekwencje(ostatniWpis, typ, imie) {
  if (typ === "P") {
    if (ostatniWpis && ostatniWpis.typ === "P") {
      return {
        ok: false,
        komunikat: `${imie}, masz już zarejestrowane przyjście dziś. ` +
                   `Czy chcesz zarejestrować wyjście? Skontaktuj się z administratorem jeśli to błąd.`
      };
    }
  }
  if (typ === "W") {
    if (!ostatniWpis || ostatniWpis.typ === "W") {
      return {
        ok: false,
        komunikat: `${imie}, nie masz zarejestrowanego przyjścia dziś. ` +
                   `Skontaktuj się z administratorem.`
      };
    }
  }
  return { ok: true };
}

// ============================================================
// OBLICZENIA GPS (Haversine)
// ============================================================

function obliczOdleglosc(lat1, lng1, lat2, lng2) {
  const R = 6371000; // promień Ziemi w metrach
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ============================================================
// EMAIL — POTWIERDZENIA I ALERTY
// ============================================================

function wyslijPotwierdzenie(pracownik, klinika, typ, timestamp) {
  const godz = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), "HH:mm");
  const data = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), "dd.MM.yyyy");
  const typPelny = typ === "P" ? "PRZYJŚCIE" : "WYJŚCIE";
  const emoji = typ === "P" ? "🟢" : "🔴";

  const temat = `${emoji} RCP: ${typPelny} — ${godz} — ${klinika.nazwa}`;

  const tresc = `
<!DOCTYPE html>
<html lang="pl">
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
  <div style="background: ${typ === 'P' ? '#d4edda' : '#f8d7da'}; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <h2 style="margin: 0; color: ${typ === 'P' ? '#155724' : '#721c24'};">
      ${emoji} Rejestracja potwierdzona
    </h2>
  </div>

  <p>Cześć, <strong>${pracownik.imie}</strong>!</p>

  <table style="width: 100%; border-collapse: collapse;">
    <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Typ zdarzenia</strong></td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${typPelny}</td></tr>
    <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Godzina</strong></td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${godz}</td></tr>
    <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Data</strong></td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${data}</td></tr>
    <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Klinika</strong></td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${klinika.nazwa}</td></tr>
    <tr><td style="padding: 8px;"><strong>Lokalizacja GPS</strong></td>
        <td style="padding: 8px;">✅ Potwierdzona</td></tr>
  </table>

  <div style="background: #fff3cd; border-radius: 4px; padding: 12px; margin-top: 20px;">
    <strong>⚠️ To nie Ty?</strong><br>
    Jeśli nie rejestrowałeś/aś czasu pracy, natychmiast skontaktuj się z administratorem:<br>
    <a href="mailto:${CONFIG.EMAIL_ADMIN}">${CONFIG.EMAIL_ADMIN}</a>
  </div>

  <p style="color: #6c757d; font-size: 12px; margin-top: 20px;">
    ${CONFIG.NAZWA_ORGANIZACJI} — System RCP v2.0<br>
    Wiadomość generowana automatycznie. Dane przetwarzane na podstawie Art. 149 KP i RODO Art. 6(1)(b)(c).
  </p>
</body>
</html>`;

  try {
    GmailApp.sendEmail(pracownik.email, temat, "", { htmlBody: tresc });
  } catch (e) {
    logujZdarzenie("BŁĄD_EMAIL", pracownik.email, klinika.nazwa, e.toString());
  }
}

function wyslijAlertAnomalii(pracownik, klinika, typ, timestamp, anomalie) {
  const godz = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), "HH:mm");
  const data = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), "dd.MM.yyyy");

  const temat = `⚠️ ANOMALIA RCP: ${pracownik.imie} ${pracownik.nazwisko} — ${data} ${godz}`;

  const listaAnomali = anomalie.map(a => `<li>${a}</li>`).join("");

  const tresc = `
<!DOCTYPE html>
<html lang="pl">
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 20px;">
    <h2 style="color: #856404; margin: 0;">⚠️ Wykryto anomalię w rejestracji czasu</h2>
  </div>

  <h3>Szczegóły zdarzenia:</h3>
  <table style="width: 100%; border-collapse: collapse;">
    <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Pracownik</strong></td>
        <td>${pracownik.imie} ${pracownik.nazwisko}</td></tr>
    <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Data / Godzina</strong></td>
        <td>${data} ${godz}</td></tr>
    <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Klinika</strong></td>
        <td>${klinika.nazwa}</td></tr>
    <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Typ</strong></td>
        <td>${typ === 'P' ? 'Przyjście' : 'Wyjście'}</td></tr>
  </table>

  <h3>Wykryte anomalie:</h3>
  <ul style="color: #856404;">${listaAnomali}</ul>

  <p>Sprawdź zakładkę <strong>Anomalie</strong> w arkuszu RCP i potwierdź lub odrzuć zdarzenie.</p>

  <p style="color: #6c757d; font-size: 12px;">
    ${CONFIG.NAZWA_ORGANIZACJI} — System RCP v2.0 — Automatyczny alert bezpieczeństwa
  </p>
</body>
</html>`;

  try {
    GmailApp.sendEmail(CONFIG.EMAIL_ADMIN, temat, "", { htmlBody: tresc });
  } catch (e) {
    Logger.log("Błąd wysyłania alertu: " + e);
  }
}

function logujZdarzenie(typ, email, kontekst, szczegoly) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.ARKUSZ_ID);
    const sheet = ss.getSheetByName(CONFIG.ZAKŁADKI.LOGI);
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

    sheet.appendRow([
      generujId(),
      timestamp,
      typ,
      email ? hashuj(email) : "—",  // email jako hash, nie plaintext
      kontekst || "—",
      szczegoly || "—"
    ]);
  } catch (e) {
    Logger.log("Błąd logowania: " + e);
  }
}

// ============================================================
// PANEL ADMINISTRACYJNY
// ============================================================

function serweAdminPanel() {
  const szablon = HtmlService.createTemplateFromFile("admin");
  return szablon.evaluate()
    .setTitle("RCP — Panel Administratora")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DENY);
}

function serweStroneBledu(tytul, komunikat) {
  return HtmlService.createHtmlOutput(`
<!DOCTYPE html>
<html lang="pl">
<body style="font-family: Arial, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f8f9fa;">
  <div style="text-align: center; padding: 40px; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 400px;">
    <div style="font-size: 48px; margin-bottom: 16px;">🔒</div>
    <h2 style="color: #dc3545;">${tytul}</h2>
    <p style="color: #6c757d;">${komunikat}</p>
    <p style="color: #6c757d; font-size: 13px;">Kontakt: <a href="mailto:${CONFIG.EMAIL_ADMIN}">${CONFIG.EMAIL_ADMIN}</a></p>
  </div>
</body>
</html>`);
}

// ============================================================
// FUNKCJE POMOCNICZE
// ============================================================

function generujId() {
  return Utilities.getUuid().replace(/-/g, "").substring(0, 12).toUpperCase();
}

function hashuj(tekst) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    tekst,
    Utilities.Charset.UTF_8
  );
  return bytes.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join("").substring(0, 32);
}

function odpowiedz(sukces, komunikat, dane) {
  return ContentService
    .createTextOutput(JSON.stringify({ sukces, komunikat, dane: dane || null }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// FUNKCJE ADMINISTRACYJNE — RAPORTY I KONSERWACJA
// ============================================================

/**
 * Uruchom raz w miesiącu (Trigger: czyszczenieMiesieczne).
 * Nie usuwa ewidencji — tylko stare logi audytowe.
 * Ewidencja przechowywana 10 lat (Art. 94(9a) KP).
 */
function czyszczenieMiesieczne() {
  const ss = SpreadsheetApp.openById(CONFIG.ARKUSZ_ID);
  const sheetLogi = ss.getSheetByName(CONFIG.ZAKŁADKI.LOGI);
  const dataGraniczna = new Date();
  dataGraniczna.setFullYear(dataGraniczna.getFullYear() - CONFIG.RETENCJA_LOGOW_LAT);

  const dane = sheetLogi.getDataRange().getValues();
  const wierszeDoCzieniu = [];

  for (let i = dane.length - 1; i >= 1; i--) {
    const dataWiersza = new Date(dane[i][1]);
    if (dataWiersza < dataGraniczna) {
      wierszeDoCzieniu.push(i + 1);
    }
  }

  // Usuń od dołu, żeby nie przesunąć indeksów
  wierszeDoCzieniu.forEach(nr => sheetLogi.deleteRow(nr));

  Logger.log(`Czyszczenie: usunięto ${wierszeDoCzieniu.length} starych logów audytowych`);
}

/**
 * Uruchom co poniedziałek (Trigger: raportTygodniowy).
 * Wysyła administratorowi podsumowanie tygodnia.
 */
function raportTygodniowy() {
  const ss = SpreadsheetApp.openById(CONFIG.ARKUSZ_ID);
  const sheet = ss.getSheetByName(CONFIG.ZAKŁADKI.EWIDENCJA);
  const dane = sheet.getDataRange().getValues();

  const ponPrzeszly = new Date();
  ponPrzeszly.setDate(ponPrzeszly.getDate() - 7);
  const dataGraniczna = Utilities.formatDate(ponPrzeszly, Session.getScriptTimeZone(), "yyyy-MM-dd");

  const statystyki = {};
  let liczbaWpisow = 0;

  for (let i = 1; i < dane.length; i++) {
    if (dane[i][2] >= dataGraniczna) {
      liczbaWpisow++;
      const pracownikId = dane[i][1];
      if (!statystyki[pracownikId]) statystyki[pracownikId] = { P: 0, W: 0 };
      statystyki[pracownikId][dane[i][4]]++;
    }
  }

  const sheetAnom = ss.getSheetByName(CONFIG.ZAKŁADKI.ANOMALIE);
  const anomalie = sheetAnom.getDataRange().getValues();
  const nowe = anomalie.filter(r => r[7] === "NOWE" && r[1] >= dataGraniczna).length;

  const temat = `📊 Raport tygodniowy RCP — ${CONFIG.NAZWA_ORGANIZACJI}`;
  const tresc = `
<h2>Raport tygodniowy RCP</h2>
<p>Łącznie wpisów w ostatnich 7 dniach: <strong>${liczbaWpisow}</strong></p>
<p>Anomalie do przejrzenia: <strong style="color: ${nowe > 0 ? '#dc3545' : '#28a745'}">${nowe}</strong></p>
<p>Sprawdź arkusz RCP po szczegóły.</p>
<p style="color: #6c757d; font-size: 12px;">${CONFIG.NAZWA_ORGANIZACJI} — System RCP v2.0</p>`;

  GmailApp.sendEmail(CONFIG.EMAIL_ADMIN, temat, "", { htmlBody: tresc });
}

/**
 * Funkcja do ręcznego testowania systemu przez administratora.
 * Uruchamiaj z edytora Apps Script przed wdrożeniem.
 */
function testSystemu() {
  Logger.log("=== TEST SYSTEMU RCP v2.0 ===");

  // Test hashowania
  const hash = hashuj("test@klinika.pl");
  Logger.log("Hash emaila: " + hash);
  Logger.log("Hash OK: " + (hash.length === 32));

  // Test obliczania odległości
  const odl = obliczOdleglosc(52.2297, 21.0122, 52.2298, 21.0124);
  Logger.log(`Odległość testowa: ${Math.round(odl)}m (oczekiwane: ~15m)`);

  // Test połączenia z arkuszem
  try {
    const ss = SpreadsheetApp.openById(CONFIG.ARKUSZ_ID);
    Logger.log("Arkusz: " + ss.getName());
    const zakładki = ss.getSheets().map(s => s.getName());
    Logger.log("Zakładki: " + zakładki.join(", "));
  } catch (e) {
    Logger.log("BŁĄD arkusza: " + e);
  }

  Logger.log("=== TEST ZAKOŃCZONY ===");
}
