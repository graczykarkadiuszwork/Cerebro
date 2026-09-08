# PIP-BOY — SYSTEM ORGANIZACJI ŻYCIA
### Dokument specyfikacyjny do realizacji w Claude Code

**Nazwa projektu:** Pip-Boy (w oryginalnym angielskim brzmieniu, bez polskiej transkrypcji)
**Data utworzenia:** 2026-09-02
**Ostatnia aktualizacja:** 2026-09-08 (wersja 17 — Runda #19: baza 263 cytatów motywacyjnych zebrana z dwóch z czterech źródeł (sekcja 5.4), Putty & Paint potwierdzone jako kanał wspierający (Moduł 18))
**Status:** Faza konceptu — przed implementacją. Otwarte: autentykacja (0.11.1, pkt 1), uzupełnienie bazy cytatów do 300 z pozostałych dwóch źródeł — lubimyczytac.pl i vogue.pl (sekcja 5.4)
**Właściciel:** Arek
**Cel dokumentu:** Kompletna specyfikacja funkcjonalna i techniczna umożliwiająca budowę systemu bez dalszych pytań doprecyzowujących — napisana z założeniem, że czyta ją deweloper bez wcześniejszego kontaktu z Arkiem i bez znajomości historii powstania tego dokumentu.

**DOKUMENT TOWARZYSZĄCY (przeczytaj razem z tym plikiem):** Ten koncept jest częścią pakietu dwóch dokumentów przekazywanych deweloperowi łącznie. Drugi dokument to "Strategia Budowy Marki Osobistej" — obszerna (67-sekcyjna) strategia biznesowa dotycząca Modułu 18 (Portfolio Figurek) tego systemu, czyli komponentu wspierającego rozwój marki osobistej Arka jako malarza/twórcy modeli do gier bitewnych (Warhammer 40k i pokrewne). Moduł 18 w tym dokumencie odwołuje się bezpośrednio do konkretnych sekcji tamtej strategii (patrz Sekcja 0.10 niżej) — bez przeczytania obu dokumentów łącznie, kontekst i uzasadnienie decyzji w Module 18 nie będą kompletne. Oba pliki należy traktować jako jeden pakiet wejściowy do tego samego projektu.

---

## STRESZCZENIE WYKONAWCZE (dla osoby czytającej ten dokument po raz pierwszy)

**Czym jest Pip-Boy?** To spersonalizowany system do zarządzania codziennym życiem — pracą, zdrowiem, treningiem, dietą, obowiązkami domowymi, hobby i rozwojem osobistym — zaprojektowany dla jednej konkretnej osoby (Arek) z uwzględnieniem jej specyficznych potrzeb zdrowotnych (ADHD, przewlekła depresja, problemy ze snem i koncentracją, nawracające problemy żołądkowo-jelitowe) oraz nietypowego trybu życia (zmienny, rotacyjny grafik pracy w klinice dentystycznej, gdzie Arek pełni funkcję operacyjną). Nie jest to gotowy produkt do sprzedaży ani uniwersalna aplikacja habit-trackingowa — to narzędzie szyte na miarę jednego użytkownika, z bardzo konkretnymi, przemyślanymi decyzjami projektowymi wynikającymi z jego indywidualnej sytuacji.

**Dlaczego to nie jest zwykły habit tracker?** Trzy rzeczy odróżniają ten projekt od typowych aplikacji do budowania nawyków. Po pierwsze, **zakres** — system obejmuje 20 modułów obejmujących praktycznie każdy aspekt codzienności: od suplementacji i treningu, przez dietę, sen, pielęgnację, sprzątanie, po dbanie o pojazdy, cotygodniowe zakupy, kontakt z naturą i rozwój równoległej ścieżki zawodowej (malarstwo miniaturek). Po drugie, **integracja z realnym życiem zawodowym** — system czyta rzeczywisty czas pracy Arka z jego własnego, wcześniej zbudowanego narzędzia do ewidencji czasu pracy (RCP), zamiast polegać na sztywnym, z góry ustalonym grafiku, bo Arek regularnie pracuje w nadgodzinach w nieprzewidywalny sposób. Po trzecie, i najważniejsze, **filozofia motywacyjna** — to nie jest system, który "delikatnie zachęca". Po świadomej, wielokrotnie potwierdzonej decyzji Arka (mimo że Claude, projektując ten system, wprost przedstawił ryzyka takiego podejścia przy współwystępującej depresji), system wykorzystuje pełną mechanikę gry RPG rodem z aplikacji Habitica — punkty życia (HP), które realnie spadają przy pominiętych obowiązkach, i mechanizm "śmierci postaci" (utrata poziomu, zresetowanie passy, utrata części osiągnięć) gdy HP spadnie do zera. To świadomy wybór: Arek chce systemu, który stawia realną stawkę za niewykonanie zadań, a nie systemu, który tylko notuje i "rozumie", gdy coś zostanie pominięte.

**Jak to działa w praktyce — jeden dzień z perspektywy Arka.** Rano Arek otwiera aplikację (telefon) i widzi całą oś czasową swojego dnia naraz — nie pojedyncze zadanie na raz, tylko pełną mapę, z możliwością rozwinięcia szczegółów każdego bloku. Dzień ma strukturę wynikającą z tego, czy to dzień pracujący (wczesna zmiana 8:30-15:30 lub późna zmiana 12:00-20:00 — zmiany rotują nieregularnie, komunikowane przez pracodawcę raz w miesiącu) czy dzień wolny, oraz czy to jeden z trzech stałych dni treningowych w tygodniu (wtorek, czwartek, sobota). System automatycznie generuje odpowiedni układ dnia z jednego z sześciu szablonów (patrz Sekcja 3), rozróżniając zadania obligatoryjne (mające wpływ na HP — np. suplementy, posiłki, trening w dni treningowe, mood tracker) od opcjonalnych (np. spacer z psem, kontakt z naturą, twórcze bloki portfolio figurek — te mają swoje miejsce w harmonogramie, ale ich pominięcie nie kosztuje nic w mechanice gry). W ciągu dnia Arek dostaje przypomnienia (część w formie agresywnych, pełnoekranowych powiadomień, część łagodniejszych) i odhacza wykonane zadania, zdobywając punkty doświadczenia przypisane do jednego z pięciu "Atrybutów" postaci (Ciało, Umysł, Dyscyplina, Otoczenie, Personal Brand — ten ostatni wydzielony specjalnie pod rozwój marki osobistej w malarstwie miniaturek). Wieczorem, po zamknięciu wszystkich obligatoryjnych zadań, system otwiera nielimitowany czasowo blok "Czasu Wolnego" jako nagrodę — jeśli dzień był wyjątkowo skompresowany (np. przez nadgodziny), system inteligentnie sugeruje wydłużenie pory snu i wykorzystanie tego czasu na coś, co jednocześnie realizuje inny cel (np. czytanie).

**Kluczowe rozstrzygnięcia, które odróżniają ten koncept od "pierwszego pomysłu na aplikację":** Podczas kilkunastu rund pogłębionego wywiadu (ten dokument jest efektem kilkunastu iteracji, każda ugruntowana w aktualnej wiedzy branżowej — nauka o treningu siłowym, projektowanie interfejsów pod ADHD, kliniczna praktyka dziennikowania objawów żołądkowo-jelitowych, wytyczne dotyczące higieny snu przy pracy zmianowej) wypracowano szereg nietrywialnych decyzji, które deweloper powinien rozumieć, nie tylko zaimplementować: (a) suplement kreatyny ma świadomie zróżnicowaną porę przyjęcia zależnie od dnia treningowego, bo może być czynnikiem nasilającym problemy żołądkowe Arka; (b) posiłki są modelowane jako przypomnienia z orientacyjnym oknem czasowym, nie sztywne bloki kalendarzowe, bo sztywne bloki okazały się nierealistyczne i nieczytelne w praktyce; (c) moduł budowania marki osobistej (Portfolio Figurek) świadomie łamie ogólną filozofię "rigid + pełna presja" tego systemu w części dotyczącej samego tworzenia (malowanie, nagrywanie) — te bloki są elastyczne, bez kary — podczas gdy checklist publikacji (zdjęcie, opis, publikacja) pozostaje rygorystyczny, bo to inny rodzaj zadania (mechaniczne dokończenie, nie proces twórczy zależny od zmiennej energii); (d) niedziela jest świadomie "lżejszym" dniem regeneracyjnym, zwolnionym z obowiązku treningu i sprzątania, ale NIE z suplementów, posiłków i monitorowania nastroju, bo te uznano za "zdrowotne minimum" niezależne od dnia tygodnia.

**Co NIE jest jeszcze rozstrzygnięte i wymaga ustalenia z Arkiem przed lub w trakcie budowy:** Zobacz Sekcję 8 (Otwarte pytania) oraz nową Sekcję 0.11 (Wymagania techniczne bazowe) — obejmuje to m.in. kwestie autentykacji, hostingu i środowisk (Arek świadomie zostawił to do ustalenia bezpośrednio z deweloperem, nie chciał, by Claude jednostronnie przesądzał decyzje czysto inżynierskie), dokładne wartości kalibracyjne mechaniki punktów życia (będą korygowane po pierwszych tygodniach realnego użytkowania) oraz jedna zewnętrzna zależność — biblioteka ćwiczeń mobilnościowych od trenera CrossFit, którą Arek dostarczy w późniejszym terminie.

**Warstwa wizualna — motyw Pip-Boy:** Cały interfejs systemu (stąd nazwa projektu) jest stylizowany na Pip-Boy, kultowe urządzenie z serii gier Fallout — monochromatyczny, zielony ekran w stylu starych monitorów CRT, czcionka o stałej szerokości znaków (monospace), nawigacja oparta o tekstowe zakładki (jak oryginalne STAT/INV/DATA/MAP z gry) zamiast ikon graficznych, z regulowaną intensywnością efektów retro (użytkownik może wybrać poziom Low/Medium/Ultra, żeby dostosować ilość migoczących efektów CRT do własnych potrzeb — od czystego, statycznego wgląduu po pełną, immersyjną imitację starego ekranu). Pełna specyfikacja wizualna w Sekcji 6.9.

---

## 0. KONTEKST I ZAŁOŻENIA BAZOWE

### 0.1 Profil użytkownika (kluczowe dla decyzji projektowych)
- ADHD — potrzeba: wizualnej struktury, natychmiastowej gratyfikacji (gamifikacja), silnych bodźców przypominających, redukcji friction (łatwość odhaczania), całościowego widoku dnia (nie sekwencyjnego, żeby nie zgubić kontekstu)
- Przewlekła depresja — potrzeba: widocznej historii postępu jako wzmocnienia motywacyjnego, braku karania za pominięcia, mood trackingu jako wczesnego systemu ostrzegania
- Problemy ze snem — potrzeba: elastycznego, ale przewidywalnego rytmu wstawania powiązanego ze zmiennym grafikiem pracy
- Problemy z koncentracją — potrzeba: time blockingu z buforem, jasnej hierarchii wizualnej
- Nawracające problemy żołądkowo-jelitowe — potrzeba: lekkiego trackingu timing posiłków względem treningu (bez nadmiernej medykalizacji)
- Deklarowana preferencja: **RIGID SYSTEM**, nie flexibility. Użytkownik świadomie wybrał strukturę i automatyzację ponad swobodę — system ma prowadzić, nie tylko rejestrować.

### 0.2 Filozofia systemu
System nie jest zbiorem osobnych narzędzi. Jest **jednym środowiskiem dnia**, które:
1. Rano pokazuje pełną mapę dnia (wszystkie moduły naraz, dopasowane do typu dnia)
2. Prowadzi przez dzień powiadomieniami przypisanymi do konkretnych bloków czasowych
3. Wieczorem zamyka dzień (mood check, podsumowanie, punkty)
4. Co tydzień pokazuje trend i historię (niedzielny review)

### 0.3 Harmonogram pracy jako "silnik" systemu
Grafik pracy Arka (zmienny, nieregularny, ustalany przez pracodawcę) jest **punktem wyjścia** dla całej logiki dnia. System musi rozpoznawać typ dnia i na tej podstawie dobierać odpowiedni szablon.

**Zidentyfikowane typy dni (na podstawie grafiku wrzesień 2026):**

| Typ dnia | Godziny pracy | Pobudka | Charakterystyka |
|---|---|---|---|
| **DZIEŃ A** (wczesna zmiana) | 8:30–15:30 (czasem do 15:00) | 7:00 | Więcej czasu po pracy na trening/hobby |
| **DZIEŃ B** (późna zmiana) | 12:00–20:00 | 8:00 | Trening/aktywności rano, praca po południu-wieczorem |
| **DZIEŃ WOLNY** | — | 8:00 | Pełna swoboda planowania, dzień na sport walki/naturę/sprzątanie globalne |

Uwaga: godziny startu/końca zmiany mogą się różnić o ±30–60 min względem tego wzorca (widoczne w grafiku: 12:15–20:25, 9:30–15:00 w sobotę, 8:30–15:00 w niektóre dni) — **system musi wczytywać realny grafik z danego miesiąca, nie zakładać sztywnych godzin.**

### 0.4 Mechanizm wprowadzania grafiku
- Na początku każdego miesiąca Arek przesyła zdjęcie/dane grafiku (jak we wrześniu 2026)
- System (na etapie MVP: Claude / człowiek; docelowo: automatyzacja) przekształca to na strukturę dzień → typ dnia → godziny
- Rekomendacja: prosty formularz/arkusz wejściowy (30 wierszy = 30 dni, 3 kolumny: data, start, koniec), z którego automatycznie wyliczany jest typ dnia i przypisywany odpowiedni szablon

---

## 0.5 RUNDA DOPRECYZOWANIA #2 — ANALIZA I WNIOSKI

Po pierwszej wersji konceptu przeprowadzono drugą turę pytań (24 pytania), której celem było domknięcie otwartych kwestii z sekcji 8 poprzedniej wersji oraz zweryfikowanie założeń roboczych. Poniżej analiza kluczowych ustaleń i ich konsekwencji dla architektury.

**A. Suplementacja — korekta logiki czasowej.**
Pierwotne założenie ("gainer przy posiłku") okazało się niedopasowane do realnego trybu życia — gainer to de facto osobny, kaloryczny "posiłek treningowy" spożywany zaraz po FBW, nie dodatek do istniejącego posiłku. To ważne, bo zmienia licznik posiłków w dniach treningowych (5 posiłków + gainer post-workout = de facto 6 punktów żywieniowych w dniu treningowym). Melatonina z kolei okazała się być lekiem "w razie potrzeby", a nie rutyną — pierwotne założenie o codziennym przyjmowaniu byłoby błędne i potencjalnie promowałoby nadużywanie środka nasennego. System musi to jasno rozróżniać: suplementy rdzenne (codzienne, obowiązkowe w checkliście) vs suplementy warunkowe (dostępne, ale nieoznaczane jako "niewykonane" gdy pominięte).

**B. Trening — użytkownik ma już gotowy plan.**
Nie trzeba było projektować planu od zera. Otrzymany plan FBW A/B (2x/tydzień na start, jasna progresja liniowa) jest kompletny i gotowy do wpisania wprost do modelu danych z sekcji 7. Ważna decyzja: dni treningowe są **stałe w tygodniu** (nie podążają za typem zmiany), co upraszcza szablony — trening nie "pływa" razem z grafikiem pracy, tylko z kalendarzem tygodniowym. To oznacza, że Szablony A/B/C (dzień wg zmiany) i "dzień treningowy/nietreningowy" to **dwie niezależne, krzyżujące się osie**, nie jedna zmienna.

**C. Dieta — mniejszy zakres niż zakładano, i dobrze.**
Rezygnacja z sugerowanych dań (żadnych przykładowych posiłków) upraszcza moduł i usuwa ryzyko, że system zacznie przypominać kaloryczny/dietetyczny reżim, którego użytkownik świadomie chciał uniknąć. Moduł 4 zostaje czystym checklistem realizacji.

**D. Pielęgnacja — rozbicie per-produkt było konieczne.**
Okazało się, że każdy produkt ma inny, niezależny rytm: krem do rąk 2x/dzień "niezależnie od pory" (czyli technicznie dwa sloty dzienne, niekoniecznie rano/wieczór), krem do twarzy rano+wieczór (dwa stałe sloty), preparat na pocenie 2x/tydzień (nie codziennie), Nizoral 2x/tydzień. To pokazuje, że pierwotny, jeden wspólny "blok pielęgnacyjny o 21:00" był nadmiernym uproszczeniem — moduł 7 wymaga rozbicia na osobne, niezależnie zaplanowane pozycje, każda z własnym rytmem (patrz zaktualizowany Moduł 7 poniżej).

**E. Sprzątanie — korekta układu mieszkania.**
Mieszkanie ma dwie osobne sypialnie: "Sypialnia" i "Pokój komputerowy" — nie ujednoliconą "Sypialnia 1/2". To kosmetyczna, ale ważna zmiana nazewnictwa w module 8. Robot sprzątający ma pracować 2x dziennie (odkurzanie + mopowanie, możliwie połączone) — to zdejmuje z użytkownika codzienne sprzątanie podłóg i pozwala skupić checklistę segmentową na rzeczach, których robot nie robi (blaty, czyszczenie na mokro poza podłogą, porządkowanie).

**F. Mood tracker — rozszerzenie o funkcję detektywistyczną.**
To najważniejsza zmiana koncepcyjna tej rundy. Użytkownik nie chce biernego logu — chce, by system **aktywnie reagował** na zgłoszone rozwolnienie, dopytując "co jadłeś dziś" (notatka tekstowa, swobodna). To wprowadza pierwszy element systemu, który nie jest statycznym formularzem, tylko prostą logiką warunkową (if GI_score < próg → pokaż pole tekstowe "co jadłeś"). Jednocześnie mood tracker przechodzi z 1x/dzień (wieczór) na 2x/dzień (rano + wieczór) — co daje więcej punktów danych do przyszłej analizy korelacji i pozwala wychwycić np. różnicę między "jak się obudziłem" a "jak kończę dzień".

**G. AI Coach — nowy, świadomie odłożony moduł.**
Użytkownik wprost nazwał potrzebę: system ma "żyć", analizować wzorce, być "coachem od wszystkiego". To wykracza poza prosty CRUD/tracking i wymaga osobnej warstwy analitycznej. Kluczowe ustalenia, które ograniczają ryzyko i zakres:
- Zakres: cały system (trening, mood, sen, dieta, GI) — szuka korelacji międzymodułowych, nie tylko w obrębie diety
- Twarda granica: wykrywanie **korelacji z własnych danych użytkownika**, nigdy stawianie diagnoz medycznych. Sformułowania muszą być w stylu "zaobserwowano, że...", nigdy "masz nietolerancję...".
- Faza: **NIE wchodzi do MVP**. Na start — czysty, rzetelny log wszystkich modułów. AI coach to Faza 2, budowana dopiero gdy w bazie danych jest wystarczająco dużo historycznych wpisów, by korelacje miały sens statystyczny (rekomendacja: min. 4-6 tygodni codziennych danych, zanim AI coach zacznie cokolwiek sugerować — inaczej wnioski z 3 dni będą szumem, nie sygnałem).
- To ma bezpośrednią konsekwencję dla modelu danych (sekcja 7) — trzeba już teraz projektować strukturę tabel tak, by nadawały się do przyszłej analizy (spójne typy danych, znaczniki czasu, brak pół-tekstowych pół-liczbowych kolumn), nawet jeśli sama warstwa AI powstanie później.

**H. Gamifikacja — rozbudowana, ale bez konkretnego systemu źródłowego.**
Wzmianka o World of Darkness posłużyła jako punkt odniesienia klimatu (dojrzały, rozbudowany, z progresją postaci), ale finalna decyzja to uniwersalny system RPG — bez licencjonowanych mechanik konkretnego systemu. To ważne o tyle, że WoD jako system narracyjny opiera się na rzutach kością i konflikcie, co nie przekłada się wprost na habit-tracker. Zamiast kopiować mechanikę, przenosimy **estetykę i głębię**: Atrybuty (kategorie życia) + Umiejętności (moduły) + Doświadczenie (XP) + rozwój postaci w czasie — ale zbudowane od zera pod potrzeby tego systemu, nie pod zasady istniejącej gry (patrz rozbudowana sekcja 4 poniżej).

**I. Kalendarz i widok dnia — potwierdzona architektura dwustronna.**
Brak istniejącego kalendarza to *czysta karta* — dobra wiadomość, nie ma bagażu migracji. Kluczowe zdanie użytkownika: "checklisty zaciągane z i do kalendarza, czyli wymiana dwustronna". To podnosi poprzeczkę techniczną: nie wystarczy, by system *wysyłał* eventy do Google Calendar (jednostronnie, jak założono w wersji 1). System musi też *odczytywać* zmiany zrobione bezpośrednio w Calendar (np. przesunięcie treningu o godzinę w appce kalendarza) i odzwierciedlać je z powrotem w arkuszu/logice. To wymaga Google Calendar API w trybie odczytu i zapisu (nie tylko zapisu), co jest wykonalne w Apps Script, ale trzeba to zaprojektować świadomie od początku (webhooki/synchronizacja, nie tylko cykliczne push).

---

## 0.6 ANALIZA POGŁĘBIONA — ZESTAWIENIE Z NAJLEPSZYMI PRAKTYKAMI (research, wrzesień 2026)

Poniżej analiza oparta na przeglądzie: (a) literatury o progresji treningowej i powrocie po przerwie, (b) projektowania habit-trackerów pod ADHD, (c) mechaniki gamifikacyjnej Habitica i jej ograniczeń, (d) protokołów food-symptom diary stosowanych klinicznie przy IBS, (e) konsensusowych wytycznych snu dla pracowników zmianowych (Delphi 2023, Sleep Foundation), (f) wpływu węglowodanów/białka na ADHD. Dla każdego obszaru: co mówi research, gdzie koncept w wersji 2 się zgadza, a gdzie wymaga korekty.

**A. Trening — częstotliwość i progresja są zgodne z evidence, ale brakuje zabezpieczenia przed przetrenowaniem.**
Konsensus naukowy (ACSM, badania nad hipertrofią) wskazuje trenowanie każdej grupy mięśniowej 2-3x/tydzień jako optymalne dla adaptacji bez przeciążenia — plan FBW A/B 2x/tydzień na start jest w pełni zgodny. Reguła progresji (+2,5kg/+1kg po osiągnięciu górnego zakresu powtórzeń) też pokrywa się ze standardową praktyką trenerską. Czego brakuje: **zasady deload/plateau**. Literatura wskazuje, że przy braku progresu przez 3+ tygodnie z rzędu na danym ćwiczeniu, standardową reakcją jest zmiana ćwiczenia (np. wyciskanie sztangi płaskie → wyciskanie hantli skośne na 4-6 tygodni) lub tydzień redukcji obciążenia (deload), a nie dalsze "napieranie" na ten sam ciężar. System w wersji 2 nie ma takiej reguły — grozi to utknięciem w cyklu "nie mogę zrobić progresji → system i tak każe próbować → frustracja" u kogoś z ADHD, gdzie tolerancja na powtarzającą się porażkę jest niska.

**B. Gamifikacja — Habitica jako punkt odniesienia ma poważną wadę dla Twojego profilu.**
Sprawdziłem dokładnie mechanikę Habitiki (na którą się powoływałeś pośrednio przez odniesienie RPG): system **odejmuje punkty życia (HP) za każdy niewykonany "Daily"**, a przy spadku HP do zera postać "umiera" i traci poziom, złoto, przedmioty. To jest dokładnie mechanika, przed którą ostrzega literatura o projektowaniu habit-trackerów dla ADHD — tzw. "streak-based shame loops": utrata czegoś (HP, streak) za brak wykonania generuje nieproporcjonalny wstyd i jest jednym z trzech głównych powodów porzucania aplikacji przez użytkowników z ADHD (obok "paraliżu inicjacji zadania" przy zbyt długiej liście i "ślepoty czasowej" przy jednym porannym powiadomieniu). Przy współwystępującej przewlekłej depresji ryzyko jest podwójne — utrata postępu może wywołać reakcję "i tak wszystko zepsute, po co zaczynać". **To bezpośrednio koliduje z Twoją deklaracją "chcę rigid system"** — rigid w sensie struktury i automatyzacji jest dobre, ale rigid w sensie "karania za porażkę" jest udokumentowanym antywzorcem. Rekomendacja: system punktowy WYŁĄCZNIE addytywny (zdobywasz punkty, nigdy ich nie tracisz za brak działania) — to nadal może być rozbudowane, głębokie RPG, tylko bez mechaniki "obrażeń".

**C. Food-symptom tracking — model "co jadłem dziś" jest niewystarczający klinicznie.**
Dokładnie przejrzałem praktyki stosowane w aplikacjach klinicznych do IBS/FODMAP (mySymptoms, Endive, protokoły badawcze z University of Washington). Kluczowe ustalenie: **objawy żołądkowo-jelitowe mogą pojawić się od 30 minut do 48 godzin po spożyciu problematycznego produktu** ("symptom lag"). Formularz, który przy zgłoszeniu rozwolnienia pyta wyłącznie "co jadłeś DZIŚ", pomija najczęstszy scenariusz — winowajcą może być coś zjedzonego wczoraj lub przedwczoraj. Badanie feasibility (Zia et al., 11 pacjentów IBS) używało 4x dziennie logowania objawów na skali suwakowej + logowania każdego posiłku osobno (min. 3x dziennie), właśnie po to, by móc później zestawić oś czasu objawów z osią czasu posiłków, zamiast polegać na retrospektywnym przypominaniu sobie przez pacjenta. Twój moduł 4 (checklist 5 posiłków, bez szczegółu co konkretnie zjedzono) w połączeniu z modułem 11 (pytanie "co jadłeś" tylko w dniu objawu) nie da wystarczających danych do wykrycia wzorca z opóźnieniem.

**D. Sen przy pracy zmianowej — model "typ dnia = stała godzina" jest zgodny z aktualnym konsensusem, ale brakuje elementu światła.**
Konsensusowe wytyczne Delphi (2023, ponad 50 międzynarodowych ekspertów) oraz zalecenia Sleep Foundation wprost rekomendują dokładnie to podejście, które już zaprojektowaliśmy: osobna, ale WEWNĘTRZNIE stała godzina snu/pobudki dla każdego typu dnia (odpowiednik Twoich Szablonów A/B/C), zamiast wymuszania jednej sztywnej godziny na wszystkie dni (co i tak byłoby nierealne przy zmianowym grafiku). To dobra wiadomość — nie trzeba nic zmieniać w konstrukcji Szablonów. Czego jednak brakuje: literatura mocno podkreśla **zarządzanie światłem** jako czynnik równie ważny co sama godzina — jasne światło rano (koreluje z wcześniejszą pobudką, Dzień A) i unikanie jasnego światła/ekranów wieczorem przed snem (szczególnie ważne w Dniu B, gdzie użytkownik kończy pracę o 20:00 i ma krótkie okno do snu). System nie ma obecnie żadnego elementu związanego ze światłem/ekranami w bloku wieczornym.

**E. Dieta i ADHD — założenie "ograniczenie węglowodanów" wymaga korekty merytorycznej.**
Oryginalna notatka Arka mówiła o "ograniczeniu węglowodanów ze względu na ADHD". Literatura (w tym źródła cytujące dietetyków klinicznych specjalizujących się w ADHD) wskazuje na coś bardziej precyzyjnego: to nie węglowodany jako kategoria są problemem, tylko **węglowodany proste/wysoko-glikemiczne** (biały chleb, słodycze, przetworzone płatki) powodujące gwałtowne skoki i spadki cukru, które nasilają objawy ADHD (rozdrażnienie, spadek koncentracji). Węglowodany złożone (pełnoziarniste, warzywa, rośliny strączkowe) działają odwrotnie — stabilizują poziom cukru i są zalecane, nie ograniczane. Dodatkowo, silny nacisk w literaturze kładzie się na **białko wcześnie w ciągu dnia** (śniadanie białkowe) jako czynnik wspierający produkcję dopaminy/noradrenaliny i stabilizujący skupienie na starcie dnia — to konkretna, actionable wskazówka, której obecny koncept nie ma, a łatwo dodać (Posiłek 1 = z naciskiem na białko).

**F. Robot sprzątający 2x/dziennie — potencjalny konflikt z psem.**
Nie było to wprost pytane, ale warto zaznaczyć: standardowa rekomendacja dla gospodarstw z psem to uruchamianie robota w momencie, gdy zwierzę nie ma dostępu do sprzątanego obszaru (naturalny niepokój/płoszenie się psów robotami sprzątającymi jest częstym zgłaszanym problemem) — **rozwiązane w Rundzie #5:** pies ma własny kojec/pokój, brak konfliktu.

---

## 0.7 RYTUAŁ MIESIĘCZNY — WGRYWANIE GRAFIKU (doprecyzowane w Rundzie #5)

Ustalono, że dni treningowe (Wt/Czw/Sob) są stałe w tygodniu niezależnie od typu zmiany — ale to rodzi pytanie o mechanizm łączenia stałych dni tygodnia ze zmiennym, comiesięcznym grafikiem pracy. Odpowiedź Arka doprecyzowuje proces:

- **Raz w miesiącu** (gdy Arek przesyła nowy grafik pracy, jak we wrześniowym przykładzie) odbywa się jedna sesja, w której:
  1. Grafik pracy zostaje wczytany do systemu (Tabela Grafik_Pracy, sekcja 7)
  2. Każdy dzień miesiąca automatycznie otrzymuje typ (A/B/Wolny) na podstawie godzin pracy
  3. System **automatycznie krzyżuje** stałe dni treningowe (Wt/Czw/Sok) z przypisanymi typami dni — więc np. jeśli dany wtorek jest Dniem A (8:30-15:30), trening wpada w Szablon A (po pracy, popołudniu); jeśli ten sam wtorek jest Dniem B (12:00-20:00), trening wpada w Szablon B (rano, przed pracą)
  4. To NIE wymaga decyzji Arka co miesiąc — sam układ dni tygodnia (Wt/Czw/Sob) jest ustalony raz i stały, zmienia się tylko automatycznie wyliczana godzina treningu w ramach dnia, w zależności od tego, jaki typ zmiany akurat wypada
- Ten mechanizm **nie koliduje** z decyzją Arka "tylko podsumowanie w niedzielnym review, bez planowania" (sekcja 0.5) — wgrywanie grafiku to osobna, comiesięczna czynność, nie cotygodniowy rytuał planistyczny

---

## 0.8 INTEGRACJA Z RCP — NADGODZINY I DOJAZD (Runda #6, nowy element architektury)

Arek zbudował własny system RCP (ewidencja czasu pracy) dla kliniki We Smile — to osobny projekt, ale okazuje się kluczowym źródłem danych dla TEGO systemu.

**Problem źródłowy:** Arek "praktycznie zawsze" pracuje dłużej niż w grafiku — nie zaczyna wcześniej, ale kończy później, w sposób nieregularny i nieprzewidywalny co do długości. Sztywne Szablony Dnia (Sekcja 3) zakładające stały koniec pracy (15:30/20:00) regularnie rozjeżdżałyby się z rzeczywistością.

**Rozwiązanie — czytanie z RCP zamiast pytania/zgadywania:**
- System **czyta bezpośrednio z istniejącego RCP** (Google Apps Script, dane wejścia/wyjścia dla pracownika "Arkadiusz Graczyk") rzeczywisty czas rozpoczęcia i zakończenia pracy danego dnia — nie pyta Arka "ile dziś nadgodzin", nie zgaduje, nie wymaga ręcznego zgłaszania
- Rzeczywisty koniec pracy (z RCP) + czas dojazdu (20-25 min, zależnie od pory roku/pogody — samochód lub motocykl) = rzeczywisty punkt startowy popołudniowego bloku Szablonu Dnia
- Dojazd sam w sobie NIE jest osobnym blokiem/checkboxem w widoku dnia — to tylko dana wejściowa do przeliczenia godzin, nie zadanie do odhaczenia
- Audiobooki podczas dojazdu: możliwe, ale zależne od nastroju danego dnia — nie modelowane jako stały, oczekiwany nawyk

**Wyjątek w mechanice HP (ważna decyzja projektowa):** Nadgodziny są poza kontrolą Arka — jeśli z ich powodu przesuwają się/skracają się popołudniowe bloki (trening, posiłki), **HP NIE spada** za wynikające z tego spóźnienia lub skrócenia. To jedyny inny (poza Tokenem Dnia Ochronnego z sekcji 4.1a) wbudowany wyjątek od pełnej presji gamifikacyjnej, uzasadniony tym samym principem co token: presja ma motywować do rzeczy, na które Arek ma wpływ, nie karać za okoliczności zewnętrzne.

**Wymagania techniczne — ZWERYFIKOWANE na realnym arkuszu (Runda #9):** Arek udostępnił arkusz "WS ewidencja czasu pracy" (Google Sheets). Ustalona struktura:
- Arek figuruje jako **WS01, Arkadiusz Graczyk** w arkuszu `Pracownicy` (kolumny: ID, Imię, Nazwisko, Rola, Status, PIN_HASH, FormaZatrudnienia)
- Arkusz zawiera osobne zakładki, z których najbardziej relewantne dla tego systemu to prawdopodobnie: **`Ewidencja_Czasu`** (surowe wejścia/wyjścia dzienne) i **`Przekroczenia`** (nadgodziny, jeśli już wyliczone automatycznie przez RCP) — dodatkowo dostępne: `Grafik`, `GrafikDni`, `GrafikZatwierdzenia`, `Anomalie`, `Nieobecnosci`, `Logi_Audytowe` i inne, prawdopodobnie pomocnicze
- **Kluczowe zawężenie zakresu:** system ma czytać WYŁĄCZNIE dane dla wiersza WS01/Arkadiusz Graczyk — żadnych innych pracowników kliniki We Smile (istotne z punktu widzenia prywatności danych współpracowników, którzy nie są stroną tego systemu). **Potwierdzone w Rundzie #17:** Arek, jako administrator/osoba zarządzająca w klinice, może samodzielnie udostępnić widok arkusza ograniczony wyłącznie do wiersza WS01 na poziomie uprawnień Google (nie tylko przez filtrowanie w kodzie) — nie wymaga to proszenia nikogo innego o pomoc
- **Dokładne nazwy kolumn w `Ewidencja_Czasu`/`Przekroczenia`** wymagają jeszcze jednej, krótkiej sesji technicznej z bezpośrednim dostępem do arkusza na etapie startu implementacji (nie blokuje konceptu — to trywialny krok mapowania, nie decyzja projektowa)
- Rekomendowany mechanizm sprawdzania: ten sam cykl 15-30 min co przy Google Calendar (sekcja 5.2), dla spójności architektury

---

## 0.9 INTEGRACJA Z CEREBRO (Runda #9 — decyzja finalna)

Wcześniej odłożone jako "do etapu technicznego" — **Arek podjął decyzję: system MA być zintegrowany z Cerebro jako nowa gałąź/sekcja istniejącego ekosystemu**, a nie budowany jako całkowicie osobny, niezależny system.

**Konsekwencje tej decyzji dla architektury (do rozwinięcia na etapie implementacji):**
- Nowy system powinien żyć w tej samej strukturze Google Drive co Cerebro (10-podfolderowa struktura z taksonomią tagowania), prawdopodobnie jako jeden z podfolderów/gałęzi tematycznych
- Potencjalna synergia: Cerebro ma już integrację MCP przez konektor Google Drive i n8n Cloud — ten sam mechanizm może obsługiwać automatyzacje nowego systemu (generowanie eventów Calendar, odczyt RCP, przyszły AI Coach) zamiast budowania osobnej infrastruktury od zera
- Taksonomia tagowania Cerebro może być rozszerzona o tagi tego systemu (np. `#zdrowie`, `#trening`, `#portfolio`) zamiast tworzenia równoległego systemu kategoryzacji
- **Prywatność danych zdrowotnych — DECYZJA FINALNA (Runda #10):** dane wrażliwe tego systemu (mood tracker, dane GI, wszelkie treści Modułu 11) mają **PEŁNĄ, OSOBNĄ prywatność** w ramach struktury Cerebro — restrykcyjne uprawnienia dostępu, tylko Arek ma wgląd, niezależnie od tego, kto może mieć dostęp do innych gałęzi Cerebro (np. materiałów związanych z We Smile). Na etapie implementacji: prawdopodobnie osobny, wydzielony podfolder z indywidualnymi uprawnieniami Google Drive, nie współdzielący domyślnych uprawnień reszty ekosystemu Cerebro. **Potwierdzone w Rundzie #17: nikt oprócz Arka nie ma i nie będzie miał dostępu do tego folderu; konto Google zabezpieczone weryfikacją dwuetapową (2FA)**
- **Backup i eksport danych (Runda #10, nowy wymóg):** system generuje **automatyczny, cotygodniowy eksport danych do pliku**, wyzwalany przy okazji niedzielnego review (sekcja 6.5) — zabezpieczenie przed utratą danych zgromadzonych przez miesiące/lata w razie awarii/utraty dostępu do konta Google. Format eksportu (CSV/JSON/arkusz kopii) do ustalenia na etapie implementacji. **Lokalizacja potwierdzona w Rundzie #17:** to samo konto Google, ale osobny, wskazany przez Arka folder Google Drive (link przekazany bezpośrednio przy konfiguracji, nie publikowany w tym dokumencie)

---

## 0.10 INTEGRACJA ZEWNĘTRZNEJ STRATEGII BIZNESOWEJ — ANALIZA ZGODNOŚCI (Runda #12)

Arek dostarczył samodzielnie opracowany, obszerny (67-sekcyjny) dokument "Strategia Budowy Marki Osobistej" dla Modułu 18 (Portfolio Figurek). Poniżej wnioski z weryfikacji zgodności między tym konceptem a dostarczoną strategią, oraz odpowiedź na pytanie Arka, czy analogiczne strategie warto przygotować dla innych segmentów systemu.

### 0.10.1 Wynik weryfikacji Modułu 18

**Ocena ogólna: strategia jest wysokiej jakości, spójna z profilem zdrowotnym Arka (jej własna sekcja 21 wprost adresuje ADHD/depresję/potrzebę kontaktu z naturą), i w większości ZGODNA z tym konceptem — z jednym istotnym punktem rozbieżności, świadomie rozstrzygniętym przez Arka.**

- **Zgodność:** kanały komunikacji (strategia potwierdza i precyzuje wcześniejszy research — podnosi rangę YouTube), filozofia "konsekwencja ponad częstotliwość", umiejscowienie w elastycznym bloku wieczornym
- **Luka po stronie strategii:** brak wzmianki o Putty & Paint (dedykowanej platformie portfolio dla tej niszy) — dopisana do Modułu 18 jako rekomendacja do uzupełnienia strategii
- **Rozbieżność filozoficzna (kluczowa):** strategia rekomenduje elastyczny rytm bez sztywnych dni i presji, oceniany miesięcznie — wprost przeciwne do rigid-system z pełną mechaniką HP rządzącą resztą tego konceptu. **Rozstrzygnięcie Arka: HYBRYDA** — bloki tworzenia (malowanie, nagrywanie) elastyczne poza HP, ale checklist publikacji (zdjęcie/opis/publikacja) pozostaje rigid z pełną presją HP. Szczegóły w zaktualizowanym Module 18
- **Pozorna rozbieżność nazewnictwa (nie wymaga naprawy):** strategia używa żargonu "Tabletop/Display/Showcase" jako tierów CENOWYCH dla klientów; ten koncept celowo używa prostszej kategoryzacji rozmiaru dla WŁASNEGO trackingu czasu Arka (zgodnie z jego wcześniejszym żądaniem "bez żargonu"). Dwie różne osie tego samego projektu, nie konflikt

### 0.10.2 Czy przygotować analogiczne strategie dla innych segmentów konceptu?

**Odpowiedź: NIE w tej samej, pełnej formie (67-sekcyjny dokument biznesowy) — TAK w znacznie węższym, celowanym zakresie, i tylko tam, gdzie segment ma realny wymiar zewnętrzny/komercyjny/wielowątkowy uzasadniający osobną, głęboką strategię.**

Uzasadnienie tej oceny:

1. **Portfolio Figurek jest wyjątkowy w tym systemie** — to jedyny moduł z wymiarem *zewnętrznym* (klienci, marka, przychód, konkurencja rynkowa, ryzyko biznesowe, prawo/podatki). Reszta 19 modułów to zarządzanie *wewnętrznym* życiem Arka (zdrowie, nawyki, dom, pojazdy) — nie mają odpowiednika "rynku", "konkurencji" czy "klienta", więc struktura w stylu "Blue Ocean Analysis", "pricing psychology" czy "lejek konwersji" nie ma tam zastosowania. Tworzenie takiego dokumentu dla np. Modułu 8 (Sprzątanie) byłoby ćwiczeniem pozornym — nie ma tam nic do "strategizowania" w tym sensie.

2. **Ryzyko przeciążenia dokumentacyjnego jest realne.** Ten koncept ma już 1200+ linijek po 12 rundach. Dokładanie pełnowymiarowych strategii biznesowych do każdego z 19 pozostałych modułów pomnożyłoby objętość dokumentacji wielokrotnie, przy malejącej wartości krańcowej — trening siłowy czy dieta nie potrzebują "analizy konkurencji", potrzebują dobrego planu i konsekwencji, co już mają.

3. **Gdzie węższa, celowana analiza MIAŁABY sens (nie pełna strategia, ale krótki dodatek warty rozważenia w przyszłości):**
   - **Ewentualna przyszła faza BJJ/Boks (Moduł 13):** gdy Arek faktycznie zapisze się na zajęcia, krótki przewodnik "jak wybrać klub/trenera, na co zwrócić uwagę jako początkujący wracający po latach" mógłby być wartościowy — ale to poradnik, nie strategia biznesowa, i to dopiero gdy moduł się aktywuje
   - **AI Coach (Moduł 14, Faza 2):** gdy ten moduł faktycznie wejdzie w życie, osobny, krótki dokument techniczny o tym, jak dokładnie prompt/logika korelacji ma działać, byłby uzasadniony — ale to specyfikacja techniczna, nie odpowiednik strategii marki

4. **Rekomendacja praktyczna:** zamiast przygotowywać kolejne pełne strategie z wyprzedzeniem, lepiej zarezerwować ten poziom głębi na moduły, które faktycznie tego zażądają w praniu — jeśli za kilka miesięcy któryś z pozostałych obszarów (np. Trening, gdyby Arek zapragnął przejść na poziom zawodniczy) nabierze podobnie zewnętrznego, wielowątkowego charakteru, wtedy warto rozważyć analogiczny dokument. Na dziś: **nie ma potrzeby**.

### 0.10.3 Scoring wszystkich 20 modułów — potrzeba indywidualnej strategii (Runda #13, na wyraźną prośbę Arka)

**Metodologia:** każdy moduł oceniony w trzech kryteriach, 0-3 punkty każde (max. suma: 9):
- **W — Wymiar zewnętrzny:** czy moduł dotyczy relacji z rynkiem/klientami/konkurencją/przychodem (0 = czysto wewnętrzny, 3 = pełnoprawny biznes)
- **Z — Złożoność decyzyjna:** ile realnych, nietrywialnych wyborów strategicznych (nie tylko harmonogramowych) trzeba w tym obszarze podejmować
- **R — Ryzyko błędu:** jak kosztowna byłaby zła strategia w tym obszarze — finansowo, zdrowotnie lub w utraconym czasie

**Próg rekomendacji:** suma ≥5 = warto rozważyć osobny dokument strategiczny; suma 3-4 = wystarczy krótka notatka/checklist, nie pełna strategia; suma ≤2 = zbędne, dobry plan w tym konceptowym dokumencie wystarcza.

| Moduł | W | Z | R | Suma | Rekomendacja |
|---|---|---|---|---|---|
| **18. Portfolio Figurek** | 3 | 3 | 3 | **9** | **TAK — już zrealizowane** (dostarczona strategia biznesowa, sekcja 0.10.1-0.10.2) |
| 2. Trening FBW | 0 | 2 | 2 | 4 | Krótka notatka, nie pełna strategia — patrz uzasadnienie niżej |
| 13. BJJ/Boks (future) | 1 | 2 | 1 | 4 | Krótki poradnik przy aktywacji modułu (już zanotowane w 0.10.2) |
| 14. AI Coach (Faza 2) | 0 | 2 | 2 | 4 | Spec techniczna przy aktywacji, nie strategia (już zanotowane w 0.10.2) |
| 11. Mood tracker | 0 | 1 | 2 | 3 | Nie — obecna specyfikacja (progi, kategorie) wystarcza |
| 12. Badania medyczne | 0 | 1 | 2 | 3 | Nie — to lista zadań, nie strategia |
| 1. Suplementacja | 0 | 1 | 1 | 2 | Nie |
| 3. Kardio+Mobilność | 0 | 1 | 1 | 2 | Nie (czeka tylko na bazę CrossFit, to materiał, nie strategia) |
| 4. Dieta | 0 | 1 | 1 | 2 | Nie |
| 16. Motocykl | 0 | 1 | 1 | 2 | Nie |
| 19. Nicnierobienie | 0 | 1 | 1 | 2 | Nie |
| 9. Kontakt z naturą | 0 | 0 | 1 | 1 | Nie |
| 15. Auto | 0 | 0 | 1 | 1 | Nie |
| 17. Zakupy 70/30 | 0 | 1 | 0 | 1 | Nie |
| 5. Czytelnictwo | 0 | 0 | 0 | 0 | Nie |
| 6. Spacer z psem | 0 | 0 | 0 | 0 | Nie |
| 7. Pielęgnacja | 0 | 0 | 0 | 0 | Nie |
| 8. Sprzątanie | 0 | 0 | 0 | 0 | Nie |
| 10. Rozciąganie/Joga | 0 | 0 | 0 | 0 | Nie |
| 10A. Higiena światła | 0 | 0 | 0 | 0 | Nie |

**Komentarz do wyniku Modułu 2 (Trening FBW, suma 4 — najwyższy wynik po Portfolio wśród modułów BEZ wymiaru zewnętrznego):** To jedyny moduł poza Portfolio, gdzie warto rozważyć coś więcej niż plan ćwiczeń — nie pełną "strategię biznesową" (bo nie ma tu rynku/klienta), ale **krótką, osobną notatkę o periodyzacji długoterminowej** (jak progresja ma wyglądać w perspektywie 6-12 miesięcy, kiedy zmieniać plan, jak przygotować się pod przyszłe BJJ/Boks) — coś w rodzaju 1-2 stronicowego dodatku, nie 67-sekcyjnego dokumentu. Wynika to z wysokiego ryzyka błędu (przetrenowanie, kontuzja przy powrocie po 2-letniej przerwie — już zaadresowane częściowo regułą plateau w Module 2) oraz realnej złożoności decyzyjnej (dokładnie ten sam typ pytania, co przy przejściu z 2x na 3x/tydzień w Rundzie #5). **To jedyna rekomendacja z tego scoringu, która realnie warta jest wykonania w niedalekiej przyszłości** — pozostałe "4-punktowe" moduły (BJJ, AI Coach) są already noted jako "poczekaj do aktywacji", a moduły 3-punktowe i niżej nie przekraczają progu opłacalności takiego dodatkowego dokumentu.

---

## 0.11 WYMAGANIA TECHNICZNE BAZOWE I FAZOWANIE IMPLEMENTACJI (Runda #15, nowa sekcja — audyt gotowości deweloperskiej)

Ten dokument był pierwotnie pisany iteracyjnie, w rozmowie, bez pełnej świadomości, że ostatecznie trafi do dewelopera bez dodatkowego kontekstu. Poniższa sekcja domyka braki wykryte w audycie "czy ten dokument wystarczy komuś, kto nie zna Arka i nie czytał historii jego powstania".

### 0.11.1 Wymagania techniczne bazowe — DO USTALENIA BEZPOŚREDNIO Z AREKIEM

**WAŻNE dla dewelopera:** Punkty 3-5 poniżej zostały rozstrzygnięte w Rundzie #18 (patrz adnotacje przy każdym). **Punkt 1 (autentykacja) pozostaje świadomie otwarty** — Arek zdecydował, że to decyzja czysto inżynierska, która powinna zostać ustalona bezpośrednio w rozmowie między deweloperem a nim, a nie jednostronnie przesądzona na etapie koncepcyjnym:

1. **Autentykacja/logowanie:** System jest z założenia **jednoosobowy** (patrz cały dokument — jeden użytkownik, Arek) — czy to oznacza brak systemu logowania w ogóle (dostęp przez sam link/URL, zabezpieczony ewentualnie na poziomie Google Workspace), czy jednak potrzebne jest minimalne zabezpieczenie dostępu (np. logowanie Google, PIN)? Do ustalenia z Arkiem, uwzględniając że dane obejmują wrażliwe informacje zdrowotne (mood tracker, GI — patrz Sekcja 0.9 o prywatności w Cerebro)
2. **Hosting:** System opiera się o Google Sheets + Google Apps Script (patrz Sekcja 1.1) — Apps Script ma własny, wbudowany hosting (Web App deployment), więc pytanie do potwierdzenia z Arkiem to raczej: czy to wystarczające, czy Arek chce dodatkowo hostować warstwę PWA (frontend) gdzieś indziej (np. Firebase Hosting, Vercel, GitHub Pages) dla lepszej wydajności/kontroli. **Rozstrzygnięte w Rundzie #17: NIE — wyłącznie wbudowany hosting Apps Script (Web App deployment), żadnej dodatkowej platformy. System pozostaje w 100% w Google Apps Script, zarządzanie limitami opisane w nowej sekcji 1.2.**
3. **Środowiska dev/staging/prod — ROZSTRZYGNIĘTE (Runda #18):** JEDNO środowisko produkcyjne od początku, zgodnie z filozofią "budujemy docelowe rozwiązanie" (Runda #17, punkt P) — bez równoległej, stałej infrastruktury testowej. Google Sheets + Apps Script są tanie w duplikowaniu: jeśli kiedykolwiek zajdzie potrzeba przetestowania czegoś ryzykownego (np. nowej wartości kalibracji HP) bez wpływu na realne dane, wystarczy jednorazowa, ręczna kopia całego arkusza i skryptu (File → Make a copy) jako doraźny sandbox, nie stała, utrzymywana osobno instancja
4. **Budżet/koszty bieżące — ROZSTRZYGNIĘTE (Runda #18):** Przy 100% Google Apps Script + Sheets na koncie osobistym (nie Workspace), koszt bieżący w Fazach 1-3 wynosi **0 zł** — Apps Script, Sheets i Google Calendar API są darmowe w tym zakresie użycia. Jedyny przyszły koszt to Moduł 14 (AI Coach, Faza 4) korzystający z Anthropic API rozliczanego za zużycie, nie w formie stałej subskrypcji — orientacyjnie pojedyncze złotówki miesięcznie przy cotygodniowej analizie, do zweryfikowania dokładnie dopiero przy aktywacji tego modułu
5. **Wersjonowanie/backup kodu — ROZSTRZYGNIĘTE (Runda #18):** Prywatne repozytorium GitHub (`graczykarkadiuszwork/cerebro`, branch `Pip-Boy`) — ten sam, w którym powstaje i jest wersjonowana niniejsza dokumentacja. Kod Apps Script (`.gs`, `.html`) będzie trzymany w tym samym repozytorium, tak jak istniejący kod Cerebro

### 0.11.2 Fazowanie implementacji — rekomendowana kolejność budowy

Dotychczasowy dokument miał tylko jedno explicite oznaczone fazowanie (AI Coach jako "Faza 2, nie MVP"). Poniżej pełniejszy podział, żeby deweloper wiedział, od czego zacząć, zamiast traktować wszystkie 20 modułów jako jeden, płaski, jednoczesny wymóg.

**Zastrzeżenie doprecyzowane w Rundzie #17:** poniższe fazy opisują kolejność prac WEWNĘTRZNYCH dewelopera (od czego faktycznie zaczyna kodować), nie kolejne, coraz głębsze wersje prezentowane Arkowi do oceny i akceptacji etapami. Arek nie chce testować uproszczonej wersji przez określony czas przed decyzją o dalszych krokach — celem jest zbudowanie docelowego rozwiązania realizującego wszystkie założenia dokumentu, pokazywanego mu w całości, nie fragmentami do akceptacji krok po kroku.

**FAZA 1 — RDZEŃ (fundament, bez którego reszta nie ma sensu):**
- Sekcja 0.7 (rytuał miesięczny wgrywania grafiku) + Sekcja 0.8 (integracja RCP) — bez tego system nie wie, jaki jest typ dnia
- Sekcja 3 (Szablony Dnia A/B/C/D) — generowanie dnia na podstawie powyższego
- Moduł 1 (Suplementacja), Moduł 4 (Dieta/posiłki jako remindery), Moduł 11 (Mood tracker) — najprostsze, czysto checklistowe moduły, dobry start do testowania mechaniki podstawowej
- Sekcja 4.1-4.2 (podstawowa mechanika HP, bez pełnej listy 208 odznak na start) — wystarczy działający pasek HP i podstawowe punkty
- Widok Dnia (Sekcja 6.1) — od startu odzwierciedlający pełną, logiczną strukturę dnia (wszystkie zaplanowane bloki widoczne), nawet jeśli głębia poszczególnych modułów rośnie w kolejnych fazach; motyw wizualny Pip-Boy może wejść stopniowo w kolejności prac deweloperskich (Runda #17), ale efekt końcowy pokazywany Arkowi jest zawsze całością, nie kolejnymi "wydaniami" do oceny

**FAZA 2 — ROZBUDOWA CORE:**
- Moduł 2 (Trening, z pełnym trackingiem ćwiczeń, progresją, regułą plateau, narzędziem wymiany treningu)
- Moduł 5 (Czytelnictwo), Moduł 6 (Spacer), Moduł 7 (Pielęgnacja), Moduł 8 (Sprzątanie), Moduł 9 (Kontakt z naturą), Moduł 10+10A (Rozciąganie, Higiena światła), Moduł 12 (Badania)
- Pełna Sekcja 4.3 (208 odznak), Sekcja 4.1a (GOD_MODE_24H) i Sekcja 4.1b (Tryb Regeneracji, Runda #17)
- Cytat Dnia (Sekcja 5.4) i Marquee sugestywne (Sekcja 6.12, Runda #17) — obie wymagają wcześniejszego przygotowania treści redakcyjnych (300 cytatów, 100+ komunikatów)
- Dashboard graficzny (Sekcja 6.13, Runda #17)
- Dwustronna synchronizacja Google Calendar (Sekcja 5.2)
- Pełny motyw wizualny Pip-Boy (Sekcja 6.9)

**FAZA 3 — MODUŁY DODATKOWE:**
- Moduł 15/16 (Auto/Motocykl), Moduł 17 (Zakupy 70/30), Moduł 19 (Czas Wolny z pełną logiką fallback), Moduł 20 (Rolling Average)
- Moduł 18 (Portfolio Figurek) — WYMAGA równoległego zapoznania się z dokumentem towarzyszącym (Strategia Marki Osobistej, patrz nagłówek dokumentu i Sekcja 0.10)
- Karta Postaci jako pełny, osobny ekran (Sekcja 6.6)
- Backup/eksport automatyczny (Sekcja 0.9)

**FAZA 4 — ROZSZERZENIA PRZYSZŁE (poza pierwotnym MVP):**
- Moduł 13 (BJJ/Boks) — aktywowany ręcznie przez Arka gdy faktycznie zapisze się na zajęcia
- Moduł 14 (AI Coach) — jak ustalono wcześniej, dopiero po 4-6 tygodniach zgromadzonych danych
- Moduł 21 (Finanse osobiste, Runda #17) — nowy moduł, do wpięcia po ustabilizowaniu reszty systemu
- Biblioteka mobilności CrossFit (Moduł 2) — świadomie odroczona (Runda #17), bez wyznaczonego terminu
- Integracja z Cerebro jako pełna gałąź (Sekcja 0.9) — może być równoległa do Fazy 1-3, ale nie blokuje ich rozpoczęcia

**Uwaga o offline-first (Sekcja 1.1):** Pełna architektura offline (Service Worker + IndexedDB + kolejka synchronizacji) jest złożonym komponentem inżynierskim. Rekomendacja: zaimplementować podstawową wersję systemu ONLINE-ONLY w Fazie 1, dodać warstwę offline w Fazie 2 lub 3, zamiast blokować cały start projektu na najbardziej złożonym technicznie elemencie.

---

## 0.12 RUNDA DOPRECYZOWANIA #17 — WYWIAD UŻYTKOWY (32 PYTANIA)

Zamiast kolejnej rundy pytań otwartych, tę rundę przeprowadzono jako ustrukturyzowany wywiad złożony z 32 prostych pytań, celowo napisanych z perspektywy użytkownika, nie dewelopera — każde pytanie domykało jedną, konkretną wątpliwość lub lukę zidentyfikowaną w niezależnym przeglądzie architektonicznym dokumentu. Poniżej wynik: decyzje wiążące, wpięte bezpośrednio w odpowiednie moduły i sekcje niżej w dokumencie.

**A. Kluczowa zmiana filozoficzna — GOD_MODE_24H zamiast auto-detekcji.** Arek świadomie odrzucił pomysł, by system SAM proponował aktywację ochrony na podstawie wyniku mood trackera — wyłącznie on decyduje, kiedy potrzebuje ochrony, ręcznie. Mechanizm tokena dnia ochronnego (sekcja 4.1a) zyskuje nazwę i formę "cheat kodu z gry" — **GOD_MODE_24H** — natychmiastowy, ręczny przełącznik na 24h, uruchamiany tego samego dnia (nie tylko z wyprzedzeniem jak dotąd). Limit 4×/miesiąc pozostaje bez zmian.

**B. Nowy stan systemu — Tryb Regeneracji.** Dwa dni z rzędu z aktywnym GOD_MODE_24H automatycznie sugerują (nie wymuszają) wejście w dłuższy, wielodniowy Tryb Regeneracji (nowa sekcja 4.1b) — HP i mechanika śmierci postaci zawieszone, ale WSZYSTKIE przypomnienia (suplementy, posiłki, mood) zostają aktywne, znika wyłącznie kara punktowa. Fakt korzystania z Trybu widoczny w historii postaci, nie ukrywany.

**C. Nowy wymóg motywacyjny — Cytat Dnia.** Każdy dzień ma się zaczynać od jednego z **300 cytatów motywacyjnych z podanym autorem** (gdy autor jest znany), z biblioteki zbudowanej ze wskazanych przez Arka źródeł. Szczegóły w nowej sekcji 5.4.

**D. Nowy wymóg UX — Marquee sugestywne.** Arek chce znacznie więcej niż dotąd zaplanowane, delikatne podpowiedzi behawioralne — **minimum 100 komunikatów**, obejmujących praktycznie każdy element systemu, wyświetlanych NIE jako popupy, tylko jako stale obecny, odświeżany pasek przewijanego tekstu (marquee/ticker), zależny od kontekstu bieżącej sytuacji. Szczegóły w nowej sekcji 6.12.

**E. Melatonina wraca do statusu warunkowego.** Zmiana z Rundy #14 (obligatoryjna, kara HP) zostaje COFNIĘTA. Arek chce, żeby system rejestrował wyłącznie faktyczne zażycie — bez odwrotnego pola "nie była potrzebna", bo to zafałszowałoby dane o realnym zażyciu. Melatonina wraca do logiki warunkowej: dostępna, trackowana gdy użyta, bez kary HP za brak. Higiena światła (Moduł 10A) i melatonina zostają jako dwa OSOBNE punkty w harmonogramie (nie łączone w jeden blok) — melatonina jest opcjonalna, higiena światła obligatoryjna.

**F. Cel snu.** Dodany jawny cel: **minimum 7h, maksimum 9h** na dobę, niezależnie od typu dnia — punkt odniesienia przy decyzjach o wydłużeniu snu (Moduł 19).

**G. Odrzucone jako zbędne (świadomie, nie przeoczone).** Przypomnienie o porze przyjęcia kreatyny względem posiłku i przypomnienie o łączeniu Omega-3 z tłuszczem — obie propozycje rozważone i odrzucone przez Arka jako nadmiar szczegółu. Pozostają wyłącznie checkboxy zażycia, bez dodatkowych pól kontekstowych.

**H. Trening — powody nieukończenia i edytowalny plan.** Status "trening zmodyfikowany" (obok pełnej sesji i GOD_MODE) zyskuje listę wyboru najczęstszych powodów (zdrowie, zmęczenie, złe samopoczucie i podobne — lista rozszerzalna). Dodatkowo Arek potrzebuje prostego narzędzia do EDYCJI planu treningowego: tabela ćwiczenie / liczba serii / liczba powtórzeń jako edytowalne pola (nie tylko A/B na sztywno), a w codziennym odhaczaniu — pole na ciężar, ocenę „jak poszło" w skali 1–10, i notatkę. Biblioteka mobilności CrossFit świadomie odroczona — start bez niej, dołączenie później, nie blokuje niczego.

**I. Kalibracja HP i „Game Over".** Arek potwierdza: przeliczyć realną częstość śmierci postaci na papierze przed startem, ale sama kalibracja ZOSTAJE bez łagodzenia, nawet jeśli wyjdzie częsta. Doprecyzowana logika śmierci postaci (pełny opis w zaktualizowanej sekcji 4.1): pełnoekranowy popup „GAME OVER" w momencie śmierci; odznaki JUŻ zdobyte (stałe [S]) zostają na zawsze; postęp W TRAKCIE zdobywania kolejnej odznaki lub progu (np. 96% do streaka 20 dni) zeruje się razem ze zerwanym licznikiem, którego dotyczy — nic poza tym nie przepada.

**J. Dostępność interfejsu — pełna kontrola ręczna.** Skalowanie rozmiaru czcionki: tak, potrzebne, niezależne od poziomu efektów CRT. Poziom „Ultra" (migotanie) NIE ma automatycznie wyłączać się wg systemowego ustawienia „ogranicz ruch" urządzenia — Arek chce pełną, ręczną kontrolę nad tym ustawieniem niezależnie od telefonu/komputera.

**K. Prywatność i dostęp — potwierdzone, zamknięte.** Nikt oprócz Arka nie ma dostępu do danych zdrowotnych. 2FA na koncie Google: włączone. Cotygodniowy backup trafia na to samo konto Google, ale do osobnego, wskazanego folderu. Dostęp do arkusza RCP: Arek jako administrator może samodzielnie udostępnić widok ograniczony wyłącznie do własnego wiersza (WS01) — nie wymaga proszenia nikogo innego. Umowa o pracę: potwierdzone, że pozwala na dodatkową działalność zarobkową — punkt zamknięty, bez dalszego ryzyka.

**L. Kalendarz.** Google Calendar systemu ma być spięty z istniejącym kontem `graczyk.arkadiusz.work@gmail.com`, nie z nowym, osobnym kontem.

**M. Dashboard — nowy wymóg wizualny.** Zamiast prostego podsumowania tygodniowego, Arek chce pełnoprawny **graficzny dashboard z wykresami i wartościami liczbowymi** — widok ogólny całości systemu plus osobne podzakładki per segment/moduł. Szczegóły w zaktualizowanej sekcji 6.5 i nowej sekcji 6.13.

**N. Portfolio Figurek — Putty & Paint odroczone.** Arek nie zna tej platformy — decyzja o jej włączeniu odroczona do momentu krótkiego przedstawienia mu, czym jest, zamiast zakładania z góry, że wejdzie do strategii kanałów.

**O. Finanse osobiste — doprecyzowanie przyszłego Modułu 21.** Ma być to ogólna poduszka bezpieczeństwa (nie wyłącznie rezerwa podatkowa), trackowana jako dokładny licznik kwoty, nie prosty checkbox tak/nie.

**P. Filozofia budowy — zmiana względem fazowania z sekcji 0.11.2.** Arek NIE chce etapowego wdrażania „od najprostszych rzeczy" z osobnym okresem testowania prostszej wersji — jego stanowisko: **Widok Dnia od początku ma odzwierciedlać pełny, logiczny i optymalny harmonogram dnia** (nie okrojony szkielet), a budowa ma dążyć do **docelowego rozwiązania realizującego wszystkie założenia dokumentu**, bez wydzielonego etapu „testuj uproszczoną wersję przez tydzień/miesiąc, potem decyduj". Fazowanie z sekcji 0.11.2 pozostaje jako **kolejność prac wewnętrznych dewelopera** (od czego faktycznie zaczyna kodować), ale nie jako kolejne, coraz głębsze „wydania" prezentowane Arkowi do oceny etapami — efekt ma być pokazywany Arkowi w całości, nie fragmentami do akceptacji krok po kroku.

---

## 1. ARCHITEKTURA SYSTEMU (WYSOKI POZIOM)

```
┌─────────────────────────────────────────────────────────┐
│  WARSTWA 1: DANE I LOGIKA                                 │
│  (baza danych / arkusz — źródło prawdy)                   │
│  - Grafik pracy (miesięczny)                               │
│  - Szablony dni (A/B/Wolny)                                │
│  - Definicje modułów (suplementy, ćwiczenia, itd.)          │
│  - Log historyczny (co zrobione, kiedy, jak się czuł)       │
│  - System punktowy (gamifikacja)                            │
└─────────────────────────────────────────────────────────┘
                          ↕
┌─────────────────────────────────────────────────────────┐
│  WARSTWA 2: SILNIK LOGIKI (automatyzacja)                  │
│  - Codziennie o 6:00: generuje "dzień" na podstawie typu    │
│  - Wylicza bloki czasowe (time blocking ±15 min)             │
│  - Wysyła powiadomienia w zaplanowanych momentach            │
│  - Agreguje dane do tygodniowego review (niedziela)          │
└─────────────────────────────────────────────────────────┘
                          ↕
┌─────────────────────────────────────────────────────────┐
│  WARSTWA 3: INTERFEJS UŻYTKOWNIKA                          │
│  - Widok dnia (cała mapa, checkboxy, kolory/ikony)           │
│  - Widok treningu (szczegółowy log + wykresy)                 │
│  - Widok tygodnia (historia, punkty, trendy)                  │
│  - Mood check (rank 1-10, kilka kategorii)                    │
└─────────────────────────────────────────────────────────┘
                          ↕
┌─────────────────────────────────────────────────────────┐
│  WARSTWA 4: POWIADOMIENIA                                  │
│  - Agresywne push (pełnoekranowe), aktywne do 22:00           │
│  - Kalendarz (bloki czasowe widoczne jako eventy)              │
│  - Reminder miesięczny: "wyślij grafik pracy"                  │
└─────────────────────────────────────────────────────────┘
```

### 1.1 Czym system BĘDZIE fizycznie — forma, stos technologiczny, architektura offline (Runda #11, doprecyzowanie kluczowe)

**Forma:** To NIE jest aplikacja do pobrania ze sklepu (App Store/Google Play). To **aplikacja webowa typu PWA (Progressive Web App)** — otwierana w przeglądarce, ale instalowalna na ekranie głównym telefonu/komputera tak, by wyglądała i działała jak natywna appka (pełny ekran, ikona, działanie w tle w ograniczonym zakresie). Ten sam ogólny typ narzędzia co istniejący RCP Arka, tylko znacznie szerszy zakresowo.

**Stos technologiczny:**
- **Silnik danych:** Google Sheets — wszystkie tabele z sekcji 7, prawdopodobnie jako nowa gałąź Cerebro (sekcja 0.9)
- **Logika/automatyzacja backendowa:** Google Apps Script — generowanie dnia, wyliczanie HP/XP, synchronizacja z Google Calendar i RCP (ten sam warsztat, którego Arek już używa w RCP)
- **Interfejs:** HTML/JS/CSS jako PWA, responsywny pod telefon i komputer
- **Powiadomienia:** Google Calendar (natywne alerty iOS/Windows), nie osobna infrastruktura push

**KLUCZOWA SPRZECZNOŚĆ WYKRYTA I ROZWIĄZANA (Runda #11):** Google Apps Script działa WYŁĄCZNIE po stronie serwera — nie ma trybu offline. Sam Google Sheets jako baza danych też wymaga połączenia. Wymaganie "offline-first" z sekcji 6.0 w swojej pierwotnej, uproszczonej formie było **technicznie niespójne** z wyborem stosu Apps Script + Sheets — appka zbudowana literalnie na tym stosie bez dodatkowej warstwy nie otworzyłaby się bez internetu. Arek, poznając realny koszt inżynierski, **świadomie potwierdził, że chce pełnej wersji offline mimo dodatkowej złożoności.**

**Rozwiązanie architektoniczne — PEŁNE PWA z lokalnym cache i kolejką synchronizacji:**
- **Service Worker** cache'uje statyczne pliki appki (HTML/JS/CSS) lokalnie w przeglądarce — appka fizycznie się otwiera i działa bez internetu, nie tylko pokazuje błąd
- **Lokalna baza w przeglądarce (IndexedDB)** przechowuje aktualny stan dnia (checkboxy, wpisy) — Arek może odhaczać zadania, wypełniać mood tracker, logować trening offline (np. na treningu, na spacerze bez zasięgu)
- **Kolejka synchronizacji** — zmiany zrobione offline czekają w lokalnej kolejce i wysyłają się do Google Sheets (przez Apps Script) automatycznie, gdy połączenie wróci
- **Rozwiązywanie konfliktów:** ponieważ Arek używa dwóch urządzeń (telefon + komputer, sekcja 6.0), teoretycznie możliwa jest sytuacja zmiany tego samego rekordu offline na obu naraz — wymaga strategii rozwiązywania konfliktów (rekomendacja robocza: "ostatni zapis wygrywa" wg znacznika czasu, z prostym oznaczeniem w UI jeśli wykryto nadpisanie, żeby nie było to całkowicie niewidoczne dla Arka)
- **Doprecyzowanie (Runda #17):** "ostatni zapis wygrywa" zostaje jako domyślne zachowanie WYŁĄCZNIE między dwoma urządzeniami Arka (telefon vs komputer, ten sam checkbox). Tam, gdzie jednym ze źródeł jest automat (RCP, auto-wygenerowany event kalendarza), obowiązuje osobna, prosta tabela priorytetów per pole: dane z RCP (godziny pracy) > ręczne odhaczenie Arka > auto-wygenerowany event kalendarza — nie jedna reguła globalna
- **To jest realny, dodatkowy komponent inżynierski**, nie proste ustawienie "włącz offline" — wymaga świadomego zaprojektowania na etapie implementacji w Claude Code, z osobnym czasem na testowanie scenariuszy synchronizacji

### 1.2 Zarządzanie limitami Google Apps Script (Runda #17)

Potwierdzone wprost: system pozostaje **w 100% w obrębie Google Apps Script + Google Sheets** — żadnej migracji do innej platformy/chmury, niezależnie od skali danych w przyszłości. To rozstrzyga ostatecznie pytanie o hosting z sekcji 0.11.1 (punkt 2).

- **Ryzyko:** Apps Script ma twarde limity wykonania (ok. 6 min/uruchomienie) i dobowe kwoty triggerów — przy wielu automatyzacjach (generowanie dnia, sync Kalendarza co 15-30 min, odczyt RCP, cotygodniowy eksport, przeliczanie HP/XP) i wielu latach danych w kilkudziesięciu tabelach (sekcja 7), zużycie kwot wymaga świadomego zarządzania od początku, nie dopiero gdy stanie się problemem
- **Podejście — wyłącznie środkami wewnątrz Apps Script, bez zmiany platformy:** grupowanie operacji na arkuszu w jedno wywołanie zamiast osobnego zapisu na każdy checkbox; przeliczanie HP/XP zbiorczo zamiast przy każdym kliknięciu; rozłożenie automatyzacji na różne pory dnia, żeby nie kumulowały się w jednym oknie czasowym
- **Monitoring:** prosty log zużycia kwot triggerów od Fazy 1 — nie jako sygnał do zmiany technologii, tylko jako informacja, kiedy warto odciążyć harmonogram automatyzacji

---

## 2. MODUŁY SYSTEMU — SZCZEGÓŁOWA SPECYFIKACJA

Dla każdego modułu: cel, dane do zbierania, częstotliwość, forma przypomnienia, forma trackingu.

### 2.0 KATEGORYZACJA: OBLIGATORYJNE VS OPCJONALNE (Runda #14 — fundamentalne rozróżnienie)

Po przejrzeniu wizualnego szkicu tygodnia Arek zażądał jawnej kategoryzacji KAŻDEGO bloku/modułu — bez tego rozróżnienia nie było jasne, co realnie kosztuje HP przy pominięciu, a co jest tylko sugestią. Poniższa tabela jest **źródłem prawdy** dla całego dokumentu — jeśli poszczególny opis modułu niżej się z nią kłóci, tabela wygrywa.

**Definicja:** OBLIGATORYJNE = ma przypomnienie i pominięcie kosztuje HP (Sekcja 4.2). OPCJONALNE = może mieć przypomnienie (miękkie) lub nie, ale NIGDY nie kosztuje HP.

| # | Element | Status | Uwagi |
|---|---|---|---|
| 1 | Suplementy rdzenne (Kreatyna, Vita Pak, Kolagen, Omega3) | **OBLIGATORYJNE** | Bez zmian |
| 1b | Melatonina | **OPCJONALNE/WARUNKOWE, bez kary HP** | **Runda #17 — cofnięcie zmiany z Rundy #14:** Arek chce dokładnego trackingu realnego zażycia (zaznacza tylko gdy bierze), bez presji punktowej, która promowałaby "sztuczne" zaznaczanie |
| 1c | Gainer (posiłek treningowy) | **OBLIGATORYJNE** | Bez zmian od Rundy #14 — osobny punkt żywieniowy w dni treningowe |
| 2+3 | Trening (połączony blok FBW + kardio/mobilność, patrz Moduł 2 zaktualizowany) | **OBLIGATORYJNE** | W dni treningowe (Wt/Czw/Sob), z wyjątkiem niedzieli (nie dotyczy — niedziela nigdy nie była dniem treningowym) |
| 4 | Dieta / 5 posiłków | **OBLIGATORYJNE** | Forma: remindery + orientacyjne okno czasowe (nie sztywny blok — patrz Sekcja 3 zaktualizowana) |
| 5 | Czytelnictwo | **OBLIGATORYJNE** | **ZMIANA (Runda #14):** wcześniej tylko rolling-average bez twardego dziennego wymogu — teraz codzienny obowiązek (rolling-average nadal używane jako miara jakości, ale HP reaguje na kompletne zero danego dnia) |
| 6 | Spacer z psem | OPCJONALNE, bez remindera | Bez zmian — Arek świadomie utrzymał tę decyzję (odpowiedzialność dzielona z innymi domownikami) |
| 7 | Pielęgnacja (2×15 min: rano przed pracą + wieczór przed snem) | OPCJONALNE (ma stały kształt w harmonogramie, ale bez kary HP) | **DOPRECYZOWANE (Runda #14):** zachowuje sztywne umiejscowienie w dniu (2 sloty po 15 min), ale pominięcie nie kosztuje HP — "zaplanowana, ale bez presji" |
| 8 | Sprzątanie | **OBLIGATORYJNE minimum 15 min/dzień** (floor), reszta ponad floor opcjonalna | Bez zmian, z wyjątkiem niedzieli (zwolniona, patrz niżej) |
| 9 | Kontakt z naturą | OPCJONALNE | Bez zmian |
| 10 | Rozciąganie/Joga | **OBLIGATORYJNE** | **DOPRECYZOWANE (Runda #14):** sekwencja poranna — zawsze PO porannej pielęgnacji, jeśli pielęgnacja tego dnia się nie odbyła, rozciąganie i tak następuje zaraz po przebudzeniu. Samo rozciąganie pozostaje obligatoryjne niezależnie od tego, czy pielęgnacja się odbyła |
| 10A | Higiena światła wieczorem | **OBLIGATORYJNE** | Bez zmian |
| 11 | Mood tracker (2×/dzień) | **OBLIGATORYJNE** | Bez zmian, dotyczy też niedzieli |
| 12 | Badania medyczne | **OBLIGATORYJNE w sensie cyklu, nie wykonania** | **ZMIANA (Runda #14):** wcześniej zero remindera — teraz kwartalne, miękkie przypomnienie "czy pora na kontrolę", ale nie ma twardego wymogu wykonania w danym kwartale (nie karane HP za brak wizyty, tylko przypomina o cykliczności) |
| 15/16 | Auto / Motocykl | OPCJONALNE | Bez zmian, cykliczne przypomnienia, nie codzienne bloki |
| 17 | Zakupy 70/30 | OPCJONALNE | Bez zmian |
| 18 | Portfolio Figurek — bloki tworzenia | OPCJONALNE | Bez zmian (hybryda z Rundy #12) |
| 18b | Portfolio Figurek — checklist publikacji | **OBLIGATORYJNE** | Bez zmian (hybryda z Rundy #12) |
| 19 | Nicnierobienie / Czas wolny | OPCJONALNE, bez remindera | **ZMIANA STRUKTURALNA (Runda #14):** Nicnierobienie i "czas wolny" są tym samym pojęciem, nie dwoma sąsiadującymi kategoriami — patrz Moduł 19 zaktualizowany |

**Niedziela — zasada specjalna (Runda #14):** Niedziela jest lżejsza, ale NIE jest pełnym resetem. Suplementy, posiłki i mood tracker POZOSTAJĄ obligatoryjne każdego dnia, w tym w niedzielę — to zdrowotne minimum niezależne od dnia tygodnia. **Wyłącznie Trening i Sprzątanie są zwolnione z obowiązkowości w niedzielę** (niedziela nigdy nie była dniem treningowym z racji stałych dni Wt/Czw/Sob, więc w praktyce ta zasada głównie zwalnia z floora sprzątania 15 min — jedyny realny "obowiązek domowy" w pozostałe dni). Pielęgnacja i Rozciąganie zachowują swój zwykły status (odpowiednio opcjonalne-ale-zaplanowane i obligatoryjne) również w niedzielę, bez specjalnego zwolnienia.

### MODUŁ 1: SUPLEMENTACJA
- **Zakres — DWIE KATEGORIE (status finalnie doprecyzowany w Rundzie #17):**
  - **Suplementy RDZENNE (codzienne, OBLIGATORYJNE):** Kreatyna, KFD Vita Pak, KFD Kolagen Plus, KFD Ultra Omega 3 Plus
  - **Melatonina — WARUNKOWA (Runda #17: cofnięcie zmiany z Rundy #14).** Max 5 kapsułek/noc (limit twardy w polu numerycznym). Brana "w razie potrzeby", trackowana WYŁĄCZNIE gdy faktycznie zażyta — **bez odwrotnego pola "nie była potrzebna"**, bo to zafałszowywałoby dane o realnym zażyciu (świadoma decyzja Arka). Nie wlicza się do % ukończenia dnia, nie podlega karze HP
  - **KFD X Gainer — OBLIGATORYJNY w dni treningowe (bez zmian od Rundy #14),** traktowany jako osobny punkt żywieniowy, nie suplement poranny (patrz niżej)
- **Częstotliwość:** Codziennie (rdzenne), w dni treningowe (Gainer), w razie potrzeby wieczorem (Melatonina)
- **Forma:** Checklist z checkboxami (✓/✗ per suplement) + reminder godzinowy — suplementy rdzenne i Gainer mają aktywne przypomnienie wpływające na HP; Melatonina ma przypomnienie wyłącznie informacyjne (nie karane)
- **Godziny przypomnień:**
  - Rano (po przebudzeniu, ok. 30 min): Kreatyna, Vita Pak, Kolagen, Omega 3
  - Melatonina: informacyjne przypomnienie wieczorem, pole liczbowe (max 5), bez wpływu na HP
  - Gainer: osobny slot "posiłek treningowy" — RANO, ZARAZ PO TRENINGU (nie w dni nietreningowe). W dniach treningowych to de facto 6. punkt żywieniowy dnia, dodatkowy do 5 głównych posiłków (patrz Moduł 4)
- **Kreatyna — uwaga GI (po analizie research — sekcja 0.6.G):** Kreatyna jest udokumentowaną przyczyną rozwolnienia przy jednorazowej dużej dawce, niedostatecznym nawodnieniu lub przyjmowaniu na czczo — istotne przy nawracających problemach GI Arka. Ustalona logika: w **dni treningowe** — pora przyjęcia luźna (może być z posiłkiem lub gainerem, mniejsze ryzyko dzięki aktywności); w **dni nietreningowe** — pora optymalna, czyli świadomie z posiłkiem (nie na czczo), by zminimalizować ryzyko podrażnienia. System oznacza w checkliście, czy kreatyna została przyjęta z posiłkiem czy osobno — dane te zasilają Moduł 14 (AI Coach) jako jeden z czynników do wykluczenia przy analizie epizodów GI
- **Nawodnienie:** Prosty checkbox dzienny "piłem dziś wystarczająco" — bez konkretnego celu litrażowego. Wliczany do Atrybutu Dyscyplina
- **Tracking:** Dzienny checklist, widoczny w historii tygodniowej jako % ukończenia (suplementy rdzenne + Gainer wliczane do %; Melatonina trackowana osobno, informacyjnie, poza % ukończenia — Runda #17)
- **Gamifikacja:** +1 punkt za każdy zaznaczony suplement, streak (dni z rzędu 100%)

### MODUŁ 2: TRENING (połączony z dawnym Modułem 3 — Runda #14)

**ZMIANA STRUKTURALNA (Runda #14):** Arek zauważył, że bloki "FBW" i "kardio/mobilność" w praktyce zawsze występują razem jako jedna sesja, o niespójnej długości w różnych szablonach dnia. Zdecydował: **to ma być JEDEN moduł, nazwany po prostu "Trening"**, o STAŁEJ długości — **zawsze dokładnie 1h treningu + 15 min pielęgnacji potreningowej = 1h15 łącznie**, niezależnie od typu dnia. Dawny Moduł 3 (Kardio+Mobilność) przestaje istnieć jako osobna pozycja — jego treść (kettlebell, mobilność bioder/barków pod BJJ/Boks) jest teraz integralną częścią struktury sesji treningowej poniżej.

- **Zakres:** Powrót po 2-letniej przerwie. **3x/tydzień OD RAZU** (Runda #5) — Arek świadomie wybrał wyższą częstotliwość startową niż sugerował pierwotny plan
- **Dni treningowe: STAŁE — Wtorek + Czwartek + Sobota**, niezależnie od typu zmiany w pracy. Ustalane raz w niedzielnej sesji miesięcznej przy wgrywaniu nowego grafiku (patrz sekcja 0.7) — sam układ dni tygodnia jest stały, konkretne godziny w ramach dnia dostosowują się do typu dnia (Szablon A/B/C). **Sobota pracująca (Runda #10):** trening trzyma się Szablonu A/B, dopasowany do realnych godzin tej konkretnej pracującej soboty
- **Status: OBLIGATORYJNY** w dni treningowe (patrz Sekcja 2.0), z pełną mechaniką HP

**NOWE NARZĘDZIE — Modyfikacja/wymiana treningu (Runda #14, nowy wymóg):** Arek zażądał możliwości zmiany zaplanowanego treningu na dany dzień — nie każda sesja musi być FBW A/B. System potrzebuje:
- **Wyboru typu sesji przy starcie treningu danego dnia:** domyślnie proponowany FBW wg rotacji A/B (patrz niżej), ale z opcją podmiany na: (a) inny zapisany wariant treningowy (do zdefiniowania przez Arka — miejsce w bibliotece na dodatkowe plany poza A/B), (b) sesję z biblioteki CrossFit (gdy zostanie dostarczona — patrz niżej), (c) sesję opisaną ręcznie ad-hoc (pole tekstowe/lista ćwiczeń wpisana na bieżąco, dla dni gdy Arek chce zrobić coś zupełnie innego)
- **Wpływ na progresję i regułę plateau:** śledzenie progresji (patrz niżej) jest przypisane do KONKRETNEGO ćwiczenia, nie do "dnia treningowego" jako całości — więc podmiana sesji na inny trening nie zaburza trackingu progresji dla ćwiczeń z planu A/B, po prostu tamten dzień nie dodaje do niej danych. Reguła plateau (3 sesje bez progresu) liczy KOLEJNE WYSTĄPIENIA danego ćwiczenia, nie kolejne dni treningowe — więc podmiana sesji naturalnie wydłuża odstęp między pomiarami tego ćwiczenia, co system powinien uwzględniać (nie liczyć "3 sesje bez progresu" jeśli w międzyczasie ćwiczenie w ogóle nie wystąpiło)
- **Cel funkcjonalny:** to daje Arkowi elastyczność (np. dzień na czystą mobilność pod BJJ, dzień testowy nowego planu) bez łamania rigid-systemu — obligatoryjność dotyczy FAKTU treningu tego dnia (jakikolwiek trening, żeby HP nie spadło), nie sztywnego trzymania się wyłącznie planu A/B

**NOWY STATUS — Trening zmodyfikowany z powodu zdrowia (Runda #17, nowy wymóg):** Obok pełnej sesji i wymiany na inny trening, dochodzi trzeci status do wyboru przy odhaczaniu dnia treningowego: **"zmodyfikowany — ograniczenie zdrowotne"**. Zalicza obligatoryjność dnia treningowego (HP nie spada), NIE zużywa limitowanego GOD_MODE_24H (sekcja 4.1a), i NIE liczy się do progresji ciężaru ani do reguły plateau (analogicznie do podmiany sesji). Przy wyborze tego statusu Arek wskazuje powód z listy najczęstszych (rozszerzalnej): zdrowie/kontuzja, zmęczenie, złe samopoczucie, inne (pole tekstowe). Lista powodów zasila w przyszłości Moduł 14 (AI Coach) jako dodatkowy kontekst korelacyjny.

- **Rotacja treningowa domyślna (3 dni/tydzień, 2 warianty planu):** Trening A i B naprzemiennie, z powtórką A jako trzeci dzień — **Tydzień 1: Wt=A, Czw=B, Sob=A. Tydzień 2: Wt=B, Czw=A, Sob=B.** (Rotacja ciągła A-B-A-B-A-B..., niezależna od podziału na tygodnie kalendarzowe)
- **Gotowy plan startowy użytkownika (do wpisania wprost do modelu danych, sekcja 7):**

  **Trening A:**
  | Ćwiczenie | Serie | Powtórzenia | Przerwa |
  |---|---|---|---|
  | Przysiad ze sztangą | 3 | 8-10 | 90 sek |
  | Wyciskanie sztangi na ławce płaskiej | 3 | 8-10 | 90 sek |
  | Wiosłowanie sztangą w opadzie | 3 | 8-10 | 90 sek |
  | Wyciskanie hantli nad głowę (stojąc) | 2 | 10-12 | 60 sek |
  | Plank | 3 | 30-45 sek | 45 sek |

  **Trening B:**
  | Ćwiczenie | Serie | Powtórzenia | Przerwa |
  |---|---|---|---|
  | Martwy ciąg rumuński | 3 | 8-10 | 90 sek |
  | Wyciskanie hantli na ławce skośnej | 3 | 10-12 | 60 sek |
  | Wiosłowanie hantlą jednorącz | 3 | 10-12 | 60 sek |
  | Wyciskanie sztangi nad głowę (OHP) | 2 | 12 | 45 sek |
  | Dead bug | 3 | 8-10 / stronę | 45 sek |

  **Uwaga projektowa o obciążeniu treningowym:** Plan A/B został zaprojektowany jako program 2x/tydzień dla początkujących/wracających po przerwie. Przechodząc od razu na 3x/tydzień, Arek trenuje każdą grupę mięśniową relatywnie częściej niż zakładał oryginalny plan — wciąż w bezpiecznych granicach (research sekcja 0.6.A: 2-3x/tydzień na grupę mięśniową jako optymalne), ale tempo wejścia jest bardziej agresywne niż standardowa progresja "dla wracających po 2-letniej przerwie" — stąd istotna jest **Reguła plateau** poniżej jako wczesny system ostrzegawczy przed przetrenowaniem, nie tylko przed stagnacją
  **Progresja (reguła automatyczna):** Gdy wszystkie serie danego ćwiczenia osiągną górny zakres powtórzeń z prawidłową techniką → system sugeruje +2,5 kg (sztanga) lub +1 kg (hantle) na następną sesję tego ćwiczenia
  **Reguła plateau (po analizie research — sekcja 0.6.A):** Gdy dane ćwiczenie nie notuje progresji ciężaru/objętości przez 3+ kolejne WYSTĄPIENIA tego ćwiczenia (nie kalendarzowe dni — patrz uwaga o podmianie sesji wyżej), system pokazuje SUGESTIĘ (nie automatyczną zmianę): *"Brak progresu na [ćwiczenie] od 3 wystąpień — rozważ: (a) zamianę na ćwiczenie zbliżone na 4-6 tygodni, (b) tydzień redukcji obciążenia (deload), (c) kontynuację bez zmian"*. Arek podejmuje decyzję ręcznie
  **Milestone:** Checkpoint w 8. tygodniu — przegląd progresji wszystkich ćwiczeń i decyzja, czy dodać czwarty dzień treningowy lub zwiększyć objętość

- **Struktura sesji treningowej — STAŁA DŁUGOŚĆ 1h15 (Runda #14, zmiana kluczowa):**
  1. Rozgrzewka (checkbox "zrobiona", w ramach godziny treningu)
  2. Właściwy trening (FBW A/B wg rotacji, LUB podmieniona sesja — patrz narzędzie wymiany wyżej) — lista ćwiczeń z polami do wypełnienia (seria × powtórzenia × ciężar), pre-wypełnione wartościami z poprzedniej sesji
  3. Kardio z kettlami na mobilność (zawsze na koniec właściwego treningu, w ramach tej samej godziny) — ukierunkowane na biodra/barki pod przyszłe BJJ/Boks (typowe ograniczniki ruchowe w tych sportach — patrz research sekcja 0.6)
  4. **Pielęgnacja potreningowa — 15 min, ZAWSZE bezpośrednio po treningu, oddzielny blok od reszty pielęgnacji dziennej** (prysznic, podstawowa regeneracja) — to nie to samo co poranna/wieczorna pielęgnacja z Modułu 7, to osobny, stały dodatek do bloku treningowego
  5. Gainer (zaraz po treningu, patrz Moduł 1) — poza godziną 1h15, jako osobny punkt żywieniowy
- **Rozciąganie/joga (Moduł 10):** W dni treningowe NIE jest już częścią tego bloku (wcześniej było "łączone z sesją") — Rozciąganie ma teraz własne, stałe miejsce w harmonogramie porannym (patrz Moduł 10 zaktualizowany, Runda #14), niezależnie od tego, czy dany dzień jest treningowy
- **Źródło ćwiczeń mobilności:** Arek dysponuje własną, spisaną bazą treningów mobilnościowych/kondycyjnych od head coacha CrossFit — **do dostarczenia i włączenia jako biblioteka ćwiczeń** (patrz sekcja 8, punkt otwarty; również źródło dla opcji (b) w narzędziu wymiany treningu wyżej). Do czasu dostarczenia, system korzysta z ogólnych rekomendacji mobilności bioder/barków jako placeholder. **Potwierdzone w Rundzie #17: start systemu świadomie BEZ tej biblioteki — dołączenie odroczone na później, bez wyznaczonego terminu, nie blokuje żadnej fazy budowy.**
- **Poziom trackingu:** PEŁNY — ćwiczenie, liczba serii, liczba powtórzeń, ciężar (kg), **ocena „jak poszło" w skali 1-10 (pole obowiązkowe przy każdej sesji — Runda #17, wcześniej opcjonalne jako "RPE/odczucia")**, notatka tekstowa opcjonalna; dla kardio/mobilności — czas trwania, subiektywna intensywność (1-10), rodzaj ćwiczeń
- **Edytowalny plan treningowy (Runda #17, nowy wymóg):** Arek potrzebuje prostego narzędzia do samodzielnej edycji planu (nie tylko sztywnego A/B wpisanego raz) — zestawienie: nazwa ćwiczenia (pole edytowalne) | liczba serii | liczba powtórzeń, z możliwością dodawania/usuwania/zmiany pozycji. W codziennym odhaczaniu sesji te pola uzupełniają się o ciężar, ocenę 1-10 i uwagi (patrz wyżej)
- **Progresja:** System pokazuje dla każdego ćwiczenia wykres ciężaru/objętości w czasie (progressive overload tracking), z automatyczną sugestią progresji
- **Wykresy:** Liniowy wykres ciężaru na ćwiczenie w czasie; wykres słupkowy liczby treningów/tydzień
- **Faza przyszła:** BJJ (start docelowo za ≤6 mies.), Boks (po BJJ) — na razie "future milestone" bez aktywnego trackingu (Moduł 13)

### MODUŁ 4: DIETA (bez liczenia kcal/makro)
- **Filozofia:** Nawyki, nie restrykcje. Cel: sucha masa (stąd gainer), ale bez liczenia.
- **Kierunki jakościowe (poprawione po analizie research — sekcja 0.6.E):**
  - **Ograniczenie węglowodanów PROSTYCH** (słodycze, białe pieczywo, przetworzone płatki — powodują skoki i spadki cukru nasilające objawy ADHD), **NIE węglowodanów ZŁOŻONYCH** (pełne ziarna, warzywa strączkowe, kasze — te są zalecane, bo stabilizują poziom energii). To istotna korekta względem pierwotnego, zbyt ogólnego założenia "ograniczenie węglowodanów"
  - Więcej warzyw i owoców
  - Minimalizacja przetworzonej żywności
  - Ograniczenie cheat meals/cheat days
  - **Nacisk na białko w Posiłku 1 (nowe, po analizie research):** Posiłek poranny bogaty w białko wspiera produkcję dopaminy/noradrenaliny i stabilizuje skupienie na starcie dnia — to ogólna wskazówka jakościowa (np. widoczna jako podpowiedź przy Posiłku 1 w checkliście), nie konkretny przepis, więc nie łamie zasady "brak sugerowanych dań"
- **Struktura:** 5 posiłków dziennie — **ZMIANA FORMY (Runda #14): remindery, nie sztywne bloki czasowe w harmonogramie.** Każdy posiłek to osobne powiadomienie ("czas na posiłek X") z orientacyjnym oknem czasowym pokazanym w widoku dnia (np. "Posiłek 2: ok. 10:30") — Arek odhacza w momencie faktycznego zjedzenia, bez sztywnego 30-minutowego bloku, który wcześniej sztucznie zajmował miejsce w harmonogramie. To rozwiązuje problem zaobserwowany przy szkicu tygodnia: krótkie bloki czasowe nie mieściły czytelnych etykiet i wizualnie "znikały" — jako reminder ten problem nie występuje
- **Orientacyjny schemat 5 pór (godziny jako punkt odniesienia dla reminderów, nie twarde okna):**
  - Dzień A (praca 8:30–15:30, pobudka 7:00): Posiłek 1 (ok. 7:30) → Posiłek 2 (ok. 10:30) → Posiłek 3 (ok. 13:30) → Posiłek 4 (ok. 16:30) → Posiłek 5 (ok. 19:30)
  - Dzień B (praca 12:00–20:00, pobudka 8:00): Posiłek 1 (ok. 8:30) → Posiłek 2 (ok. 11:00) → Posiłek 3 (ok. 14:00) → Posiłek 4 (ok. 17:00) → Posiłek 5 (ok. 20:30)
  - Dzień wolny (pobudka 8:00): pory elastyczne wokół treningu, orientacyjnie co 3h od pobudki
  - **W dni treningowe:** dodatkowy 6. punkt żywieniowy — Gainer, zaraz po treningu (patrz Moduł 1)
- **Status: OBLIGATORYJNE** (patrz Sekcja 2.0), każdego dnia w tygodniu włącznie z niedzielą
- **Ważne — brak sugestii dań:** System NIE proponuje konkretnych posiłków/przepisów. Arek gotuje sam i planuje zakupy samodzielnie — checklist rejestruje wyłącznie fakt spożycia, bez ingerencji w wybór jedzenia
- **Powiązanie z GI issues:** Lekkie przypomnienie o zachowaniu odstępu między posiłkiem a treningiem (np. "unikaj ciężkiego posiłku <60 min przed treningiem") — jako pasywna wskazówka. Gdy w Module 11 (Mood Tracker) zgłoszone zostanie rozwolnienie, system retrospektywnie odwołuje się do checklisty posiłków tego dnia jako kontekstu
- **Tracking:** 5 reminderów dziennie (zjadłem posiłek 1/2/3/4/5: tak/nie) + osobny reminder Gainer w dni treningowe, bez pól kalorycznych

### MODUŁ 5: CZYTELNICTWO (książki + audiobooki + komiksy)
- **Cel:** 1h dziennie
- **Status: OBLIGATORYJNE (ZMIANA, Runda #14)** — wcześniej (Moduł 20) traktowane wyłącznie przez rolling-average bez twardego dziennego wymogu; Arek świadomie zmienił na codzienny obowiązek z pełną mechaniką HP. Rolling-average (średnia 7-dniowa) nadal liczona i widoczna jako dodatkowy kontekst jakościowy, ale HP reaguje już na sam fakt zera danego dnia, nie czeka na spadek średniej
- **Format:** Audiobooki (preferowane, ADHD-friendly) + książki fizyczne + komiksy
- **Integracja:** Sloty audiobooków przypisane do naturalnych okazji — dojazdy/dni pracy, spacery z psem, wieczorny czas wyciszenia
- **Tracking:** PODWÓJNY
  - Minuty dziennie (cel: 60 min, pasek postępu dzienny)
  - Tytuły — lista książek/audiobooków w trakcie i ukończonych, % ukończenia danej pozycji
- **Gamifikacja:** Punkty za minuty, bonus za ukończoną książkę/audiobook

### MODUŁ 6: SPACER Z PSEM
- **Status: OPCJONALNE, bez remindera** — potwierdzone ponownie w Rundzie #14 (Arek rozważył zmianę na obligatoryjne, po czym świadomie wrócił do pierwotnej decyzji)
- **Częstotliwość:** 2–3x dziennie, max 1h każdy
- **Forma:** BRAK REMINDERA (świadoma decyzja Arka — "sam wiem, że muszę", odpowiedzialność dzielona z innymi domownikami, nie zawsze robi to sam)
- **Tracking:** Prosty checkbox "spacer 1/2/3" w widoku dnia — dla kompletności obrazu dnia i historii, ale bez powiadomienia wypychającego i bez wpływu na HP
- **Rola w systemie:** Traktowany też jako naturalna okazja na kontakt z naturą (Moduł 9) i słuchanie audiobooków (Moduł 5)
- **WAŻNE (Runda #14):** Spacer z psem NIGDY nie występuje w tym samym bloku/linii harmonogramu co Pielęgnacja (Moduł 7) — to dwie zupełnie różne czynności i wcześniejsze łączenie ich w Szablonach Dnia ("Spacer z psem / pielęgnacja") było błędem, poprawionym w Sekcji 3

### MODUŁ 7: PIELĘGNACJA I HIGIENA

**ZMIANA STRUKTURALNA (Runda #14):** Ponad dotychczasowy, rozdrobniony harmonogram per-produkt, Arek wprowadził **dwa stałe, nadrzędne sloty pielęgnacyjne w ciągu dnia**, w które wpisują się poszczególne produkty:
- **Slot poranny — max 15 min, TUŻ PRZED WYJŚCIEM DO PRACY, obejmuje prysznik.** W tym oknie mieszczą się: krem do twarzy (slot poranny), guma do włosów, oraz w dni Nizoralu/Ziai (niedziela+środa) — mycie włosów tym szamponem/preparatem
- **Slot wieczorny — max 15 min, PRZED SNEM.** W tym oknie: krem do twarzy (slot wieczorny), krem do rąk (jeden z dwóch dziennych slotów, drugi swobodnie w ciągu dnia)
- **Status: OPCJONALNE, ale ZE STAŁYM KSZTAŁTEM w harmonogramie (Runda #14, dopracowane po wyjaśnieniu sprzeczności):** oba sloty są wpisane do Szablonów Dnia jako stałe pozycje (rano i wieczór), więc są widoczne i przypominane — ale ich pominięcie NIE kosztuje HP. To rozwiązanie pośrednie: pielęgnacja ma swoje stałe miejsce w strukturze dnia (nie jest "zrób kiedy chcesz"), ale nie podlega presji rigid-systemu jak reszta obligatoryjnych modułów
- **WAŻNE:** Pielęgnacja POTRENINGOWA (15 min bezpośrednio po sesji treningowej, patrz Moduł 2) to OSOBNY, trzeci blok pielęgnacyjny — nie zlewa się z porannym/wieczornym slotem opisanym tu. W dni treningowe Arek ma więc potencjalnie 3 momenty pielęgnacyjne: poranny, potreningowy, wieczorny

| Produkt | Częstotliwość | Slot | Uwagi |
|---|---|---|---|
| Krem do rąk | 2x dziennie | Jeden slot dowolny w dzień + slot wieczorny | Elastyczny pierwszy slot, drugi w ramach bloku wieczornego |
| Krem do twarzy | 2x dziennie | Slot poranny + slot wieczorny | Stałe umiejscowienie w obu głównych slotach |
| Preparat Ziaja (pocenie) | 2x w tygodniu | Slot poranny | **Stałe dni: niedziela + środa** |
| Szampon Nizoral | 2x w tygodniu | Slot poranny (przy prysznicu) | **Stałe dni: niedziela + środa** |
| Guma do włosów | Wg potrzeby/stylizacji | Slot poranny | Codzienna rutyna w ramach porannego slotu, nietrackowana osobno |
| Fryzjer | Min. 1x/3 tygodnie | — (osobny, nie codzienny slot) | Cykliczne przypomnienie co 21 dni od ostatniej wizyty |

- **Tracking:** Checklist per produkt w ramach dwóch głównych slotów + data ostatniej wizyty u fryzjera (licznik dni do kolejnego przypomnienia)
- **Uwaga projektowa:** Grupowanie w dwa stałe sloty (zamiast rozproszonych, niezależnych przypomnień per produkt jak w poprzedniej wersji) upraszcza widok dnia — Arek widzi "Pielęgnacja poranna" i "Pielęgnacja wieczorna" jako dwie karty, z rozwijaną listą aktywnych tego dnia produktów w środku (zgodnie z ogólnym wzorcem UI "cała oś + zwijane szczegóły", Sekcja 6.1)

### MODUŁ 8: SPRZĄTANIE (SEGMENTOWE)
- **Filozofia:** Rotacyjna ścieżka dzienna — każdy dzień inny segment mieszkania, plus globalne sprzątanie w weekend. Robot sprzątający przejmuje codzienne odkurzanie/mopowanie podłóg — checklist segmentowy skupia się na tym, czego robot nie robi (blaty, czyszczenie na mokro poza podłogą, porządkowanie, kurz na wysokości)
- **Zakres mieszkania (potwierdzony):** Duży pokój z kuchnią, Sypialnia, Pokój komputerowy (dwa OSOBNE pomieszczenia, nie "sypialnia 1/2"), pomieszczenie gospodarcze, łazienka, przedsionek + klatka schodowa (mieszkanie dwupoziomowe)
- **Robot sprzątający:** Harmonogram 2x dziennie, odkurzanie + mopowanie (może być połączone w jednym cyklu, jeśli model robota na to pozwala). Rekomendacja godzin: raz rano po wyjściu domowników (żeby nie przeszkadzał), raz wieczorem/w nocy. Traktowany jako automatyzacja w tle — NIE wymaga codziennego checkboxa od Arka, jedynie comiesięczne przypomnienie o czyszczeniu pojemnika/filtra robota
- **Rotacja tygodniowa (7 dni = 7 stref):**
  - Poniedziałek: Łazienka
  - Wtorek: Kuchnia (część dużego pokoju)
  - Środa: Duży pokój (część mieszkalna)
  - Czwartek: Sypialnia
  - Piątek: Pokój komputerowy
  - Sobota: Pomieszczenie gospodarcze + przedsionek/klatka schodowa
  - Niedziela: Sprzątanie globalne (detale całościowe — robot pokrywa podłogi, człowiek robi resztę)
- **Tracking:** Checkbox dzienny "strefa X — zrobiona", widoczny w tygodniowym review jako mapa ukończenia
- **Elastyczność:** Mimo rigid-system, jeśli dany dzień wypada w dzień pracujący z późną zmianą, system może pokazać zadanie jako "do zrobienia dziś, ale można przesunąć w ramach tygodnia" — to jedyne miękkie odstępstwo, bo dotyczy zadania niezależnego od zdrowia/nawyku

### MODUŁ 9: KONTAKT Z NATURĄ / WYCISZENIE
- **Częstotliwość:** Flexible, reminder 2–3x/tydzień (nie codziennie — świadomy wybór Arka)
- **Cel:** Element ochronny dla zdrowia psychicznego (depresja, ADHD, wyciszenie)
- **Forma:** Miękki reminder (nie agresywny) w dni, gdy system wykrywa, że w ciągu ostatnich 2-3 dni nie było zarejestrowanego wyjścia (może być powiązane ze spacerem z psem — jeśli spacery są robione, naturalnie kontakt z naturą też się odbywa)
- **Tracking:** Checkbox "kontakt z naturą dziś" — może być automatycznie odhaczany, jeśli zarejestrowano spacer z psem

### MODUŁ 10: ROZCIĄGANIE / JOGA
- **Status: OBLIGATORYJNE**
- **Częstotliwość:** Codziennie, 10-15 min
- **Umiejscowienie — ZMIANA (Runda #14):** NIE jest już częścią bloku treningowego (dawniej "na końcu sesji FBW"). Ma teraz własne, stałe miejsce w harmonogramie porannym: **zawsze bezpośrednio PO porannym slocie pielęgnacyjnym (Moduł 7).** Jeśli poranna pielęgnacja tego dnia się nie odbędzie (przypomnijmy: pielęgnacja jest opcjonalna, bez kary HP), rozciąganie i tak następuje zaraz po przebudzeniu — sekwencja "po pielęgnacji" określa KOLEJNOŚĆ gdy oba się dzieją, ale nie czyni rozciągania zależnym od wykonania pielęgnacji. Samo rozciąganie pozostaje obligatoryjne niezależnie od tego, czy pielęgnacja tego dnia się odbyła
- **Tracking:** Checkbox + opcjonalny czas trwania

### MODUŁ 10A: HIGIENA ŚWIATŁA WIECZOREM (nowy, po analizie research — sekcja 0.6.D)
- **Uzasadnienie:** Konsensusowe wytyczne dla pracowników zmianowych (Delphi 2023, Sleep Foundation) podkreślają wagę ograniczenia jasnego światła/ekranów w oknie 30-60 min przed snem — szczególnie istotne w Dniu B, gdzie koniec pracy o 20:00 zostawia krótkie okno na wyciszenie przed snem
- **Forma:** Manualny checkbox wieczorny "ograniczyłem światło/ekrany przed snem" — automatyczna detekcja przez urządzenie ODRZUCONA (Arek nie posiada smartwatcha, tylko telefon; dane typu Screen Time nie dają wystarczająco precyzyjnej informacji o porze tuż przed snem, by były użyteczne bez dodatkowego sprzętu)
- **Umiejscowienie w dniu:** Ostatni blok wieczorny, tuż przed suplementami wieczornymi/pielęgnacją nocną (patrz Szablony Dnia, sekcja 3)
- **Tracking:** Prosty checkbox, wliczany do Atrybutu Umysł (jako wsparcie jakości snu → pośrednio skupienia)

### MODUŁ 11: MOOD TRACKER / SAMOPOCZUCIE
- **Forma:** Ranking 1-10 w kilku kategoriach (nie notatki tekstowe jako podstawa — wyjątek: warunkowe pole tekstowe opisane niżej)
- **Kategorie (potwierdzone):**
  1. Nastrój ogólny (1-10)
  2. Poziom energii (1-10)
  3. Jakość snu poprzedniej nocy (1-10)
  4. Poziom skupienia/koncentracji dziś (1-10)
  5. Stan żołądkowo-jelitowy / GI (1-10) — **obowiązkowe pole, z funkcją follow-up (patrz niżej)**
- **Częstotliwość: DWA wpisy dziennie — rano i wieczorem** (zmiana względem wersji 1, gdzie był tylko wieczorny wpis)
  - **Rano:** skupiony na stanie startowym dnia — jakość snu (kat. 3), energia (kat. 2), nastrój (kat. 1)
  - **Wieczorem:** pełny zestaw 5 kategorii, w tym GI i skupienie z całego dnia — zamknięcie dnia
- **Funkcja follow-up GI (nowa, kluczowa, rozszerzona po researchu):** Gdy wieczorny wpis GI (kat. 5) spadnie poniżej ustalonego progu (robocza propozycja: ≤4/10, do potwierdzenia przez Arka), system pokazuje dodatkowe pole tekstowe: *"Co jadłeś w ciągu ostatnich 48 godzin? (opisz krok po kroku, dzień po dniu)"*. Zmiana względem wersji 1: pytanie obejmuje nie tylko dany dzień, ale retrospektywnie 48h wstecz — zgodnie z kliniczną praktyką food-symptom diary (patrz sekcja 0.6.C), gdzie objawy GI mogą pojawić się z opóźnieniem do 48h po spożyciu. Wpis pozostaje jednorazowy, wieczorny (nie real-time po każdym posiłku — świadomy wybór Arka, by nie przerywać dnia). Odpowiedź to swobodna notatka tekstowa, zapisywana z powiązaniem do daty zgłoszenia. To JEDYNE miejsce w systemie z notatką tekstową — celowo warunkowe, nie codzienne, żeby nie zaprzeczać ogólnej zasadzie "ranking, nie dziennik"
- **Wykorzystanie danych:** Wykres trendu w tygodniowym review — korelacja z realizacją innych modułów (np. czy dni z niższym mood mają niższą realizację checklisty). Dane GI + notatki żywieniowe stanowią wejście dla Modułu 14 (AI Coach, Faza 2)

### MODUŁ 12: BADANIA I KONTROLA MEDYCZNA
- **Zakres:** Badania krwi, wizyta kontrolna u lekarza
- **Status: OBLIGATORYJNE W SENSIE CYKLU, NIE WYKONANIA (ZMIANA, Runda #14)** — wcześniej zero remindera; Arek zmienił na kwartalne, miękkie przypomnienie "czy pora na kontrolę". WAŻNE rozróżnienie: to nie jest twardy wymóg wykonania badań w danym kwartale (nie kosztuje HP, jeśli Arek akurat nie pójdzie) — to cykliczny NUDGE, systemowe przypomnienie o samej potrzebie rozważenia kontroli, żeby temat nie umknął całkowicie z pola widzenia na miesiące
- **Forma:** Kwartalne powiadomienie (co ok. 90 dni) z pytaniem/przypomnieniem, bez wymogu potwierdzenia wykonania
- **Tracking:** Sekcja w systemie jako "do zrobienia" (evergreen task), odhaczana ręcznie po wykonaniu, z datownikiem — data ostatniego badania resetuje licznik do następnego kwartalnego przypomnienia

### MODUŁ 13: BJJ / BOKS (FUTURE PLANNING)
- **Status:** Nieaktywne w bieżącym trackingu
- **Forma:** Pole "milestone przyszły" — widoczne np. w widoku miesięcznym/kwartalnym jako cel odległy ("BJJ start: [data docelowa ≤ marzec 2027]"), bez codziennego trackingu
- **Aktywacja:** Moduł "uśpiony", do włączenia ręcznie przez Arka gdy zdecyduje się zapisać na zajęcia

### MODUŁ 14: AI COACH (FAZA 2 — nie wchodzi do MVP)
- **Status:** Świadomie odłożony poza pierwszą wersję systemu. Opisany tu w pełni, by model danych (sekcja 7) był od początku zaprojektowany pod przyszłą analizę, nawet gdy sama warstwa AI jeszcze nie działa.
- **Cel:** Cotygodniowa (przy niedzielnym review) prezentacja automatycznie wykrytych korelacji między modułami, na podstawie własnych, historycznych danych Arka.
- **Twarda granica etyczna/bezpieczeństwa:** System wykrywa i opisuje **korelacje**, nigdy nie stawia **diagnoz**. Dozwolone sformułowania: "W dni, w które zjadłeś [produkt X], rozwolnienie wystąpiło w 4 z 5 przypadków" lub "W tygodnie z 4 treningami Twój średni poziom nastroju był o 1.5 pkt wyższy niż w tygodnie z 1-2 treningami". Zabronione: jakiekolwiek sformułowania sugerujące diagnozę medyczną ("masz nietolerancję laktozy", "cierpisz na X") — te zawsze wymagają konsultacji lekarskiej, system może najwyżej zasugerować "rozważ konsultację z lekarzem, jeśli wzorzec się powtarza".
- **Zakres analizy:** CAŁY system — nie tylko dieta/GI. Przykładowe typy korelacji do wykrywania:
  - Dieta ↔ GI (na podstawie notatek tekstowych z Modułu 11 i checklisty posiłków z Modułu 4)
  - Sen ↔ Nastrój/Energia (na podstawie Modułu 11, kategorie 2-3)
  - Trening ↔ Nastrój (częstotliwość FBW z Modułu 2 vs. trend nastroju z Modułu 11)
  - Czytelnictwo/wyciszenie ↔ Jakość snu
  - Realizacja checklisty ogólnej ↔ Mood (czy "dobre dni" systemowo korelują z lepszym samopoczuciem)
- **Warunek startu:** Moduł uruchamiany dopiero gdy zgromadzone jest minimum 4-6 tygodni codziennych danych — wcześniej korelacje są statystycznym szumem, nie sygnałem. System (lub Arek ręcznie) powinien to blokować/ukrywać do czasu zebrania wystarczającej historii.
- **Wymagania techniczne (do etapu implementacji):** Podłączenie modelu AI (np. przez Anthropic API) analizującego dane z arkusza cyklicznie (raz w tygodniu, przy generowaniu review). Wymaga zaprojektowania promptu z jasnymi ograniczeniami (brak diagnoz, tylko korelacje z danych, ton wspierający nie alarmistyczny) oraz mechanizmu przekazania danych (eksport z Google Sheets → API → wynik z powrotem do arkusza/UI).

### 2.1 WZORZEC PROJEKTOWY: TAGI KATEGORII + FLOOR/CEILING (nowy, zgłoszony przez Arka — Runda #7)

Arek zaproponował własny, ogólny mechanizm, który wykracza poza jeden moduł i powinien być stosowany wszędzie, gdzie pasuje: **zadania z różnych modułów mogą dzielić wspólny tag kategorii, a każda kategoria ma dolny limit (floor — minimum, które trzeba wykonać) i górny sensowny limit (ceiling — powyżej którego nie warto/nie trzeba iść, żeby nie "zjadło" reszty dnia)**.

**Przykład źródłowy od Arka:** odkurzanie mieszkania i czyszczenie samochodu to różne moduły, ale oba oznaczone tagiem `#sprzątanie`. Jeśli dnia zabraknie na oba, zrobienie jednego z nich w wymiarze **min. 15 min** zalicza dzienny floor kategorii `#sprzątanie`, a system nie oczekuje więcej niż **maks. 60 min** łącznie w tym tagu tego dnia — reszta czasu idzie na inne kategorie.

**Zastosowanie wzorca w całym systemie (zidentyfikowane miejsca, gdzie pasuje):**
| Tag kategorii | Floor (min/dzień) | Ceiling (max/dzień) | Moduły objęte |
|---|---|---|---|
| `#sprzątanie` | 15 min | 60 min | Moduł 8 (Sprzątanie mieszkania) + Moduł 16 (Auto — mycie) |
| `#samorozwój` | 15 min (jako rolling average, patrz Moduł 20) | brak twardego ceiling, ale system flaguje >2h jako nietypowe | Moduł 5 (Czytelnictwo), Moduł 7 (Pielęgnacja — potraktowana jako część samorozwoju/dbania o siebie), Moduł 18 (Portfolio Figurek — praktyka) |
| `#ruch` | wynika z planu treningowego (patrz Moduł 2/3/10) | naturalny ceiling = koniec zaplanowanej sesji | Moduł 2 (FBW), Moduł 3 (Kardio/Mobilność), Moduł 10 (Rozciąganie/Joga), Moduł 6 (Spacer z psem) |

**Zasada ogólna dla przyszłych modułów:** przy projektowaniu każdego nowego elementu systemu, pytanie "czy to pasuje pod istniejący tag, czy potrzebuje nowego" powinno być zadawane od razu — to redukuje liczbę osobnych, sztywnych wymagań czasowych i zamienia je w elastyczne, ale wciąż mierzalne budżety kategorii. To bezpośrednio wspiera filozofię ADHD-friendly (mniej sztywnych, osobnych zadań = mniej okazji do paraliżu decyzyjnego), a jednocześnie zachowuje rigid-system (bo floor jest twardym minimum wliczanym do HP).

### MODUŁ 15: AUTO
- **Zakres:** Samochód, użytkowany cały rok (w przeciwieństwie do motocykla, patrz Moduł 16)
- **Częstotliwość opieki:** Miesięczny przegląd ogólny — mycie, sprawdzenie poziomów płynów, podstawowa kontrola wzrokowa
- **Forma:** Cykliczne przypomnienie (co ok. 30 dni od ostatniego wykonania, z polem "data ostatniego przeglądu" jako trigger, podobnie jak fryzjer w Module 7)
- **Tag kategorii:** `#sprzątanie` (mycie auta dzieli budżet czasowy ze sprzątaniem mieszkania — patrz sekcja 2.1)
- **Tracking:** Checkbox miesięczny + data ostatniego wykonania + opcjonalna notatka (np. "wymiana oleju za 2 miesiące")

### MODUŁ 16: MOTOCYKL
- **Zakres:** Motocykl, użytkowany sezonowo (wiosna–jesień), nieużywany w sezonie zimowym
- **Przypomnienia sezonowe (2x rocznie, kluczowe momenty):**
  - **Wiosna (marzec/kwiecień, dokładny miesiąc do potwierdzenia z lokalnym klimatem):** "Czas na wiosenne przygotowanie motocykla" — przegląd po zimowym przestoju (akumulator, opony, płyny, ogólna sprawność)
  - **Jesień (październik/listopad):** "Czas odłożyć motocykl na zimę" — przygotowanie do przechowywania (konserwacja, akumulator, itd.)
- **Przypomnienie comiesięczne W SEZONIE (dodatkowe, poza sezonowymi):** Kontrola bieżąca — łańcuch, ciśnienie w oponach — co ok. 30 dni w oknie wiosna-jesień, automatycznie wyłączone poza sezonem
- **Tag kategorii:** `#sprzątanie` / konserwacja pojazdów, podobnie jak Moduł 15, ale osobno trackowane ze względu na sezonowość
- **Tracking:** Checkbox sezonowy (2x/rok) + checkbox comiesięczny (tylko w sezonie) + daty ostatnich wykonań
- **Uwaga projektowa:** To pierwszy w całym systemie moduł z logiką sezonową (włącz/wyłącz przypomnienia zależnie od pory roku) — model danych musi to uwzględniać (pole "aktywny_w_sezonie" sprawdzane przy generowaniu Szablonów Dnia/przypomnień)

### MODUŁ 17: ZAKUPY SPOŻYWCZE (Core żywieniowy — rekomendacje 70/30)
- **Częstotliwość:** Cotygodniowe, większe zakupy — slot ELASTYCZNY w tygodniu (nie stały dzień/godzina — Arek robi je "kiedy wychodzi")
- **Filozofia rekomendacji — zasada 70/30 (kluczowa, zgłoszona przez Arka):** System nie utrzymuje jednej stałej listy produktów. Zamiast tego, dla każdej z czterech kategorii core (Białko, Węglowodany złożone, Warzywa i owoce, Nabiał/zamienniki) generuje rekomendacje produktów w proporcji:
  - **70% — najczęściej rekomendowane, sprawdzone źródło** danego makroskładnika/kategorii (np. dla białka: kurczak, indyk, jaja — produkty o wysokiej biodostępności, niskim koszcie, łatwej dostępności w dyskoncie)
  - **30% — produkty rotujące, przełamujące rutynę** żywieniową (np. zamiast kurczaka: tofu, ryba, soczewica) — dobierane tak, by co tydzień/dwa tygodnie pojawiała się przynajmniej jedna nowa propozycja w każdej kategorii, zapobiegając monotonii (co wspiera też cel "pozytywne nawyki żywieniowe, nie restrykcje" z Modułu 4)
  - Kategorie core: **Białko** (kurczak, indyk, ryby, jaja + rotacja: tofu, strączkowe, owoce morza), **Węglowodany złożone** (ryż, kasze, pełnoziarniste pieczywo + rotacja: komosa ryżowa, bataty, pełnoziarniسty makaron), **Warzywa i owoce** (sezonowe, rotujące z natury), **Nabiał/zamienniki** (jogurt naturalny, twaróg, kefir + rotacja: napoje roślinne, sery alternatywne)
- **Przypomnienie Aldi (ograniczenie techniczne — patrz sekcja 0.6 rozszerzona niżej):** Aldi Polska nie udostępnia publicznego API ani ustrukturyzowanych danych o promocjach — gazetki są dystrybuowane jako obrazy/PDF przez social media i WhatsApp, bez oficjalnego dostępu programistycznego. Automatyczne dopasowanie listy zakupów do aktualnej oferty wymagałoby web scrapingu, co jest technicznie kruche (strona może się zmienić) i na granicy zasad serwisu. **Rozwiązanie przyjęte:** prosty manualny reminder w checkliście zakupowej — "Sprawdź aktualną gazetkę Aldi przed wyjściem" — Arek sam ocenia, czy coś z rekomendowanej listy 70/30 akurat jest w promocji
- **Tracking:** Cotygodniowa checklist z rekomendacjami (4 kategorie × kilka pozycji każda), odhaczanie kupionych, licznik dni od ostatnich zakupów jako miękki trigger przypomnienia (nie sztywna godzina)

### MODUŁ 18: PORTFOLIO FIGUREK (Personal Brand — Warhammer 40k i pokrewne)

**INTEGRACJA ZE STRATEGIĄ BIZNESOWĄ (Runda #12) — dokument źródłowy:** Arek dostarczył własną, obszerną (67-sekcyjną) "Strategię Budowy Marki Osobistej" opracowaną wcześniej i niezależnie od tego konceptu. Poniższy moduł został zweryfikowany względem tego dokumentu i zaktualizowany tam, gdzie strategia wnosi konkretniejsze lub dokładniejsze wytyczne. Pełna analiza zgodności w sekcji 0.10 (patrz niżej) — tu tylko wnioski operacyjne.

**KLUCZOWA DECYZJA FILOZOFICZNA — hybryda rigid/elastyczny (Runda #12):** Strategia biznesowa (jej sekcja 21) świadomie rekomenduje ELASTYCZNY rytm pracy dla działań budujących markę (bez sztywnych dni tygodnia, ocena sukcesu w cyklu miesięcznym, "system ma prawo być łamany bez poczucia porażki") — to wprost przeciwne do rigid-system z pełną presją HP, który rządzi resztą tego konceptu. Arek rozstrzygnął to świadomie, wybierając **hybrydę**:
- **Bloki tworzenia i nagrywania (malowanie, sklejanie, sesje produkcyjne contentu) — ELASTYCZNE, poza mechaniką HP.** Nie ma sztywnych dni, nie ma kary za pominięcie tygodnia. To zgodne z filozofią strategii biznesowej — presja tutaj byłaby kontrproduktywna dla procesu twórczego i ryzykowałaby dokładnie to, przed czym ostrzega sekcja 21.4 strategii (system stający się źródłem dodatkowej presji zamiast wsparciem)
- **Checklist publikacji (zdjęcie zrobione / opis napisany / opublikowane) — POZOSTAJE RIGID, z pełną mechaniką HP**, tak jak reszta systemu. Uzasadnienie: to nie jest akt tworzenia (podatny na zmienną energię/ADHD), tylko krótkie, mechaniczne dokończenie czegoś, co już powstało — bliżej "checkbox administracyjny" niż "praca kreatywna". Utrzymanie tu presji chroni przed typowym wzorcem "zrobiłem 50 modeli, opublikowałem 3" (dokładnie to, przed czym strategia ostrzega w sekcji 14.3: konsekwencja publikacji ważniejsza niż tempo tworzenia)

- **Kontekst:** Arek pracuje w Neon Forge Studio (głównie sklejanie/budowanie modeli), a równolegle chce budować niezależną markę osobistą (docelowo: samodzielne zlecenia komercyjne, niezależne od pracodawcy). **Zgodnie ze strategią (sekcja 3.1):** to nie jest zmiana kariery, tylko budowanie dodatkowego strumienia dochodu przy zachowaniu etatu — założenie o realistycznym nakładzie czasu 45-90 min/dzień w dni robocze (strategia, sekcja 1) jest zgodne z ustaloną wcześniej elastycznością bloku wieczornego w Szablonach Dnia
- **Poziom umiejętności:** Średniozaawansowany — zna podstawy, doskonali warsztat. **Zgodnie ze strategią (sekcja 3.1):** transfer z "hobbysty" do "profesjonalisty" wymaga przejścia trzech barier — technicznej (powtarzalność na poziomie komercyjnym), tożsamościowej (przejście z "robię dla siebie" na "sprzedaję jako usługę") i systemowej (portfolio, wycena, umowy) — Moduł 18 adresuje głównie barierę systemową (tracking, publikacja); bariery techniczna i tożsamościowa pozostają poza zakresem tego systemu, adresowane przez samą strategię
- **Priorytet umiejętności do rozwoju:** Malowanie (w przeciwieństwie do pracy w NFS, gdzie głównie skleja) — ale **opcjonalne/zmienne w częstotliwości**, bo nie zawsze chce kupować nowe figurki do malowania
- **Trening ręki/oka bez zakupu figurek:** Kolorowanki antystresowe jako substytut praktyki — wliczane do TEGO SAMEGO licznika "czas praktyki" co malowanie figurek (nie osobna kategoria)
- **Kategoryzacja projektów (prosty, nie-żargonowy podział wg rozmiaru/złożoności — CELOWA różnica względem strategii, patrz uwaga niżej):**
  | Kategoria | Opis | Orientacyjny czas (do kalibracji na realnych danych Arka) |
  |---|---|---|
  | Mała figurka | Pojedynczy piechur, prosty model | 1-3h (sklejanie) / 1-3h (malowanie podstawowe) |
  | Średnia figurka | Postać z detalami, większy pojedynczy model | 3-6h / 3-8h |
  | Duża/złożona figurka | Pojazd, duży model, wiele części | 6-15h+ / 8-20h+ |
  | Cały zestaw/oddział | Wiele modeli naraz | Suma czasów pojedynczych modeli × liczba sztuk, z rabatem czasowym za powtarzalność (rutyna przy identycznych elementach) |
  Orientacyjne widełki czasowe oparte na branżowych standardach (komisyjni malarze wskazują: poziom "tabletop" 1-5h/model, poziom "parade/display" 5-20h+/model dla pojedynczych figurek) — **do skalibrowania indywidualnie po pierwszych kilku zarejestrowanych projektach Arka** (patrz tracking poniżej)
  **Uwaga o rozbieżności nazewnictwa (świadoma, nie błąd):** Strategia biznesowa (sekcja 9.2) używa profesjonalnej nomenklatury cenowej "Tabletop+ / Display / Showcase-Centerpiece" jako TIERÓW CENOWYCH dla klientów. To CELOWO inny podział niż kategoryzacja rozmiaru w tym module (Mała/Średnia/Duża/Zestaw) — Arek wcześniej explicite odrzucił żargon branżowy dla swojego OSOBISTEGO trackingu czasu ("nie znam tej nomenklatury, musi być prosto"). Oba podziały mogą współistnieć: kategoryzacja rozmiaru (ten moduł) do szacowania czasu WŁASNEJ pracy, tiery cenowe (strategia) do wyceny dla KLIENTA — to różne osie tego samego projektu, nie sprzeczność do naprawienia
- **Szacowanie czasu PRZED projektem:** Arek wybiera kategorię (Mała/Średnia/Duża/Zestaw) + typ pracy (sklejanie/malowanie/oba) → system pokazuje orientacyjny czas z tabeli powyżej jako punkt odniesienia
- **Tracking PO projekcie:** Rzeczywisty czas wykonania zapisywany i porównywany z szacunkiem (estymowany vs rzeczywisty) — różnica służy do stopniowego kalibrowania przyszłych szacunków pod indywidualne tempo Arka (system może np. zauważyć "Twoje średnie figurki zajmują Ci o 20% dłużej niż orientacyjny szacunek — kolejne szacunki będą korygowane")
- **Umiejscowienie w harmonogramie:** Blok "czas wolny" wieczorem, NIEZALEŻNIE od typu dnia (Szablon A/B/C) — nie ma dedykowanych stałych dni, elastycznie w dostępnym oknie wieczornym. **Zgodne ze strategią (sekcja 21.2):** "typy bloków do rozmieszczenia elastycznie w tygodniu" zamiast sztywnych dni — ten fragment konceptu już wcześniej (przed dostarczeniem strategii) intuicyjnie szedł w tym samym kierunku
- **Tygodniowy budżet czasu:** Elastyczny, bez sztywnego celu godzinowego — dopasowuje się do tego, ile faktycznie zostaje czasu wolnego w danym tygodniu. **Zgodne ze strategią (sekcja 21.4):** horyzont oceny sukcesu to miesiąc, nie tydzień — "tydzień bez bloku" nie jest porażką, jeśli trend miesięczny jest pozytywny
- **Cel portfolio — strategia zamiast liczby (potwierdzone i ROZSZERZONE przez dostarczoną strategię biznesową):** Zamiast sztywnego celu ilościowego, portfolio rozwija się według sprawdzonej strategii budowania marki osobistej:
  1. **Częste, regularne posty** — w tym prace w toku (WIP), nie tylko ukończone modele
  2. **Spójny styl wizualny profilu** — jednolita estetyka prezentacji buduje rozpoznawalność
  3. **Aktywność w społeczności** — komentowanie, hashtagi, dyskusje branżowe
  4. **(Nowe, ze strategii, sekcja 14.3) Konsekwencja ponad częstotliwość, mierzona długoterminowo:** strategia podaje konkretny, przetestowany wzorzec — "3 Reels/tydzień publikowane konsekwentnie przez 12 miesięcy przewyższą 7 Reels/tydzień publikowane intensywnie przez 6 tygodni i porzucone" — to bezpośrednio uzasadnia decyzję o elastycznych blokach tworzenia (presja krótkoterminowa = ryzyko porzucenia, udokumentowany wzorzec przy ADHD)
- **Kanały komunikacji — ZAKTUALIZOWANE po weryfikacji ze strategią biznesową (Runda #12):**
  - **Kanał #1 (codzienny, Hook): Instagram Reels** — potwierdzone przez obie analizy (research Claude'a + strategia biznesowa) jako dominująca platforma pierwszego wyboru w tej niszy
  - **Kanał #2 (tygodniowy, Retain+SEO): YouTube** — strategia biznesowa PODNOSI RANGĘ tego kanału względem wcześniejszej wersji konceptu (gdzie YouTube był "do rozważenia w przyszłości, nie priorytet") — strategia jednoznacznie rekomenduje YouTube jako drugi kanał główny od startu, nie opcję na później: buduje bibliotekę evergreen, fundament pod przyszłe kursy, jedyny kanał z realnym potencjałem przychodu reklamowego
  - **Kanały wspierające (pasywne, 15-30 min/tydz.): Reddit + 2-3 grupy FB + 1-2 Discordy branżowe** — zero dodatkowej produkcji contentu, publikacja tego samego materiału źródłowego z dostosowanym tonem
  - **Kanał eksperymentalny (opcjonalny, miesiąc 3+): TikTok** — repurposing z Reels bez dodatkowego nakładu
  - **Putty & Paint (puttyandpaint.com)** — LUKA W STRATEGII BIZNESOWEJ wykryta przy weryfikacji: dedykowana platforma portfolio dla malarzy miniaturek (znaleziona w researchu do tego konceptu) nie jest wspomniana ani razu w 67-sekcyjnym dokumencie strategii. Rekomendacja: dopisać ją do strategii jako uzupełnienie kanałów wspierających — trafia dokładnie w docelową publiczność z silniejszym dopasowaniem niż ogólne social media. **Decyzja FINALNA (Runda #19):** Arek potwierdza włączenie — Putty & Paint wchodzi do strategii kanałów jako kanał wspierający (pasywna obecność, ta sama treść co na Instagramie, bez dodatkowej pracy), zgodnie z pierwotną rekomendacją powyżej
- **Publikacja — zintegrowany proces, RIGID z HP (potwierdzone przez Arka, patrz decyzja filozoficzna wyżej):** System śledzi nie tylko tworzenie, ale też publikację, jako checklist per projekt: ☐ zdjęcie zrobione → ☐ opis napisany → ☐ opublikowane (z polem "na jakim kanale/kanałach")
- **Tag kategorii:** `#samorozwój` (dzieli logikę rolling-average z Modułem 5/Czytelnictwo, patrz Moduł 20 niżej) dla BLOKÓW TWORZENIA (elastyczne); checklist publikacji poza tym tagiem, traktowany jak reszta rigid-systemu
- **Wskaźnik rolling-average marki (Runda #17, nowy wymóg):** analogicznie do Modułu 20 (Czytelnictwo), system liczy średnią kroczącą 7-dniową minut poświęconych na blok tworzenia — bez wpływu na HP, ale widoczny w Dashboardzie (sekcja 6.13) jako trend: spada / stabilny / rośnie. Cel: uchwycić cichy zanik konsekwencji budowania marki, zanim stanie się kilkumiesięczną przerwą, bez naruszania elastycznej, pozbawionej presji natury tych bloków
- **Atrybut RPG:** Personal Brand (5. Atrybut, patrz sekcja 4.1 — wydzielony na wyraźną prośbę Arka zamiast wchodzić w skład Umysłu)
- **Rytm tygodniowy wg strategii (sekcja 21.2, do wpięcia jako orientacyjne bloki, NIE sztywne godziny):**
  - 1× blok "tworzenie + nagrywanie" (2-4h, zależnie od zlecenia) — sesja malarska = domyślnie też sesja nagraniowa (zasada "domyślne działanie łatwiejsze niż jego brak", strategia sekcja 21.1)
  - 1× blok "montaż i buforowanie" (60-90 min, w dniu wyższej energii)
  - 1× krótki blok "społeczność" (20-30 min: odpowiedzi na komentarze/DM, aktywność w grupach)
  - Wszystkie trzy bloki elastyczne — Arek sam decyduje, kiedy w tygodniu je umieścić, zgodnie z ustaloną filozofią hybrydową powyżej

### MODUŁ 19: NICNIEROBIENIE = CZAS WOLNY (ADHD-critical) — ZMIANA POJĘCIOWA (Runda #14)

**Ujednolicenie terminologii:** Arek wskazał wprost, że "Nicnierobienie" i "Czas wolny" to TO SAMO pojęcie, nie dwie sąsiadujące kategorie. Wcześniejsza wersja dokumentu sztucznie je rozdzielała (Czas wolny = wieczorny blok hostujący portfolio/czytanie/hobby; Nicnierobienie = osobny blok-nagroda po zamknięciu dnia). Od tej rundy: **jeden moduł, jedna nazwa w interfejsie — "Czas wolny"** — obejmujący zarówno aktywne wykorzystanie (portfolio, czytanie, gry, hobby) jak i bierne "nic nierobienie" (siedzenie, leżenie, kolorowanki, podcast). To, co się w nim dzieje, zależy od nastroju Arka danego dnia — moduł nie rozróżnia trybu "produktywnego" od "biernego" jako osobnych kategorii systemowych.

- **Status: OPCJONALNE, bez remindera** — to nagroda/przestrzeń, nie obowiązek do odhaczenia
- **Uzasadnienie:** Przy ADHD nadmiar struktury bez przestrzeni na nudę/bezczynność prowadzi do przeciążenia i porzucenia całego reżimu dnia — kontrolowany Czas Wolny jest funkcjonalną częścią systemu, nie luką w harmonogramie
- **Częstotliwość:** Codziennie, ale ZMIENNA długość zależna od przebiegu dnia (nie sztywny blok)
- **Mechanizm umiejscowienia — "nagroda po zamknięciu dnia":** Blok Czasu Wolnego wyzwala się PO wykonaniu wszystkich zaplanowanych obligatoryjnych zadań dnia (patrz Sekcja 2.0), jako naturalne zamknięcie — Arek dostaje tyle czasu, ile zostało do planowanej pory snu, **bez górnego limitu**. Wyzwalacz jest HYBRYDOWY: system sugeruje moment (wykrywa, że ostatnie obligatoryjne zadanie zostało odhaczone), ale Arek ręcznie potwierdza/rozpoczyna blok (patrz Sekcja 6.8)
- **Zabezpieczenie na dni skompresowane:** Gdy po zamknięciu wszystkich zadań zostaje bardzo mało czasu (np. ~15 min do planowanej pory snu), system **nie zostawia Arka bez Czasu Wolnego, tylko rekomenduje elastyczne rozwiązanie**:
  1. Sugestia wydłużenia pory snu o do 30 minut, **pod twardym warunkiem: zero światła niebieskiego** (zgodne z Modułem 10A)
  2. Sugestia, by ten wydłużony czas wykorzystać na coś, co JEDNOCZEŚNIE służy innemu celowi systemu — np. czytanie (wspiera dzienny cel z Modułu 5, teraz obligatoryjnego — patrz uwaga niżej)
- **Uwaga o relacji z Modułem 20 (Rolling Average) po zmianie statusu czytelnictwa:** Czytelnictwo jest teraz obligatoryjne z dziennym wymogiem (Moduł 5, Runda #14), więc mechanizm "dogrywki wieczorem ratującej rolling-average" nadal ma sens, ale teraz ratuje dzienny checkbox (uniknięcie zera tego dnia), nie tylko średnią kroczącą — rolling-average pozostaje jako dodatkowa metryka jakościowa w tle, nie jedyny mechanizm oceny
- **Treść Czasu Wolnego — świadomie NIE zdefiniowana sztywno:** Arek nie chce zamkniętej listy wymaganych opcji — czasem to dosłownie siedzenie/leżenie bez żadnej aktywności, czasem kolorowanki antystresowe, czasem podcast, czasem portfolio figurek, czasem połączenie kilku (zależnie od nastroju danego dnia). System może POKAZYWAĆ te opcje jako inspirację (nie wymóg): kolorowanki, podcasty, gry, portfolio, czytanie, "nic" — ale nie wymusza wyboru ani nie trackuje szczegółowo TREŚCI tego czasu, tylko sam FAKT i długość
- **Bufor w ciągu dnia (poza pracą):** Krótki moment Czasu Wolnego w ciągu dnia NIE jest możliwy w trakcie pracy — jeśli ma się pojawić dodatkowy, krótszy moment poza wieczornym blokiem nagrody, musi być zaplanowany PRZED lub PO pracy (zależnie od typu zmiany), nigdy w jej trakcie
- **Przenikanie z Modułem 18 (Portfolio Figurek):** Malowanie figurek MOŻE pełnić funkcję Czasu Wolnego/nicnierobienia, ale tylko gdy wykonywane BEZ presji portfolio/celu — malowanie "pod projekt" z zamiarem publikacji pozostaje w Module 18 (`#samorozwój`, produktywne, opcjonalne bloki tworzenia), a malowanie czysto rekreacyjne (bez zamiaru publikacji) jest po prostu jedną z form spędzenia Czasu Wolnego — rozróżnienie zależy od intencji Arka przy rozpoczęciu sesji, nie od samej czynności
- **Umiejscowienie względem innych aktywności (Runda #14 — zasada porządkowa):** Czas Wolny nigdy nie poprzedza w harmonogramie: spaceru z psem (mimo że opcjonalny) ani slotów pielęgnacyjnych — te zachowują swoje umiejscowienie w dniu niezależnie od tego, kiedy zaczyna się Czas Wolny (patrz Sekcja 3, zaktualizowane Szablony Dnia)
- **Tracking:** Prosty log: data, długość sesji, opcjonalnie jaka forma (jeśli Arek chce zanotować) — bez presji kategoryzacji, celowo minimalistyczny w trackingu, bo nadmierne dokumentowanie odpoczynku zaprzeczałoby jego funkcji

### MODUŁ 20: ROLLING AVERAGE — ZASADA DLA CELÓW "MIĘKKICH" (nowy wzorzec systemowy, Runda #7)
Dotyczy celów, które są ważne, ale nie na tyle krytyczne, by wymagać codziennej realizacji day-in-day-out bez wyjątku (w odróżnieniu od suplementów rdzennych czy treningu, które pozostają dziennymi/sesyjnymi obowiązkami z pełną presją HP).

- **Zastosowanie:** Czytelnictwo (Moduł 5, cel 1h/dzień), Pielęgnacja (Moduł 7, poszczególne pozycje), **Portfolio Figurek (Moduł 18, minuty bloku tworzenia — Runda #17)**, inne aktywności jakościowe/samorozwojowe
- **Mechanizm:** Zamiast codziennego sztywnego "wykonano/nie wykonano" wpływającego na HP, system liczy **średnią kroczącą z ostatnich 7 dni** dla danego celu. Krótszy dzień (np. 20 min czytania zamiast 60) nie jest "porażką" tego dnia — obniża średnią tygodniową, którą Arek może odrobić w kolejnych dniach
- **Powiązanie z HP:** Do ustalenia na etapie kalibracji (sekcja 8) — proponowane podejście: HP nadal reaguje na kompletne pominięcie celu danego dnia (0 min czytania), ale nie karze proporcjonalnie za niepełne wykonanie (30 z 60 min) — pełna kara HP zarezerwowana dla prawdziwych zer, częściowa realizacja chroniona przez logikę rolling-average
- **Widoczność w UI:** Pasek/wskaźnik pokazujący średnią z 7 dni obok dziennego wyniku, żeby Arek widział kontekst ("dziś 20 min, ale średnia tygodniowa nadal 55 min — w normie")

### MODUŁ 21: FINANSE OSOBISTE (przyszły moduł, poza MVP — Runda #17)
- **Status:** Poza zakresem MVP, zarezerwowane miejsce w architekturze na przyszłość (Faza 4, sekcja 0.11.2)
- **Cel:** Arek potwierdza koncepcję jako słuszną na przyszłość — **ogólna poduszka bezpieczeństwa finansowego** (nie wyłącznie rezerwa podatkowa działalności Portfolio Figurek, patrz Strategia Marki Osobistej sekcja 41.2), spójna z troską o zdrowie widoczną w reszcie systemu (por. Scenariusz D ze strategii biznesowej)
- **Forma:** **Dokładny licznik kwoty** (nie prosty checkbox tak/nie) — saldo rezerwy podatkowej, saldo poduszki osobistej, cel miesięczny
- **Atrybut RPG:** Dyscyplina — ten sam mechanizm punktowy co reszta systemu, nie osobna aplikacja finansowa
- **Model danych:** tabela `Finanse_Osobiste` (sekcja 7)

---

## 3. SZABLONY DNIA (DAY TEMPLATES)

System generuje jeden z 4 szablonów każdego dnia na podstawie grafiku pracy i dnia tygodnia (Runda #14 dodaje Szablon D dla niedzieli). **Aktualizacja Runda #6:** rzeczywisty koniec bloku pracy nie jest sztywną godziną z grafiku — system pobiera realny czas z RCP (sekcja 0.8) i dolicza dojazd (20-25 min). **Aktualizacja Runda #14 — zasady czytania poniższych tabel:**
- **[OBLIGATORYJNE]** = ma pełną mechanikę HP (Sekcja 4.2), pominięcie kosztuje; **[opcjonalne]** = bez kary HP, niezależnie od tego czy ma stały slot czy nie (patrz Sekcja 2.0 dla pełnej tabeli źródłowej)
- **Posiłki są REMINDERAMI z orientacyjną godziną**, nie zajmują sztywnego bloku czasowego w harmonogramie — pokazane tu jako punkty w czasie, nie zakresy
- **Trening to zawsze dokładnie 1h15** (1h treningu + 15 min pielęgnacji potreningowej), niezależnie od dnia
- **Pielęgnacja poranna i wieczorna to osobne, stałe sloty (max 15 min każdy)**, NIGDY połączone ze spacerem z psem
- **"Czas wolny" i "Nicnierobienie" to jedno pojęcie** (Moduł 19) — pokazywane jako jeden ciągły blok wieczorny

### SZABLON A — Dzień pracujący, wczesna zmiana (8:30–15:30), NIE dzień treningowy
| Godzina | Blok |
|---|---|
| 7:00 | Pobudka |
| ~7:00 | [opcjonalne] Pielęgnacja poranna (max 15 min, przed wyjściem, z prysznicem) |
| ~7:15 | [OBLIGATORYJNE] Rozciąganie/joga (10-15 min, zawsze po pielęgnacji porannej lub zaraz po przebudzeniu, jeśli pielęgnacji nie było) |
| ~7:30 | [OBLIGATORYJNE] Reminder: Suplementy poranne |
| ~7:30 | [OBLIGATORYJNE] Reminder: Posiłek 1 (białko na starcie) |
| ~7:45 | [OBLIGATORYJNE] Mood check poranny |
| 7:45–8:15 | Przygotowanie, dojazd |
| 8:30–15:30 | Praca (realny koniec wg RCP — sekcja 0.8) |
| ~10:30 | [OBLIGATORYJNE] Reminder: Posiłek 2 |
| ~13:30 | [OBLIGATORYJNE] Reminder: Posiłek 3 |
| ok. 16:00 (RCP+dojazd) | Powrót, odpoczynek |
| ~16:15 | [OBLIGATORYJNE] Reminder: Posiłek 4 |
| 16:15–17:30 | [opcjonalne] Czas wolny — Portfolio Figurek / czytanie / spacer z psem |
| ~19:00 | [OBLIGATORYJNE] Reminder: Posiłek 5 |
| ~19:00 (jeśli nie wcześniej) | [opcjonalne] Spacer z psem |
| ~20:30 | [opcjonalne] Pielęgnacja wieczorna (max 15 min, przed snem) |
| 20:30–21:00 | [OBLIGATORYJNE] Higiena światła wieczorem (redukcja ekranów) |
| 20:00–22:00 | [opcjonalne] Czas wolny cd. (czytanie, gry, hobby — jeśli wcześniej nie wykorzystane) |
| ~22:00 | [OBLIGATORYJNE] Mood check wieczorny (w tym GI — z follow-up 48h retrospektywnym, jeśli potrzebny) |
| po zamknięciu dnia | [opcjonalne] Czas wolny / Nicnierobienie (Moduł 19) — reszta czasu do snu, bez górnego limitu |

### SZABLON A-TRENING — Dzień pracujący, wczesna zmiana, DZIEŃ TRENINGOWY (Wt/Czw/Sob)
Identyczny jak Szablon A, z jedną zmianą: blok 16:15–17:30 "Czas wolny" zastąpiony przez:
| Godzina | Blok |
|---|---|
| ~16:15 | [OBLIGATORYJNE] Reminder: Posiłek 4 |
| 16:15–17:30 | [OBLIGATORYJNE] Trening (1h trening + 15 min pielęgnacja potreningowa — patrz Moduł 2) |
| ~17:45 | [opcjonalne] Reminder: Gainer (posiłek treningowy) |
| 17:45–19:00 | [opcjonalne] Czas wolny — Portfolio Figurek / czytanie / spacer z psem |
Reszta wieczoru identyczna jak Szablon A.

### SZABLON B — Dzień pracujący, późna zmiana (12:00–20:00), NIE dzień treningowy
| Godzina | Blok |
|---|---|
| 8:00 | Pobudka |
| ~8:00 | [opcjonalne] Pielęgnacja poranna (max 15 min, przed wyjściem, z prysznicem) |
| ~8:15 | [OBLIGATORYJNE] Rozciąganie/joga (10-15 min, po pielęgnacji porannej lub zaraz po przebudzeniu) |
| ~8:30 | [OBLIGATORYJNE] Reminder: Suplementy poranne + Posiłek 1 (białko na starcie) |
| ~8:45 | [OBLIGATORYJNE] Mood check poranny |
| 9:00–11:00 | Przygotowanie, [opcjonalne] spacer z psem #1 |
| ~11:00 | [OBLIGATORYJNE] Reminder: Posiłek 2 |
| 12:00–20:00 | Praca (realny koniec wg RCP) |
| ~14:00 | [OBLIGATORYJNE] Reminder: Posiłek 3 |
| ~17:00 | [OBLIGATORYJNE] Reminder: Posiłek 4 |
| ok. 20:30 (RCP+dojazd) | Powrót |
| ~20:30 | [OBLIGATORYJNE] Reminder: Posiłek 5 |
| ~20:45 | [opcjonalne] Spacer z psem #2 (jeśli nie wcześniej) |
| ~21:00 | [opcjonalne] Pielęgnacja wieczorna (max 15 min, przed snem) |
| 21:00–21:30 | [OBLIGATORYJNE] Higiena światła wieczorem |
| 20:30–22:00 | [opcjonalne] Czas wolny (czytanie, hobby) |
| ~22:00 | [OBLIGATORYJNE] Mood check wieczorny (w tym GI, follow-up jeśli potrzebny) |
| po zamknięciu dnia | [opcjonalne] Czas wolny / Nicnierobienie — reszta czasu do snu |

### SZABLON B-TRENING — Dzień pracujący, późna zmiana, DZIEŃ TRENINGOWY (Wt/Czw/Sob)
Identyczny jak Szablon B, z jedną zmianą: trening wchodzi rano, priorytetowo, przed pracą:
| Godzina | Blok |
|---|---|
| ~8:15 | [OBLIGATORYJNE] Trening (1h trening + 15 min pielęgnacja potreningowa) — ZASTĘPUJE osobne rozciąganie tego dnia (rozciąganie jest częścią rozgrzewki/zakończenia treningu tego dnia, patrz Moduł 2) |
| ~9:30 | [opcjonalne] Reminder: Gainer |
| 9:30–11:00 | Prysznic, przygotowanie, [opcjonalne] spacer z psem #1 |
Reszta dnia identyczna jak Szablon B (Posiłek 1 przesuwa się na ok. 9:45, po treningu i prysznicu).

### SZABLON C — Dzień wolny (sobota, gdy nie pracująca), DZIEŃ TRENINGOWY
| Godzina | Blok |
|---|---|
| 8:00 | Pobudka |
| ~8:00 | [opcjonalne] Pielęgnacja poranna (max 15 min, z prysznicem) |
| ~8:15 | [OBLIGATORYJNE] Reminder: Suplementy poranne + Posiłek 1 (białko na starcie) |
| ~8:30 | [OBLIGATORYJNE] Mood check poranny |
| 8:30–9:45 | [OBLIGATORYJNE] Trening (1h + 15 min pielęgnacja potreningowa) — zastępuje osobne rozciąganie tego dnia |
| ~10:00 | [opcjonalne] Reminder: Gainer |
| 10:00–11:00 | [opcjonalne] Spacer z psem #1 / kontakt z naturą |
| ~11:00 | [OBLIGATORYJNE] Reminder: Posiłek 2 |
| 11:00–13:00 | [OBLIGATORYJNE min. 15 min floor] Sprzątanie (strefa dnia) / [opcjonalne] zakupy (Moduł 17) / Auto-Motocykl gdy zaplanowane |
| ~13:00 | [OBLIGATORYJNE] Reminder: Posiłek 3 |
| 13:00–15:00 | [opcjonalne] Czas wolny — Portfolio Figurek / czytanie / hobby |
| 15:00–16:00 | [opcjonalne] Spacer z psem #2 |
| ~16:00 | [OBLIGATORYJNE] Reminder: Posiłek 4 |
| 16:00–18:00 | Sprawy osobiste, [opcjonalne] pielęgnacja wieczorna wcześniej jeśli wygodniej |
| ~19:00 | [OBLIGATORYJNE] Reminder: Posiłek 5 |
| 19:00–20:30 | [opcjonalne] Czas wolny — Portfolio Figurek, hobby, gry |
| ~20:30 | [opcjonalne] Pielęgnacja wieczorna (max 15 min, jeśli nie zrobiona wcześniej) |
| 20:30–21:00 | [OBLIGATORYJNE] Higiena światła wieczorem |
| ~21:30 | [OBLIGATORYJNE] Mood check wieczorny (w tym GI, follow-up jeśli potrzebny) |
| po zamknięciu dnia | [opcjonalne] Czas wolny / Nicnierobienie — reszta czasu do snu |

### SZABLON D — NIEDZIELA (nowy, Runda #14) — dzień regeneracyjny, LŻEJSZY
**Zasada specjalna:** Niedziela NIE jest pełnym resetem. Suplementy, posiłki i mood tracker POZOSTAJĄ obligatoryjne (zdrowotne minimum niezależne od dnia). **Wyłącznie Trening i Sprzątanie są zwolnione z obowiązkowości.** Niedziela nigdy nie była dniem treningowym (stałe dni to Wt/Czw/Sob), więc w praktyce ta zasada zwalnia głównie z floora sprzątania.

| Godzina | Blok |
|---|---|
| 8:00 | Pobudka (lub później — brak presji wczesnego wstawania w niedzielę, sam Arek decyduje w granicach rozsądku) |
| ~8:00 | [opcjonalne] Pielęgnacja poranna (max 15 min) |
| ~8:15 | [OBLIGATORYJNE] Rozciąganie/joga (10-15 min) |
| ~8:30 | [OBLIGATORYJNE] Reminder: Suplementy poranne + Posiłek 1 |
| ~8:45 | [OBLIGATORYJNE] Mood check poranny |
| 9:00–11:00 | [opcjonalne, bez presji] Spacer z psem / kontakt z naturą / czas wolny |
| ~11:00 | [OBLIGATORYJNE] Reminder: Posiłek 2 |
| 11:00–13:00 | [opcjonalne, ZWOLNIONE z floora] Sprzątanie globalne (jeśli Arek chce) — dziś bez obowiązkowego minimum 15 min |
| ~13:00 | [OBLIGATORYJNE] Reminder: Posiłek 3 |
| 13:00–15:00 | [opcjonalne] Przegląd tygodniowy (Sekcja 6.5, niedzielny review 15-20 min) + Czas wolny |
| ~16:00 | [OBLIGATORYJNE] Reminder: Posiłek 4 |
| 16:00–19:00 | [opcjonalne] Czas wolny — Portfolio Figurek, hobby, spacer, cokolwiek regeneracyjnego |
| ~19:00 | [OBLIGATORYJNE] Reminder: Posiłek 5 |
| 19:00–20:30 | [opcjonalne] Czas wolny |
| ~20:30 | [opcjonalne] Pielęgnacja wieczorna (max 15 min) |
| 20:30–21:00 | [OBLIGATORYJNE] Higiena światła wieczorem |
| ~21:30 | [OBLIGATORYJNE] Mood check wieczorny |
| po zamknięciu dnia | [opcjonalne] Czas wolny / Nicnierobienie — reszta czasu do snu |

**Uwaga projektowa:** Szablony to punkt startowy generowany automatycznie — Arek może edytować dany dzień ręcznie, ale system domyślnie proponuje powyższą strukturę. Blok popołudniowy w dniach pracujących jest elastyczny względem realnego czasu zakończenia pracy (RCP + dojazd), nie sztywnej godziny z grafiku. Posiłki są zawsze reminderami z orientacyjną godziną — jeśli dzień się przesunie (np. nadgodziny), godziny reminderów przesuwają się proporcjonalnie, o czym system informuje jawnym komunikatem (Sekcja 6.1).

---

## 4. GAMIFIKACJA — ROZBUDOWANY SYSTEM RPG (uniwersalny, bez licencji konkretnej gry)

Zgodnie z decyzją Arka: system ma być maksymalnie rozbudowany, inspirowany klimatem gier RPG (punkt odniesienia: World of Darkness — dojrzały, narracyjny, z rozwojem postaci w czasie), ale zbudowany jako **własna, uniwersalna mechanika** — nie odwzorowanie zasad konkretnego systemu źródłowego.

### 4.0 Decyzja o mechanice presji (ważne — świadomie potwierdzone przez Arka dwukrotnie)
Podczas researchu (sekcja 0.6.B) wskazano, że mechanika Habitica — utrata punktów życia (HP) za każde niewykonane obowiązkowe zadanie dnia, a przy HP=0 "śmierć postaci" (utrata poziomu, przedmiotów, odznak, restart z niższym punktem startowym) — jest udokumentowanym antywzorcem przy współwystępującej depresji ("shame loop"). Mimo przedstawienia tego ryzyka wprost, **Arek świadomie i dwukrotnie potwierdził, że chce dokładnie tej mechaniki** — presja ma być dla niego motywatorem, nie przeszkodą. Decyzja jest wiążąca dla konceptu. Jedyne zabezpieczenie wpisane do projektu (zgodne z inną preferencją Arka — "system tłumaczy skąd biorą się rekomendacje"): **system zawsze pokazuje ostrzeżenie, zanim HP realnie spadnie do zera** (np. przy 15-20% HP: wyraźny wizualny alert "Twoja postać jest bliska upadku — wykonaj [lista brakujących zadań], żeby tego uniknąć"), tak by "śmierć postaci" nigdy nie była zaskoczeniem, tylko świadomie zaakceptowanym skutkiem serii pominięć. To nie zmienia mechaniki, tylko dodaje przejrzystość.

### 4.1 Struktura: Atrybuty, Umiejętności, Doświadczenie, Punkty Życia

**Atrybuty (5, odpowiadają głównym filarom systemu — zaktualizowano w Rundzie #8 o Personal Brand):**
| Atrybut | Zasilany przez moduły |
|---|---|
| **CIAŁO** (Body) | Trening FBW, kardio/mobilność, rozciąganie/joga, spacer z psem |
| **UMYSŁ** (Mind) | Czytelnictwo, mood tracker (skupienie), AI Coach insights (Faza 2) |
| **DYSCYPLINA** (Discipline) | Suplementacja, dieta (checklist posiłków), pielęgnacja |
| **OTOCZENIE** (Environment) | Sprzątanie, kontakt z naturą, ogólny porządek dnia, Auto, Motocykl |
| **PERSONAL BRAND** (nowy, Runda #8) | Portfolio Figurek (Moduł 18) — praktyka malowania/sklejania, publikacja, zaangażowanie społecznościowe |

Piąty Atrybut, Personal Brand, został wydzielony na wyraźną prośbę Arka zamiast wchodzić w skład Umysłu — odzwierciedla, że budowanie marki osobistej i rozwój warsztatu w malarstwie miniaturek jest dla niego wystarczająco odrębnym, priorytetowym obszarem życia, by zasługiwać na własny pasek postępu, nie być rozmyty w szerszej kategorii kreatywności/umysłu.

Każdy Atrybut ma własny pasek XP i poziom (np. 1-20), rosnący wraz z wykonywaniem powiązanych zadań. To pozwala Arkowi widzieć nie tylko ogólny postęp, ale **w którym filarze życia radzi sobie najlepiej, a który wymaga uwagi** — wizualnie, bez czytania raportów tekstowych (zgodnie z preferencją wizualną, ADHD-friendly).

**Punkty Życia (HP) — mechanika presji:**
- Postać zaczyna dzień z pełnym HP (100%)
- Każde niewykonane zadanie z listy OBOWIĄZKOWEJ (suplementy rdzenne, checklist posiłków, blok treningowy w dni treningowe, mood tracker) odejmuje ustaloną wartość HP — kalibracja szczegółowej tabeli "ile HP za co" do etapu implementacji, powiązana z wagą zadania (pominięcie treningu w dniu treningowym > pominięcie 1 kremu do rąk)
- HP regeneruje się do 100% każdego nowego dnia — konsekwencje przenoszą się między dniami tylko poprzez POZIOM POSTACI, nie poprzez przenoszony deficyt HP
- Przy spadku do 0% w trakcie dnia: "śmierć postaci" — patrz logika DOPRECYZOWANA w Rundzie #17 poniżej
- **Ostrzeżenie wyprzedzające:** przy HP ≤20% system pokazuje pełnoekranowy alert z listą konkretnych brakujących zadań, które pozwolą odzyskać HP jeszcze tego samego dnia

**Logika "śmierci postaci" — FINALNA (Runda #17, potwierdzona po przeglądzie kalibracji):** Arek potwierdza, że kalibracja HP zostaje bez łagodzenia — ale przed uruchomieniem systemu należy przeliczyć na papierze, na przykładach typowego "gorszego tygodnia" Arka, ile razy realnie doszłoby do śmierci postaci, żeby liczby były świadomie zaakceptowane, a nie tylko teoretyczne (zadanie przedwdrożeniowe, nie blokuje reszty konceptu). Co dokładnie się dzieje w momencie śmierci:
1. **Pełnoekranowy popup „GAME OVER"** — natychmiastowa, jawna informacja, nie cichy reset w tle
2. **Odznaki JUŻ zdobyte, oznaczone jako [S] Stała — zostają na zawsze**, niezależnie od śmierci postaci (patrz pełna lista, sekcja 4.3)
3. **Odznaki sezonowe [Z] oraz aktualny streak — zerują się**, zgodnie z dotychczasową zasadą
4. **Postęp W TRAKCIE zdobywania kolejnej, jeszcze nieodblokowanej odznaki lub progu — zeruje się razem z licznikiem, którego dotyczy** (np. jeśli Arek miał 96% postępu do odznaki za 20-dniowy streak treningowy, a streak się zrywa, ten postęp wraca do zera wraz z licznikiem streaka — nie jako osobna kara, tylko naturalna konsekwencja zerwania licznika, na którym był oparty)
5. **Poza punktami 2-4, WSZYSTKO INNE toczy się dalej bez zmian** — poziom postaci traci 1 (jak dotychczas), ale historia, dane, i pozostałe, niepowiązane liczniki nie są ruszane

**Umiejętności (podkategorie w ramach Atrybutów, przykładowo):**
- CIAŁO → "Siła" (trening), "Wytrzymałość" (kardio), "Mobilność" (rozciąganie)
- UMYSŁ → "Wiedza" (czytelnictwo), "Skupienie" (mood — koncentracja)
- DYSCYPLINA → "Rutyna" (suplementy), "Odżywianie" (dieta), "Higiena" (pielęgnacja)
- OTOCZENIE → "Porządek" (sprzątanie), "Regeneracja" (natura/wyciszenie)

**Doświadczenie (XP) i Poziom Postaci — kalibracja FINALNA (Runda #9, formuła matematyczna zamiast przybliżenia):** Na prośbę Arka o wzorowanie się na standardach branżowych RPG, przyjęto powszechnie stosowaną **krzywą kwadratową** (ten sam wzorzec co w popularnych systemach XP typu Discord-bot/RPG: `XP(poziom) = a·poziom² + b·poziom + c`), skalibrowaną tak, by poziom 1→2 wymagał dokładnie 50 XP (zgodnie z wcześniejszą decyzją) i by osiągnięcie poziomu maksymalnego (20) zajmowało ok. 8-9 miesięcy regularnego użytkowania przy średnim tempie 60-90 pkt/dzień — długoterminowy, ale nie zniechęcająco odległy cel.

**Finalna formuła: `XP(poziom) = 3·poziom² + 47·poziom`**

| Poziom | XP potrzebne do następnego | Suma XP od startu |
|---|---|---|
| 1→2 | 50 | 50 |
| 2→3 | 106 | 156 |
| 3→4 | 168 | 324 |
| 4→5 | 236 | 560 |
| 5→6 | 310 | 870 |
| 6→7 | 390 | 1 260 |
| 7→8 | 476 | 1 736 |
| 8→9 | 568 | 2 304 |
| 9→10 | 666 | 2 970 |
| 10→11 | 770 | 3 740 |
| 11→12 | 880 | 4 620 |
| 12→13 | 996 | 5 616 |
| 13→14 | 1 118 | 6 734 |
| 14→15 | 1 246 | 7 980 |
| 15→16 | 1 380 | 9 360 |
| 16→17 | 1 520 | 10 880 |
| 17→18 | 1 666 | 12 546 |
| 18→19 | 1 818 | 14 364 |
| 19→20 | 1 976 | 16 340 |
| 20→21 | 2 140 | 18 480 |

Ta sama formuła (przeskalowana proporcjonalnie) stosowana jest dla każdego z 5 Atrybutów osobno — Atrybuty rosną z indywidualnej puli punktów przypisanych do ich modułów (patrz tabela 4.1), więc będą rosły w różnym tempie zależnie od tego, jak intensywnie Arek angażuje się w powiązane obszary.

### 4.1a Token Dnia Ochronnego — „GOD_MODE_24H" (Runda #5, nazwa i rozszerzenie aktywacji w Rundzie #17)
Osobny od "dnia treningowego/nietreningowego" — to **limitowany zasób aktywowany ręcznie przez Arka**, nie stały dzień tygodnia (bo potrzeba ochrony pojawia się nieregularnie, np. przy wyjeździe lub nagłym złym dniu).

- **Mechanika:** Arek posiada pulę aktywacji GOD_MODE_24H — jak przełącznik/cheat kod z gry, uruchamiany na 24h. W czasie jego działania HP nie spada za pominięcia w objętych modułach (patrz niżej)
- **Aktywacja — DOPRECYZOWANA w Rundzie #17:** wyłącznie ręczna, **w tym w trybie natychmiastowym, tego samego dnia** (zniesiono wymóg aktywacji z wyprzedzeniem obowiązujący wcześniej) — Arek chce móc włączyć ochronę w danej chwili, nie tylko planować ją zawczasu. **Bez żadnej automatycznej sugestii systemu** — wyłącznie Arek decyduje, kiedy aktywować; system nie proponuje tego na podstawie mood trackera ani żadnych innych danych
- **Limit:** Bez sztywnego limitu tygodniowego, ale **maksymalnie 4 aktywacje miesięcznie łącznie** (żeby GOD_MODE_24H pozostał wyjątkiem, nie furtką osłabiającą całą mechanikę presji)
- **Zakres ochrony (domyślny):** Obejmuje WSZYSTKIE moduły OPRÓCZ suplementów rdzennych — te pozostają obowiązkowe (HP za nie spada) nawet z aktywnym GOD_MODE_24H, bo są minimalnym wysiłkiem niezależnym od okoliczności
- **Nie kumuluje się między miesiącami** — niewykorzystane aktywacje przepadają na koniec miesiąca
- **Interakcja z odznakami streakowymi (Runda #10, zasada FINALNA):** dzień z aktywnym GOD_MODE_24H jest **neutralny wobec streaków** — NIE przerywa aktywnego streaka (bo formalnie nic nie zawiodło, ochrona była świadoma i celowa), ale też SIĘ DO NIEGO NIE LICZY jako pełnoprawny dzień realizacji. W praktyce: streak "pauzuje" na dzień z GOD_MODE_24H i kontynuuje naliczanie od kolejnego dnia bez zerowania licznika. Ta sama zasada dotyczy odznak liczonych jako "X dni łącznie" (np. "Setka Perfect Days") — taki dzień nie wlicza się do licznika, ale też go nie cofa.

### 4.1b Tryb Regeneracji (nowy mechanizm, Runda #17)
Rozszerzenie GOD_MODE_24H na dłuższy, wielodniowy okres — odpowiednik Scenariusza D ze Strategii Marki Osobistej (kilkutygodniowy spadek wydolności), którego system wcześniej nie miał żadnego odpowiednika poza pojedynczymi dniami ochronnymi.

- **Wyzwalacz:** dwa dni z rzędu z aktywnym GOD_MODE_24H automatycznie PROPONUJĄ (nie wymuszają) wejście w Tryb Regeneracji — Arek potwierdza ręcznie, decyzja zawsze należy do niego
- **Mechanika:** HP i mechanika śmierci postaci w pełni zawieszone na cały czas trwania trybu. **WSZYSTKIE przypomnienia (suplementy, posiłki, mood tracker, higiena światła) POZOSTAJĄ AKTYWNE** — znika wyłącznie presja punktowa, nie same przypomnienia
- **Wyjście z trybu:** ręczne, gdy Arek uzna że wraca do normalnego funkcjonowania — bez limitu czasowego
- **Widoczność:** okres Trybu Regeneracji jest jawnie widoczny w historii Karty Postaci (nie ukrywany, nie usuwany z danych) — pozwala z czasem zauważyć wzorce (np. "co miesiąc mam gorszy okres koło dnia X")
- **Model danych:** rozszerzenie istniejącej tabeli `Tokeny_Dnia_Ochronnego` (sekcja 7) o pole `typ` (dzień/tryb-regeneracji), nie osobna, nowa tabela

**Wskaźnik dnia (dodatkowy, ponad paski Atrybutów):** Jeden łączny wskaźnik 0-100%, widoczny na pierwszy rzut oka w headerze widoku dnia, agregujący ukończenie wszystkich zaplanowanych zadań danego dnia (niezależnie od podziału na Atrybuty) — szybka odpowiedź na pytanie "jak mi idzie dzisiaj" bez analizowania 4 osobnych pasków. W dniu z aktywnym tokenem ochronnym, wskaźnik wizualnie oznacza ten fakt (np. ikona tarczy), by było jasne, że niższy % tego dnia nie odzwierciedla realnego spadku formy.

### 4.2 Zasady przyznawania i odejmowania punktów (propozycja robocza, przypisane do Atrybutów)
| Akcja | Punkty (zdobyte) | Atrybut |
|---|---|---|
| Zaznaczenie 1 suplementu rdzennego | +1 pkt | Dyscyplina |
| Ukończony posiłek (z 5) | +2 pkt | Dyscyplina |
| Ukończony trening FBW (cały, wg planu A/B) | +20 pkt | Ciało |
| Progresja ciężaru w ćwiczeniu (nowy rekord) | +10 pkt bonus | Ciało |
| Kardio + kettle po treningu | +5 pkt | Ciało |
| Rozciąganie/joga | +5 pkt | Ciało |
| Spacer z psem (odhaczony, mimo braku remindera) | +3 pkt/spacer | Ciało + Otoczenie |
| 10 minut czytania | +2 pkt (max 12 pkt/dzień przy 60 min) | Umysł |
| Ukończona książka/audiobook | +25 pkt bonus | Umysł |
| Zadanie sprzątania (strefa dnia) | +8 pkt | Otoczenie |
| Wypełniony mood tracker (rano LUB wieczór) | +3 pkt/wpis (max 6/dzień) | Umysł |
| Pielęgnacja (każda zaznaczona pozycja) | +2 pkt | Dyscyplina |
| Kontakt z naturą (dzień potwierdzony) | +5 pkt | Otoczenie |
| **Streak bonus:** 7 dni z rzędu ≥80% ukończenia dnia | +25 pkt (do puli ogólnej) | — |
| **Perfect day:** 100% wszystkich zaplanowanych zadań | +15 pkt bonus | — |

| Zdarzenie (utrata HP) | HP — FINALNA kalibracja (Runda #9, zaktualizowana Runda #14) |
|---|---|
| Pominięty suplement rdzenny lub Gainer w dniu treningowym (za każdą pozycję z 5: Kreatyna, Vita Pak, Kolagen, Omega3, Gainer) | -3% HP |
| Melatonina (nieprzyjęta) | **0% HP (Runda #17 — cofnięcie zmiany z Rundy #14)** — warunkowa, trackowana informacyjnie |
| Pominięty posiłek (za każdy z 5) | -6% HP |
| Pominięty Trening w dniu treningowym (blok 1h15, patrz Moduł 2 połączony) | -30% HP |
| Pominięty checkbox Czytelnictwa danego dnia (zero minut, Runda #14 — nowe) | -8% HP |
| Pominięty mood tracker (za każdy z 2: rano/wieczór) | -5% HP |
| Pominięte zadanie sprzątania (strefa dnia, poniżej floora 15 min) — NIE dotyczy niedzieli | -5% HP |
| Pielęgnacja poranna/wieczorna | **0% HP (Runda #14 — zmiana)** — ma stały slot w harmonogramie, ale pominięcie nie kosztuje HP |
| **HP = 0%:** "śmierć postaci" | utrata 1 poziomu, reset streak, utrata odznak sezonowych |

**Uzasadnienie kalibracji:** Arek poprosił o wartości z realnym ryzykiem "śmierci postaci" w naprawdę złym dniu, a nie kosmetyczną presję. Powyższe wartości oznaczają: całkowite zignorowanie treningu w dniu treningowym (-30%) + pominięcie 2-3 posiłków (-12-18%) + brak mood trackera (-10%) już zbliża do zera przy jednym bardzo złym dniu — ale pojedyncze potknięcia (jeden pominięty suplement) nie zagrażają przetrwaniu postaci. Pielęgnacja została świadomie wyłączona z mechaniki HP w Rundzie #14, mimo zachowania stałego miejsca w harmonogramie — to jedyny obligatoryjny-w-formie, ale wolny-od-kary element systemu. **Wartości są punktem startowym do skorygowania po 2-3 tygodniach realnego użytkowania.**

### 4.3 Odznaki ("Osiągnięcia") — PEŁNA LISTA 208 odznak (Runda #9)

Inspirowane systemami osiągnięć znanymi z platformy Steam (progresywne tiery: Brąz/Srebro/Złoto/Platyna dla tego samego osiągnięcia na różnych poziomach trudności, odznaki "sekretne" odkrywane dopiero po spełnieniu warunku, mieszanka odznak "łatwych na start" i "prestiżowych długoterminowych"). Każda odznaka oznaczona jako **[S]** Stała (przetrwa "śmierć postaci") lub **[Z]** Sezonowa (przepada przy śmierci postaci — reprezentuje bieżącą passę/postęp, nie trwałe osiągnięcie).

Rozkład: 208 odznak w 15 kategoriach, ważony wg priorytetów Arka (Trening i Portfolio Figurek — najwięcej, bo priorytetowe obszary rozwoju).

---

#### A. SUPLEMENTACJA / DYSCYPLINA (15)
1. [S] Pierwszy krok — pierwszy dzień z pełną suplementacją rdzenną
2. [Z] Tydzień rutyny — 7 dni z rzędu 100% suplementów rdzennych
3. [S] Miesiąc dyscypliny — 30 dni z rzędu 100% suplementów rdzennych
4. [S] Kwartał żelaznej woli — 90 dni z rzędu
5. [S] Pół roku nawyku — 180 dni z rzędu
6. [S] Rok konsekwencji — 365 dni z rzędu
7. [S] Setka — 100 dni łącznie z pełną suplementacją (niekoniecznie z rzędu)
8. [S] Pięćsetka — 500 dni łącznie
9. [Z] Odzyskany rytm — powrót do 100% po przerwie 3+ dni
10. [S] Świadomy wybór — pierwsze użycie Melatoniny "tylko w razie potrzeby" bez nadużycia (miesiąc bez przekroczenia limitu)
11. [S] Nawodniony — 30 dni z rzędu zaznaczonego nawodnienia
12. [S] Kreatyna bez ryzyka — 60 dni świadomego dopasowania pory kreatyny bez epizodu GI
13. [Z] Perfekcyjny tydzień suplementów — 7/7 dni, wszystkie pozycje rdzenne
14. [S] Gainer na czas — 20 sesji treningowych z gainerem przyjętym zaraz po treningu
15. [S] Sekretna: Fundament — odblokowana po 6 miesiącach systemu, niezależnie od streaków (nagroda za sam fakt wytrwania z systemem)

#### B. TRENING / CIAŁO (30)
16. [S] Powrót na matę — pierwszy trening FBW po rozpoczęciu systemu
17. [Z] Tydzień w rytmie — 3 treningi w tygodniu, tydzień z rzędu
18. [S] Miesiąc w budowie — 12 treningów w 30 dni
19. [S] Kwartał regularności — ~36 treningów w 90 dni
20. [S] Pół roku w budowie — ~78 treningów w 180 dni
21. [S] Setka treningów — 100 ukończonych sesji FBW łącznie
22. [S] Dwieście treningów — 200 sesji łącznie
23. [S] Pierwszy rekord — pierwsza zanotowana progresja ciężaru (dowolne ćwiczenie)
24. [S] Dziesięć rekordów — 10 progresji ciężaru łącznie
25. [S] Pięćdziesiąt rekordów — 50 progresji łącznie
26. [S] Przełamanie plateau — pierwsza progresja po zarejestrowanym 3-sesyjnym plateau
27. [S] Mistrz przysiadu — 10 progresji w przysiadzie ze sztangą
28. [S] Mistrz wyciskania — 10 progresji w wyciskaniu (płaskim lub skośnym)
29. [S] Mistrz martwego ciągu — 10 progresji w martwym ciągu rumuńskim
30. [S] Żelazne barki — 10 progresji w OHP/wyciskaniu nad głowę
31. [S] Rdzeń stalowy — 20 ukończonych sesji plank/dead bug bez skrócenia czasu
32. [Z] Perfekcyjny tydzień treningowy — wszystkie 3 zaplanowane treningi + kardio + rozciąganie
33. [S] Trzy miesiące bez przerwy dłuższej niż tydzień — ciągłość treningowa
34. [S] Weteran FBW — 6 miesięcy regularnego treningu od powrotu po przerwie
35. [S] Rocznik — 1 rok od powrotu na siłownię w systemie
36. [Z] Nowy poziom obciążenia — pierwszy raz przekroczony próg [do skalibrowania: np. 100kg suma martwy+przysiad+wyciskanie]
37. [S] Konsekwentna rozgrzewka — 30 sesji z odhaczoną rozgrzewką
38. [S] Techniczna precyzja — 20 sesji bez zgłoszonego pogorszenia techniki w notatkach
39. [S] Sekretna: Rehabilitacja zakończona — odblokowana, gdy statystyki treningowe (objętość/ciężar) przekroczą poziom sprzed 2-letniej przerwy (wymaga danych historycznych od Arka, jeśli dostępne)
40. [S] Rytm trzech dni — 50 tygodni z pełnymi 3 sesjami (odpowiednik "prawie roku" konsekwencji)
41. [Z] Dzień mocy — sesja z co najmniej 2 progresjami ciężaru naraz
42. [S] Budowniczy od podstaw — ukończona pełna 8-tygodniowa faza startowa planu A/B
43. [S] Czwarty dzień — pierwsza sesja po ewentualnym dodaniu 4. dnia treningowego (milestone z Modułu 2)
44. [S] Sto serii — 100 zarejestrowanych serii łącznie (dowolne ćwiczenia)
45. [S] Tysiąc serii — 1000 serii łącznie

#### C. KARDIO + MOBILNOŚĆ (12)
46. [S] Pierwszy krok mobilności — pierwsza sesja kardio z kettlami po treningu
47. [Z] Tydzień mobilności — kardio/mobilność po każdym z 3 treningów w tygodniu
48. [S] Miesiąc mobilności — 12 sesji w 30 dni
49. [S] Otwarte biodra — 20 sesji ukierunkowanych na mobilność bioder (po dostarczeniu bazy CrossFit)
50. [S] Ruchome barki — 20 sesji ukierunkowanych na mobilność barków
51. [S] Fundament pod matę — 50 sesji mobilności łącznie, przed startem BJJ
52. [S] Wydolność w budowie — 3 miesiące regularnego kardio potreningowego
53. [Z] Intensywny tydzień — wszystkie sesje tygodnia z notatką "wysoka intensywność"
54. [S] Sto sesji kardio — 100 sesji łącznie
55. [S] Baza CrossFit wdrożona — pierwsza sesja wykorzystująca bibliotekę ćwiczeń od trenera
56. [S] Sekretna: Gotowość do maty — odblokowana automatycznie w miesiącu poprzedzającym deklarowany start BJJ (na podstawie Modułu 13)
57. [S] Pełny zakres — subiektywna notatka "pełny zakres ruchu bez ograniczeń" w 10 sesjach z rzędu

#### D. DIETA (15)
58. [S] Pierwszy pełny dzień — 5/5 posiłków w jeden dzień
59. [Z] Tydzień pełnych posiłków — 7 dni z rzędu 5/5
60. [S] Miesiąc regularności żywieniowej — 25+/30 dni z pełnymi posiłkami
61. [S] Kwartał nawyku — 3 miesiące konsekwentnego wzorca posiłków
62. [S] Białkowy start — 30 dni z rzędu z odhaczonym naciskiem na białko w Posiłku 1
63. [S] Bez przetworzonego — 30 dni bez zgłoszonego cheat mealu
64. [Z] Czysty tydzień — 7 dni bez cheat mealu/cheat daya
65. [S] Sucha masa w budowie — 3 miesiące diety z celem masy bez odnotowanego znacznego przyrostu tkanki tłuszczowej (subiektywna ocena Arka)
66. [S] Setka posiłków — 100 odhaczonych posiłków łącznie
67. [S] Pięćset posiłków — 500 posiłków łącznie
68. [S] Tysiąc posiłków — 1000 posiłków łącznie
69. [S] Gainer konsekwentny — 50 sesji treningowych z odhaczonym gainerem
70. [Z] Idealny tydzień żywieniowy — 5/5 posiłków każdego dnia przez 7 dni + zero cheat meali
71. [S] Sekretna: Nawyk ponad restrykcję — odblokowana po 6 miesiącach bez ani jednego dnia z zerem posiłków (odzwierciedla filozofię "nawyki, nie restrykcje")
72. [S] Rok przy stole — 1 rok konsekwentnego trackingu posiłków

#### E. CZYTELNICTWO / UMYSŁ (18)
73. [S] Pierwsza godzina — pierwszy dzień z 60 min czytania/słuchania
74. [Z] Tydzień czytelnika — średnia 7-dniowa ≥55 min
75. [S] Miesiąc w książkach — średnia 30-dniowa ≥55 min
76. [S] Pierwsza ukończona książka/audiobook w systemie
77. [S] Piątka — 5 ukończonych pozycji
78. [S] Dziesiątka — 10 ukończonych pozycji
79. [S] Dwudziestka pięć — 25 ukończonych pozycji
80. [S] Pięćdziesiątka — 50 ukończonych pozycji
81. [S] Setka godzin — 100h łącznego czasu czytania/słuchania
82. [S] Pięćset godzin — 500h łącznie
83. [S] Tysiąc godzin — 1000h łącznie
84. [S] Komiksowy koneser — 10 przeczytanych komiksów odnotowanych w systemie
85. [Z] Maraton wiedzy — 3h czytania/słuchania w jeden dzień
86. [S] Audiobook w drodze — 20 sesji słuchania podczas dojazdu do pracy
87. [S] Dogrywka mistrzowska — 10 przypadków skorzystania z mechanizmu "wydłużony czas przed snem na czytanie" (Moduł 19) bez zaniedbania higieny światła
88. [S] Rok czytelnika — 1 rok konsekwentnego trackingu czytelnictwa
89. [S] Sekretna: Erudyta — odblokowana po ukończeniu pozycji z 5 różnych gatunków/kategorii
90. [S] Zrównoważony umysł — 90 dni ze średnią rolling-average w normie (patrz Moduł 20) bez ani jednego dnia zerowego

#### F. PIELĘGNACJA (10)
91. [S] Pierwszy rytuał — pierwszy w pełni odhaczony dzień pielęgnacyjny (wszystkie zaplanowane pozycje)
92. [Z] Tydzień w formie — 7 dni z rzędu pełnej pielęgnacji
93. [S] Miesiąc dbałości — 25+/30 dni
94. [S] Fryzjer w rytmie — 10 wizyt u fryzjera zgodnie z cyklem 3-tygodniowym
95. [S] Nizoral konsekwentny — 20 tygodni z dotrzymanym rytmem niedziela+środa
96. [S] Skóra w formie — 90 dni z rzędu odhaczonego kremu do twarzy (oba sloty)
97. [S] Ręce jak nowe — 90 dni z rzędu kremu do rąk (oba sloty)
98. [S] Rok pielęgnacji — 1 rok konsekwentnego trackingu
99. [S] Setka rytuałów — 100 w pełni odhaczonych dni pielęgnacyjnych
100. [S] Sekretna: Detal ma znaczenie — odblokowana po 6 miesiącach bez ani jednego całkowicie pominiętego dnia pielęgnacji

#### G. SPACER Z PSEM (8)
101. [S] Pierwszy spacer w systemie
102. [Z] Tydzień ruchu z psem — min. 2 spacery dziennie przez 7 dni
103. [S] Setka spacerów — 100 spacerów łącznie
104. [S] Pięćset spacerów — 500 spacerów łącznie
105. [S] Tysiąc spacerów — 1000 spacerów łącznie
106. [S] Bez przypomnień — 6 miesięcy konsekwentnych spacerów mimo braku remindera (odzwierciedla świadomą decyzję Arka o rezygnacji z powiadomień w tym module)
107. [S] Towarzysz w każdą pogodę — 12 miesięcy trackingu niezależnie od sezonu
108. [S] Sekretna: Więź — odblokowana po roku konsekwentnych spacerów (odzwierciedla relację z psem, nie tylko metrykę)

#### H. SPRZĄTANIE / OTOCZENIE (14)
109. [S] Pierwsza strefa — pierwsze ukończone zadanie rotacji 7-strefowej
110. [Z] Pełny tydzień rotacji — wszystkie 7 stref odhaczone w tygodniu
111. [S] Miesiąc porządku — 4 pełne tygodnie rotacji z rzędu
112. [S] Kwartał w ryzach — 3 miesiące konsekwentnej rotacji
113. [S] Setka zadań — 100 ukończonych zadań sprzątania łącznie
114. [S] Mistrz łazienki — 20 ukończonych zadań strefy Łazienka
115. [S] Mistrz kuchni — 20 ukończonych zadań strefy Kuchnia
116. [S] Porządek globalny — 20 niedzielnych sprzątań globalnych
117. [S] Floor zawsze spełniony — 60 dni z rzędu z dotrzymanym minimum 15 min w tagu #sprzątanie
118. [S] W granicach ceiling — 60 dni bez przekroczenia 60 min w tagu #sprzątanie (dyscyplina, nie tylko wykonanie)
119. [Z] Dzień generalny — dzień z odhaczonymi wszystkimi możliwymi zadaniami sprzątania (mieszkanie + auto)
120. [S] Rok w porządku — 1 rok konsekwentnej rotacji
121. [S] Sekretna: Symbioza z robotem — odblokowana po 6 miesiącach bez przerwy w harmonogramie robota sprzątającego
122. [S] Przedsionek i klatka — 20 ukończonych zadań tej konkretnej strefy (najrzadziej wybierana intuicyjnie, więc osobne wyróżnienie)

#### I. SEN / HIGIENA ŚWIATŁA (8)
123. [S] Pierwsza ciemna noc — pierwszy odhaczony checkbox redukcji światła wieczorem
124. [Z] Tydzień higieny snu — 7 dni z rzędu odhaczonej redukcji światła
125. [S] Miesiąc dyscypliny świetlnej — 25+/30 dni
126. [S] Setka ciemnych wieczorów — 100 dni łącznie
127. [S] Rytm zmianowy opanowany — 3 miesiące konsekwentnego stosowania się do właściwej pobudki wg typu dnia (A/B/C)
128. [S] Bez ekranu przed snem — 60 dni z rzędu
129. [S] Rok higieny snu — 1 rok trackingu
130. [S] Sekretna: Regeneracja — odblokowana, gdy rolling-average jakości snu (Moduł 11) przekroczy 7/10 przez 30 dni z rzędu

#### J. MOOD TRACKER / SAMOPOCZUCIE (10)
131. [S] Pierwszy wpis — pierwszy w pełni wypełniony mood check (rano+wieczór)
132. [Z] Tydzień świadomości — 14/14 wpisów w tygodniu (rano+wieczór × 7 dni)
133. [S] Miesiąc obserwacji — 50+/60 wpisów w miesiącu
134. [S] Setka wpisów — 100 wpisów łącznie
135. [S] Pięćset wpisów — 500 wpisów łącznie
136. [S] Tysiąc wpisów — 1000 wpisów łącznie
137. [S] Rok samoobserwacji — 1 rok konsekwentnego trackingu
138. [S] Detektyw GI — 10 przypadków wypełnionej retrospekcji żywieniowej po niskim wyniku GI (nagroda za współpracę z systemem, nie za same objawy)
139. [S] Stabilny trend — 30 dni z rzędu bez wyniku poniżej 4/10 w żadnej kategorii
140. [S] Sekretna: Gotowość na AI Coacha — odblokowana automatycznie po zebraniu wystarczających danych do aktywacji Modułu 14 (4-6 tygodni)

#### K. PORTFOLIO FIGUREK / PERSONAL BRAND (22)
141. [S] Pierwszy projekt — pierwszy zarejestrowany projekt w systemie
142. [S] Pierwsza ukończona figurka
143. [S] Piątka portfolio — 5 ukończonych projektów
144. [S] Dziesiątka portfolio — 10 ukończonych projektów
145. [S] Dwudziestka pięć — 25 ukończonych projektów
146. [S] Pięćdziesiątka — 50 ukończonych projektów
147. [S] Setka — 100 ukończonych projektów
148. [S] Pierwsza publikacja — pierwszy projekt z pełnym checklistem publikacji (zdjęcie+opis+opublikowane)
149. [S] Dziesięć publikacji
150. [S] Pięćdziesiąt publikacji
151. [S] Konsystentny twórca — 8 tygodni z rzędu z minimum 1 publikacją tygodniowo (zgodnie ze strategią z Modułu 18: regularność > ilość)
152. [S] Kwartał marki — 3 miesiące konsekwentnej obecności publikacyjnej
153. [S] Pół roku budowania marki — 6 miesięcy
154. [S] Rok Personal Brand — 1 rok konsekwentnego rozwoju portfolio
155. [S] Kalibracja mistrzowska — 10 projektów z różnicą szacowany/rzeczywisty czas poniżej 15% (system nauczył się Twojego tempa)
156. [S] Mała ale wytrwała — 10 ukończonych "Małych figurek"
157. [S] Średniozaawansowany warsztat — 10 ukończonych "Średnich figurek"
158. [S] Duże wyzwanie — 5 ukończonych "Dużych/złożonych figurek"
159. [S] Cały oddział — pierwszy ukończony "Cały zestaw/oddział"
160. [Z] Tydzień praktyki — min. 3 sesje praktyki (malowanie lub kolorowanki) w tygodniu
161. [S] Trening oka i ręki — 50 sesji z kolorowankami jako praktyka
162. [S] Sekretna: Niezależność — odblokowana przy pierwszym projekcie oznaczonym jako zlecenie niezależne (poza Neon Forge Studio) — milestone realnego celu zawodowego Arka

#### L. AUTO + MOTOCYKL (10)
163. [S] Pierwszy przegląd auta w systemie
164. [S] Rok w trasie — 12 miesięcy konsekwentnych comiesięcznych przeglądów auta
165. [S] Pierwsza wiosna — pierwsze wiosenne przygotowanie motocykla w systemie
166. [S] Pierwsza zima — pierwsze jesienne odłożenie motocykla na zimę
167. [S] Pełny sezon — kwiecień-październik z dotrzymanymi wszystkimi comiesięcznymi kontrolami motocykla
168. [S] Trzy sezony — 3 pełne sezony motocyklowe z konsekwentną opieką
169. [S] Mechanik-amator — 20 łącznie odhaczonych zadań konserwacyjnych (auto+motocykl razem)
170. [Z] Miesiąc na kołach — wszystkie zaplanowane zadania pojazdów w danym miesiącu odhaczone
171. [S] Pięć lat w garażu — 5 sezonów motocyklowych (cel bardzo długoterminowy)
172. [S] Sekretna: Dwa kółka, cztery kółka — odblokowana po pierwszym miesiącu z pełną opieką nad OBOMA pojazdami naraz

#### M. ZAKUPY (6)
173. [S] Pierwsza lista 70/30 — pierwsze zrealizowane zakupy wg rekomendacji systemu
174. [Z] Miesiąc świadomych zakupów — 4 tygodnie z rzędu z odhaczoną listą
175. [S] Setka list — 100 zrealizowanych cotygodniowych list zakupowych
176. [S] Łowca promocji — 20 przypadków odnotowanego skorzystania z promocji Aldi po sprawdzeniu gazetki
177. [S] Rotacja bez rutyny — 20 tygodni z odhaczoną co najmniej 1 pozycją z "30% rotacyjnych" w każdej kategorii
178. [S] Rok przy wózku — 1 rok konsekwentnego trackingu zakupów

#### N. STREAKI OGÓLNE / PERFECT DAY (15)
179. [Z] Pierwszy Perfect Day — pierwszy dzień ze 100% ukończeniem wszystkich zaplanowanych zadań
180. [Z] Tydzień doskonałości — 7 Perfect Days w jednym tygodniu (rzadkie, bardzo wymagające)
181. [S] Dziesięć Perfect Days łącznie (niekoniecznie z rzędu)
182. [S] Pięćdziesiąt Perfect Days łącznie
183. [S] Setka Perfect Days łącznie
184. [Z] Streak 7 — 7 dni z rzędu ≥80% ukończenia dnia
185. [Z] Streak 14 — 14 dni z rzędu ≥80%
186. [S] Streak 30 — 30 dni z rzędu ≥80% (przekracza próg "sezonowy", staje się trwałym osiągnięciem przy pierwszym osiągnięciu)
187. [S] Streak 60 — 60 dni z rzędu
188. [S] Streak 90 — 90 dni z rzędu
189. [S] Streak 180 — pół roku bez przerwy ≥80%
190. [S] Streak 365 — cały rok
191. [S] Feniks — pierwszy powrót do streaka po jego zerwaniu (odzwierciedla resilience, nie tylko konsekwencję)
192. [S] Wszystkie 5 atrybutów — dzień z 100% ukończeniem we WSZYSTKICH 5 Atrybutach naraz
193. [S] Sekretna: Rok z systemem — odblokowana po 365 dniach od pierwszego uruchomienia systemu, niezależnie od jakości wykonania (nagroda za sam fakt wytrwania)

#### O. MILESTONE'Y DŁUGOTERMINOWE / SEKRETNE (15)
194. [S] Sekretna: Pierwszy miesiąc — przetrwanie pierwszych 30 dni z systemem (próg, na którym najwięcej ludzi porzuca nowe nawyki — świadomie nagrodzony)
195. [S] Sekretna: Dolina cienia — odblokowana po pierwszej "śmierci postaci" i kontynuacji następnego dnia bez przerwy w używaniu systemu (nagroda za nie-porzucanie po porażce, zgodnie z filozofią "historia nie jest karząca")
196. [S] Sekretna: Trzy doliny — przetrwanie i kontynuacja po 3 "śmierciach postaci" łącznie — odzwierciedla, że system wybacza i motywuje dalej mimo trudnej mechaniki HP
197. [S] Sekretna: Wiosna wojownika — odblokowana automatycznie w pierwszym tygodniu sezonu motocyklowego (kwiecień)
198. [S] Sekretna: Gotowość do BJJ — odblokowana ręcznie przez Arka, gdy faktycznie zapisze się na zajęcia (Moduł 13 aktywowany)
199. [S] Sekretna: Pierwszy krok w boksie — analogicznie, po BJJ
200. [S] Poziom 10 postaci — osiągnięcie 10. poziomu ogólnego
201. [S] Poziom 20 postaci (maksymalny) — pełne wypełnienie krzywej XP
202. [S] Mistrz Ciała — Atrybut Ciało osiąga poziom 20
203. [S] Mistrz Umysłu — Atrybut Umysł osiąga poziom 20
204. [S] Mistrz Dyscypliny — Atrybut Dyscyplina osiąga poziom 20
205. [S] Mistrz Otoczenia — Atrybut Otoczenie osiąga poziom 20
206. [S] Mistrz Marki Osobistej — Atrybut Personal Brand osiąga poziom 20
207. [S] Pięć Mistrzostw — wszystkie 5 Atrybutów na poziomie 20 (odznaka finałowa, najwyższe osiągnięcie w systemie)
208. [S] Sekretna: Rocznica — odblokowana dokładnie rok od daty pierwszego uruchomienia systemu, z osobistym podsumowaniem roku (dane z całego roku zebrane w jeden widok)

---

**Uwaga projektowa o wdrożeniu:** Ta lista jest kompletną specyfikacją nazw i warunków — na etapie implementacji każda odznaka potrzebuje: unikalnego ID, ikony (dobieranej z biblioteki Tabler lub podobnej), dokładnego zapytania/warunku sprawdzającego spełnienie w bazie danych. Odznaki oznaczone "Sekretna" nie powinny być widoczne na liście dostępnych osiągnięć przed odblokowaniem (typowy wzorzec Steam) — pojawiają się dopiero po spełnieniu warunku, z efektem "odkrycia" w UI.
### 4.4 Wizualizacja ("Karta Postaci")
- Widok "Karty Postaci" (dostępny np. z poziomu widoku tygodniowego): 4 paski Atrybutów z aktualnym poziomem, pasek HP, ogólny poziom postaci, lista zdobytych odznak
- Pasek postępu dnia (% ukończenia, wskaźnik łączny z sekcji 4.1) na górze widoku głównego
- Licznik streak (dni z rzędu) z ikoną ognia/płomienia
- Total punktów (XP) zawsze widoczny w headerze
- **Panel wyjaśnień:** przy sugestiach systemowych (np. plateau treningowy, ostrzeżenie HP) krótkie uzasadnienie widoczne obok rekomendacji (np. "3 tygodnie bez progresu na tym ćwiczeniu" / "HP 18% — brakuje: mood wieczorny, spacer z psem")
- Estetyka: mroczniejsza, dojrzała paleta kolorów (nawiązanie do klimatu WoD jako inspiracji wizualnej — do doprecyzowania na etapie designu UI, np. w połączeniu ze skillem frontend-design)

---

## 5. POWIADOMIENIA — SPECYFIKACJA

### 5.1 Charakterystyka ogólna
- **Typ:** Agresywne, pełnoekranowe (tam gdzie platforma na to pozwala)
- **Okno aktywności:** 6:00–22:00 (brak twardej ciszy nocnej, ale też brak powiadomień po 22:00 — naturalny koniec dnia)
- **Platformy:** iOS (push + Calendar alerts) + Windows (Calendar/Teams-style notifications lub aplikacja desktopowa)

### 5.2 Mechanizm techniczny — DWUSTRONNA SYNCHRONIZACJA Z GOOGLE CALENDAR
**Decyzja potwierdzona:** Arek nie ma obecnie żadnego kalendarza — założy Google Calendar dedykowanie pod ten system. Wymagana jest wymiana DWUSTRONNA, nie tylko wypychanie eventów:

- **Kierunek 1 (system → kalendarz):** Każdy blok czasowy z szablonu dnia (A/B/C) generowany jest automatycznie jako event w Google Calendar, z odpowiednim wyprzedzeniem (np. generowanie na cały nadchodzący tydzień w niedzielę, albo dzień naprzód)
- **Kierunek 2 (kalendarz → system):** Jeśli Arek ręcznie przesunie/zmodyfikuje event bezpośrednio w aplikacji Kalendarza (np. przesunie trening o godzinę), system musi to wykryć (Google Calendar API — nasłuchiwanie zmian / okresowe sprawdzanie) i zaktualizować odpowiadający wpis w arkuszu/logice, żeby checklist w widoku dnia pokazywał aktualną, a nie pierwotną godzinę
- Google Calendar ma naturalne, natywne, agresywne powiadomienia na iOS (pełnoekranowe przy nadchodzącym evencie) i Windows (aplikacja Kalendarz Google lub przeglądarka)
- **Wymagania techniczne:** Google Calendar API w trybie odczytu i zapisu (nie tylko zapisu jak zakładano pierwotnie), zaimplementowane w Google Apps Script. **Mechanizm synchronizacji: cykliczne sprawdzanie zmian co 15-30 minut** (decyzja Arka — prostsze technicznie niż webhooki, a opóźnienie rzędu kilkunastu minut nie ma znaczenia przy rigid-system, gdzie i tak wszystko jest zaplanowane z wyprzedzeniem). Wymaga unikalnego identyfikatora eventu łączącego wpis w arkuszu z eventem w kalendarzu, żeby aktualizacje szły w obie strony bez duplikatów

**Alternatywa (odrzucona):** dedykowana aplikacja (PWA) z Web Push API — bardziej elastyczna wizualnie, ale trudniejsza w utrzymaniu "agresywności" powiadomień na iOS (ograniczenia Apple dla web push) i nie oferuje naturalnej dwustronnej synchronizacji bez dodatkowej pracy.

### 5.3 Reminder specjalny — grafik miesięczny
- Automatyczne przypomnienie **ostatniego dnia miesiąca** (lub gdy Arek zwykle dostaje grafik od pracodawcy): "Wyślij grafik na przyszły miesiąc, żeby system mógł zaplanować dni"

### 5.4 Cytat Dnia (nowy element, Runda #17)
Każdy dzień, przy pierwszym otwarciu aplikacji, wyświetla jeden cytat motywacyjny z podanym autorem (gdy autor jest znany/określony w źródle).

- **Zakres biblioteki:** 300 cytatów, budowana ze wskazanych przez Arka źródeł:
  - tekstualna.pl — „100 mądrych zdań od 100 mądrych kobiet"
  - lubimyczytac.pl — sekcja cytatów o motywacji
  - fabrykadygresji.pl — zestawienie cytatów motywacyjnych o życiu
  - vogue.pl — cytaty motywacyjne
- **Mechanizm doboru:** losowy, bez powtórzeń w obrębie jednego przejścia przez całą pulę 300 (dopiero po wyczerpaniu wszystkich 300 pula "odświeża się" i losowanie zaczyna się od nowa)
- **Umiejscowienie:** pierwszy ekran dnia, przed lub razem z Widokiem Dnia (sekcja 6.1) — nie wymaga osobnego kliknięcia, żeby go zobaczyć
- **Model danych:** nowa tabela `Cytaty_Motywacyjne` (sekcja 7): treść | autor (może być puste, jeśli nieznany) | źródło | data_ostatniego_wyświetlenia
- **Status (Runda #19):** Arek dostarczył bezpośrednio treść dwóch z czterech wskazanych stron (tekstualna.pl, fabrykadygresji.pl — ta ostatnia zawiera też kilka cytatów oznaczonych źródłowo jako pochodzące z vogue.pl, przywoływanych przez fabrykadygresji.pl jako cytaty w cytacie). Po ekstrakcji i usunięciu duplikatów (11 pozycji powtórzonych między sekcjami tej samej strony lub między dwiema stronami) baza liczy **263 zweryfikowane cytaty z podanym autorem**, zapisane w `docs/data/cytaty-motywacyjne.csv`. **Pozostały brak:** lubimyczytac.pl i pełna, samodzielna zawartość vogue.pl wciąż nie zostały dostarczone ani pobrane (środowisko deweloperskie ma zablokowany dostęp sieciowy do obu domen) — do 300 brakuje ok. 37 pozycji. Nie blokuje to reszty systemu; baza 263 cytatów jest już w pełni użyteczna do wdrożenia, uzupełnienie do 300 może nastąpić w dowolnym momencie

---

## 6. WIDOK GŁÓWNY (UI) — WYMAGANIA FUNKCJONALNE (rozszerzone, Runda #8)

### 6.0 Urządzenia i kontekst użycia
- **Telefon (iOS):** główne narzędzie rano i wieczorem — odhaczanie suplementów, mood check, zamykanie dnia
- **Komputer (Windows):** główne narzędzie w pracy i w czasie wolnym — przegląd szczegółów, Portfolio Figurek, planowanie
- System musi więc być responsywny/dwuplatformowy od początku, nie "mobile-first z dodatkiem web" — oba konteksty są realnie używane w różnych porach dnia
- **Offline-first (wymaganie krytyczne, POTWIERDZONE mimo złożoności — pełna architektura w sekcji 1.1):** aplikacja musi działać w pełni bez połączenia z internetem (np. na treningu, na spacerze bez zasięgu) — odhaczanie zapisuje się lokalnie (Service Worker + IndexedDB) i synchronizuje przez kolejkę po odzyskaniu połączenia. Arek świadomie potwierdził ten wybór po poznaniu realnego kosztu inżynierskiego (Runda #11) — to nie prosty cienki klient uderzający bezpośrednio w Google Sheets, tylko pełnoprawna warstwa lokalnego cache'u i synchronizacji

### 6.1 Widok dnia (główny ekran, otwierany rano) — rozwiązanie kompromisowe "cała oś + zwijane szczegóły"
Wynik świadomego kompromisu między dwiema sprzecznymi potrzebami: Arek chce widzieć CAŁY dzień naraz (nie sekwencyjnie, żeby nie zgubić kontekstu), ale badania nad ADHD ostrzegają przed przeciążeniem informacyjnym przy pokazywaniu wszystkiego na raz. Rozwiązanie:
- **Cała chronologiczna oś czasowa dnia zawsze widoczna** — przewijana lista bloków od pobudki do snu, żaden blok nie jest ukryty na starcie
- **Szczegóły każdego bloku są ZWINIĘTE domyślnie i rozwijają się po kliknięciu** — np. blok "16:15 Trening FBW-A" na pierwszy rzut oka pokazuje tylko nazwę, ikonę, checkbox; dopiero kliknięcie rozwija pełną listę ćwiczeń z polami do wpisania serii/powtórzeń/ciężaru
- To pozwala jednocześnie: widzieć strukturę całego dnia (redukcja lęku "co mnie jeszcze czeka") i unikać przeciążenia szczegółami wielu modułów naraz
- **Karty zadań — rozszerzony format (zmiana względem v4):** ikona modułu + kolor + checkbox + godzina + **krótki opis** (1 linia, np. "3 serie × 8-10 powt.") + **cel liczbowy gdy dotyczy** (np. "1h" dla czytelnictwa, "2/4" dla tokenów) — więcej informacji niż pierwotnie zakładano, bo Arek potrzebuje kontekstu bez rozwijania karty
- **Pasek postępu dnia (0-100%): PRZYPIĘTY na stałe u góry ekranu**, widoczny nawet przy przewijaniu listy w dół — nie znika, nie trzeba wracać na górę żeby sprawdzić postęp
- **Licznik punktów (XP) + streak w headerze**, obok paska postępu
- **Widoczne na bieżąco (nie ukryte, nie uproszczone do koloru/słowa) liczby mechanik w tle:** rolling average (np. "czytanie: śr. 7-dniowa 55 min"), floor/ceiling (np. "sprzątanie: 20/60 min dziś"), licznik tokenów dnia ochronnego (np. "pozostałe tokeny: 3/4"), zasada 70/30 przy zakupach — Arek explicite chce widzieć te konkretne liczby codziennie, nie uproszczony status
- **Komunikat o przesunięciu harmonogramu przez nadgodziny:** gdy RCP (sekcja 0.8) wykryje nadgodziny i przesunie popołudniowe bloki, widoczny, jawny baner/komunikat w widoku dnia — np. "Harmonogram przesunięty o 45 min z powodu nadgodzin — trening: 17:00 zamiast 16:15" — NIGDY ciche przesunięcie bez wyjaśnienia
- **Formularz "Dodaj zadanie" zawsze dostępny** (np. stały przycisk/FAB) — pozwala dodać jednorazowe zadanie ad-hoc poza szablonem dnia (np. "wizyta u dentysty 14:00"), bez naruszania sztywności głównego szablonu
- **Cofanie błędów:** proste "kliknij ponownie, żeby odznaczyć" — bez dedykowanego UI do cofania, wystarczy że checkbox jest przełącznikiem (toggle), nie jednokierunkowym potwierdzeniem

### 6.2 Nawigacja — hybrydowa struktura
- **Widok Dnia jako ekran główny** (to, co się otwiera po wejściu do aplikacji)
- **Osobne, rzadziej odwiedzane widoki dla pozostałych obszarów:** Trening (szczegółowy log/wykresy), Portfolio Figurek, Przegląd Tygodniowy, Karta Postaci (RPG)
- **Nawigacja mobilna:** dolny pasek nawigacji (standardowy wzorzec aplikacji mobilnych) — proponowane zakładki: Dzień / Tydzień / Trening / Portfolio / Postać — pozwala szybkie przełączanie bez zagłębiania się w menu, co jest istotne przy ADHD (mniej kroków = mniejsza szansa na porzucenie akcji w trakcie)
- **Nawigacja desktopowa:** boczny panel lub górne zakładki odzwierciedlające tę samą strukturę, dostosowane do szerszego ekranu

### 6.3 Widok treningu (szczegółowy)
- Formularz do wpisania: ćwiczenie → seria → powtórzenia → ciężar
- Historia poprzednich sesji tego samego ćwiczenia (do porównania — progressive overload), pre-wypełnione wartościami z poprzedniej sesji jako punkt odniesienia
- Wykres liniowy: ciężar/objętość w czasie, per ćwiczenie
- Wykres słupkowy: liczba treningów w tygodniu/miesiącu
- Widoczna sugestia reguły plateau, gdy aktywna (patrz Moduł 2), z krótkim uzasadnieniem ("3 sesje bez progresu")
- **Edycja planu (Runda #17):** ćwiczenie/serie/powtórzenia w pełni edytowalne przez Arka z tego widoku, nie tylko odczyt sztywnego planu A/B
- **Pole oceny sesji (Runda #17):** po zamknięciu treningu, obowiązkowe pole „jak poszło" (1-10) + opcjonalna notatka, widoczne razem z historią poprzednich sesji

### 6.4 Widok Portfolio Figurek
- **Lista projektów z wyszukiwarką/filtrem** (po kategorii rozmiaru, statusie: w toku/ukończony) — wdrożone od początku, nie odłożone na później mimo małego portfolio na start
- Formularz nowego projektu: nazwa, kategoria rozmiaru, typ pracy (sklejanie/malowanie/oba) → wyświetla orientacyjny szacunek czasu z tabeli (Moduł 18)
- Po zakończeniu: pole rzeczywistego czasu, automatyczne porównanie z szacunkiem
- Checklist publikacji per projekt: zdjęcie zrobione / opis napisany / opublikowane (+ kanały)
- **Zdjęcia NIE są przechowywane w systemie** — tylko checkbox faktu wykonania zdjęcia, żadnego uploadu/galerii w samej aplikacji (zdjęcia żyją tam, gdzie Arek je faktycznie publikuje — IG, Putty & Paint, itd.)

### 6.5 Widok tygodniowy (Review — niedziela, 15-20 min)
- Podsumowanie: % ukończenia każdego modułu w tygodniu
- Wykres trendu mood trackera (5 kategorii, 7 dni, rano+wieczór osobno)
- Historia ostatnich 4 tygodni (trend długoterminowy — motywacyjny, nie karzący)
- Liczba zdobytych punktów w tygodniu + porównanie do poprzedniego
- Opcjonalny raport tekstowy do przeczytania/eksportu
- **Rozszerzenie w Rundzie #17:** ten widok staje się częścią szerszego, graficznego Dashboardu (patrz nowa sekcja 6.13) — treść zostaje bez zmian, ale prezentacja przechodzi z tekstowego podsumowania na wykresy

### 6.6 Karta Postaci (widok RPG) — osobny, większy ekran
Zgodnie z decyzją Arka, to NIE mały widget w rogu głównego widoku, tylko **pełnoprawny, dedykowany ekran** dostępny z nawigacji głównej (sekcja 6.2):
- 5 pasków Atrybutów z aktualnym poziomem: Ciało, Umysł, Dyscyplina, Otoczenie, **Personal Brand** (nowy, 5. Atrybut — patrz sekcja 4.1 zaktualizowana)
- Pasek HP z aktualną wartością liczbową
- Ogólny poziom postaci + aktualne XP / próg do następnego poziomu
- Lista zdobytych odznak (stałe i sezonowe rozróżnione wizualnie)
- Historia "śmierci postaci" (jeśli wystąpiły) — jako część kroniki postępu, nie ukrywana

### 6.7 Ostrzeżenia HP — skala nasilenia dopasowana do poziomu zagrożenia
Zamiast jednej, stałej formy ostrzeżenia, nasilenie komunikatu skaluje się z poziomem HP:
- **HP bardzo niskie (<10%):** pełnoekranowy, blokujący alert — trzeba go świadomie zamknąć, żeby wrócić do aplikacji, spójne z ogólną preferencją agresywnych powiadomień
- **HP średnio niskie (10-25%, FINALNIE potwierdzone w Rundzie #9):** zauważalny, ale nieblokujący baner na górze ekranu
- Oba poziomy pokazują listę konkretnych brakujących zadań, które pozwolą odzyskać HP (zgodnie z zasadą transparentności rekomendacji ustaloną wcześniej)

### 6.8 Wyzwalacz Nicnierobienia — hybryda sugestii i potwierdzenia
System **sugeruje** moment rozpoczęcia bloku nicnierobienia (np. wykrywając, że ostatnie zaplanowane zadanie dnia zostało odhaczone), ale **Arek ręcznie potwierdza/uruchamia** blok — nie w pełni automatyczne uruchomienie. To daje kontrolę nad przejściem (może jeszcze chwilę dokończyć coś innego), przy zachowaniu systemowego przypomnienia, że ten czas mu się należy.

### 6.9 Motyw wizualny — PIP-BOY (Runda #16, decyzja finalna, zastępuje wcześniejszą koncepcję PSX×NOIRE+RPG)

Cały interfejs systemu — w tym Karta Postaci i wszystkie widoki gamifikacji, nie tylko Widok Dnia — jest stylizowany na **Pip-Boy**, kultowe urządzenie z serii gier Fallout. To nie jest luźna inspiracja kolorystyczna, tylko pełny, spójny kierunek wizualny, oparty na trzech niezależnych analizach przeprowadzonych przed podjęciem decyzji: (1) research historyczno-wizualny oryginalnego interfejsu gry, (2) sprawdzenie realnej wykonalności technicznej na web (potwierdzone — istnieją gotowe implementacje CSS tego stylu), (3) konfrontacja z literaturą o dostępności interfejsów dla ADHD (wykryto i rozwiązano realną sprzeczność, patrz niżej).

**Paleta kolorów:** Klasyczny zielony Pip-Boy jako domyślny i jedyny wymagany kolor bazowy — z rodziny monochromatycznych zielonych ekranów CRT (orientacyjnie #12FF15 / #3dff3d), czarne lub prawie czarne tło. Warianty bursztynowy/niebieski (znane z różnych gier serii Fallout) NIE są wymagane jako opcja przełączalna — zielony jest jedynym ustalonym wymogiem.

**Czcionka — wymóg twardy:** Font o stałej szerokości znaków (monospace), w duchu pikselowych/retro krojów kojarzonych ze starymi terminalami komputerowymi. To świadomy wybór estetyczny Arka, utrzymany mimo świadomości, że czcionki monospace bywają nieco mniej komfortowe w czytaniu długich fragmentów tekstu niż czcionki proporcjonalne — priorytetem jest tożsamość wizualna, nie maksymalizacja szybkości czytania.

**Nawigacja — zakładki tekstowe, NIE ikony graficzne:** Kluczowe odkrycie z researchu: oryginalny interfejs Pip-Boya w grach Fallout **nie posiada biblioteki ikon/piktogramów** do nawigacji głównej — używa tekstowych etykiet zakładek (w grze: STAT, INV, DATA, MAP, RADIO) jako podstawowego mechanizmu przełączania widoków. Ten system przyjmuje analogiczne podejście: główna nawigacja to zakładki tekstowe (np. DZIEŃ / POSTAĆ / TYDZIEŃ / PORTFOLIO), nie ikony. Jedyne symbole graficzne w oryginalnym źródle to garstka bardzo prostych, funkcjonalnych kształtów (krzyż/plus medyczny, pasek bateryjny reużyty jako miernik) — nie ma tam nic bardziej złożonego do naśladowania.

**Status zadań — proste znaki ASCII, NIE emoji, NIE wymyślony zestaw ikon:** Zamiast emoji jako ikon modułów (odrzucone po zobaczeniu wizualnego porównania) lub granicznie czystego, w pełni monochromatycznego ASCII (Wariant C, też zaprezentowany), Arek wybrał **hybrydę**: bazowa forma to tekstowe/ASCII oznaczenia statusu (np. znak "+" dla wykonanego zadania, "o" dla oczekującego, ">" jako marker linii) w duchu źródłowego stylu, ALE z dodanym akcentem kolorystycznym/wizualnym wyróżniającym zadania **obligatoryjne** (Sekcja 2.0) od **opcjonalnych** — bo to rozróżnienie jest funkcjonalnie ważniejsze niż czystość stylistyczna, a sam ASCII bez żadnego wyróżnienia rozmywałby tę różnicę na pierwszy rzut oka. Dokładna forma tego wyróżnienia (np. jaśniejszy odcień zielonego dla obligatoryjnych, dodatkowy nawias/ramka, pogrubienie) do ustalenia na etapie budowy UI, ale zasada jest wiążąca: **rozróżnienie obligatoryjne/opcjonalne musi być natychmiast widoczne wizualnie, nie tylko przez czytanie etykiety.**

**Regulowana intensywność efektów CRT — rozwiązanie sprzeczności ADHD vs autentyczność:** Klasyczny efekt CRT (migotanie ekranu, linie skanowania/scanlines, drobne zakłócenia obrazu) jest integralną częścią tożsamości wizualnej Pip-Boya, ale literatura o dostępności interfejsów dla ADHD jednoznacznie wskazuje, że migoczące/animowane elementy UI pogarszają skupienie (narzędzia wspierające ADHD often mają "wyłącz animacje" jako kluczową funkcję dostępności). Rozwiązanie: **przełącznik ustawień z trzema poziomami intensywności, w stylu opcji graficznych w grach wideo:**
- **Low:** Czysty wygląd Pip-Boya bez żadnych ruchomych efektów — tylko kolor, czcionka, ramki, układ. Zalecany domyślny poziom dla codziennego użytku, szczególnie w kontekście ADHD
- **Medium:** Umiarkowane efekty retro — dokładna specyfikacja do ustalenia na etapie implementacji (np. bardzo subtelne, statyczne linie skanowania bez migotania)
- **Ultra:** Pełna autentyczność — migotanie, scanlines, drobne zakłócenia jak w oryginalnym urządzeniu z gry, dla pełnej immersji, kosztem potencjalnego wpływu na skupienie
- Ustawienie zapisane per-użytkownik (jedyny użytkownik systemu, patrz Sekcja 0.11), zmienialne w dowolnym momencie z poziomu ustawień aplikacji

**Nawiązanie do obudowy urządzenia — subtelne, nie dosłowne:** Oryginalny Pip-Boy to fizyczne urządzenie noszone na nadgarstku, z metalową obudową wokół ekranu. System NIE odtwarza pełnej ramki imitującej to urządzenie wokół całej aplikacji — tylko lekkie, subtelne nawiązanie wizualne (np. zaokrąglone rogi, delikatna ramka, drobne detale w headerze), bez udawania fizycznego sprzętu.

**Tryb ciemny/jasny:** Przełącznik MANUALNY (Runda #9, wciąż aktualne) — Arek sam decyduje, kiedy przełączyć, nie ma automatycznej zmiany wg pory dnia. Domyślny motyw przy pierwszym uruchomieniu: ciemny (naturalnie spójny z estetyką ekranu CRT). Manualny przełącznik oznacza też, że higiena światła wieczorem (Moduł 10A) pozostaje osobnym, świadomym działaniem Arka (checkbox "ograniczyłem światło"), nie jest zautomatyzowana poprzez wymuszenie ciemnego motywu po zachodzie słońca.

**Skalowanie rozmiaru czcionki (Runda #17, wymóg potwierdzony):** niezależny od poziomu efektów CRT (Low/Medium/Ultra) suwak/ustawienie rozmiaru tekstu w Ustawieniach — czytelność przy dłuższym, codziennym użytkowaniu ma pierwszeństwo przed jednym, stałym rozmiarem.

**Poziom "Ultra" a ustawienia systemowe urządzenia (Runda #17, doprecyzowanie — PEŁNA KONTROLA RĘCZNA):** intensywność efektów CRT NIE jest automatycznie ograniczana przez systemowe ustawienie "ogranicz ruch" telefonu/komputera — Arek chce pełną, ręczną kontrolę nad tym ustawieniem w samej aplikacji, niezależnie od konfiguracji urządzenia.

**Do ustalenia na etapie budowy UI:** dokładne wartości hex palety, dokładna specyfikacja poziomu "Medium" intensywności efektów, konkretny krój czcionki monospace/pixel do zastosowania, dokładna forma wyróżnienia obligatoryjne/opcjonalne — prawdopodobnie z użyciem skilla frontend-design przy faktycznej implementacji.

### 6.10 Dostępność dotykowa — DECYZJA FINALNA (Runda #9)
Ustalona reguła: **duże, łatwe do trafienia elementy dotykowe wszędzie tam, gdzie odbywa się codzienne odhaczanie** (checkboxy zadań w Widoku Dnia — suplementy, posiłki, trening, mood tracker, wszystko z głównej listy) — te są używane najczęściej, często w pośpiechu lub zmęczeniu (zaraz po treningu, wieczorem przed snem), więc priorytet ma pewność trafienia. **Standardowy rozmiar dla elementów rzadziej używanych** (ustawienia, formularze Portfolio Figurek, szczegółowe widoki treningowe, konfiguracja) — tu precyzja nie jest krytyczna, a więcej informacji na ekranie jest cenniejsze niż większe elementy. Rekomendacja techniczna: min. 44×44px dla głównych, codziennych akcji (zgodnie ze standardową praktyką mobilnego UI), standardowe wymiary komponentów w pozostałych miejscach.

### 6.11 Pierwsze uruchomienie — Onboarding (Runda #10, nowy element)
Ustalono: **prosty formularz onboardingowy, krok po kroku**, wypełniany raz przy pierwszym uruchomieniu systemu, zamiast zaczynania od pustego systemu lub tylko minimalnego zestawu pytań.

**Proponowana sekwencja kroków (do dopracowania na etapie budowy, ale kierunek ustalony):**
1. **Podstawy grafiku** — wgranie pierwszego miesięcznego grafiku pracy (zgodnie z rytuałem z sekcji 0.7), automatyczne wyliczenie typów dni (A/B/Wolny)
2. **Dni treningowe** — potwierdzenie stałych dni tygodnia (domyślnie Wt/Czw/Sob, edytowalne)
3. **Suplementy** — lista rdzennych (domyślnie: Kreatyna, Vita Pak, Kolagen, Omega 3) + warunkowych (Melatonina, Gainer), z możliwością edycji
4. **Pielęgnacja** — potwierdzenie/dostosowanie harmonogramu per-produkt (sekcja Moduł 7)
5. **Sprzątanie** — potwierdzenie rotacji 7-strefowej i harmonogramu robota
6. **Pojazdy** — czy dotyczy (Auto zawsze, Motocykl opcjonalnie z potwierdzeniem sezonu)
7. **Integracja RCP** — połączenie z arkuszem RCP (jednorazowa konfiguracja dostępu/uprawnień)
8. **Kalendarz** — założenie/połączenie z Google Calendar
9. **Podsumowanie i start** — pokazanie wygenerowanego pierwszego Widoku Dnia na podstawie wszystkich powyższych ustawień, z możliwością ostatniej korekty przed zatwierdzeniem

Onboarding jest jednorazowy — po ukończeniu system przechodzi do normalnego trybu (Widok Dnia jako ekran startowy przy każdym kolejnym otwarciu). Zmiana ustawień po onboardingu odbywa się przez osobny ekran "Ustawienia" (nie wymaga przechodzenia przez cały formularz ponownie).

### 6.12 Marquee sugestywne (nowy element, Runda #17)
Warstwa delikatnych, kontekstowych podpowiedzi behawioralnych, znacznie szersza niż pojedyncze, punktowe komunikaty rozsiane dotąd po systemie (np. ostrzeżenie HP w sekcji 6.7, follow-up GI w Module 11).

- **Forma:** stale obecny, przewijany pasek tekstu (marquee/ticker) w interfejsie — NIE pojedyncze wyskakujące okna (popupy), które przerywałyby uwagę
- **Zakres:** minimum 100 komunikatów, obejmujących praktycznie każdy moduł systemu (suplementy, trening, dieta, sen, sprzątanie, portfolio itd.), nie tylko obszary "wysokiego ryzyka" jak GI czy HP
- **Mechanizm doboru:** kontekstowy — treść paska zmienia się zależnie od aktualnej sytuacji (pora dnia, status ukończenia dnia, aktywny GOD_MODE_24H/Tryb Regeneracji, zbliżający się deadline modułu itd.), nie czysto losowy
- **Model danych:** nowa tabela `Marquee_Komunikaty` (sekcja 7): treść | kategoria/moduł_powiązany | warunek_wyświetlenia | priorytet
- **Zebrane (Runda #18):** 107 komunikatów, gotowych do wgrania — plik `docs/data/marquee-komunikaty.csv` w repozytorium. Obejmują wszystkie moduły systemu (suplementy, dieta, trening, sen, mood, czytelnictwo, pielęgnację, sprzątanie, naturę, portfolio, HP/odznaki, GOD_MODE, pojazdy, zakupy, badania, rozciąganie, czas wolny, finanse i komunikaty ogólne), każdy z warunkiem kontekstowym i priorytetem (1-3) do wykorzystania przy sortowaniu, gdy kilka warunków spełnia się naraz

### 6.13 Dashboard graficzny (nowy, rozszerzony element, Runda #17)
Zamiast wyłącznie tekstowego podsumowania tygodniowego (sekcja 6.5), pełnoprawny widok analityczny z wykresami.

- **Widok ogólny:** zbiorcze podsumowanie całego systemu — pasek HP, 5 Atrybutów, streak, % ukończenia w czasie (wykres liniowy), rozkład punktów wg Atrybutu
- **Podzakładki per segment:** osobne widoki szczegółowe dla głównych obszarów (Trening, Dieta/Suplementy, Sen/Nastrój, Portfolio Figurek, Dom/Pojazdy) — każdy z własnymi wykresami odpowiednimi do danego modułu (np. wykres ciężaru dla Treningu już opisany w sekcji 6.3, trend mood dla Modułu 11, minuty/tydzień dla Portfolio)
- **Umiejscowienie w nawigacji:** dostępny z głównej nawigacji (sekcja 6.2), nie ukryty wyłącznie wewnątrz Widoku tygodniowego
- **Do etapu implementacji:** dobór konkretnej biblioteki wykresów w ramach stosu HTML/JS (sekcja 1.1) i dokładny układ podzakładek — zadanie projektowe UI, nie decyzyjne

---

## 7. DANE — MODEL (do implementacji)

### 7.1 Tabele/arkusze potrzebne
1. **Grafik_Pracy** (miesięczny import): data | dzień_tygodnia | start | koniec | typ_dnia (A/B/Wolny)
2. **Szablony_Dnia**: typ_dnia | blok_czasowy | nazwa_zadania | moduł | punkty | atrybut_rpg
3. **Log_Dzienny**: data | moduł | zadanie | wykonano (bool) | wartość_dodatkowa (np. kg, min, ocena) | godzina_wykonania | google_calendar_event_id (dla synchronizacji dwustronnej) | nawodnienie_ok (bool, osobne pole dzienne)
4. **Log_Treningowy**: data | trening_typ (A/B/podmieniony-inny/ad-hoc/zmodyfikowany-zdrowie — rozszerzone w Rundzie #17) | zrodlo_sesji (plan-AB/biblioteka-crossfit/reczny-wpis) | powod_modyfikacji (zdrowie/zmeczenie/zle-samopoczucie/inne — tylko gdy trening_typ=zmodyfikowany-zdrowie, Runda #17) | ćwiczenie | seria_nr | powtórzenia | ciężar_kg | ocena_sesji_1_10 (obowiązkowe, Runda #17) | notatka | nowy_rekord (bool)
5. **Plan_Treningowy** (w pełni edytowalny przez Arka — Runda #17): trening_typ (A/B) | ćwiczenie | serie_docelowe | powtórzenia_zakres | przerwa_sek | kolejność
6. **Mood_Log**: data | pora (rano/wieczór) | nastrój | energia | sen | skupienie | GI | notatka_GI_followup (tekst, tylko gdy GI ≤ próg)
7. **Punkty_Historia**: data | punkty_dzienne | atrybut_cialo | atrybut_umysl | atrybut_dyscyplina | atrybut_otoczenie | HP_koniec_dnia | streak_aktualny | total_punktow | poziom_postaci | smierc_postaci_bool
8. **Odznaki_Log**: data_zdobycia | nazwa_odznaki | typ (stała/sezonowa) | opis
9. **Pielęgnacja_Log**: data | produkt | wykonano (bool) | data_ostatniej_wizyty_fryzjer
10. **Sprzątanie_Rotacja**: dzień_tygodnia | strefa | ostatnie_wykonanie
11. **Suplementy_Definicje**: nazwa | kategoria (rdzenny/warunkowy) | limit_dzienny (np. melatonina max 5) | pora_przypomnienia
12. **AI_Coach_Insights** (Faza 2, struktura przygotowana od początku): data_wygenerowania | typ_korelacji | opis_tekstowy | moduły_źródłowe | potwierdzona_przez_uzytkownika (bool)
13. **Biblioteka_Mobilnosc_CrossFit** (do wypełnienia po dostarczeniu przez Arka): nazwa_cwiczenia | partia_ciala (biodra/barki/inne) | opis | źródło (head coach CrossFit)
14. **Tokeny_Dnia_Ochronnego / GOD_MODE_24H** (rozszerzone w Rundzie #17): data_aktywacji | data_docelowa | typ (dzień/tryb-regeneracji) | moduly_objete (domyślnie: wszystkie oprócz suplementów rdzennych) | wykorzystane_w_miesiacu (licznik do limitu 4/mies., dotyczy tylko typu "dzień")
15. **RCP_Log** (odczyt z zewnętrznego systemu RCP): data | godzina_wejscia | godzina_wyjscia | zrodlo (RCP We Smile) — read-only dla tego systemu
16. **Auto_Log**: data_ostatniego_przegladu | notatka
17. **Motocykl_Log**: data_wiosennego_przygotowania | data_jesiennego_odlozenia | data_ostatniej_kontroli_miesiecznej | aktywny_w_sezonie (bool, wyliczany z daty)
18. **Zakupy_Rekomendacje**: kategoria (Białko/Węglowodany złożone/Warzywa i owoce/Nabiał) | produkt | typ (70%-core / 30%-rotacyjny) | ostatnio_rekomendowany
19. **Portfolio_Projekty**: data_rozpoczecia | nazwa_modelu | kategoria_rozmiaru (Mała/Średnia/Duża/Zestaw) | typ_pracy (sklejanie/malowanie/oba) | czas_szacowany_h | czas_rzeczywisty_h | status (w toku/ukończony) | zdjecie_zrobione (bool) | opis_napisany (bool) | opublikowane_kanaly (lista)
20. **Nicnierobienie_Log**: data | dlugosc_min | forma (opcjonalnie: kolorowanka/podcast/nic/inne) | wyzwolone_przez (koniec_dnia/przed_praca/po_pracy)
21. **Rolling_Average_Cele**: modul (czytelnictwo/pielegnacja/portfolio — rozszerzone w Rundzie #17) | data | wartosc_dnia | srednia_7dni
22. **Backup_Eksport_Log**: data_eksportu | format | lokalizacja_pliku | status (sukces/blad) — rejestr cotygodniowych automatycznych eksportów (Runda #10)
23. **Cytaty_Motywacyjne** (Runda #17): treść | autor (opcjonalnie) | źródło | data_ostatniego_wyświetlenia
24. **Marquee_Komunikaty** (Runda #17): treść | kategoria/moduł_powiązany | warunek_wyświetlenia | priorytet
25. **Finanse_Osobiste** (Moduł 21, przyszły — Runda #17): data | saldo_rezerwa_podatkowa | saldo_poduszka_osobista | cel_miesięczny

### 7.2 Rekomendowana technologia (do etapu implementacji w Claude Code)
- Backend danych: Google Sheets (łatwa edycja ręczna przez Arka, dobra integracja z Apps Script, zgodność z istniejącym ekosystemem Cerebro)
- Automatyzacja: Google Apps Script (generowanie dziennych eventów w Calendar, przeliczanie punktów, cotygodniowe podsumowania)
- Interfejs: HTML/JS webapp (Apps Script Web App lub osobna lekka aplikacja) — spójna z resztą narzędzi Arka
- Powiadomienia: Google Calendar (natywne alerty na iOS/Windows)

---

## 8. OTWARTE PYTANIA DO ETAPU IMPLEMENTACJI

Po Rundzie Doprecyzowania #9 zdecydowana większość punktów liczbowych, harmonogramowych i mechanicznych jest DOMKNIĘTA (krzywa XP ma finalną formułę matematyczną — sekcja 4.1; wartości HP mają finalną tabelę — sekcja 4.2; próg ostrzeżeń HP potwierdzony <10%/10-25% — sekcja 6.7; pełna lista 208 odznak z podziałem stałe/sezonowe gotowa — sekcja 4.3; integracja z Cerebro rozstrzygnięta — patrz niżej; sezon motocyklowy potwierdzony kwiecień-październik — Moduł 16; mechanizm zakupów 70/30 rozstrzygnięty — patrz niżej; struktura RCP zmapowana — patrz niżej; tryb ciemny/jasny rozstrzygnięty jako przełącznik manualny — sekcja 6.9; touch-target rozstrzygnięty regułą "duże dla codziennych, standardowe dla rzadkich" — sekcja 6.10).

**Decyzje finalne z Rundy #9 (do zapisania w odpowiednich sekcjach):**
- **Integracja z Cerebro:** Arek potwierdził — system ma być zintegrowany z Cerebro jako nowa gałąź/sekcja istniejącego ekosystemu Google Drive, NIE osobny, niezależny system (patrz zaktualizowana sekcja 0.9 poniżej)
- **Zakupy 70/30 — mechanizm:** prosty predefiniowany zestaw (szybszy, przewidywalny, bez kosztów API) jako podstawa, ROZSZERZONY o opcję manualnych reminderów "sprawdź gazetkę z promocjami" — czyli combo z pierwotną koncepcją z Modułu 17, nie zmiana kierunku, tylko potwierdzenie
- **Struktura RCP:** zmapowana z realnego arkusza Arka ("WS ewidencja czasu pracy") — patrz zaktualizowana sekcja 0.8 poniżej. Arek jest wierszem WS01 w arkuszu "Pracownicy"; interesują nas WYŁĄCZNIE dane dla WS01/Arkadiusz Graczyk, nie innych pracowników kliniki. Relevantne arkusze do odczytu: prawdopodobnie `Ewidencja_Czasu` (surowe wejścia/wyjścia) i `Przekroczenia` (nadgodziny już wyliczone) — dokładne kolumny do zweryfikowania przy sesji technicznej (arkusz ma też `Anomalie`, `GrafikDni`, `Grafik` — potencjalnie pomocnicze)

**Pozostałe, faktycznie otwarte punkty (wymagają czasu/danych, nie da się ich domknąć rozmową):**

1. **Baza treningów mobilnościowych CrossFit** — Arek dostarczy własną, spisaną bazę ćwiczeń od head coacha CrossFit (ukierunkowaną pod mobilność bioder/barków dla BJJ/boksu) w najbliższych dniach — do włączenia jako biblioteka w Module 3, gdy zostanie przekazana
2. **Weryfikacja obciążenia treningowego przy 3x/tydzień od startu** — flagowane w Module 2 jako bardziej agresywne tempo niż standardowa progresja dla wracających po 2-letniej przerwie; reguła plateau ma działać jako wczesny system ostrzegawczy, ale wymaga to obserwacji Arka w pierwszych 2-3 tygodniach, nie da się rozstrzygnąć teoretycznie
3. **Kalibracja orientacyjnych czasów Portfolio Figurek** (tabela w Module 18) — widełki oparte na branżowych standardach ogólnych, do skorygowania pod indywidualne tempo Arka po pierwszych 3-5 zarejestrowanych projektach — wymaga rzeczywistych danych
4. **Moment aktywacji Modułu 14 (AI Coach)** — po zebraniu 4-6 tygodni danych, konkretną datę/warunek startu ustali Arek lub system automatycznie na podstawie liczby wypełnionych dni — z natury rzeczy nie da się tego przyspieszyć
5. **Dokładna paleta kolorów motywu hybrydowego** (sekcja 6.9) — kierunek ustalony (struktura PSX×NOIRE + kolorystyka RPG), ale konkretne wartości hex do zaprojektowania na etapie budowy UI, prawdopodobnie z użyciem skilla frontend-design — to zadanie implementacyjne, nie decyzyjne
6. **Dokładne kolumny arkusza RCP do odczytu** — zmapowano ogólną strukturę (patrz wyżej), ale precyzyjne nazwy kolumn w `Ewidencja_Czasu`/`Przekroczenia` wymagają jednej krótkiej sesji technicznej z bezpośrednim dostępem do arkusza przy starcie implementacji (nie blokuje konceptu, jest to trywialny krok na starcie budowy)
7. **Dokładny mechanizm HP dla celów rolling-average** (Moduł 20) — finalna tabela HP (sekcja 4.2) obejmuje już większość modułów, ale dokładny próg "co liczy się jako wystarczające minimum dnia" dla czytelnictwa/pielęgnacji w logice rolling-average wymaga jeszcze jednej rundy kalibracji razem z realnymi danymi po 2-3 tygodniach
8. **Szczegółowa strategia rozwiązywania konfliktów synchronizacji offline** (sekcja 1.1) — robocza rekomendacja "ostatni zapis wygrywa" z oznaczeniem w UI, ale dokładny mechanizm wykrywania i prezentacji konfliktów między dwoma urządzeniami (telefon+komputer) wymaga projektowania na etapie implementacji, to nietrywialny komponent inżynierski wymagający testowania w praktyce, nie decyzji przy stole
9. **Biblioteka dodatkowych planów treningowych poza A/B** (Moduł 2, nowe narzędzie wymiany treningu — Runda #14) — Arek zażądał możliwości podmiany sesji treningowej, ale konkretne dodatkowe plany (poza FBW A/B i przyszłą biblioteką CrossFit) nie zostały jeszcze zdefiniowane — do uzupełnienia przez Arka w miarę potrzeby, system ma tylko mechanizm gotowy na przyjęcie takich planów
10. **Dokładny próg rolling-average dla czytelnictwa po zmianie na obligatoryjne** (Moduł 20 vs Moduł 5, Runda #14) — czytelnictwo ma teraz podwójną logikę: dzienny obowiązek (kara HP za zero) ORAZ rolling-average jako metryka jakościowa w tle — dokładna interakcja obu mechanizmów (czy średnia tygodniowa wpływa na cokolwiek poza wyświetlaniem trendu) wymaga doprecyzowania przy kalibracji ogólnej tabeli HP

---

## 9. PODSUMOWANIE — CO TEN SYSTEM ROBI, A CZEGO NIE ROBI

**System ROBI:**
- Generuje codziennie spersonalizowaną mapę dnia dopasowaną do zmiennego grafiku pracy (Szablony A/B/C)
- Prowadzi przez dzień strukturą czasową z buforem ±15 min (elastyczne okno powiadomień)
- Trackuje szczegółowo trening wg konkretnego, gotowego planu FBW A/B z automatyczną progresją ciężarów i sugestią przy plateau (zmiana ćwiczenia/deload, decyzja ręczna)
- Rozróżnia suplementy rdzenne (obowiązkowe) od warunkowych (Melatonina, Gainer — dostępne, nie karane za pominięcie)
- Trackuje ogólnie dietę (bez kcal, bez sugestii dań, z korektą "węglowodany proste vs złożone" i naciskiem na białko w Posiłku 1), czytelnictwo (minuty + tytuły), pielęgnację (rozbita per-produkt, każdy z własnym rytmem), sprzątanie (rotacyjnie, 7 stref, wspomagane robotem 2x/dzień)
- **Motywuje przez pełną mechanikę RPG w stylu Habitica** — punkty życia (HP) tracone za niewykonane obowiązkowe zadania, "śmierć postaci" przy HP=0 (popup GAME OVER, utrata poziomu, odznak sezonowych, restart streak, zerowanie postępu w trakcie zdobywania niespełnionych progów — pełna logika w sekcji 4.1), z wyprzedzającym ostrzeżeniem przy niskim HP i jasnym wytłumaczeniem przyczyn — świadomie wybrana przez Arka mechanika presji, mimo udokumentowanego ryzyka przy współwystępującej depresji
- **Daje ręczny "wyłącznik awaryjny" presji** — GOD_MODE_24H (dawny Token Dnia Ochronnego, sekcja 4.1a) jako natychmiastowy, ręczny przełącznik na 24h bez automatycznej sugestii systemu, oraz Tryb Regeneracji (sekcja 4.1b) na dłuższe, wielodniowe okresy obniżonej wydolności, z przypomnieniami wciąż aktywnymi, tylko bez kary punktowej
- **Zaczyna dzień Cytatem Dnia** (sekcja 5.4, 300 cytatów z podanym autorem) i utrzymuje stałą, kontekstową warstwę delikatnych podpowiedzi behawioralnych w formie przewijanego paska Marquee (sekcja 6.12, min. 100 komunikatów), zamiast przerywających popupów
- Monitoruje samopoczucie 2x dziennie (rano+wieczór), z inteligentnym follow-up przy niskim wyniku GI (pyta retrospektywnie o jedzenie z ostatnich 48h, zgodnie z kliniczną praktyką food-symptom diary)
- Wspiera higienę snu przy pracy zmianowej: stałe godziny per typ dnia (zgodne z konsensusem Delphi 2023) + manualny checkbox redukcji światła/ekranów wieczorem
- Kieruje mobilność post-treningową w stronę bioder/barków (typowe ograniczniki BJJ/boksu), z docelową biblioteką ćwiczeń od head coacha CrossFit
- Automatycznie dostosowuje się do typu dnia (A/B/Wolny), niezależnie od stałych dni treningowych
- Synchronizuje się DWUSTRONNIE z Google Calendar (zmiany w kalendarzu odzwierciedlają się w systemie i odwrotnie)
- **Czyta realny czas pracy z istniejącego systemu RCP Arka** — popołudniowy harmonogram dopasowuje się do faktycznego, nie zaplanowanego końca pracy, z doliczeniem dojazdu; nadgodziny nie kosztują HP
- **Prowadzi Portfolio Figurek** jako osobny podsystem — szacowanie czasu wg prostej, edytowalnej kategoryzacji rozmiaru, tracking estymowany-vs-rzeczywisty, checklist publikacji, rolling-average minut tworzenia jako miękki sygnał trendu marki (bez kary HP, Runda #17), strategię budowania marki opartą na researchu branżowym (regularność postów > liczba ukończonych modeli; platforma Putty & Paint — decyzja o włączeniu odroczona, Runda #17)
- **Pokazuje ogólny stan systemu graficznie** — Dashboard z wykresami i podzakładkami per segment (sekcja 6.13), zamiast wyłącznie tekstowego podsumowania tygodniowego
- **Dba o pojazdy** — Auto (miesięczny przegląd) i Motocykl (sezonowe przypomnienia + comiesięczna kontrola w sezonie) jako osobne moduły z logiką sezonowości
- **Generuje inteligentne rekomendacje zakupowe** wg zasady 70/30 (sprawdzone źródła + rotujące nowości) zamiast sztywnej listy, z manualnym przypomnieniem o sprawdzeniu gazetki Aldi (potwierdzone: brak API do automatyzacji)
- **Chroni przestrzeń na kontrolowane nicnierobienie** — codzienny blok wyzwalany jako nagroda po zamknięciu dnia, z inteligentnym fallbackiem na dni skompresowane (wydłużenie snu + aktywność wspierająca inny cel)
- **Stosuje wzorzec tagów kategorii + floor/ceiling** (np. `#sprzątanie` łączący mieszkanie i auto) oraz **rolling average dla celów miękkich** (czytelnictwo, pielęgnacja) zamiast sztywnego dziennego "zero-jedynkowego" rozliczenia

(Faza 2, nie MVP) Analizuje korelacje między wszystkimi modułami jako "AI Coach", bez stawiania diagnoz

**System NIE ROBI (świadomie, zgodnie z odpowiedziami Arka):**
- Nie liczy kalorii ani makroskładników, nie sugeruje konkretnych dań
- Nie wymusza flex days ani odpuszczania — jest rigid z założenia, z pełną presją gamifikacyjną (z wyjątkiem nadgodzin i Tokenu Dnia Ochronnego — jedyne dwa wbudowane wyłączenia)
- Nie remindeuje spacerów z psem, badań krwi/lekarza (świadomie pominięte reminder)
- Nie prowadzi codziennego dziennika tekstowego (tylko liczbowy mood tracker + warunkowa notatka GI retrospektywna)
- Nie trackuje aktywnie BJJ/Boksu jako codziennej dyscypliny (dopóki nie zostanie ręcznie aktywowany jako cel bieżący) — ale JUŻ TERAZ przygotowuje mobilność pod te sporty
- Nie stawia diagnoz medycznych — AI Coach (Faza 2) ogranicza się do korelacji z własnych danych użytkownika
- Nie zmienia automatycznie planu treningowego przy plateau — tylko sugeruje, decyzję podejmuje Arek
- Nie automatyzuje pobierania promocji Aldi (potwierdzone technicznie niepraktyczne) — tylko manualny reminder
- Nie wymusza sztywnej liczby ukończonych figurek miesięcznie — portfolio rośnie wg strategii jakościowej, nie ilościowego celu

---

*Koniec dokumentu koncepcyjnego. Gotowy do przekazania jako specyfikacja wejściowa dla sesji budowy w Claude Code.*
