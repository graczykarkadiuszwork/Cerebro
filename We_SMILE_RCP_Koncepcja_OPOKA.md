# We SMILE RCP — koncepcja „OPOKA”
## Rejestr czasu pracy jako niepodrabialna księga dowodowa — na bazie istniejącej struktury Google Sheets + Apps Script

| | |
|---|---|
| **Wersja** | 1.0 — koncepcja konkursowa |
| **Data** | 2026-07-18 |
| **Punkt wyjścia** | Audyt „We_SMILE_RCP_Specyfikacja.md” v1.0 (system v6.0) oraz konkurencyjna koncepcja „TRIADA” v1.2 |
| **Twarde warunki zlecenia** | Wyłącznie Google Sheets + Google Apps Script + natywne API przeglądarki. Zero nowych platform i usług. Zero utraty historycznych danych z arkusza `Ewidencja`. Trzy widoki: Pracownik / Właściciel (Kadry) / Admin-Edytor. Funkcjonalność i prostota obsługi na pierwszym miejscu. Oznaczanie nieobecności (urlop, urlop na żądanie, L4 itd.). |
| **Zakres prawny** | Kodeks pracy, rozporządzenie MRPiPS w sprawie dokumentacji pracowniczej (Dz.U. 2018 poz. 2369), RODO, art. 22²–22³ KP, wyrok TSUE C-55/18 (CCOO) — stan na 18.07.2026 |

---

## 0. Teza konkursowa — trzy filary, których nie ma ani v6.0, ani TRIADA

Koncepcja TRIADA trafnie zdiagnozowała choroby v6.0 i wprowadziła cztery dobre lekarstwa: dziennik append-only, role jako niezależne flagi, filozofię „oznaczanie zamiast zgłaszania” nieobecności oraz mobile-first. **OPOKA przejmuje te cztery rozwiązania wprost — z podaniem źródła — bo są słuszne i nie ma sensu być „innym na siłę” tam, gdzie konkurent ma rację.** Konkurencja rozstrzyga się gdzie indziej: w trzech obszarach, w których TRIADA zatrzymała się w połowie drogi.

**Filar I — czynnik posiadania zamiast geolokalizacji jako fundament tożsamości.**
TRIADA opiera weryfikację na PIN + geolokalizacji. Oba czynniki są typu „coś, co wiesz / gdzie jesteś” — oba w pełni przekazywalne: PIN można podyktować, a GPS przeglądarki sfałszować mock-location, co TRIADA sama uczciwie przyznaje. OPOKA wprowadza **czynnik posiadania: sparowane urządzenie** (rozdz. 3). Telefon pracownika zostaje jednorazowo zarejestrowany w systemie (jak WhatsApp Web — kod parowania), po czym każde odbicie niesie kryptograficzny dowód „to odbito z telefonu Kai, nie tylko z PIN-em Kai”. Oszustwo „odbij za mnie” przestaje być podyktowaniem 4 cyfr — wymaga fizycznego oddania komuś swojego telefonu, codziennie, na oczach zespołu. Geolokalizacja w OPOCE **zostaje, ale jako opcjonalny, konfigurowalny sygnał dodatkowy** — co ma też wymierny skutek prawny: dopóki jest wyłączona, nie uruchamiamy w ogóle reżimu monitoringu z art. 22³ KP i obowiązków informacyjnych z nim związanych (rozdz. 6).

**Filar II — łańcuch hashy zamiast hashy wierszy.**
TRIADA hashuje każdy wiersz z osobna. To wykrywa **edycję** komórki, ale nie wykrywa **usunięcia całego wiersza** — cichy `deleteRow` zrobiony ręcznie w arkuszu pozostaje niewidzialny, bo pozostałe wiersze nadal mają poprawne hashe. OPOKA buduje **łańcuch**: hash każdego zdarzenia obejmuje hash zdarzenia poprzedniego (rozdz. 4). Usunięcie, wstawienie lub przestawienie dowolnego wiersza rozrywa łańcuch od tego miejsca do końca — i jest wykrywane przez codzienną weryfikację. Historyczna `Ewidencja` zostaje zapieczętowana jednym zbiorczym hashem i staje się „blokiem zerowym” łańcucha: dane z przeszłości nie tylko nie giną — zostają kryptograficznie zakotwiczone.

**Filar III — kompletna karta ewidencji czasu pracy, nie tabela wejść i wyjść.**
Ani v6.0, ani TRIADA nie wytwarzają dokumentu, którego naprawdę wymaga prawo. § 6 rozporządzenia o dokumentacji pracowniczej każe ewidencjonować nie tylko liczbę przepracowanych godzin, ale też: godziny rozpoczęcia i zakończenia pracy, godziny nadliczbowe, pracę w porze nocnej, dni wolne **z oznaczeniem tytułu ich udzielenia**, urlopy, zwolnienia od pracy oraz inne usprawiedliwione i nieusprawiedliwione nieobecności. OPOKA wprowadza **grafik jako obiekt pierwszej klasy** (rozdz. 1.4) i **zamknięcie miesiąca** (rozdz. 5), dzięki czemu na koniec każdego miesiąca system generuje jednym kliknięciem pełną, zgodną z § 6 kartę ewidencji per pracownik — dokument gotowy na kontrolę PIP, a nie surowiec do ręcznej obróbki. Dla osób na zleceniu system prowadzi odrębną, prostszą ewidencję liczby godzin (wymóg ustawy o minimalnym wynagrodzeniu), a dla B2B — neutralny rejestr obecności bez nomenklatury pracowniczej.

