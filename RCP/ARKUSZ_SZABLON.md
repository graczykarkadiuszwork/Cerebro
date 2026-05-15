# Szablon Arkusza Google Sheets — System RCP v2.0

Poniżej dokładna struktura każdej zakładki. Skopiuj nagłówki dokładnie jak podano — system jest na nie wrażliwy.

---

## Zakładka: Ewidencja Czasu

| Kolumna | Nagłówek | Typ | Opis | Przykład |
|---|---|---|---|---|
| A | ID_WPISU | Tekst | Automatyczny UUID (12 znaków) | `A3F8B2C19D7E` |
| B | ID_PRACOWNIKA | Tekst | Klucz obcy → Pracownicy.A | `P001` |
| C | DATA | Data (YYYY-MM-DD) | Data zdarzenia | `2026-05-15` |
| D | ID_KLINIKI | Tekst | Klucz obcy → Kliniki.A | `K001` |
| E | TYP | Tekst (P/W) | P=Przyjście, W=Wyjście | `P` |
| F | GODZINA | Czas (HH:mm:ss) | Godzina zdarzenia | `08:03:14` |
| G | DZIEN_TYGODNIA | Tekst | Dzień tygodnia | `piątek` |
| H | GPS_ODLEGLOSC_M | Liczba | Odległość od kliniki w metrach | `12` |
| I | STATUS | Tekst | Stan wpisu | `ZATWIERDZONE` |
| J | TIMESTAMP_ISO | Tekst | Pełny timestamp ISO 8601 | `2026-05-15T08:03:14.000Z` |
| K | UWAGI | Tekst | Korekty ręczne, wyjaśnienia | `Korekta: awaria GPS 2026-05-15` |

**Możliwe wartości STATUS:**
- `ZATWIERDZONE` — normalny wpis systemowy
- `KOREKTA_RĘCZNA` — wpis dodany przez administratora
- `ANULOWANE — [powód]` — wpis anulowany

**Uprawnienia zakładki:** Tylko administrator (właściciel arkusza) może edytować.

---

## Zakładka: Pracownicy

| Kolumna | Nagłówek | Typ | Opis | Przykład |
|---|---|---|---|---|
| A | ID | Tekst | Unikalny identyfikator | `P001` |
| B | IMIE | Tekst | Imię pracownika | `Anna` |
| C | NAZWISKO | Tekst | Nazwisko pracownika | `Kowalska` |
| D | EMAIL_HASH | Tekst | SHA-256 hash emaila (32 znaki) | `a3f8b2c19d7e...` |
| E | EMAIL_JAWNY | Tekst | Email do wglądu administratora | `anna@klinika.pl` |
| F | ROLA | Tekst | Rola w systemie | `PRACOWNIK` |
| G | KLINIKI_ID | Tekst | IDs klinik oddzielone przecinkiem | `K001,K002` |
| H | STATUS | Tekst | Status konta | `AKTYWNY` |

**Możliwe wartości ROLA:**
- `PRACOWNIK` — standardowy pracownik, może się tylko rejestrować
- `KIEROWNIK` — dostęp do panelu admin
- `ADMIN` — pełny dostęp

**Możliwe wartości STATUS:**
- `AKTYWNY` — może korzystać z systemu
- `NIEAKTYWNY` — brak dostępu (zwolnienie, urlop bezpłatny, etc.)
- `PENDING` — konto oczekuje na pierwsze logowanie

**Jak wygenerować EMAIL_HASH:**

W Apps Script → Run → `generujHashePracownikow()` (uruchom raz po dodaniu nowych pracowników z wartością PENDING).

Lub ręcznie w Apps Script Editor:
```javascript
function generujHashePracownikow() {
  const ss = SpreadsheetApp.openById(CONFIG.ARKUSZ_ID);
  const sheet = ss.getSheetByName("Pracownicy");
  const dane = sheet.getDataRange().getValues();
  
  for (let i = 1; i < dane.length; i++) {
    if (dane[i][3] === "PENDING" && dane[i][4]) {
      const email = dane[i][4].toLowerCase().trim();
      const hash = hashuj(email);
      sheet.getRange(i + 1, 4).setValue(hash); // kolumna D
    }
  }
  Logger.log("Hashe wygenerowane!");
}
```

**Uprawnienia zakładki:** Tylko administrator.

---

## Zakładka: Kliniki

| Kolumna | Nagłówek | Typ | Opis | Przykład |
|---|---|---|---|---|
| A | ID | Tekst | Unikalny identyfikator | `K001` |
| B | NAZWA | Tekst | Pełna nazwa kliniki | `Klinika Centrum` |
| C | ADRES | Tekst | Adres fizyczny | `ul. Marszałkowska 1, Warszawa` |
| D | LAT | Liczba | Szerokość geograficzna | `52.22970` |
| E | LNG | Liczba | Długość geograficzna | `21.01220` |
| F | RADIUS_M | Liczba | Promień akceptacji GPS (metry) | `50` |
| G | STATUS | Tekst | Status kliniki | `AKTYWNA` |

**Możliwe wartości STATUS:**
- `AKTYWNA` — klinika jest aktywna
- `NIEAKTYWNA` — klinika zamknięta (nie pojawia się pracownikom)

**Jak znaleźć dokładne współrzędne:**

1. Google Maps → wyszukaj adres kliniki
2. Kliknij prawym przyciskiem myszy na punkt wejścia do budynku (nie środek budynku)
3. Skopiuj współrzędne (pierwsza liczba to LAT, druga LNG)
4. Wpisz do arkusza z dokładnością 5 miejsc po przecinku

