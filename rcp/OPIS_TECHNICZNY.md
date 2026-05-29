# We SMILE — System RCP: Opis techniczny

**Wersja:** 6.0 | **Platforma:** Google Apps Script + Google Sheets

---

## Czym jest ten system

Webowa aplikacja rejestracji czasu pracy (RCP) dla gabinetu stomatologicznego We SMILE.
Pracownicy odbijają wejście i wyjście przez telefon, dane trafiają do arkusza Google Sheets.
Nie wymaga instalacji żadnej aplikacji — działa przez przeglądarkę.

---

## Jak działa — przepływ jednego odbicia

```
[Tablet admina]          [Telefon pracownika]        [Google Sheets]
      │                          │                          │
      │  wyświetla kod 4-cyfr.   │                          │
      │  (zmienia się co 30s)    │                          │
      │──────── kod ────────────▶│                          │
      │                          │  1. wpisuje PIN (4 cyfry)│
      │                          │  2. wpisuje kod (4 cyfry)│
      │                          │  3. klika WEJŚCIE/WYJŚCIE│
      │                          │──── zapis zdarzenia ────▶│
      │                          │◀─── potwierdzenie ───────│
```

---

## Dane przechowywane w Google Sheets

**Arkusz ID:** `1wI3ysrolzGea5nNi7GYBo09t38y8oUgPoqGG3wn-ZsA`

### Zakładka: `Ewidencja` — główne dane dla pracodawcy

| Kolumna | Zawartość | Przykład |
|---------|-----------|---------|
| Timestamp | Data i czas UTC (ISO 8601) | `2025-05-29T06:30:00.000Z` |
| EmpID | ID pracownika | `WS03` |
| Imię | Imię | `Julia` |
| Nazwisko | Nazwisko | `Polishchuk` |
| Akcja | `WEJSCIE` lub `WYJSCIE` | `WEJSCIE` |
| Data | Data lokalna (PL) | `2025-05-29` |
| Godzina | Godzina lokalna (PL) | `08:30` |
| Źródło | Zawsze `worker` (lub `uzupelnienie`) | `worker` |

### Zakładka: `Pracownicy` — lista pracowników

| ID | Imię | Nazwisko | Rola | Status | PIN |
|----|------|----------|------|--------|-----|
| WS01 | Arkadiusz | Graczyk | Admin | Aktywny | 0371 |
| WS02 | Kaja | Węglarek | rejestratorka medyczna | Aktywny | 1826 |
| WS03 | Julia | Polishchuk | higienistka stomatologiczna | Aktywny | 0316 |
| WS04 | Oksana | Revutska | asystentka stomatologiczna | Aktywny | 0484 |
| WS05 | Kamila | Pruszczyńska | higienistka stomatologiczna | Aktywny | 4731 |
| WS06 | Katarzyna | Graczyk | higienistka stomatologiczna | Aktywny | 9010 |

### Zakładka: `Anomalie` — zdarzenia nieprawidłowe

Zapisywane automatycznie gdy ktoś np. próbuje dwa razy odbić WEJŚCIE pod rząd.

---

## Linki do aplikacji

| Widok | URL | Kto używa |
|-------|-----|-----------|
| Tablet (kod) | `[URL]?page=admin` | Tablet przy wejściu |
| Pracownik | `[URL]?page=worker` | Każdy pracownik na telefonie |

---

## Co można zrobić z danymi w Sheets

Dane w zakładce `Ewidencja` to surowa tabela — możliwości:

1. **Filtrowanie** — po pracowniku, dacie, akcji (natywnie w Sheets)
2. **Pivot table** — zestawienie godzin wejść/wyjść per pracownik per dzień
3. **Formuła czasu pracy** — `WYJSCIE.Godzina - WEJSCIE.Godzina` = przepracowany czas
4. **Eksport CSV** — z arkusza lub z panelu admina (przycisk "Eksportuj CSV")
5. **Integracja z zewnętrznym systemem** — przez Google Sheets API (OAuth 2.0)
6. **Automatyczny raport** — trigger GAS wysyłający e-mail z podsumowaniem tygodniowym

---

## Architektura techniczna

```
Google Apps Script (backend + frontend)
    │
    ├── Code.gs          — logika: tokeny HMAC-SHA256, weryfikacja PIN,
    │                       zapis zdarzeń, rate limiting, dedupl.
    │
    └── Index.html       — interfejs (vanilla JS, bez frameworków)
                           renderowany server-side przez HtmlService
                           
Google Sheets (baza danych)
    ├── Pracownicy       — lista i autoryzacja
    ├── Ewidencja        — zdarzenia wejść/wyjść
    └── Anomalie         — log bezpieczeństwa
```

**Bezpieczeństwo:**
- Kod autoryzacyjny generowany algorytmem HMAC-SHA256 (jak TOTP w 2FA)
- Każdy kod ważny 30 sekund (±30s tolerancja)
- Rate limiting: blokada po 5 błędnych próbach przez 5 minut
- Deduplikacja: to samo zdarzenie nie może być zapisane dwa razy w ciągu 90 sekund
- Walidacja sekwencji: nie można wejść dwa razy bez wyjścia (i odwrotnie)

---

## Co wymaga dalszego dopracowania (opcjonalnie)

| Funkcja | Opis | Trudność |
|---------|------|----------|
| Raport dzienny/tygodniowy | GAS trigger → e-mail PDF do pracodawcy | Niska |
| Wyliczanie czasu pracy | Formuły Sheets lub dodatkowa zakładka | Niska |
| Panel podglądu pracodawcy | Oddzielny widok `?page=report` tylko do odczytu | Średnia |
| Integracja z systemem kadrowym | Eksport do zewnętrznego API (np. Symfonia, Enova) | Wysoka |
| Powiadomienia SMS/push | Alert gdy pracownik nie odbił do X godziny | Średnia |

---

## Kontakt techniczny

Kod źródłowy: repozytorium GitHub `graczykarkadiuszwork/Cerebro`, katalog `/rcp/`  
Arkusz danych: Google Sheets ID `1wI3ysrolzGea5nNi7GYBo09t38y8oUgPoqGG3wn-ZsA`  
Administrator: Arkadiusz Graczyk (WS01)