Do tego dochodzi czwarta różnica, mniejsza architektonicznie, ale duża funkcjonalnie: **dwustronne oznaczanie nieobecności** (rozdz. 2). TRIADA słusznie zostawia zgłaszanie nieobecności telefonowi, ale ciężar opisania jej w systemie składa wyłącznie na pracownika. OPOKA pozwala oznaczyć nieobecność **każdej ze stron rozmowy**: właściciel może to zrobić jednym gestem jeszcze w trakcie telefonu („Kamila, L4 do piątku” — trzy dotknięcia), a pracownik przy najbliższym logowaniu tylko potwierdza lub uzupełnia. Kto pierwszy, ten opisuje; druga strona widzi i może skorygować. Znika jedyny słaby punkt modelu TRIADY — zależność od tego, czy pracownik po powrocie zareaguje na popup.

---

## 1. Model danych — wyłącznie rozszerzenie istniejącej struktury

Zasada identyczna jak w TRIADZIE i przejęta świadomie: **żadna istniejąca kolumna nie znika ani nie zmienia znaczenia; wszystko nowe to nowe kolumny na końcu albo nowe arkusze.** Różnice zaczynają się w tym, *co* dodajemy.

### 1.1 `Pracownicy` — rozszerzenie

| Kolumna | Status | Opis |
|---|---|---|
| ID, Imię, Nazwisko, Rola, Status, PIN | **bez zmian** | `Rola` (kol. 3) zostaje jako stanowisko opisowe. Kolumna `PIN` po migracji zostaje wyzerowana — jedyna świadoma nadpisana wartość w całym systemie. |
| `PIN_Hash`, `PIN_Sol` *(nowe)* | dodane | Iterowany SHA-256 (10 000 rund) z solą per pracownik **i pieprzem z `ScriptProperties`** — wyciek samego arkusza nie wystarcza do offline brute-force 10 000 kombinacji, bo bez pieprza hash jest nieweryfikowalny. To krok dalej niż sól sama w sobie. |
| `Jest_Pracownikiem`, `Jest_Wlascicielem`, `Jest_Adminem` *(nowe, boolean)* | dodane | **Przejęte 1:1 z TRIADY** — role jako niezależne, nakładające się flagi; współwłaściciel-administrator ma obie i po zalogowaniu widzi przełącznik paneli. Rozwiązanie słuszne, nie zmieniam go. |
| `Forma_Zatrudnienia` *(nowa)* | dodana | `Umowa o pracę` / `Zlecenie` / `B2B` / `Inne`. Jak w TRIADZIE steruje listą kategorii nieobecności, ale w OPOCE dodatkowo wybiera **typ generowanego dokumentu miesięcznego**: karta ewidencji § 6 / ewidencja godzin zleceniobiorcy / rejestr obecności (rozdz. 5). |
| `Norma_Etatu` *(nowa)* | dodana | Wymiar etatu — przeniesiony z `ScriptProperties` tam, gdzie logicznie należy. |

Celowo **nie ma** kolumny `Dni_Robocze` znanej z TRIADY — dni i godziny pracy każdej osoby wynikają z arkusza `Grafik` (1.4), który daje więcej informacji (nie tylko *czy* ktoś pracuje w środę, ale *od której do której*), a to odblokowuje wykrywanie spóźnień, przewidywanego końca pracy i pory nocnej.

### 1.2 `Ewidencja` — pieczętowana księga historyczna (blok zerowy)

Arkusz `Ewidencja` **nie dostaje żadnych nowych kolumn i nie przyjmuje żadnych nowych wierszy.** Skrypt migracyjny wykonuje trzy operacje:

1. liczy SHA-256 po wszystkich istniejących wierszach (znormalizowanych przez dotychczasowe `_sheetDate`/`_sheetTime`, żeby niejednorodność typów z audytu nie psuła powtarzalności) i zapisuje wynik jako `PieczecArchiwum` w `Ustawienia`,
2. nakłada na arkusz ochronę zakresu (protection) — sygnał „tu się już nie pisze”,
3. czyni tę pieczęć **hashem genesis** nowego łańcucha zdarzeń (1.3).

Warstwa odczytu (siatki miesięczne, eksporty) skleja przezroczyście dane historyczne z `Ewidencja` i nowe z `Zdarzenia_RRRR` — dla użytkownika to jedna ciągła historia. Wymóg „zero utraty danych” jest spełniony mocniej niż dosłownie: przeszłość jest nie tylko zachowana, ale kryptograficznie zakotwiczona — jej późniejsza manipulacja unieważnia cały łańcuch i jest wykrywalna.

