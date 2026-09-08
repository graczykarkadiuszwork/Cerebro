# Pip-Boy — status budowy i wdrożenie

## Co istnieje teraz (Faza 1 — rdzeń, zgodnie z sekcją 0.11.2 koncepcji)

Kod w tym repozytorium (branch `Pip-Boy`), zintegrowany z Cerebro jako nowy moduł:

- `PipBoy.gs` — logika: rytuał miesięczny grafiku (wejście manualne, zgodnie z sekcją 0.4 MVP), Szablony Dnia A/B/C/D, Moduł 1 (Suplementacja — Melatonina warunkowa), Moduł 4 (Dieta/posiłki), Moduł 11 (Mood tracker + follow-up GI), podstawowa mechanika HP (sekcja 4.2), GOD_MODE_24H (sekcja 4.1a), Cytat Dnia (5.4), Marquee (6.12).
- `PipBoyData.gs` — dane statyczne: definicje suplementów, szablony posiłków, tabela kalibracji HP, **263 realne cytaty** i **107 realnych komunikatów Marquee** (z `docs/data/`).
- `PipBoy.html` + `PipBoyStyles.html` — Widok Dnia w motywie Pip-Boy (sekcja 6.9): zielony monospace, zwijane bloki, pasek HP, przełączniki CRT (Low/Medium/Ultra) i rozmiaru czcionki — oba w pełni ręczne, zgodnie z Rundą #17.
- Wpięte do istniejącej nawigacji Cerebro (`sidebar.html`, `scripts.html`) i do Ustawień (przycisk „Skonfiguruj Pip-Boy”, `ustawienia.html`).

**Świadomie POZA tą fazą** (Faza 2+, patrz sekcja 0.11.2): szczegółowy Moduł 2 (Trening) z edytowalnym planem i oceną 1-10, status „zmodyfikowany — zdrowie”, pełna lista 208 odznak, Tryb Regeneracji (4.1b), dwustronna synchronizacja Google Calendar, odczyt RCP, offline-first (Service Worker + IndexedDB), Dashboard graficzny (6.13), Portfolio Figurek, Moduł 21 (Finanse osobiste).

**Znana luka odziedziczona ze specyfikacji, nie z tej implementacji:** sekcja 4.2 dokumentu koncepcyjnego nie definiuje kary HP dla Rozciągania/Jogi ani Higieny światła, mimo że sekcja 2.0 oznacza oba jako OBLIGATORYJNE. Oba są w pełni trackowalne (checkbox w Widoku Dnia), ale świadomie nie naliczają jeszcze kary HP — czeka na kalibrację od Arka, tak samo jak reszta tabeli 4.2.

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
