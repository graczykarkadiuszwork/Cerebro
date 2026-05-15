# Scenariusze Użytkowania — System RCP v2.0

## Dla kogo jest ten dokument

Ten dokument opisuje jak system zachowuje się w różnych sytuacjach — zarówno normalnych, jak i wyjątkowych. Przeczytaj go przed wdrożeniem i zachowaj jako przewodnik operacyjny.

---

## SCENARIUSZ 1 — Normalne przyjście do pracy

**Aktorzy:** Anna, asystentka stomatologiczna  
**Sytuacja:** Normalna środa, przyjście o 8:00

**Kroki:**

1. Anna przyjeżdża do kliniki. Przy wejściu widzi plakat z QR kodem.
2. Otwiera aparat na telefonie i skanuje QR.
3. Przeglądarka otwiera aplikację RCP i pyta o zalogowanie — Anna jest już zalogowana kontem Google kliniki.
4. Aplikacja wyświetla jej imię i prosi o zgodę na lokalizację GPS.
5. Anna klika "Zezwól".
6. Po 2–3 sekundach pojawia się zielony komunikat: "GPS aktywny (dokładność: 8m)".
7. Anna klika zielony przycisk **Przyjście**.
8. Pojawia się komunikat: "✅ Przyjście zarejestrowane o 08:03"
9. Na jej email przychodzi potwierdzenie z godziną, datą i nazwą kliniki.

**Czas całej operacji:** 15–25 sekund  
**Zapis w arkuszu:** Jeden wiersz w zakładce "Ewidencja Czasu" z statusem ZATWIERDZONE

---

## SCENARIUSZ 2 — Wyjście po dyżurze

**Aktorzy:** Piotr, lekarz dentysta  
**Sytuacja:** Piątek, wyjście po długim dyżurze o 19:45

**Kroki:**

1. Piotr kończy ostatniego pacjenta. Bierze telefon i skanuje QR przy wyjściu (lub przy wejściu — kod działa w obie strony).
2. Klika **Wyjście**.
3. System sprawdza: "Piotr, przyjście dziś zarejestrowano o 08:15. Czas pracy: 11h 30min."
4. System zapisuje wyjście.

**Trigger anomalii:** Zmiana 11h 30min mieści się w normie (limit alertu ustawiony na 13h), więc alert nie zostaje wysłany.

**Jeśli dyżur przekraczałby 13h:** System rejestruje wyjście, ale automatycznie wysyła Ci email: "⚠️ Anomalia: Piotr pracował 13h 45min. Sprawdź czy to zgodne z harmonogramem."

---

## SCENARIUSZ 3 — Pracownik zapomniał zarejestrować przyjście

**Aktorzy:** Marta, recepcjonistka  
**Sytuacja:** Marta zaczęła pracę o 9:00 ale zapomniała się zarejestrować. Pamiętała dopiero o 14:30.

**Co się dzieje:**

1. Marta próbuje zarejestrować wyjście o 17:00.
2. System blokuje: "Marta, nie masz zarejestrowanego przyjścia dziś. Skontaktuj się z administratorem."
3. Marta dzwoni do Ciebie.

**Twoje działanie (2 minuty):**

1. Otwórz arkusz → zakładka "Ewidencja Czasu"
2. Dodaj ręcznie wiersz: [ID_WPISU=REC001], [ID_PRAC=P003], [DATA=dzisiaj], [TYP=P], [GODZINA=09:00], [STATUS=KOREKTA_RĘCZNA], [UWAGI=Pracownik zapomniał zarejestrować, czas potwierdzony przez kierownika]
3. Powiedz Marcie żeby teraz zarejestrowała wyjście — system już ją wpuści
4. Wpis z korektą jest widoczny w raportach i ewentualnej kontroli Inspekcji Pracy — nota wyjaśnia sytuację

---

## SCENARIUSZ 4 — Próba rejestracji spoza kliniki