### 1.3 Nowe arkusze: `Zdarzenia_2026`, `Zdarzenia_2027`, … — łańcuchowany dziennik zdarzeń

Partycjonowanie roczne to odpowiedź na dług D1/D9 z audytu: przy 10-letniej retencji (art. 94 pkt 9b KP) pojedynczy, wiecznie rosnący arkusz — jak w v6.0 i TRIADZIE — z każdym rokiem spowalnia **każde** odbicie, bo `getDataRange().getValues()` czyta całość. W OPOCE odbicie czyta wyłącznie bieżącą partycję roczną.

| Kolumna | Opis |
|---|---|
| Timestamp, EmpID, Imię, Nazwisko, Akcja, Data, Godzina, Źródło | **Identyczne jak w `Ewidencja`** — format zachowany, żeby warstwa odczytu była trywialna |
| `ZdarzenieID` | UUID |
| `AktorID` | Kto fizycznie dokonał zapisu (przy odbiciu = EmpID; przy korekcie = ID właściciela/admina) — audyt wymaga rozróżnienia „czyj czas” od „kto zapisał” |
| `Czynniki` | Zapis czynników uwierzytelnienia obecnych przy zdarzeniu, np. `URZADZENIE+PIN+GEO` / `URZADZENIE+PIN` / `PIN` (tryb awaryjny) — rozwinięcie `TrybWeryfikacji` z TRIADY do pełnej listy (rozdz. 3.3) |
| `KorygujeZdarzenieID` | Przejęte z TRIADY: korekta = nowy wiersz wskazujący korygowany, nigdy delete |
| `Powod` | Obowiązkowe uzasadnienie przy każdej korekcie |
| `PoprzedniHash` | Hash poprzedniego zdarzenia w łańcuchu (dla pierwszego zdarzenia roku — hash zamknięcia roku poprzedniego; dla pierwszego w ogóle — `PieczecArchiwum`) |
| `Hash` | SHA-256(`PoprzedniHash` + treść wiersza + pieprz z `ScriptProperties`) |

Zapis zdarzenia jest serializowany przez `LockService.getScriptLock()` — konieczne dla spójności łańcucha, a **przy okazji rozwiązuje race condition z długu D6** (dwa równoległe zapisy w v6.0 mogły się przeplatać). Jeden mechanizm, dwa problemy.

`masterSetDay` (delete+insert) nie istnieje. Jedyna operacja zapisu to `appendEvent()` — wspólna dla odbić i korekt.

### 1.4 Nowy arkusz: `Grafik` — planowany czas pracy jako obiekt pierwszej klasy

| Kolumna | Opis |
|---|---|
| `EmpID` | FK → Pracownicy |
| `Zakres` | `SZABLON` (powtarzalny dzień tygodnia) lub konkretna data (wyjątek nadpisujący szablon) |
| `Dzien` | `Pn`…`Nd` dla szablonu / `yyyy-MM-dd` dla wyjątku |
| `Od`, `Do` | Planowane godziny (puste = dzień wolny) |
| `Obowiazuje_Od` | Data, od której wiersz szablonu obowiązuje (zmiany grafiku nie nadpisują historii) |

Grafik edytuje Właściciel (prosty tygodniowy widok, raz ustawiony — działa latami). To najtańszy pojedynczy dodatek o największej liczbie skutków:

- **wykrywanie nieopisanych nieobecności** — dzień z planem, bez odbicia i bez wpisu w `Nieobecnosci` (mechanizm i wyzwalacz jak w TRIADZIE, ale zasilany grafikiem zamiast pola tekstowego `Dni_Robocze`),
- **inteligentne „zapomniał się wybić”** — flaga nie po sztywnych 12h, lecz po planowanym `Do` + konfigurowalny margines (np. 2h); trafniejsza i szybsza,
- **spóźnienia i nadgodziny** — odbicie vs plan, oznaczane w siatce Właściciela (informacyjnie, nie represyjnie),
- **pora nocna** — automatyczne wyliczenie do karty § 6,
- **panel „Jutro”** — kto powinien być, obok panelu „Dziś”.

### 1.5 Nowy arkusz: `Nieobecnosci` — model TRIADY + dwustronność

Struktura przejęta z TRIADY (WpisID, EmpID, Data — jeden dzień na wiersz, Typ filtrowany przez `Forma_Zatrudnienia`, obowiązkowy `OpisKrotki`, opcjonalny `ZalacznikURL`, korekta przez `KorygujeWpisID`) — z trzema zmianami:

| Kolumna | Zmiana |
|---|---|
| `OznaczylID` | *(nowa)* Kto oznaczył: sam pracownik czy właściciel — obie strony mogą (Filar IV z rozdz. 0) |
| `PotwierdzilID`, `PotwierdzonoDnia` | *(nowe)* Druga strona potwierdza jednym dotknięciem; wpis niepotwierdzony jest ważny (nie blokuje niczego), ale oznaczony dyskretną kropką „czeka na potwierdzenie” |
| `Symbol` | *(nowa)* Kod do karty ewidencji (UW, UŻ, CH, OP, UO, UB, DEL, NU…) mapowany automatycznie z `Typ` — dzięki temu karta § 6 składa się sama |