**Wskazówka dla GPS w budynkach:** Telefony często tracą dokładność GPS wewnątrz budynków. Ustaw punkt GPS na wejście/bramę kliniki, nie na wnętrze. Radius 50m zazwyczaj wystarczy.

---

## Zakładka: Logi Audytowe

| Kolumna | Nagłówek | Typ | Opis | Przykład |
|---|---|---|---|---|
| A | ID | Tekst | UUID zdarzenia | `B7D3E9F2A1C4` |
| B | TIMESTAMP | Tekst | Data i godzina zdarzenia | `2026-05-15 08:03:14` |
| C | TYP_ZDARZENIA | Tekst | Kod zdarzenia | `SUKCES_REJESTRACJI` |
| D | EMAIL_HASH | Tekst | Hash emaila (anonimizacja) | `a3f8b2c19d7e...` |
| E | KONTEKST | Tekst | Klinika lub kontekst | `Klinika Centrum` |
| F | SZCZEGOLY | Tekst | Szczegóły zdarzenia | `P | GPS: 12m | ID: A3F8B2C1` |

**Kody zdarzeń TYP_ZDARZENIA:**
- `SUKCES_REJESTRACJI` — poprawna rejestracja
- `GPS_ODMOWA` — GPS poza strefą
- `DOSTEP_ODMOWIONY` — nieznany email
- `ODMOWA_REJESTRACJI` — błąd walidacji
- `BRAK_GPS` — brak danych GPS w żądaniu
- `BŁĄD_KLINIKI` — nieznana klinika
- `BŁĄD_SYSTEMU` — wyjątek w kodzie
- `BŁĄD_EMAIL` — błąd wysyłki emaila

**Uwaga:** Logi NIE zawierają emaila w plaintext — zawierają hash. Chroni to prywatność pracowników nawet jeśli ktoś uzyska dostęp do arkusza logów.

**Retencja:** 3 lata (automatyczne czyszczenie via trigger miesięczny).

---

## Zakładka: Anomalie

| Kolumna | Nagłówek | Typ | Opis | Przykład |
|---|---|---|---|---|
| A | ID | Tekst | UUID anomalii | `C2E5F8A3B1D7` |
| B | TIMESTAMP | Tekst | Data i godzina | `2026-05-15 22:15:30` |
| C | ID_PRACOWNIKA | Tekst | Klucz → Pracownicy.A | `P003` |
| D | IMIE_NAZWISKO | Tekst | Czytelna nazwa | `Marta Wiśniewska` |
| E | KLINIKA | Tekst | Nazwa kliniki | `Klinika Centrum` |
| F | TYP | Tekst | P lub W | `P` |
| G | OPIS | Tekst | Opis anomalii | `Rejestracja w godzinach nocnych: 22:00` |
| H | STATUS | Tekst | Status weryfikacji | `NOWE` |

**Możliwe wartości STATUS:**
- `NOWE` — wymaga weryfikacji administratora
- `OK` — anomalia wyjaśniona, zdarzenie prawidłowe
- `WYJAŚNIONO` — dodaj notatkę w OPIS np. "WYJAŚNIONO: dyżur nocny z dnia X"
- `PODEJRZANE` — potwierdzone nieprawidłowości, wymaga działania

**Cotygodniowa rutyna:** Sprawdź wszystkie wpisy ze statusem "NOWE" i zmień na odpowiedni.

---

## Zakładka: Konfiguracja

Ta zakładka jest poglądowa — nie czyta jej kod. Służy jako dokumentacja Twojej konfiguracji.

| Parametr | Wartość | Opis |
|---|---|---|
| Wersja systemu | 2.0 | |
| Data wdrożenia | [data] | |
| Administrator | [email] | |
| Radius GPS domyślny | 50m | Zmień w arkuszu Kliniki dla każdej kliniki |
| Blokada po próbach | 5 prób / 60 min | Zmień w CONFIG.js |
| Alerty weekendowe | TAK | Zmień w CONFIG.js |
| Alerty nocne | TAK | Zmień w CONFIG.js |
| Retencja ewidencji | 10 lat | Nie zmieniaj — wymóg prawny |
| Retencja logów | 3 lata | |

---

## Przykładowe dane do testów

Wpisz te dane do arkusza przed wdrożeniem żeby przetestować system:

### Pracownicy (przykład):

| ID | IMIE | NAZWISKO | EMAIL_HASH | EMAIL_JAWNY | ROLA | KLINIKI_ID | STATUS |
|---|---|---|---|---|---|---|---|
| P001 | Anna | Kowalska | PENDING | anna@klinika.pl | PRACOWNIK | K001 | AKTYWNY |
| P002 | Piotr | Lewandowski | PENDING | piotr@klinika.pl | KIEROWNIK | K001,K002 | AKTYWNY |

### Kliniki (przykład):

| ID | NAZWA | ADRES | LAT | LNG | RADIUS_M | STATUS |
|---|---|---|---|---|---|---|
| K001 | Klinika Centrum | ul. Marszałkowska 1, Warszawa | 52.22970 | 21.01220 | 50 | AKTYWNA |
| K002 | Klinika Mokotów | ul. Puławska 100, Warszawa | 52.19540 | 21.02070 | 50 | AKTYWNA |

Po wpisaniu danych uruchom `generujHashePracownikow()` z Apps Script — kolumna EMAIL_HASH zostanie automatycznie wypełniona.
