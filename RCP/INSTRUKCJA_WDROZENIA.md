# Instrukcja Wdrożenia — System RCP v2.0

## Przed rozpoczęciem

**Czas wdrożenia:** ok. 3–4 godziny  
**Wymagania:** konto Google Workspace (lub Gmail), dostęp do internetu  
**Poziom trudności:** 3/10 — każdy krok opisany dokładnie, bez programowania

---

## KROK 1 — Utwórz konta Google dla pracowników

Każdy pracownik musi mieć konto Google kliniki (np. `jan.kowalski@twoja-klinika.pl`).

Jeśli nie masz Google Workspace (płatne):
- Możesz użyć bezpłatnych kont Gmail (`jkowalski.klinika@gmail.com`)
- Każdy pracownik loguje się tym kontem na swoim telefonie

**Dlaczego to ważne:** System rozpoznaje pracownika po koncie Google, nie po wyborze z listy. To eliminuje możliwość podszywania się.

---

## KROK 2 — Utwórz arkusz Google Sheets

1. Przejdź na [sheets.google.com](https://sheets.google.com) i utwórz nowy arkusz
2. Nazwij go: `RCP — [Nazwa Kliniki]`
3. Utwórz następujące zakładki (kliknij `+` na dole):

| Nazwa zakładki | Opis |
|---|---|
| `Ewidencja Czasu` | Wszystkie rejestracje czasu pracy |
| `Pracownicy` | Lista pracowników |
| `Kliniki` | Lista klinik z GPS |
| `Logi Audytowe` | Wszystkie zdarzenia systemowe |
| `Anomalie` | Wykryte nieprawidłowości |
| `Konfiguracja` | Ustawienia systemu |

### Ustaw nagłówki w każdej zakładce:

**Ewidencja Czasu** (wiersz 1):
```
ID_WPISU | ID_PRACOWNIKA | DATA | ID_KLINIKI | TYP | GODZINA | DZIEN_TYGODNIA | GPS_ODLEGLOSC_M | STATUS | TIMESTAMP_ISO | UWAGI
```

**Pracownicy** (wiersz 1):
```
ID | IMIE | NAZWISKO | EMAIL_HASH | EMAIL_JAWNY | ROLA | KLINIKI_ID | STATUS
```

**Kliniki** (wiersz 1):
```
ID | NAZWA | ADRES | LAT | LNG | RADIUS_M | STATUS
```

**Logi Audytowe** (wiersz 1):
```
ID | TIMESTAMP | TYP_ZDARZENIA | EMAIL_HASH | KONTEKST | SZCZEGOLY
```

**Anomalie** (wiersz 1):
```
ID | TIMESTAMP | ID_PRACOWNIKA | IMIE_NAZWISKO | KLINIKA | TYP | OPIS | STATUS
```

### Skopiuj ID arkusza z adresu URL:
```
https://docs.google.com/spreadsheets/d/TUTAJ_JEST_ID/edit
                                       ↑ skopiuj to
```

---

## KROK 3 — Dodaj pracowników do arkusza

W zakładce **Pracownicy** wpisz dla każdej osoby:

| Kolumna | Co wpisać | Przykład |
|---|---|---|
| A (ID) | Unikalny skrót | `P001` |
| B (IMIE) | Imię | `Anna` |
| C (NAZWISKO) | Nazwisko | `Kowalska` |
| D (EMAIL_HASH) | **Wygeneruj z kroku 3a** | `a3f8b2c1...` |
| E (EMAIL_JAWNY) | Email do wglądu | `anna@klinika.pl` |
| F (ROLA) | Rola | `PRACOWNIK` lub `KIEROWNIK` lub `ADMIN` |
| G (KLINIKI_ID) | ID klinik, przecinkami | `K001,K002` |
| H (STATUS) | Status | `AKTYWNY` |

### Krok 3a — Wygeneruj hash emaila

W komórce arkusza wpisz (zmień adres email):

```
=LOWER(TO_HEX(ARRAYFORMULA(MOD(CODE(MID(LOWER("anna@klinika.pl"),ROW(INDIRECT("1:"&LEN("anna@klinika.pl"))),1)),256))))
```

**Uwaga:** To jest uproszczone. Właściwy hash SHA-256 wygeneruje skrypt automatycznie przy pierwszym logowaniu. Na razie możesz wpisać placeholder `PENDING` — system zaktualizuje to przy pierwszym uruchomieniu.

**Prostszy sposób:** Zostaw kolumnę D jako `PENDING`. Po wdrożeniu systemu (krok 6), uruchom ręcznie funkcję `generujHashe()` z edytora skryptów.

---

## KROK 4 — Dodaj kliniki do arkusza

W zakładce **Kliniki** wpisz dla każdej kliniki:

| Kolumna | Co wpisać | Przykład |
|---|---|---|
| A (ID) | Unikalny skrót | `K001` |
| B (NAZWA) | Pełna nazwa | `Klinika Centrum` |
| C (ADRES) | Adres | `ul. Marszałkowska 1, Warszawa` |
| D (LAT) | Szerokość geograficzna | `52.2297` |
| E (LNG) | Długość geograficzna | `21.0122` |
| F (RADIUS_M) | Promień akceptacji GPS (metry) | `50` |
| G (STATUS) | Status | `AKTYWNA` |

### Jak znaleźć współrzędne GPS kliniki:

1. Otwórz [Google Maps](https://maps.google.com)
2. Znajdź adres kliniki
3. Kliknij prawym przyciskiem myszy na budynek
4. Pierwsze liczby to współrzędne — **skopiuj je**

Przykład: `52.2297, 21.0122` → LAT = `52.2297`, LNG = `21.0122`

---

## KROK 5 — Skonfiguruj Google Apps Script

1. Otwórz [script.google.com](https://script.google.com)
2. Kliknij **Nowy projekt**
3. Nazwij projekt: `RCP System v2`
4. Usuń cały kod z pliku `Kod.gs`
5. Wklej **całą zawartość** pliku `backend.gs` z tego pakietu
6. Kliknij **`+`** obok "Pliki" → **HTML** → wpisz nazwę `index`
7. Wklej **całą zawartość** pliku `index.html`

### Uzupełnij konfigurację (linie 25–52 w backend.gs):

```javascript
const CONFIG = {
  ARKUSZ_ID: "WKLEJ_TUTAJ_ID_Z_KROKU_2",      // ← skopiuj z URL arkusza
  EMAIL_ADMIN: "twoj.email@klinika.pl",          // ← Twój email
  NAZWA_ORGANIZACJI: "Klinika Stomatologiczna XYZ", // ← nazwa kliniki
  // ... resztę zostaw bez zmian
};
```

### Zapisz projekt (Ctrl+S lub Cmd+S)

---

## KROK 6 — Wdróż jako aplikację webową

1. Kliknij **Wdróż** → **Nowe wdrożenie**
2. Kliknij ikonę ⚙️ obok "Typ" → wybierz **Aplikacja webowa**
3. Ustaw:
   - **Opis:** `RCP v2.0 — produkcja`
   - **Wykonaj jako:** `Ja (twoj.email@klinika.pl)` ← Twoje konto
   - **Kto ma dostęp:** `Wszyscy, którzy mają konto Google w domenie` (lub `Wszyscy zalogowani` jeśli używasz gmail.com)
4. Kliknij **Wdróż**
5. **Skopiuj URL aplikacji** — to jest link, który dasz pracownikom

**URL wygląda tak:**
```
https://script.google.com/macros/s/AKfycby.../exec
```

---

## KROK 7 — Wyraź zgody dla skryptu

Przy pierwszym uruchomieniu skrypt poprosi o uprawnienia:
- Dostęp do Twojego Dysku Google (arkusze)
- Wysyłanie emaili w Twoim imieniu

Kliknij **Zezwól**. To jest wymagane do działania systemu.

---

## KROK 8 — Ustaw automatyczne triggery

Triggery to harmonogram automatycznych zadań (raporty, czyszczenie).

1. W edytorze Apps Script kliknij ikonę **⏱️ Triggery** (zegar, lewy pasek)
2. Kliknij **Dodaj trigger** (prawy dół)

### Trigger 1: Raport tygodniowy

| Ustawienie | Wartość |
|---|---|
| Funkcja | `raportTygodniowy` |
| Źródło | Na podstawie czasu |
| Typ | Tydzień |
| Dzień | Poniedziałek |
| Godzina | 08:00–09:00 |

### Trigger 2: Czyszczenie logów (co miesiąc)

| Ustawienie | Wartość |
|---|---|
| Funkcja | `czyszczenieMiesieczne` |
| Źródło | Na podstawie czasu |
| Typ | Miesiąc |
| Dzień | 1 |
| Godzina | 03:00–04:00 |

---

## KROK 9 — Przetestuj system

1. W edytorze Apps Script wybierz funkcję `testSystemu`
2. Kliknij ▶️ **Uruchom**
3. Sprawdź logi (View → Logi) — wszystko powinno być zielone

### Testuj jako pracownik:

1. Otwórz URL aplikacji z kroku 6 na telefonie
2. Zaloguj się kontem Google pracownika
3. Zezwól na lokalizację GPS
4. Kliknij **Przyjście**
5. Sprawdź czy wpis pojawił się w arkuszu (zakładka Ewidencja Czasu)
6. Sprawdź czy przyszedł email potwierdzający

---

## KROK 10 — Stwórz QR kody i wdróż

### Generowanie QR kodu:

Wejdź na [qr-code-generator.com](https://qr-code-generator.com) i wklej URL aplikacji z kroku 6.

**Zalecenia dla wydruku:**
- Rozmiar minimum: 10×10 cm
- Laminat lub rama (kliniki to mokre środowisko)
- Umieść przy wejściu na poziomie wzroku
- Dodaj podpis: `📱 Zeskanuj aby zarejestrować przyjście/wyjście`

### Szkolenie pracowników (15 minut):

1. Pokaż jak skanować QR na iPhonie i Androidzie
2. Wyjaśnij że trzeba mieć zalogowane konto Google kliniki
3. Wyjaśnij że GPS musi być włączony
4. Pokaż przykładowe potwierdzenie emailem
5. Powiedz co robić gdy pojawi się błąd (kontakt z Tobą)

---

## KROK 11 — Konfiguracja praw dostępu do arkusza

Arkusz zawiera dane osobowe — ogranicz dostęp.

1. W arkuszu kliknij **Udostępnij** (prawy górny róg)
2. Usuń wszystkich obecnych współpracowników
3. Dodaj **tylko siebie** jako **Właściciela**
4. Dodaj ewentualnie kadrową/księgową jako **Przeglądającego** (tylko do odczytu)
5. Wyłącz opcję "Każdy z linkiem może wyświetlać"

---

## Po wdrożeniu — cotygodniowa rutyna (5 minut)

- [ ] Przejrzyj zakładkę **Anomalie** — sprawdź wpisy ze statusem `NOWE`
- [ ] Potwierdź lub odrzuć anomalie (zmień status na `OK` lub `WYJAŚNIONO`)
- [ ] Sprawdź raport tygodniowy w emailu (wysyłany automatycznie w poniedziałki)
- [ ] Jeśli pracownik ma błędną rejestrację — ręcznie popraw w arkuszu, dodaj uwagę w kolumnie K

---

## Rozwiązywanie typowych problemów

| Problem | Możliwa przyczyna | Rozwiązanie |
|---|---|---|
| "Twój email nie jest zarejestrowany" | Brak pracownika w arkuszu | Dodaj pracownika do zakładki Pracownicy |
| "GPS niedostępny" | Brak zgody na lokalizację | Ustawienia przeglądarki → Zezwól na lokalizację |
| "Jesteś Xm od kliniki" | Błąd GPS lub za daleko | Sprawdź współrzędne kliniki; zwiększ RADIUS w arkuszu Kliniki |
| "Konto tymczasowo zablokowane" | Zbyt wiele nieudanych prób | Odczekaj 60 minut lub skontaktuj się z adminem |
| Email nie przychodzi | Problem z uprawnieniami Gmail | Sprawdź folder Spam; przeautoryzuj skrypt |
| Błąd 500 przy ładowaniu | Błąd w kodzie | Sprawdź logi w Apps Script: View → Logi |

---

## Aktualizacja pracowników

### Dodanie nowego pracownika:
1. Dodaj wiersz w zakładce Pracownicy
2. Wpisz dane (ID, imię, nazwisko, email, rola, kliniki, status AKTYWNY)
3. Poczekaj na pierwsze logowanie — hash emaila zostanie wygenerowany automatycznie

### Odejście pracownika:
1. W kolumnie H (STATUS) zmień na `NIEAKTYWNY`
2. System natychmiast odmówi dostępu temu pracownikowi
3. **Nie usuwaj danych** — ewidencja czasu pracy musi być przechowywana 10 lat (Art. 94(9a) KP)

---

## Koszty

| Składnik | Koszt miesięczny |
|---|---|
| Google Apps Script | **Bezpłatne** |
| Google Sheets | **Bezpłatne** |
| Gmail (wysyłanie emaili) | **Bezpłatne** |
| Google Workspace (opcjonalnie, dla własnej domeny) | ok. 6–12 EUR/os/mies. |
| QR kody (wydruk) | jednorazowo ok. 10–20 zł |
| **RAZEM** | **0 zł / miesiąc** |

> Jeśli chcesz mieć formalne DPA (umowę powierzenia danych) z Google oraz zaawansowane funkcje bezpieczeństwa, Google Workspace Business Starter (~6 EUR/os/mies.) jest zalecaną opcją dla kliniki medycznej.