Listy kategorii per forma zatrudnienia — dokładnie jak w TRIADZIE (umowa o pracę: urlop wypoczynkowy, urlop na żądanie, L4, opieka art. 188 KP, okolicznościowy, bezpłatny, delegacja/szkolenie, inna usprawiedliwiona; zlecenie/B2B: przerwa w świadczeniu usług, choroba własna, inna) — konfigurowalne w `Ustawienia`. Zasada „system nie ma formularza *zgłaszania*, telefon zostaje telefonem” — przejęta bez zmian, bo jest słuszna: OPOKA dodaje tylko to, że efekt rozmowy może zapisać którakolwiek jej strona.

Mechanizm popupu dla pracownika — reguły TRIADY przejęte 1:1 (bieżący miesiąc zawsze; poprzedni miesiąc tylko przez pierwsze 10 dni; X nie zamyka sprawy). Dodatek OPOKI: jeśli nieobecność oznaczył właściciel, popup pracownika zmienia się z „opisz” na „potwierdź” — jedno dotknięcie zamiast wyboru z listy.

### 1.6 Nowy arkusz: `Urzadzenia` — rejestr czynnika posiadania

| Kolumna | Opis |
|---|---|
| `UrzadzenieID` | UUID |
| `EmpID` | Właściciel urządzenia |
| `TokenHash` | SHA-256 tokenu urządzenia (128-bit, wydawany przy parowaniu, przechowywany w localStorage telefonu; w arkuszu wyłącznie hash) |
| `Nazwa` | np. „iPhone Kai” — nadawana przy parowaniu |
| `Status` | `Aktywne` / `Cofniete` |
| `Zarejestrowano`, `OstatnioWidziane` | Timestampy |

### 1.7 `Ustawienia`, `Powiadomienia`, `Anomalie`, `Logi_Admin`

- `Ustawienia` i `Powiadomienia` — przejęte z TRIADY co do idei (konfiguracja poza kodem; centrum powiadomień z dzwonkiem, auto-odczytem i ręcznym „oznacz jako nieprzeczytane”). W `Ustawienia` dochodzą: `PieczecArchiwum`, przełącznik `Geo_Wlaczona` (domyślnie **wyłączona** — rozdz. 6), margines flagi braku wybicia, kalendarz zamknięć placówki.
- `Anomalie` — bez zmian struktury; dochodzą nowe typy wpisów: `LANCUCH_PRZERWANY`, `JEDNO_URZADZENIE_DWA_KONTA`, `TRYB_AWARYJNY_UZYTY`.
- `Logi_Admin` — jak w TRIADZIE, zaczyna logować także odczyty danych osobowych (kto oglądał czyj miesiąc) — łata luka wprost wskazana w audycie (rozdz. 7 tabela, wiersz „Audyt”).
- `ScriptProperties` — wyłącznie sekrety: `RCP_SECRET` (kod HMAC) i `PIEPRZ` (do hashy PIN-ów i łańcucha). Zero stanu biznesowego. Fallback do domyślnego sekretu (dług D12) — usunięty; brak sekretu = kontrolowany błąd startu, nie ciche przejście na wartość znaną publicznie.

---

## 2. Nieobecności w praktyce — trzy scenariusze

**Scenariusz A (najczęstszy):** Kamila dzwoni rano: „mam L4 do piątku”. Właściciel, nie kończąc rozmowy, otwiera panel → „Dziś” → Kamila → „Oznacz nieobecność” → L4, do piątku (system rozbije na wpisy dzienne), opis „L4 tel.”. Koniec — 10 sekund. Kamila przy pierwszym logowaniu po powrocie widzi „Właściciel oznaczył: L4 pon–pt — potwierdź” i dotyka jeden przycisk (przy okazji może dołączyć skan ZUS ZLA linkiem).

**Scenariusz B:** Właściciel odebrał telefon w aucie i niczego nie oznaczył. Wieczorny wyzwalacz widzi: grafik mówił „pracuje”, odbić brak, wpisu brak → dzień trafia na listę nieopisanych. Pracownik dostanie popup po powrocie (reguły TRIADY), właściciel — powiadomienie w dzwonku. Którakolwiek strona opisze pierwsza — druga potwierdza.

**Scenariusz C (nadużycie):** pracownik próbuje po fakcie oznaczyć „urlop na żądanie” na dzień, w którym po prostu nie przyszedł bez telefonu. Wpis powstaje, ale jest **niepotwierdzony** i właściciel dostaje powiadomienie „X oznaczył urlop na żądanie wstecz — potwierdź lub skoryguj”. Nic nie ginie, nic nie dzieje się bez wiedzy drugiej strony, a ślad sporu zostaje w dzienniku.

