# Pip-Boy — status budowy i wdrożenie

## Co istnieje teraz (Faza 1 + część Fazy 2, zgodnie z sekcją 0.11.2 koncepcji)

Kod w tym repozytorium (branch `Pip-Boy`), zintegrowany z Cerebro jako nowy moduł:

- `PipBoy.gs` — rytuał miesięczny grafiku (wejście manualne, sekcja 0.4 MVP), Szablony Dnia A/B/C/D, Moduł 1 (Suplementacja — Melatonina warunkowa), Moduł 2 (Trening: plan edytowalny, log serii, RPE, status „zmodyfikowana — zdrowie”, reguła plateau), Moduł 4 (Dieta), Moduł 5 (Czytelnictwo + rolling average), Moduł 6 (Spacer z psem), Moduł 7 (Pielęgnacja per-produkt), Moduł 8 (Sprzątanie — rotacja 7-strefowa, floor/ceiling), Moduł 9 (Kontakt z naturą, auto-link ze spacerem), Moduł 11 (Mood tracker + follow-up GI), Moduł 17 (Zakupy 70/30), Moduł 19 (Czas wolny — log minimalistyczny), Moduł 20 (Rolling average), przypomnienia cykliczne (fryzjer/badania/auto/robot filtr), mechanika HP (sekcja 4.2) — obejmująca sprzątanie, czytelnictwo i trening, nie tylko suplementy/posiłki/mood — XP/Atrybuty (4.1), GOD_MODE_24H (4.1a), Tryb Regeneracji (4.1b), Karta Postaci (6.6), katalog 208 odznak (4.3, wczytany programowo z dokumentu) + **ewaluator obejmujący ~39/208 odznak** (wszystkie, których warunek jest jednoznacznie obliczalny z danych już logowanych — kategorie A/Suplementacja, B/Trening, D/Dieta, E/Czytelnictwo, G/Spacer, H/Sprzątanie + Mood), Cytat Dnia (5.4), Marquee (6.12), **Dashboard graficzny (6.13, wersja podstawowa)** — wykresy Chart.js: trend HP, rozkład XP wg Atrybutu, progresja ciężaru per ćwiczenie, średnia czytelnictwa, trend mood, minuty sprzątania/dzień.
- `PipBoyData.gs` — dane statyczne: suplementy, szablony posiłków, plan treningowy A/B, kategorie zakupowe 70/30, produkty pielęgnacyjne, rotacja sprzątania, tabela kalibracji HP i punktów, **263 realne cytaty**, **107 komunikatów Marquee**, **208 odznak**.
- `PipBoy.html` + `PipBoyStyles.html` — cztery wewnętrzne zakładki (DZIEŃ / TRENING / POSTAĆ / DASHBOARD, przełączane bez przeładowania modułu Cerebro; DASHBOARD ma własne podzakładki OGÓLNY/TRENING/DIETA-UMYSŁ/SEN-NASTRÓJ/DOM), motyw Pip-Boy (6.9): zielony monospace, CRT Low/Medium/Ultra i rozmiar czcionki w pełni ręczne (Runda #17).
- Wpięte do istniejącej nawigacji Cerebro (`sidebar.html`, `scripts.html`) i do Ustawień (przycisk „Skonfiguruj Pip-Boy”, `ustawienia.html`). Chart.js (CDN) doładowany globalnie w `index.html`, obok już używanych Tailwind/Lucide/Marked.

**Świadomie POZA tym pakietem** (dalsza część Fazy 2 + Faza 3/4, patrz sekcja 0.11.2): dwustronna synchronizacja Google Calendar, odczyt RCP, offline-first (Service Worker + IndexedDB), Widok tygodniowy (6.5), Onboarding formularz (6.11), Portfolio Figurek (Moduł 18 — Dashboard ma zarezerwowaną, wyłączoną podzakładkę), Moduł 21 (Finanse osobiste), Moduł 12 (Badania — obecnie tylko jako przypomnienie cykliczne, bez pełnego ekranu), Moduł 15/16 (Auto/Motocykl — obecnie tylko jako przypomnienie cykliczne, bez sezonowej logiki motocykla), pozostałe ~169/208 warunków odznak (sekretne, subiektywne, zależne od modułów jeszcze niezbudowanych lub od dopasowania nazw ćwiczeń — patrz komentarz nad `evaluateStarterBadges` w `PipBoy.gs`), narzędzie wymiany treningu (podmiana na bibliotekę CrossFit / plan alternatywny — obecnie tylko status ad-hoc bez wyboru źródła).

**Znana luka odziedziczona ze specyfikacji, nie z tej implementacji:** sekcja 4.2 dokumentu koncepcyjnego nie definiuje kary HP dla Rozciągania/Jogi ani Higieny światła, mimo że sekcja 2.0 oznacza oba jako OBLIGATORYJNE. Oba są w pełni trackowalne (checkbox w Widoku Dnia), ale świadomie nie naliczają jeszcze kary HP — czeka na kalibrację od Arka, tak samo jak reszta tabeli 4.2.

**Poprawione w tej turze usterki (odkryte podczas budowy Dashboardu/odznak, nie nowo wprowadzone):**
1. Arkusz `punkty_historia` był zdefiniowany dwukrotnie w `setupPipBoy()` z różnymi nagłówkami — druga definicja nadpisywała pierwszą przy zakładaniu arkusza, więc historia dziennego HP (`hp_procent`, `streak_aktualny`...) nigdy nie była realnie zapisywana. Dodany osobny, faktycznie używany arkusz `hp_historia` (upsert przy każdym przeliczeniu Widoku Dnia) — to on zasila teraz trend HP na Dashboardzie.
2. `sprawdzCzyRekord` i `sprawdzPlateau` filtrowały wiersze treningowe po `trening_typ === 'pelna'`, ale kolumna `trening_typ` przechowuje plan A/B, nie status sesji (status jest w `zrodlo_sesji`) — warunek nigdy nie był prawdziwy, więc **rekordy ciężaru nigdy się nie zapisywały, a reguła plateau nigdy nie mogła zadziałać**. Poprawione na `zrodlo_sesji === 'pelna'`.
3. Wywołanie `logTrainingSet(...)` z frontendu (`PipBoy.html`, `pbLogSet()`) pomijało parametr `treningTyp`, przez co wszystkie kolejne argumenty przesuwały się o jedno miejsce względem sygnatury backendu — ciężar trafiał do pola oceny sesji, ocena do notatki itd. Poprawione: `treningTyp` jest teraz wyznaczany z planu na podstawie wybranego ćwiczenia.
4. Floor sprzątania (15 min) był błędnie ograniczony tylko do Szablonu C (dzień wolny) zamiast obowiązywać każdego dnia oprócz niedzieli, zgodnie z sekcją 2.0 (poprawione w poprzedniej turze) — patrz `generateDayBlocks` w `PipBoy.gs`.

## Czego nie mogłem zrobić z tej sesji

Nie mam dostępu do Twojego konta Google — nie mogę więc:
- wypchnąć tego kodu na żywy projekt Google Apps Script (`clasp push` wymaga Twojego OAuth),
- utworzyć arkusza i folderu Pip-Boy na Twoim Dysku (to robi funkcja `setupPipBoy()`, ale dopiero po wdrożeniu),
- podłączyć RCP ani Kalendarza (Faza 2, wymaga Twoich danych dostępowych).

## Jak wdrożyć (kroki dla Ciebie lub dewelopera)

1. Zainstaluj `clasp` (`npm install -g @google/clasp`), zaloguj się (`clasp login`) na to samo konto co `graczyk.arkadiusz.work@gmail.com` (Runda #17, pkt L).
2. W katalogu repo: `clasp create --type webapp --title "Cerebro"` (jeśli projekt Apps Script jeszcze nie istnieje) albo `clasp clone <scriptId>` (jeśli już istnieje z wcześniejszej pracy nad Cerebro) — potwierdź z deweloperem, czy taki projekt już jest.
3. `clasp push` — wgrywa wszystkie pliki `.gs`/`.html` z repo.
4. `clasp deploy` jako Web App (dostęp: tylko Ty — zgodnie z sekcją 0.11.1, pkt 1, wciąż otwartym pytaniem o autentykację).
5. Otwórz wdrożony Web App → Ustawienia → **Skonfiguruj Pip-Boy** — tworzy osobny arkusz i osobny, restrykcyjny folder na Twoim Dysku (sekcja 0.9), zasiewa 263 cytaty i 107 komunikatów Marquee.
6. W nowym arkuszu Pip-Boy, w zakładce `grafik_pracy`, wpisz ręcznie dni bieżącego miesiąca (data, godziny, typ A/B/Wolny) — to tymczasowy, manualny odpowiednik rytuału z sekcji 0.7, dopóki odczyt RCP (Faza 2) nie zastąpi go automatyzacją.
7. Otwórz zakładkę Pip-Boy w Cerebro — powinieneś zobaczyć dzisiejszy Widok Dnia.

## Sugerowany następny krok

Priorytet #2 z wcześniejszego przeglądu wciąż aktualny: **przeliczyć kalibrację HP na papierze** zanim zacznie się codzienne używanie — teraz można to zrobić na żywych, choć jeszcze niepodłączonych, wartościach z `PipBoyData.gs` (`PIPBOY_HP_KARY`).
