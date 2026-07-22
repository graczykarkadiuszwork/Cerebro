# We SMILE RCP „OPOKA” v1.0 — instrukcja wdrożenia

Komplet plików do podmiany w projekcie Apps Script. System zastępuje v6.0 w całości,
**nie ruszając ani jednego istniejącego wiersza w arkuszu `Ewidencja`** — stare odbicia
pozostają i są normalnie widoczne w siatce miesiąca oraz eksportach.

## Pliki projektu (docelowa zawartość edytora Apps Script)

| Plik | Rola |
|---|---|
| `appsscript.json` | Manifest (bez zmian koncepcyjnych względem v6.0) |
| `Kod.gs` | Router, bezpieczeństwo, widok Pracownika (PIN → dotknięcie → potwierdzenie, odbicia, ręczne wpisy, nieobecności) |
| `Logika.gs` | Czysta logika (parowanie odcinków, walidacje, kolizje) — pokryta testami jednostkowymi |
| `Panel.gs` | Widok Właściciela: Dziś / Skrzynka (Potwierdź–Edytuj) / Miesiąc / eksport XLSX |
| `Administrator.gs` | Widok Admina-Edytora + migracja `setupOpoka()` |
| `Styl.html` | Wspólny CSS + pomocnicze JS (dołączany przez `include`) |
| `Pracownik.html` | UI pracownika (`?page=pracownik` lub bez parametru) |
| `Wlasciciel.html` | UI właściciela (`?page=wlasciciel`) |
| `Admin.html` | UI admina (`?page=admin`) |

**Stare pliki (`Dashboard.gs`, `Index.html`, `DashboardGUI.html`, `MasterGUI.html`) należy
usunąć z projektu** — ich funkcje przejmują pliki powyższe. Stary `Kod.gs` zastępuje nowy.

## Krok po kroku

1. **Kopia bezpieczeństwa:** Plik → Utwórz kopię całego arkusza Google Sheets. (Migracja niczego
   nie usuwa, ale kopia to zasada, nie opcja.)
2. W edytorze Apps Script: usuń stare pliki, wklej 9 plików z tej paczki (nazwy 1:1).
3. Sprawdź, że `SS_ID` w `Kod.gs` wskazuje właściwy, produkcyjny arkusz.
4. Uruchom ręcznie funkcję **`setupOpoka`** (plik `Administrator.gs`) i zatwierdź uprawnienia.
   Funkcja jest idempotentna — wielokrotne uruchomienie jest bezpieczne. Wykona:
   - dopisze nagłówki nowych kolumn `Ewidencja` (I–M) i `Pracownicy` (G–K),
   - utworzy arkusz `Nieobecnosci` (oraz brakujące `Logi_Admin`/`Anomalie`),
   - **zahaszuje istniejące PIN-y** (HMAC-SHA256 z solą per osoba i sekretem PEPPER
     w ScriptProperties) i wyczyści kolumnę jawnego PIN-u,
   - nada roli `Admin` z kolumny „Rola” flagi `Czy_Wlasciciel` + `Czy_Admin`,
   - ustawi format tekstowy kolumn Data/Godzina (stare wartości bez zmian).
5. **Ustaw strefę czasową PLIKU arkusza** na Warszawę (Plik → Ustawienia) — musi być zgodna
   z manifestem (incydent 9.2 z audytu v6.0).
6. Wdrożenie: Wdróż → Zarządzaj wdrożeniami → istniejące wdrożenie → **Edytuj → Nowa wersja**
   (URL pozostaje ten sam). Adresy: bez parametru lub `?page=pracownik` (pracownik),
   `?page=wlasciciel` (kadry), `?page=admin` (admin-edytor).
7. Wejdź jako admin (`?page=admin`) i sprawdź listę zespołu; PIN-y pozostały te same co w v6.0
   (zostały zahaszowane, nie zmienione).

## Co się zmienia dla użytkowników