---

## 3. Uwierzytelnienie i bulletproofing

### 3.1 Parowanie urządzenia (raz na telefon)

1. Admin-Edytor w swoim panelu generuje dla pracownika **kod parowania** (8 znaków, ważny 10 minut, jednorazowy).
2. Pracownik otwiera stały adres systemu na swoim telefonie, wpisuje kod i ustawia PIN.
3. Serwer wydaje losowy token 128-bit → localStorage telefonu; w `Urzadzenia` ląduje wyłącznie jego hash.
4. Od tej chwili telefon jest rozpoznawany: ekran startowy wita „Cześć, Kaju” bez żadnego wpisywania.

Zgubiony/nowy telefon → Admin cofa urządzenie (`Status=Cofniete`) i generuje nowy kod parowania. Stary token staje się bezwartościowy natychmiast.

### 3.2 Odbicie (codziennie, docelowo < 3 sekundy)

Telefon rozpoznany → ekran od razu pokazuje imię i dwa duże przyciski WEJŚCIE/WYJŚCIE → dotknięcie → PIN (4 cyfry, walidacja lokalna natychmiastowa, RPC dopiero po czwartej cyfrze — poprawka wydajnościowa z rozdz. 9 TRIADY, przejęta) → animowane potwierdzenie. Jeśli `Geo_Wlaczona`, w tle dokleja się wynik geolokalizacji jako sygnał (nigdy blokada). Jeśli w ostatnich minutach był aktywny bierny ekran `?page=kod-recepcji` — system poprosi też o kod rotacyjny HMAC (mechanizm adaptacyjny TRIADY, przejęty jako opcja).

**Tryb awaryjny** (rozładowany/zapomniany telefon): odbicie z dowolnej przeglądarki samym PIN-em **zawsze przechodzi** — ale ląduje z `Czynniki=PIN`, generuje wpis `TRYB_AWARYJNY_UZYTY` w `Anomalie` i powiadomienie dla właściciela. Filozofia spójna z TRIADĄ: flagować, nie blokować — nikt nie zostaje przed drzwiami bez możliwości odbicia.

### 3.3 Tabela wektorów oszustwa

| Wektor | v6.0 | TRIADA | OPOKA |
|---|---|---|---|
| „Odbij za mnie” (podanie PIN-u koledze) | wymaga też kodu z ekranu — o ile ekran działa | PIN + geo: kolega będący na miejscu odbije bez problemu | wymaga **fizycznego przekazania telefonu**; odbicia dwóch osób z jednego urządzenia → automatyczna flaga `JEDNO_URZADZENIE_DWA_KONTA` |
| Odbicie zdalne (z domu) | blokowane kodem z ekranu | geo flaguje (fałszowalne mock-location) | telefon jest z pracownikiem, więc sam czynnik posiadania nie wystarcza — geo (jeśli włączona) + wzorce czasowe flagują; uczciwie: bez geo wykrywalność zdalności ograniczona, patrz 3.4 |
| Ręczna edycja arkusza | niewykrywalna | hash wiersza — wykrywa edycję, **nie wykrywa usunięcia wiersza** | łańcuch hashy — wykrywa edycję, usunięcie, wstawienie i przestawienie; codzienna weryfikacja + powiadomienie |
| Manipulacja danymi historycznymi | niewykrywalna | poza zakresem | `PieczecArchiwum` — jednorazowy hash całego archiwum jako genesis łańcucha |
| Cicha korekta godzin przez admina | delete+insert bez śladu | append-only + uzasadnienie | jak TRIADA, plus `AktorID` i zamknięcie miesiąca (rozdz. 5): korekta w zamkniętym miesiącu wymaga jawnego ponownego otwarcia, notyfikowanego drugiej roli |
| „Zapomniałem się wybić” | ręczne wyłapywanie | flaga po sztywnych 12h | flaga po planowym końcu z grafiku + margines — szybciej i trafniej |
| Brute-force PIN | jawny PIN w arkuszu | hash+sól | hash+sól+**pieprz poza arkuszem** — wyciek arkusza nie wystarcza; limit prób per urządzenie |
| Nieuprawniona kategoria nieobecności (L4 na B2B) | brak nieobecności w ogóle | lista filtrowana formą zatrudnienia | przejęte z TRIADY + wymóg potwierdzenia drugiej strony |

### 3.4 Uczciwe zastrzeżenie

Granica jest ta sama, którą uczciwie wyznaczyła TRIADA: bez biometrii żaden system nie udowodni, że telefon trzymała właściwa osoba. OPOKA przesuwa koszt oszustwa z „podyktuj 4 cyfry” na „oddawaj mi codziennie swój telefon” — to różnica jakościowa przy 6-osobowym zespole pracującym w jednym pomieszczeniu, ale nie matematyczny dowód. WebAuthn/odcisk palca rozważono i odrzucono: HtmlService serwuje aplikację w sandboksowanym iframe na domenie `googleusercontent.com`, gdzie API WebAuthn jest w praktyce niedostępne — twardy limit platformy, nie zaniechanie. Drugie znane ograniczenie: Safari potrafi wyczyścić localStorage witryny nieużywanej ponad 7 dni (ITP) — przy codziennym użyciu bez znaczenia, po urlopie dłuższym niż tydzień telefon może wymagać ponownego sparowania; komunikat prowadzi wtedy pracownika prosto do admina po kod, a tryb awaryjny działa od ręki.

