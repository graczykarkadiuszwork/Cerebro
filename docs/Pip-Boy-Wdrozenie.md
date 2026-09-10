# Pip-Boy — status budowy i wdrożenie

## Co istnieje teraz (Faza 1 + część Fazy 2, zgodnie z sekcją 0.11.2 koncepcji)

Kod w tym repozytorium (branch `Pip-Boy`), zintegrowany z Cerebro jako nowy moduł:

- `PipBoy.gs` (51 funkcji) — rytuał miesięczny grafiku (wejście manualne, sekcja 0.4 MVP), Szablony Dnia A/B/C/D, Moduł 1 (Suplementacja — Melatonina warunkowa), Moduł 2 (Trening: plan edytowalny, log serii, RPE, status „zmodyfikowana — zdrowie”, reguła plateau), Moduł 4 (Dieta), Moduł 5 (Czytelnictwo + rolling average), Moduł 6 (Spacer z psem), Moduł 7 (Pielęgnacja per-produkt), Moduł 8 (Sprzątanie — rotacja 7-strefowa, floor/ceiling), Moduł 9 (Kontakt z naturą, auto-link ze spacerem), Moduł 11 (Mood tracker + follow-up GI), Moduł 17 (Zakupy 70/30), Moduł 19 (Czas wolny — log minimalistyczny), Moduł 20 (Rolling average), przypomnienia cykliczne (fryzjer/badania/auto/robot filtr), mechanika HP (sekcja 4.2) — **teraz obejmująca też sprzątanie i czytelnictwo, nie tylko suplementy/posiłki/mood**, XP/Atrybuty (4.1), GOD_MODE_24H (4.1a), Tryb Regeneracji (4.1b), Karta Postaci (6.6), katalog 208 odznak (4.3, wczytany programowo z dokumentu) + ewaluator startowy (3 przykładowe odznaki), Cytat Dnia (5.4), Marquee (6.12).
- `PipBoyData.gs` — dane statyczne: suplementy, szablony posiłków, plan treningowy A/B, kategorie zakupowe 70/30, produkty pielęgnacyjne, rotacja sprzątania, tabela kalibracji HP i punktów, **263 realne cytaty**, **107 komunikatów Marquee**, **208 odznak**.
- `PipBoy.html` + `PipBoyStyles.html` — trzy wewnętrzne zakładki (DZIEŃ / TRENING / POSTAĆ, przełączane bez przeładowania modułu Cerebro), motyw Pip-Boy (6.9): zielony monospace, CRT Low/Medium/Ultra i rozmiar czcionki w pełni ręczne (Runda #17).
- Wpięte do istniejącej nawigacji Cerebro (`sidebar.html`, `scripts.html`) i do Ustawień (przycisk „Skonfiguruj Pip-Boy”, `ustawienia.html`).

**Świadomie POZA tym pakietem** (dalsza część Fazy 2 + Faza 3/4, patrz sekcja 0.11.2): dwustronna synchronizacja Google Calendar, odczyt RCP, offline-first (Service Worker + IndexedDB), Dashboard graficzny z wykresami (6.13), Widok tygodniowy (6.5), Onboarding formularz (6.11), Portfolio Figurek (Moduł 18), Moduł 21 (Finanse osobiste), Moduł 12 (Badania — obecnie tylko jako przypomnienie cykliczne, bez pełnego ekranu), Moduł 15/16 (Auto/Motocykl — obecnie tylko jako przypomnienie cykliczne, bez sezonowej logiki motocykla), pełna ewaluacja wszystkich 208 warunków odznak (na razie 3 przykładowe), narzędzie wymiany treningu (podmiana na bibliotekę CrossFit / plan alternatywny — obecnie tylko status ad-hoc bez wyboru źródła).

**Znana luka odziedziczona ze specyfikacji, nie z tej implementacji:** sekcja 4.2 dokumentu koncepcyjnego nie definiuje kary HP dla Rozciągania/Jogi ani Higieny światła, mimo że sekcja 2.0 oznacza oba jako OBLIGATORYJNE. Oba są w pełni trackowalne (checkbox w Widoku Dnia), ale świadomie nie naliczają jeszcze kary HP — czeka na kalibrację od Arka, tak samo jak reszta tabeli 4.2.

**Poprawiona w tej turze usterka Fazy 1:** floor sprzątania (15 min) był błędnie ograniczony tylko do Szablonu C (dzień wolny) zamiast obowiązywać każdego dnia oprócz niedzieli, zgodnie z sekcją 2.0. Poprawione — patrz `generateDayBlocks` w `PipBoy.gs`.

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