- **Pracownik:** PIN → jeden wielki przycisk (system sam wie, czy to WEJŚCIE, czy WYJŚCIE —
  także przy kilku odcinkach dziennie, np. 9–10 i 15–20) → potwierdzenie → gotowe.
  Braki uzupełnia sam: „Uzupełnij dzień” = godziny z ręki **z obowiązkowym uzasadnieniem**
  albo nieobecność (lista typów zależna od formy zatrudnienia — na zleceniu/B2B nie ma L4
  ani urlopu na żądanie).
- **Właściciel:** karty w Skrzynce z decyzją **Potwierdź / Edytuj**. Potwierdź = godziny
  zostają, jakby pracownik odbił się normalnie. Edytuj = wpisanie właściwych godzin/oznaczeń
  z obowiązkowym powodem. Ręczne wpisy pracowników są zawsze oflagowane (chip „ręczne”)
  wraz z uzasadnieniem pracownika — w panelu i w eksporcie XLSX.
- **Korekty nigdy nie kasują wierszy** — anulowanie to status w nowych kolumnach, nowe godziny
  to nowe wiersze ze źródłem `wlasciciel` i powodem. Pełna rozliczalność każdej zmiany.
- Ekran kodu rotacyjnego znika — kod z tabletu admina nie jest już potrzebny do odbicia.

## Raport z testów — co zostało faktycznie sprawdzone

**Wykonane automatycznie (środowisko Node.js, przed oddaniem kodu):**
- `Logika.gs` — **125 testów jednostkowych, 125 zaliczonych, 0 błędów**: parowanie wielu
  odcinków dziennie (w tym przypadek 9–10 + 15–20), zdarzenia nieposortowane, dni otwarte,
  duplikaty WEJŚCIE/WYJŚCIE (odtworzone incydenty z audytu v6.0), odcinki zerominutowe,
  śmieciowe godziny, kolizje ręcznych wpisów (nakładanie, styk, domykanie otwartego wejścia),
  walidacje dat (29 lutego, 31 kwietnia), PIN-ów, uzasadnień, różnice dat przez zmianę czasu
  letni/zimowy i przełom roku.
- Weryfikacja składni wszystkich plików serwerowych (`node --check`).

**Czego nie da się wykonać poza Google i co wymaga 15 minut testu ręcznego po wdrożeniu**
(kod tych ścieżek jest defensywny — locki, walidacje, rate limiting — ale uczciwie:
integracji z żywym arkuszem nie uruchomię poza Apps Script):

1. `setupOpoka()` na kopii arkusza → kolumna PIN pusta, PIN_Hash wypełniony, arkusz
   `Nieobecnosci` istnieje, stare wiersze `Ewidencja` nietknięte.
2. Logowanie PIN-em każdej roli (pracownik / właściciel / admin) + błędny PIN (komunikat,
   po 8 próbach blokada na 5 min).
3. Odbicie WEJŚCIE → WYJŚCIE → ponowne WEJŚCIE → WYJŚCIE tego samego dnia; suma w panelu
   właściciela = suma odcinków; próba dwóch WEJŚĆ pod rząd odrzucona z komunikatem.
4. Ręczny wpis bez uzasadnienia → odrzucony; z uzasadnieniem → chip „ręczne” w Skrzynce
   i miesiącu; Potwierdź → chip zmienia się na „ręczne ✓”; Edytuj → nowe godziny, stare
   wiersze mają status ANULOWANE (nie zniknęły z arkusza).
5. Nieobecność na zleceniu → brak L4/urlopu na żądanie na liście typów.
6. Eksport XLSX miesiąca z danymi historycznymi v6.0 + nowymi odbiciami w jednej siatce.
7. Dwa telefony odbijające się jednocześnie (lock — brak duplikatów).

## Znane, świadome granice

- Odczyt całej `Ewidencji` przy każdej operacji — bez zmian względem v6.0; przy 6 osobach
  bezproblemowe latami. Partycjonowanie roczne opisane w koncepcji OPOKA można dodać później
  bez zmiany danych.
- Ręczna edycja arkusza przez konto właściciela Google pozostaje fizycznie możliwa
  (natura platformy) — system ją ujawnia (rozjazdy sekwencji → flagi „!”), nie uniemożliwia.
- Odcinek przez północ wpisuje się jako dwa dni (komunikat w walidacji).