---

## 4. Integralność — mechanika łańcucha

- Zapis: `Hash_n = SHA256(Hash_{n-1} ∥ kanoniczna_treść_wiersza ∥ PIEPRZ)`. Kanonizacja = te same normalizacje dat/godzin, których system i tak używa (`_sheetDate`/`_sheetTime` z v6.0 — zachowane).
- Serializacja zapisów przez `LockService` (30 s timeout, kontrolowany komunikat przy przekroczeniu).
- **Codzienny wyzwalacz `weryfikujLancuch()`**: przelicza łańcuch bieżącej partycji (a raz w tygodniu — wszystkich partycji i pieczęci archiwum). Rozbieżność → wpis `LANCUCH_PRZERWANY` w `Anomalie` z numerem pierwszego złego wiersza + powiadomienie dla Admina i Właściciela. Wynik ostatniej weryfikacji (zielona/czerwona plakietka z datą) jest stale widoczny w obu panelach — integralność jako stan, nie jako raport na żądanie.
- Uczciwie: konto Google właściciela wdrożenia zawsze może fizycznie edytować arkusz — na tej platformie celem jest **wykrywalność i rozliczalność, nie fizyczna niemożność** (ta sama uczciwa granica, którą deklaruje TRIADA; OPOKA domyka jedynie ślepą plamkę usuwania wierszy).

---

## 5. Zamknięcie miesiąca i dokumenty

Nowy arkusz `Zamkniecia`: po zakończeniu miesiąca Właściciel przegląda siatkę (system pokazuje blokujące braki: dni bez pary wejście–wyjście, nieopisane nieobecności) i klika **„Zamknij miesiąc”**. System zapisuje: rok-miesiąc, per pracownik sumę godzin, godziny nadliczbowe i nocne (z porównania z grafikiem), liczbę dni każdego symbolu nieobecności, hash końca łańcucha na moment zamknięcia, kto i kiedy zamknął.

- Korekta w zamkniętym miesiącu jest możliwa (życie), ale wymaga jawnej operacji „Otwórz ponownie” z uzasadnieniem — obie role dostają powiadomienie, a w `Zamkniecia` przybywa wpis ponownego zamknięcia. Księgowość nigdy nie pracuje na danych, które po cichu „się zmieniły”.
- Eksport XLSX (mechanizm v6.0 zachowany 1:1) generuje po zamknięciu **dokument właściwy dla formy zatrudnienia**: pełną kartę ewidencji czasu pracy zgodną z § 6 rozporządzenia (umowa o pracę), ewidencję liczby godzin (zlecenie) albo rejestr obecności (B2B).
- Bilans urlopowy: decyzja TRIADY o odroczeniu do 1 stycznia z bilansem otwarcia — **przejęta, bo jest po prostu słuszna**. Zamknięcia miesięcy od startu systemu dodatkowo ułatwią przyszłe naliczenie: dane będą już zsumowane i zamrożone.

---

## 6. Trzy widoki

### 6.1 Pracownik (`?page=pracownik`)
Telefon rozpoznany → imię + WEJŚCIE/WYJŚCIE + PIN → gotowe. Zakładki: **Moje nieobecności** (popup wg reguł TRIADY; potwierdzanie wpisów właściciela jednym dotknięciem; własna historia — realizacja prawa wglądu, art. 149 § 1 KP w zw. z § 6 rozporządzenia), **Mój miesiąc** (odbicia + plan z grafiku). Zero funkcji ponad to — prostota jako cecha, nie brak.

### 6.2 Właściciel — Kadry (`?page=wlasciciel`)
Panele **Dziś** i **Jutro** (z grafiku), centrum powiadomień (mechanika dzwonka przejęta z TRIADY), siatka miesięczna z plakietkami czynników uwierzytelnienia i flagami (spóźnienie, brak wybicia, tryb awaryjny), oznaczanie nieobecności za pracownika (scenariusz A), korekty append-only z uzasadnieniem, edycja grafiku, **Zamknij miesiąc**, eksport dokumentów, plakietka integralności łańcucha.

### 6.3 Admin-Edytor (`?page=admin-edytor`)
Konta (dodanie/dezaktywacja, reset PIN), **parowanie i cofanie urządzeń**, `Ustawienia` (w tym świadomy przełącznik geolokalizacji — patrz niżej), `Logi_Admin`, ręczne `Weryfikuj integralność`, powiadomienia techniczne. Role są flagami (model TRIADY) — współwłaściciel-administrator widzi oba panele po jednym logowaniu.

---

## 7. Zgodność prawna — stan na 18.07.2026

