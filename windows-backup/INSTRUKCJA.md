# Automatyczny backup Windows — Instrukcja

Backup kopiuje wskazany folder na jeden lub wiele dysków o wybranej godzinie.
Działa w tle, nie spowalnia komputera, zapisuje logi z każdego uruchomienia.

---

## Szybki start (3 kroki)

### Krok 1 — Skonfiguruj backup

Otwórz plik **`KONFIGURACJA.ps1`** w Notatniku i ustaw trzy rzeczy:

```
$FOLDER_ZRODLOWY = "C:\Users\TwojeImie\Dokumenty"   ← skąd kopiować
$FOLDERY_DOCELOWE = @(                               ← dokąd kopiować
    "D:\Backup\Dokumenty",
    "E:\Backup\Dokumenty"
)
$GODZINA = 2                                         ← o której godzinie (2 = 02:00)
$MINUTA  = 0
```

Zapisz plik i zamknij.

---

### Krok 2 — Zainstaluj harmonogram (raz)

1. Kliknij **prawym przyciskiem** na plik `setup.ps1`
2. Wybierz **"Uruchom z programem PowerShell jako administrator"**
3. Potwierdź literą **T** i Enter
4. Opcjonalnie uruchom backup testowy — wpisz **T** i Enter

Gotowe. Backup będzie uruchamiał się automatycznie każdej nocy.

---

### Krok 3 — Sprawdź czy działa

Po pierwszym automatycznym backupie zajrzyj do folderu **`logi\`** —
znajdziesz tam plik `.log` z wynikami (OK lub ewentualne błędy).

---

## Zmiana ustawień po instalacji

Edytuj **`KONFIGURACJA.ps1`** i uruchom `setup.ps1` ponownie jako administrator.
Stare zadanie zostanie automatycznie zastąpione nowym.

---

## Opis plików

| Plik | Opis |
|------|------|
| `KONFIGURACJA.ps1` | **Edytuj ten plik** — wszystkie ustawienia |
| `backup.ps1` | Główny skrypt backupu — nie edytuj |
| `setup.ps1` | Instalator — uruchom raz jako administrator |
| `logi\` | Folder z logami — tworzony automatycznie |

---

## Dyski zewnętrzne i pendrive'y

Jeśli dysk docelowy nie jest podłączony w momencie backupu:
- backup do tego dysku jest **pominięty** (nie powoduje błędu)
- pozostałe miejsca docelowe są nadal kopiowane
- w logu pojawia się wpis "POMINIĘTO: Dysk X: nie jest podłączony"

---

## Powiadomienia

Gdy backup się zakończy, na pasku zadań pojawi się dymek z wynikiem:
- zielony/szary = OK
- żółty = pominięto (brak dysku)
- czerwony = błąd (sprawdź log)

Powiadomienia można wyłączyć w `KONFIGURACJA.ps1` ustawiając `$POWIADOMIENIA = $false`.

---

## Logi

Logi zapisywane są w folderze `logi\` obok skryptów.
Każdy backup tworzy nowy plik `backup_YYYY-MM-DD_HH-mm.log`.
Logi starsze niż 30 dni kasowane są automatycznie (można zmienić w konfiguracji).

---

## Ręczne uruchomienie backupu

**Sposób 1** — przez Harmonogram zadań:
1. Otwórz Start → wpisz "Harmonogram zadań"
2. Znajdź zadanie `AutoBackup_Cerebro`
3. Kliknij prawym → "Uruchom"

**Sposób 2** — bezpośrednio z PowerShell:
```
powershell -File "C:\ścieżka\do\backup.ps1"
```

---

## Odinstalowanie

Aby usunąć automatyczny backup:
1. Otwórz Start → wpisz "Harmonogram zadań"
2. Znajdź `AutoBackup_Cerebro`
3. Kliknij prawym → "Usuń"

Pliki skryptów możesz zostawić lub skasować — nie wpływają na system.

---

## Najczęstsze pytania

**Backup działa gdy komputer jest wyłączony?**
Nie. Komputer musi być włączony. Jeśli o wybranej godzinie jest wyłączony,
zadanie uruchomi się przy kolejnym starcie (opcja "Uruchom jeśli pominięto").

**Backup usuwa pliki z kopii gdy usunę je ze źródła?**
Nie. Domyślnie backup tylko kopiuje nowe i zmienione pliki,
nie kasuje niczego z miejsca docelowego. To bezpieczniejsza opcja.

**Jak dodać kolejny folder docelowy?**
Otwórz `KONFIGURACJA.ps1`, dodaj linię do `$FOLDERY_DOCELOWE`,
uruchom ponownie `setup.ps1` jako administrator.

**Co oznaczają kody w logu robocopy?**
0 = brak zmian, 1 = skopiowano pliki, 2–7 = sukces z informacjami.
Kod 8 lub wyższy oznacza błąd — szczegóły w logu robocopy w folderze `logi\`.