**Aktorzy:** Karol, lekarz  
**Sytuacja:** Karol próbuje zarejestrować przyjście z domu (2,3 km od kliniki) — być może przez pomyłkę, być może celowo.

**Co się dzieje:**

1. Karol otwiera aplikację z domu.
2. System pobiera GPS: 2,3 km od kliniki.
3. System blokuje rejestrację: "Jesteś 2300m od kliniki. Maksymalna odległość: 60m. Skontaktuj się z administratorem."
4. Karol nie może się zarejestrować.
5. System zapisuje zdarzenie w zakładce "Logi Audytowe": GPS_ODMOWA | P005 | Odległość: 2300m, limit: 60m.
6. **Nie wysyła alertu emailowego** (to prawdopodobna pomyłka, nie atak).

**Jeśli Karol spróbuje 5 razy z różnych lokalizacji poza kliniką:**
System blokuje konto na 60 minut i wysyła Ci alert: "⚠️ BEZPIECZEŃSTWO: Konto Karola zablokowane po 5 próbach rejestracji poza kliniką."

---

## SCENARIUSZ 5 — Praca w wielu klinikach (jeden dzień)

**Aktorzy:** Dr Zofia, ortodonta pracująca w dwóch klinikach  
**Sytuacja:** Środa: Klinika Centrum do 13:00, Klinika Mokotów od 14:00

**Krok 1 — Klinika Centrum, 8:15:**
1. Zofia skanuje QR w Klinice Centrum.
2. Aplikacja pokazuje dropdown: "Klinika Centrum | Klinika Mokotów"
3. Zofia wybiera "Klinika Centrum" i klika Przyjście.
4. Zapis: Przyjście 08:15, Klinika Centrum

**Krok 2 — Wyjście z Centrum, 13:05:**
1. Zofia skanuje QR w Centrum.
2. Wybiera "Klinika Centrum" i klika Wyjście.
3. Zapis: Wyjście 13:05, Klinika Centrum

**Krok 3 — Klinika Mokotów, 14:00:**
1. Zofia jest w innym miejscu — skanuje QR w Klinice Mokotów.
2. Wybiera "Klinika Mokotów" — GPS jest w promieniu 50m.
3. Klika Przyjście.
4. Zapis: Przyjście 14:00, Klinika Mokotów

**Raport tygodniowy pokaże:** Zofia, środa: 8:15–13:05 (Centrum), 14:00–18:00 (Mokotów). Czytelny podział godzin per klinika.

---

## SCENARIUSZ 6 — Rejestracja w sobotę (alert weekendowy)

**Aktorzy:** Tomasz, technik RTG  
**Sytuacja:** Klinika pracuje w soboty. Tomasz rejestruje przyjście o 9:30 w sobotę.

**Co się dzieje:**

1. Tomasz rejestruje przyjście — rejestracja **przechodzi pomyślnie**.
2. System wykrywa sobotę (dzień weekendowy).
3. Ty (administrator) otrzymujesz email: "⚠️ Anomalia RCP: Tomasz — Przyjście w sobotę 09:30. Sprawdź zakładkę Anomalie."
4. Zakładka Anomalie: nowy wpis ze statusem "NOWE".

**Twoje działanie (30 sekund):**

Otwórz zakładkę Anomalie → znajdź wpis Tomasza → zmień status z "NOWE" na "OK" (klinika pracuje w soboty) lub "WYJAŚNIONO: harmonogram sobotni".

**Dlaczego tak:** Weekend i noc to statystycznie rzadkie zdarzenia — mogą być normalne (pracujesz w soboty) lub podejrzane (ktoś zarejestrował się bezprawnie). System pyta Cię o weryfikację, ale nie blokuje.

---

## SCENARIUSZ 7 — Utrata telefonu przez pracownika

**Aktorzy:** Natalia, higieniistka  
**Sytuacja:** Natalia zgubiła telefon. Boi się że ktoś może się zalogować jako ona.

**Ryzyko:** Znalazca telefonu musiałby:
1. Znać hasło do odblokowania telefonu (blokada ekranu)
2. Być fizycznie w klinice (GPS weryfikacja)