- **Obowiązek obiektywnego, wiarygodnego i dostępnego pomiaru czasu pracy** — wyrok TSUE C-55/18 (CCOO): łańcuchowany, niemutowalny dziennik z rozliczalnością każdej korekty to wprost ta „wiarygodność”; wersja append-only ma wartość dowodową, której tabela nadpisywana nie ma.
- **§ 6 rozporządzenia o dokumentacji pracowniczej (Dz.U. 2018 poz. 2369)** — pełny zakres karty ewidencji (godziny, nadliczbowe, pora nocna, tytuły dni wolnych, urlopy, zwolnienia, inne nieobecności) generowany automatycznie — rozdz. 5. To jedyna z trzech koncepcji, która wytwarza dokument w kształcie wymaganym przez przepis, a nie półprodukt.
- **Retencja 10 lat** od końca roku ustania zatrudnienia (art. 94 pkt 9b KP) — partycje roczne + pieczęć archiwum czynią długą retencję tanią operacyjnie i bezpieczną integralnościowo.
- **Art. 22³ KP (inny monitoring) i RODO:** OPOKA domyślnie **nie zbiera lokalizacji** — czynnik posiadania (sparowane urządzenie) nie jest monitoringiem miejsca pobytu i nie wymaga reżimu art. 22³. Włączenie geolokalizacji to świadoma decyzja w `Ustawienia`, z checklistą prawną w panelu: zapis w regulaminie/obwieszczeniu, pisemna informacja min. 2 tygodnie przed startem, przejrzystość celu (art. 12 RODO), rekomendowana DPIA. Minimalizacja danych (art. 5 ust. 1 lit. c RODO) jako właściwość architektury, nie deklaracja.
- **Hashowanie PIN (z pieprzem), logowanie odczytów danych, brak sekretów w danych** — środki techniczne z art. 32 RODO.
- **Rozdział kategorii nieobecności wg formy zatrudnienia** (za TRIADĄ): L4, urlop na żądanie i opieka z art. 188 KP istnieją tylko w stosunku pracy; system czyni błędną kwalifikację niemożliwą, a odrębne typy dokumentów miesięcznych (rozdz. 5) domykają to również po stronie wyjściowej — czego TRIADA już nie robi. Uwaga metodyczna: przywoływane w koncepcji TRIADA nowelizacje z 2026 r. (m.in. podwyższenie widełek grzywny z art. 281 KP) należy przed wdrożeniem zweryfikować z aktualnym stanem prawnym; OPOKA celowo opiera argumentację wyłącznie na przepisach ugruntowanych — jej wartość dowodowa nie zależy od żadnej świeżej nowelizacji.

---

## 8. UX i wydajność

Cały rozdział 9 i kierunek wizualny rozdziału 10 koncepcji TRIADA (mobile-first od małego ekranu, `100dvh`, `font-size≥16px` przeciw auto-zoomowi iOS, `touch-action: manipulation`, cele dotykowe ≥48 px, optymistyczny PIN-pad bez RPC per cyfra, bottom-sheets zamiast `<select>`, tryb ciemny, szkielety ładowania, animacje sprężyste) — **przejęte w całości jako specyfikacja bazowa.** To dobra robota i kopiowanie jej bez atrybucji byłoby nieuczciwe, a „ulepszanie” na siłę — szkodliwe.

Wkład własny OPOKI w odczuwalną szybkość leży głębiej niż CSS:

- **Zero wpisywania przed odbiciem** — rozpoznane urządzenie eliminuje krok identyfikacji; PIN pozostaje jedynym wpisywaniem w całym przepływie.
- **Jedno RPC na odbicie** (weryfikacja + zapis + odpowiedź w jednym wywołaniu) zamiast kaskady `checkPin` → `clock` z v6.0 — połowa opóźnienia sieciowego znika strukturalnie.
- **Odczyt tylko bieżącej partycji rocznej** — czas odbicia przestaje rosnąć z historią; to różnica, której nie da się nadrobić żadnym spinnerem, i której nie rozwiązuje ani v6.0, ani TRIADA.

---

## 9. Decyzje świadomie odrzucone

- **Kamera/biometria przy odbiciu** — jak w TRIADZIE: RODO, DPIA, sprzęt. Odrzucone.
- **WebAuthn (odcisk palca)** — kuszące, ale nierealizowalne w iframe HtmlService (rozdz. 3.4). Odrzucone z powodów platformowych, z jasnym uzasadnieniem — żeby następny audytor nie musiał odkrywać tego samodzielnie.
- **Geolokalizacja jako czynnik obowiązkowy** — odrzucona świadomie (fałszowalność, ciężar prawny art. 22³, tarcie UX przy promptach uprawnień). Zostaje jako opcja z checklistą prawną.
- **Formularz „zgłoś nieobecność”** — odrzucony, dokładnie z argumentacją TRIADY: telefon wymusza natychmiastową reakcję, formularz może zostać przeoczony. OPOKA jedynie pozwala obu stronom zapisać efekt rozmowy.
- **Wymóg sprzętu recepcyjnego** — odrzucony (za TRIADĄ); ekran kodu HMAC pozostaje czysto opcjonalnym wzmocnieniem.
- **Automatyczny bilans urlopowy od zaraz** — odroczony do 1 stycznia z bilansem otwarcia (za TRIADĄ).
- **Migracja historycznej `Ewidencja` do nowego formatu** — odrzucona. Przepisywanie danych historycznych to ryzyko ich zepsucia; pieczęć + sklejanie w warstwie odczytu daje ten sam efekt bez dotykania ani jednej komórki przeszłości.

