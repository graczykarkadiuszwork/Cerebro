# Dokumentacja Prawna — System RCP v2.0
## Klinika Stomatologiczna — Rejestracja Czasu Pracy

---

## 1. Podstawy prawne przetwarzania danych

### Obowiązek prowadzenia ewidencji czasu pracy

**Art. 149 § 1 Kodeksu Pracy (Dz.U. 1974 Nr 24 poz. 141 ze zm.):**
> Pracodawca prowadzi ewidencję czasu pracy pracownika do celów prawidłowego ustalenia jego wynagrodzenia i innych świadczeń związanych z pracą.

System RCP v2.0 wypełnia ten obowiązek przez automatyczną rejestrację znacznika czasu każdego przyjścia i wyjścia pracownika.

**Art. 94 pkt 9a Kodeksu Pracy:**
> Pracodawca jest obowiązany przechowywać dokumentację pracowniczą przez okres zatrudnienia, a także przez okres 10 lat, licząc od końca roku kalendarzowego, w którym stosunek pracy uległ rozwiązaniu lub wygasł.

**KRYTYCZNA UWAGA dla administratora:** System RCP v2.0 przechowuje ewidencję czasu pracy przez 10 lat. Logi audytowe (zdarzenia systemowe) są usuwane po 3 latach — są to dane różnego rodzaju. Nigdy nie usuwaj ewidencji czasu pracy ręcznie.

### Podstawa prawna RODO dla przetwarzania danych pracowników

**Art. 6 ust. 1 lit. b RODO** — Przetwarzanie jest niezbędne do wykonania umowy, której stroną jest osoba, której dane dotyczą (umowa o pracę).

**Art. 6 ust. 1 lit. c RODO** — Przetwarzanie jest niezbędne do wypełnienia obowiązku prawnego ciążącego na administratorze (Art. 149 KP, wymogi ZUS, Inspekcji Pracy).

**Wniosek:** Nie jest wymagana odrębna zgoda pracownika na prowadzenie ewidencji czasu pracy. Zgoda na przetwarzanie dla celów przekraczających ewidencję (np. monitoring szczegółowy) wymagałaby osobnej podstawy prawnej.

---

## 2. Minimalizacja danych — co przetwarzamy i dlaczego

System RCP v2.0 przetwarza wyłącznie dane niezbędne do celu ewidencji czasu pracy (zasada minimalizacji danych — Art. 5 ust. 1 lit. c RODO):

| Kategoria danych | Cel przetwarzania | Podstawa prawna |
|---|---|---|
| Imię i nazwisko | Identyfikacja pracownika | Art. 149 KP |
| Znacznik czasu (przyjście/wyjście) | Ewidencja czasu pracy | Art. 149 KP |
| Identyfikator kliniki | Określenie miejsca pracy | Art. 149 KP |
| Lokalizacja GPS (weryfikacja) | Zapobieganie fałszywym rejestracjom | Uzasadniony interes pracodawcy (Art. 6(1)(f) RODO) |
| Hash emaila w logach | Bezpieczeństwo systemu | Art. 32 RODO |

**Danych GPS pracownika nie przechowujemy** — zapisujemy wyłącznie odległość od kliniki w metrach (np. "12m"). Dokładna lokalizacja nie jest rejestrowana.

**Adres email pracownika w arkuszu jest przechowywany jako hash SHA-256** — identyfikujemy pracownika bez konieczności przechowywania jego emaila w czytelnej formie w logach.

---

## 3. Retencja danych

| Kategoria | Okres przechowywania | Podstawa |
|---|---|---|
| Ewidencja czasu pracy | **10 lat** od rozwiązania stosunku pracy | Art. 94(9a) KP |
| Logi audytowe systemu | **3 lata** | Uzasadniony interes bezpieczeństwa |
| Anomalie (wyjaśnione) | **3 lata** | Uzasadniony interes bezpieczeństwa |
| Potwierdzenia emailowe | Pracownik zarządza samodzielnie | — |

---

## 4. Prawa pracowników (RODO Art. 15–22)

### Art. 15 — Prawo dostępu

Pracownik ma prawo do uzyskania informacji czy jego dane są przetwarzane i do otrzymania kopii. Administrator (kierownik kliniki) musi odpowiedzieć w ciągu 30 dni. Dane z arkusza mogą być wyeksportowane do PDF lub CSV.

### Art. 16 — Prawo do sprostowania