Bez obu tych warunków — rejestracja niemożliwa.

**Co robisz jako administrator:**

1. Popros Natalię żeby zmieniła hasło do konta Google na nowym telefonie (unieważnia sesję na starym)
2. Ewentualnie: zmień status Natalii w arkuszu na "NIEAKTYWNY" dopóki sprawa nie zostanie wyjaśniona
3. Sprawdź zakładkę Logi Audytowe za ostatnie godziny — czy były jakieś próby logowania z konta Natalii

---

## SCENARIUSZ 8 — Kontrola Inspekcji Pracy

**Sytuacja:** Inspektor Inspekcji Pracy przychodzi na kontrolę. Prosi o ewidencję czasu pracy za ostatnie 3 miesiące.

**Co robisz (10 minut):**

1. Otwórz arkusz → zakładka "Ewidencja Czasu"
2. Filtruj według daty (kliknij strzałkę w nagłówku kolumny DATA → filtruj zakres dat)
3. Zaznacz wszystkie dane za żądany okres
4. Kliknij Plik → Pobierz → Microsoft Excel (.xlsx) lub PDF
5. Wydrukuj lub przekaż plik inspektorowi

**Dane w ewidencji zawierają:**
- Datę i godzinę każdego przyjścia i wyjścia
- Identyfikację pracownika (imię, nazwisko)
- Potwierdzenie lokalizacji GPS
- Status każdego wpisu (ZATWIERDZONE / KOREKTA_RĘCZNA)

**Prawidłowe korekty ręczne** (kolumna Uwagi) są dozwolone i akceptowane przez Inspekcję Pracy — ważne żeby każda korekta miała adnotację z datą i powodem.

---

## SCENARIUSZ 9 — Odejście pracownika z kliniki

**Aktorzy:** Ewa, która kończy pracę 30 czerwca  
**Sytuacja:** Ewa odchodzi z kliniki.

**Dzień odejścia — 30 czerwca:**

1. Otwórz arkusz → zakładka Pracownicy
2. Znajdź wiersz Ewy
3. Zmień kolumnę H (STATUS) z "AKTYWNY" na "NIEAKTYWNY"
4. Ewa natychmiast traci dostęp do systemu RCP

**Ważne:** Nie usuwaj wiersza Ewy. Ewidencja czasu pracy musi pozostać przez 10 lat (Art. 94(9a) KP). Zachowaj wszystkie jej wpisy w zakładce Ewidencja Czasu.

**Po 10 latach:** Możesz usunąć dane Ewy z arkusza. Zanotuj w rejestrze czynności przetwarzania: "Dane pracownika [Ewa] usunięte [data], podstawa: Art. 94(9a) KP — upłynął 10-letni okres przechowywania."

---

## SCENARIUSZ 10 — Awaria GPS w telefonie pracownika

**Aktorzy:** Łukasz, technik stomatologiczny  
**Sytuacja:** GPS w telefonie Łukasza nie działa (awaria sprzętowa).

**System zachowuje się:**

1. Łukasz wchodzi na aplikację — GPS nie odpowiada lub zgłasza błąd.
2. Aplikacja wyświetla: "❌ Lokalizacja niedostępna. Sprawdź czy GPS jest włączony."
3. Przyciski Przyjście/Wyjście są nieaktywne.
4. Łukasz nie może się zarejestrować.

**Twoje opcje:**

**Opcja A (zalecana):** Wpis ręczny — Łukasz zgłasza Ci przyjście/wyjście, Ty wpisujesz ręcznie do arkusza z adnotacją "Awaria GPS urządzenia — zarejestrowano ręcznie przez kierownika".

**Opcja B (tymczasowa):** Jeśli problemy GPS są częste w danym miejscu (budynek blokuje sygnał), możesz tymczasowo zwiększyć `RADIUS_GPS_METRY` w arkuszu Kliniki do np. 100m. Uwaga: to zmniejsza dokładność weryfikacji.