---

## 10. Plan wdrożenia — zero przerwy, zero utraty danych

| Faza | Zakres | Czas |
|---|---|---|
| **0. Pieczęć** | Skrypt migracyjny: hash archiwum `Ewidencja` + ochrona arkusza + nowe kolumny w `Pracownicy` (hashowanie PIN-ów, zerowanie kolumny jawnej) + utworzenie nowych arkuszy + sekrety w `ScriptProperties` | 1 dzień |
| **1. Równoległość** | Wdrożenie nowego kodu pod tym samym URL; stary przepływ PIN+kod działa jako tryb awaryjny od pierwszej minuty — nikt nie zostaje bez możliwości odbicia | 1 dzień |
| **2. Parowanie** | 6 osób × 2 minuty: kod parowania od Admina, telefon sparowany; grafik wpisany przez Właściciela (raz) | 1 tydzień kalendarzowy |
| **3. Pełny tryb** | Odbicia niesparowane stają się flagowanym trybem awaryjnym; rusza wyzwalacz nieobecności i weryfikacja łańcucha; pierwszy pełny miesiąc kończy się pierwszym „Zamknij miesiąc” | od 1. dnia następnego miesiąca |

Rollback w każdej fazie: dane historyczne nietknięte, nowe zdarzenia w formacie zgodnym kolumnowo ze starym — powrót do v6.0 to wyłącznie zmiana kodu, nie danych.

---

## 11. Zestawienie konkursowe

| Kryterium | v6.0 | TRIADA | **OPOKA** |
|---|---|---|---|
| Tożsamość odbijającego | PIN jawny + kod z ekranu | PIN hash + geo (+kod adaptacyjnie) | PIN hash+pieprz + **sparowane urządzenie** (+geo/kod opcjonalnie) |
| Wykrycie edycji wiersza | — | ✔ (hash wiersza) | ✔ |
| Wykrycie **usunięcia** wiersza | — | — | ✔ (łańcuch) |
| Ochrona danych historycznych | — | nietykane | nietykane **+ zapieczętowane** |
| Nieobecności | brak | oznaczanie przez pracownika | oznaczanie **dwustronne** z potwierdzeniem |
| Kategorie wg formy zatrudnienia | — | ✔ | ✔ (za TRIADĄ) + odrębne dokumenty wyjściowe |
| Grafik / plan pracy | — | pole tekstowe dni | **obiekt pierwszej klasy** (godziny, wyjątki, historia zmian) |
| Karta ewidencji zgodna z § 6 | — | — | ✔ automatycznie, po zamknięciu miesiąca |
| Zamknięcie miesiąca | — | — | ✔ z jawnym ponownym otwieraniem |
| Skalowanie na 10 lat retencji | jeden rosnący arkusz | jeden rosnący arkusz | partycje roczne |
| Race conditions zapisu | podatny | niezaadresowane | `LockService` (wymuszony przez łańcuch) |
| Geolokalizacja a art. 22³ KP | n/d | obowiązkowa → pełny reżim monitoringu | **opcjonalna, domyślnie wyłączona** → reżim tylko przy świadomym włączeniu |
| Odbicie bez telefonu/sprzętu | wymaga ekranu kodu | zawsze możliwe | zawsze możliwe (tryb awaryjny, flagowany) |
| Role nakładane (współwłaściciel-admin) | — | ✔ | ✔ (za TRIADĄ) |
| Mobile-first / premium UI | — | ✔ (rozdz. 9–10) | ✔ (przejęte) + 1 RPC/odbicie + odczyt partycji |

---

## 12. Podsumowanie w jednym akapicie

TRIADA naprawiła v6.0. OPOKA naprawia to, czego TRIADA nie widzi: że PIN i lokalizację można pożyczyć, ale telefonu nie chce się oddawać; że hash wiersza nie zauważy zniknięcia wiersza, a łańcuch — tak; że prawo każe prowadzić kartę ewidencji, nie tabelę odbić; że miesiąc kadrowy musi się dać **zamknąć**, żeby cokolwiek było ostateczne; i że system pisany na 10 lat retencji nie może zwalniać z każdym przepracowanym rokiem. Wszystko powyższe — na tej samej platformie, na tych samych arkuszach, bez utraty jednej komórki historii i z prostszym, nie trudniejszym, codziennym użyciem: telefon wita cię po imieniu, a odbicie to jeden PIN i jedno dotknięcie.

*Koniec dokumentu.*