Jeśli rejestracja jest błędna (np. system zarejestrował godzinę przez awarię GPS), kierownik może ręcznie skorygować wpis w arkuszu, zaznaczając poprawkę w kolumnie "Uwagi".

### Art. 17 — Prawo do usunięcia ("prawo do bycia zapomnianym")

**OGRANICZENIE:** Prawo do usunięcia nie dotyczy danych przetwarzanych w celu wywiązania się z obowiązku prawnego (Art. 17 ust. 3 lit. b RODO). Ewidencja czasu pracy musi być przechowywana przez 10 lat — nie można jej usunąć na żądanie pracownika w tym okresie.

Po upływie 10 lat od rozwiązania stosunku pracy dane **powinny być usunięte**.

### Art. 20 — Prawo do przenoszenia danych

Dane mogą być wyeksportowane z arkusza do formatów CSV lub XLSX.

### Art. 21 — Prawo do sprzeciwu

Pracownik może wyrazić sprzeciw wobec przetwarzania. Jednak gdy przetwarzanie jest oparte na obowiązku prawnym (Art. 149 KP), sprzeciw nie skutkuje zaprzestaniem przetwarzania — pracodawca musi prowadzić ewidencję bez względu na sprzeciw. W takim przypadku można przejść na ręczną listę obecności.

---

## 5. Bezpieczeństwo techniczne (Art. 32 RODO)

### Środki techniczne zastosowane w systemie:

**Uwierzytelnienie:**
- Google OAuth 2.0 — pracownik loguje się kontem Google, nie wybiera się z listy
- Brak PIN-ów przechowywanych w aplikacji
- Blokada konta po 5 nieudanych próbach dostępu (60 minut)

**Integralność danych:**
- Arkusz ma ograniczony dostęp (tylko administrator)
- Logi audytowe rejestrują każde zdarzenie systemowe
- Weryfikacja GPS po stronie serwera (nie można sfałszować lokalizacji przez manipulację URL)

**Szyfrowanie:**
- Komunikacja z Google: TLS 1.3
- Emaile pracowników w logach: hashowane SHA-256
- Adresy GPS: zapisywana wyłącznie odległość, nie współrzędne

**Monitoring:**
- Anomaly detection: alerty przy rejestracji nocnej, weekendowej, zbyt krótkich zmianach
- Cotygodniowy raport dla administratora
- Natychmiastowe emaile o próbach zablokowanego dostępu

### Środki organizacyjne:

- Dostęp do arkusza wyłącznie dla administratora/kierownika
- Obowiązek używania silnego hasła i 2FA dla konta Google administratora
- Procedura postępowania w przypadku naruszenia (patrz sekcja 7)
- Coroczny przegląd konfiguracji systemu

---

## 6. Umowa powierzenia przetwarzania z Google

System korzysta z infrastruktury Google (Apps Script, Sheets, Gmail). Google jest podmiotem przetwarzającym dane w rozumieniu Art. 28 RODO.

**Krok wymagany:** Zaakceptuj Google Data Processing Amendment (DPA).

### Jak to zrobić:

**Dla Google Workspace:**
1. Zaloguj się do [admin.google.com](https://admin.google.com)
2. Przejdź do: Konto → Ustawienia konta → Zgodność prawna i audyt
3. Kliknij "Data Processing Amendment" i zaakceptuj

**Dla kont Gmail (bezpłatne):**
Google oferuje ograniczoną ochronę dla kont bezpłatnych. Dla kliniki medycznej **zalecane jest korzystanie z Google Workspace** (ok. 6 EUR/os/mies.), które zapewnia pełne DPA zgodne z RODO i standardami ochrony danych medycznych.

---

## 7. Procedura postępowania przy naruszeniu bezpieczeństwa

W przypadku naruszenia danych osobowych (np. nieautoryzowany dostęp do arkusza):

### Pierwsze 24 godziny:

1. **Natychmiast** zmień hasło do konta Google administratora
2. Sprawdź zakładkę "Logi Audytowe" — zidentyfikuj zakres naruszenia
3. Zmień URL aplikacji webowej (nowe wdrożenie w Apps Script)
4. Poinformuj pracowników emailem o naruszeniu

### Do 72 godzin od wykrycia (Art. 33 RODO):

Jeśli naruszenie może powodować ryzyko dla praw i wolności pracowników (np. wyciek harmonogramów, możliwość identyfikacji obecności w pracy), **zgłoś naruszenie do UODO**:

- Formularz online: [uodo.gov.pl/pl/p/zgloszenie-naruszenia-ochrony-danych-osobowych](https://uodo.gov.pl)
- Adres: ul. Stawki 2, 00-193 Warszawa
- Telefon: +48 22 531 03 00

**UWAGA:** Obowiązek zgłoszenia do UODO nie zależy od liczby osób. Istotne jest czy naruszenie stwarza ryzyko dla osób fizycznych.

### Szablon emaila do pracowników przy naruszeniu:

```
Temat: Powiadomienie o naruszeniu bezpieczeństwa danych — System RCP

Szanowni Pracownicy,

Informujemy o naruszeniu bezpieczeństwa w systemie RCP [NAZWA KLINIKI].

Data i godzina wykrycia: [DATA GODZINA]
Zakres naruszenia: [opis co mogło wyciec]
Czego dotyczą dane: czasy przyjść i wyjść z pracy

Podjęte działania:
- Zablokowano nieautoryzowany dostęp
- Zmieniono dane uwierzytelniające systemu
- Zdarzenie zostało zgłoszone do UODO (jeśli dotyczy)

Co powinniście zrobić:
- Zmieńcie hasło do konta Google kliniki
- Powiadomcie nas o wszelkich podejrzanych aktywnościach

Kontakt: [EMAIL ADMINISTRATORA]

Z poważaniem,
[Kierownik/Administrator Kliniki]
```

---

## 8. Rejestr czynności przetwarzania (Art. 30 RODO)

Wydrukuj poniższy rejestr i przechowuj w dokumentacji kliniki.

```
╔══════════════════════════════════════════════════════════════════╗
║         REJESTR CZYNNOŚCI PRZETWARZANIA DANYCH OSOBOWYCH        ║
║               Klinika Stomatologiczna [NAZWA KLINIKI]           ║
╠══════════════════════════════════════════════════════════════════╣
║ ADMINISTRATOR DANYCH:                                           ║
║   Nazwa: [Pełna nazwa kliniki]                                  ║
║   Adres: [Adres kliniki]                                        ║
║   NIP: [NIP]                                                    ║
║   Kontakt: [email/telefon]                                      ║
║                                                                  ║
║ PODMIOT PRZETWARZAJĄCY:                                         ║
║   Google LLC / Google Ireland Limited                           ║
║   Gordon House, Barrow Street, Dublin 4, Irlandia               ║
║   Podstawa: Google Data Processing Amendment (DPA)              ║
║                                                                  ║
║ CZYNNOŚĆ PRZETWARZANIA: Ewidencja czasu pracy pracowników       ║
║                                                                  ║
║ KATEGORIE OSÓB: Pracownicy kliniki                              ║
║ LICZBA OSÓB: do 20                                              ║
║                                                                  ║
║ KATEGORIE DANYCH:                                               ║
║   • Imię i nazwisko                                             ║
║   • Identyfikator (email — hashed w logach)                     ║
║   • Czas przyjścia/wyjścia z pracy                              ║
║   • Identyfikator kliniki (miejsce pracy)                       ║
║   • Odległość od kliniki przy rejestracji (metry)               ║
║                                                                  ║
║ CELE PRZETWARZANIA:                                             ║
║   1. Wypełnienie obowiązku prawnego — Art. 149 KP               ║
║   2. Rozliczenia wynagrodzeń                                    ║
║   3. Dokumentacja dla ZUS, GUS, Inspekcji Pracy                 ║
║   4. Bezpieczeństwo systemu (logi audytowe)                     ║
║                                                                  ║
║ PODSTAWY PRAWNE:                                                ║
║   Art. 6(1)(b) RODO — wykonanie umowy o pracę                   ║
║   Art. 6(1)(c) RODO — obowiązek prawny (Art. 149 KP)            ║
║   Art. 6(1)(f) RODO — uzasadniony interes (bezpieczeństwo)      ║
║                                                                  ║
║ OKRES PRZECHOWYWANIA:                                           ║
║   Ewidencja czasu pracy: 10 lat (Art. 94(9a) KP)               ║
║   Logi audytowe systemowe: 3 lata                               ║
║                                                                  ║
║ ODBIORCY DANYCH:                                                ║
║   • Kierownik/Administrator kliniki (dostęp operacyjny)         ║
║   • Biuro rachunkowe (do rozliczeń, na żądanie)                 ║
║   • ZUS, GUS, Inspekcja Pracy (na żądanie organu)               ║
║   • Sąd (na postanowienie sądu)                                 ║
║                                                                  ║
║ TRANSFERY DO PAŃSTW TRZECICH:                                   ║
║   Google — infrastruktura może być w USA.                       ║
║   Zabezpieczenie: Standard Contractual Clauses (SCCs)           ║
║   zatwierdzone decyzją KE 2021/914                              ║
║                                                                  ║
║ ŚRODKI BEZPIECZEŃSTWA:                                          ║
║   ✓ Szyfrowanie transmisji (TLS 1.3)                           ║
║   ✓ Uwierzytelnienie Google OAuth 2.0                           ║
║   ✓ Blokada konta po nieudanych próbach                         ║
║   ✓ Hashowanie emaili w logach (SHA-256)                        ║
║   ✓ Weryfikacja GPS przy każdej rejestracji                     ║
║   ✓ Logi audytowe wszystkich zdarzeń systemowych                ║
║   ✓ Dwuskładnikowe uwierzytelnienie administratora (2FA)        ║
║                                                                  ║
║ DATA WDROŻENIA: _______________                                 ║
║ DATA OSTATNIEJ AKTUALIZACJI: _______________                    ║
║ PODPIS ADMINISTRATORA: _______________                          ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
```

---

## 9. Klauzula informacyjna dla pracowników (Art. 13 RODO)

Wręcz każdemu pracownikowi przy wdrożeniu systemu:

```
INFORMACJA O PRZETWARZANIU DANYCH OSOBOWYCH
W SYSTEMIE REJESTRACJI CZASU PRACY

Administrator danych: [Pełna nazwa kliniki], [adres], [kontakt]

Cel przetwarzania:
Prowadzenie ewidencji czasu pracy zgodnie z Art. 149 Kodeksu Pracy,
rozliczanie wynagrodzeń oraz wywiązanie się z obowiązków wobec ZUS
i Inspekcji Pracy.

Podstawa prawna:
Art. 6(1)(b) RODO (umowa o pracę) i Art. 6(1)(c) RODO
(obowiązek prawny — Art. 149 KP).

Przetwarzane dane:
Imię, nazwisko, czas przyjścia/wyjścia, identyfikator kliniki,
odległość od kliniki przy rejestracji.

Okres przechowywania:
10 lat od rozwiązania stosunku pracy (Art. 94(9a) KP).

Odbiorcy danych:
Kierownik kliniki, biuro rachunkowe, ZUS, Inspekcja Pracy (na żądanie).

Twoje prawa:
Masz prawo do: dostępu do danych (Art. 15), sprostowania (Art. 16),
ograniczenia przetwarzania (Art. 18), wniesienia skargi do UODO
(ul. Stawki 2, 00-193 Warszawa, tel. +48 22 531 03 00).
Prawo do usunięcia (Art. 17) jest ograniczone przez obowiązek
przechowywania ewidencji przez 10 lat.

Dane kontaktowe administratora: [email], [telefon]

Data: ______________ Podpis pracownika: ______________
```

---

## 10. Specyfika sektora medycznego

Klinika stomatologiczna jako podmiot leczniczy podlega dodatkowym regulacjom:

**Ustawa z dnia 15 kwietnia 2011 r. o działalności leczniczej (Dz.U. 2011 Nr 112 poz. 654 ze zm.):**
System RCP dotyczy wyłącznie pracowników kliniki — nie przetwarza danych pacjentów. Dane pracownicze muszą być ściśle oddzielone od dokumentacji medycznej. System RCP v2.0 nie ma dostępu do żadnych danych pacjentów i nie powinien być z nimi integrowany.

**Rozporządzenie MZ w sprawie rodzajów i zakresu dokumentacji medycznej:**
Dotyczy wyłącznie dokumentacji pacjentów — RCP jest poza zakresem tego rozporządzenia.

**Zalecenie:** Jeśli klinika jest zarejestrowana jako podmiot leczniczy, warto skonsultować wdrożenie systemu z prawnikiem specjalizującym się w prawie medycznym lub firmą oferującą outsourcing IOD (Inspektora Ochrony Danych).

---

## Kontakty instytucjonalne

| Instytucja | Kontakt | Cel |
|---|---|---|
| UODO | uodo.gov.pl / +48 22 531 03 00 | Zgłoszenie naruszenia, skargi pracowników |
| Inspekcja Pracy | pip.gov.pl / +48 22 668 80 80 | Nadzór nad ewidencją czasu pracy |
| ZUS | zus.pl / +48 22 291 91 00 | Rozliczenia oparte na ewidencji |
| Rzecznik Praw Pacjenta | gov.pl/rpp | Kwestie związane z danymi pacjentów |