**Opcja C:** Łukasz kupuje nowy telefon lub używa telefonu firmowego kliniki (jeden dedykowany telefon przy recepcji, zawsze w klinice).

---

## SCENARIUSZ 11 — Pracownik zgłasza błędną rejestrację

**Aktorzy:** Renata, higienistka  
**Sytuacja:** Renata kliknęła "Wyjście" przez pomyłkę o 11:00, a jej zmiana kończy się o 18:00.

**System zachowuje się:**

1. Renata zobaczyła błędne potwierdzenie emailowe (Wyjście 11:00).
2. Próbuje zarejestrować Wyjście o 18:00 — system mówi "Renata, nie masz zarejestrowanego przyjścia dziś po godz. 11:00".
3. Renata zgłasza problem Tobie.

**Twoje działanie:**

1. Otwórz arkusz → Ewidencja Czasu
2. Znajdź błędny wpis Renaty (Wyjście 11:00)
3. Zmień kolumnę I (STATUS) z "ZATWIERDZONE" na "ANULOWANE — BŁĄD PRACOWNIKA"
4. Dodaj w kolumnie K (UWAGI): "Anulowane na prośbę pracownika [data] — kliknięcie omyłkowe"
5. Renata może teraz zarejestrować Wyjście o 18:00 normalnie przez aplikację

---

## Tabela szybkiego odniesienia — co robić gdy...

| Sytuacja | Działanie |
|---|---|
| Pracownik zapomniał przyjście | Ręczny wpis w arkuszu z adnotacją |
| Błędna rejestracja pracownika | Zmień STATUS wpisu na ANULOWANE + adnotacja |
| GPS nie działa w telefonie | Ręczna rejestracja lub telefon firmowy przy wejściu |
| Pracownik odchodzi z pracy | STATUS → NIEAKTYWNY (nie usuwaj danych!) |
| Nowy pracownik | Dodaj wiersz w zakładce Pracownicy, STATUS=AKTYWNY |
| Alert anomalii w emailu | Sprawdź zakładkę Anomalie → potwierdź/wyjaśnij |
| Podejrzana próba logowania | Sprawdź zakładkę Logi Audytowe → zadzwoń do pracownika |
| Kontrola Inspekcji Pracy | Eksportuj Ewidencję Czasu do xlsx/pdf |
| Pracownik pyta o jego dane | Eksportuj jego wpisy → wyślij emailem |
| Naruszenie bezpieczeństwa | Zmień hasło Google → sprawdź logi → zgłoś do UODO (72h) |

---

## Miesięczna rutyna administratora (30 minut)

### Pierwszy poniedziałek miesiąca:

- [ ] Sprawdź zakładkę **Anomalie** — wyjaśnij wszystkie ze statusem "NOWE"
- [ ] Przejrzyj raport tygodniowy z poprzedniego tygodnia
- [ ] Sprawdź czy nie ma pracowników ze statusem NIEAKTYWNY którzy mają niedomknięte wpisy
- [ ] Sprawdź limity Google Apps Script (dashboard.google.com → Apps Script quotas) — przy 20 osobach nie powinieneś przekroczyć limitów bezpłatnych

### Co kwartał (30 minut):

- [ ] Przejrzyj listę pracowników — czy wszyscy AKTYWNI pracownicy są nadal zatrudnieni?
- [ ] Sprawdź czy konfiguracja GPS klinik jest aktualna (kliniki nie zmieniają adresu, ale współrzędne warto sprawdzić)
- [ ] Wykonaj backup arkusza (Plik → Pobierz → Excel) i zapisz w bezpiecznym miejscu

### Co roku (2 godziny):

- [ ] Przejrzyj dokumentację prawną — czy przepisy się nie zmieniły?
- [ ] Sprawdź czy Google DPA jest nadal aktualne
- [ ] Przeszkol nowych pracowników z korzystania z systemu
- [ ] Sprawdź logi z poprzedniego roku — czy były powtarzające się anomalie?
