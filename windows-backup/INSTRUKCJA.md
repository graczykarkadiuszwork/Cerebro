# Automatyczny backup z wersjonowaniem — Instrukcja

System przeznaczony do archiwizacji dokumentacji medycznej.
**Nic nie jest nigdy kasowane.** Każda zmiana dokumentu jest pamiętana z datą i godziną.

---

## Jak działa wersjonowanie

Na każdym dysku docelowym powstają dwa podfoldery:

```
D:\Backup\Dokumenty\
├── aktualny\          ← zawsze najnowsza wersja wszystkich plików
└── historia\
    ├── 2025-05-23_0200\   ← pliki, które ZMIENIŁY SIĘ 23 maja o 02:00
    ├── 2025-05-24_0200\   ← pliki, które ZMIENIŁY SIĘ 24 maja o 02:00
    └── 2025-05-25_0200\   ← pliki, które ZMIENIŁY SIĘ 25 maja o 02:00
```

**Jak odczytać historię:**
Każdy folder w `historia\` zawiera poprzednie wersje plików, które zmieniły się
podczas tamtego backupu. Jeśli dokument był zmieniany 10 razy, masz 10 poprzednich
wersji w 10 różnych folderach dat.

**Co się nigdy nie dzieje:**
- żaden plik nie jest kasowany — ani z `aktualny\`, ani z `historia\`
- jeśli dysk zewnętrzny nie jest podłączony, backup do niego jest pominięty,
  ale pozostałe miejsca są nadal kopiowane

---

## Szybki start (3 kroki)

### Krok 1 — Skonfiguruj backup

Otwórz plik **`KONFIGURACJA.ps1`** w Notatniku i ustaw:

```
$FOLDER_ZRODLOWY = "C:\Users\Jan\Dokumenty"   ← skąd kopiować
$FOLDERY_DOCELOWE = @(
    "D:\Backup\Dokumenty",                    ← dokąd (ile chcesz)
    "E:\Backup\Dokumenty"
)
$GODZINA = 2    ← o której godzinie (2 = 02:00 w nocy)
$MINUTA  = 0
```

Zapisz plik i zamknij.

---

### Krok 2 — Zainstaluj harmonogram (raz)

1. Kliknij **prawym przyciskiem** na plik `setup.ps1`
2. Wybierz **"Uruchom z programem PowerShell jako administrator"**
3. Sprawdź wyświetloną konfigurację i potwierdź literą **T**
4. Opcjonalnie uruchom backup testowy — wpisz **T**

Gotowe. Od teraz backup uruchamia się automatycznie każdej nocy.

---

### Krok 3 — Sprawdź po pierwszym backupie

Zajrzyj do folderu docelowego (np. `D:\Backup\Dokumenty\`):
- podfolder `aktualny\` — bieżąca kopia wszystkich plików
- podfolder `historia\` — tu będą trafiać poprzednie wersje
- podfolder `logi\` — tu skrypt składa logi z każdego uruchomienia

---

## Opis plików

| Plik | Opis |
|------|------|
| `KONFIGURACJA.ps1` | **Edytuj ten plik** — wszystkie ustawienia |
| `backup.ps1` | Główna logika — nie edytuj |
| `setup.ps1` | Instalator harmonogramu — uruchom raz jako administrator |
| `logi\` | Logi sesji — tworzone automatycznie obok skryptów |

---

## Zmiana ustawień po instalacji

Edytuj `KONFIGURACJA.ps1` i uruchom `setup.ps1` ponownie jako administrator.
Stare zadanie zostanie zastąpione nowym.

---

## Jak odzyskać poprzednią wersję dokumentu

1. Otwórz dysk docelowy (np. `D:\Backup\Dokumenty\`)
2. Wejdź do folderu `historia\`
3. Znajdź folder z datą bliską tej, kiedy dokument wyglądał tak jak chcesz
4. Skopiuj plik stamtąd w wybrane miejsce

---

## Ostrzeżenie o miejscu na dysku

Historia rośnie z każdym backupem — nic nie jest kasowane.
Skrypt sprawdza wolne miejsce i wyświetla ostrzeżenie (dymek + wpis w logu),
gdy zostaje mniej niż `$OSTRZEZENIE_GB` GB (domyślnie 20 GB).

Gdy dysk zaczyna się zapełniać: podłącz większy dysk zewnętrzny
i przenieś całą zawartość tam — struktura `aktualny\` i `historia\` jest samodzielna.

---

## Ręczne uruchomienie backupu

**Przez Harmonogram zadań:**
Start → „Harmonogram zadań" → `AutoBackup_Cerebro` → prawy klik → „Uruchom"

**Przez PowerShell:**
```
powershell -File "C:\ścieżka\do\backup.ps1"
```

---

## Odinstalowanie harmonogramu

Start → „Harmonogram zadań" → znajdź `AutoBackup_Cerebro` → prawy klik → „Usuń"

Pliki i całą historię możesz zostawić lub przenieść — harmonogram to tylko wpis w systemie.

---

## Najczęstsze pytania

**Backup działa gdy komputer jest wyłączony?**
Nie. Przy kolejnym uruchomieniu komputera zadanie uruchomi się automatycznie
(opcja „Uruchom jeśli pominięto" jest włączona).

**Co jeśli zmieniłem plik wielokrotnie między backupami?**
Backup zapisuje stan pliku z momentu uruchomienia. Zmiany między backupami
w jednej dobie są nadpisywane — tylko wersja z poprzedniego backupu trafia do historii.
Jeśli potrzeba częstszego wersjonowania, zmień `$GODZINA` na kilka razy dziennie
(setup.ps1 tworzy jedno zadanie z jedną godziną — dla kilku godzin uruchom setup raz,
a potem dodaj kolejne zadania ręcznie w Harmonogramie zadań).

**Jak dodać kolejne miejsce docelowe?**
Otwórz `KONFIGURACJA.ps1`, dodaj wiersz do `$FOLDERY_DOCELOWE`,
uruchom `setup.ps1` jako administrator.

**Co oznaczają kody w logu robocopy?**
0 = brak nowych plików, 1 = skopiowano nowe/zmienione, 2–7 = sukces z dodatkowymi info.
Kod 8 lub wyższy to błąd — szczegóły w pliku `robocopy_*.log` w folderze `logi\`.
