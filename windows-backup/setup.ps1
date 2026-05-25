# ==============================================================
#  setup.ps1 — Instalator harmonogramu zadań
#  Uruchom ten plik RAZ jako Administrator, żeby zainstalować
#  automatyczny backup. Potem możesz go skasować lub zachować.
# ==============================================================

#region --- Sprawdź uprawnienia administratora ---

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
          ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {

    Write-Host ""
    Write-Host "================================================================" -ForegroundColor Red
    Write-Host "  BŁĄD: Ten skrypt musi być uruchomiony jako ADMINISTRATOR"       -ForegroundColor Red
    Write-Host "================================================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Jak to zrobić:"
    Write-Host "  1. Kliknij prawym przyciskiem na setup.ps1"
    Write-Host "  2. Wybierz 'Uruchom z programem PowerShell jako administrator'"
    Write-Host ""
    Read-Host "Naciśnij Enter aby zamknąć"
    exit 1
}

#endregion

#region --- Wczytaj konfigurację ---

$skryptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$konfigPlik = Join-Path $skryptDir "KONFIGURACJA.ps1"
$backupPlik = Join-Path $skryptDir "backup.ps1"

if (-not (Test-Path $konfigPlik)) {
    Write-Host "BŁĄD: Brak pliku KONFIGURACJA.ps1 w: $skryptDir" -ForegroundColor Red
    Read-Host "Naciśnij Enter aby zamknąć"
    exit 1
}
if (-not (Test-Path $backupPlik)) {
    Write-Host "BŁĄD: Brak pliku backup.ps1 w: $skryptDir" -ForegroundColor Red
    Read-Host "Naciśnij Enter aby zamknąć"
    exit 1
}

. $konfigPlik

#endregion

#region --- Wyświetl podsumowanie konfiguracji ---

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  INSTALACJA HARMONOGRAMU BACKUPU" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Ustawienia z KONFIGURACJA.ps1:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Źródło backupu : $FOLDER_ZRODLOWY"
Write-Host ""
Write-Host "  Miejsca docelowe:"
foreach ($cel in $FOLDERY_DOCELOWE) {
    Write-Host "    → $cel"
}
Write-Host ""

$godzinaStr = "{0:D2}:{1:D2}" -f $GODZINA, $MINUTA
Write-Host "  Godzina backupu: $godzinaStr (codziennie)"
Write-Host "  Powiadomienia  : $POWIADOMIENIA"
Write-Host ""

#endregion

#region --- Sprawdź poprawność konfiguracji ---

$bledy = 0

if (-not (Test-Path $FOLDER_ZRODLOWY)) {
    Write-Host "  OSTRZEŻENIE: Folder źródłowy nie istnieje: $FOLDER_ZRODLOWY" -ForegroundColor Yellow
    Write-Host "               (może być niedostępny teraz — backup sprawdzi przy uruchomieniu)"
}

if ($FOLDERY_DOCELOWE.Count -eq 0) {
    Write-Host "  BŁĄD: Nie podano żadnego folderu docelowego w KONFIGURACJA.ps1" -ForegroundColor Red
    $bledy++
}

if ($GODZINA -lt 0 -or $GODZINA -gt 23) {
    Write-Host "  BŁĄD: Nieprawidłowa godzina ($GODZINA). Podaj wartość 0–23." -ForegroundColor Red
    $bledy++
}

if ($MINUTA -lt 0 -or $MINUTA -gt 59) {
    Write-Host "  BŁĄD: Nieprawidłowa minuta ($MINUTA). Podaj wartość 0–59." -ForegroundColor Red
    $bledy++
}

if ($bledy -gt 0) {
    Write-Host ""
    Write-Host "Popraw błędy w KONFIGURACJA.ps1 i uruchom setup.ps1 ponownie." -ForegroundColor Red
    Read-Host "Naciśnij Enter aby zamknąć"
    exit 1
}

$odpowiedz = Read-Host "Czy zainstalować zadanie? (T/N)"
if ($odpowiedz -notmatch '^[TtYy]') {
    Write-Host "Anulowano." -ForegroundColor Yellow
    exit 0
}

#endregion

#region --- Zezwól na wykonywanie skryptów PowerShell (jeśli potrzeba) ---

$policy = Get-ExecutionPolicy -Scope LocalMachine
if ($policy -eq "Restricted" -or $policy -eq "Undefined") {
    Write-Host ""
    Write-Host "Ustawianie polityki wykonywania skryptów na RemoteSigned..." -ForegroundColor Cyan
    Set-ExecutionPolicy RemoteSigned -Scope LocalMachine -Force
}

#endregion

#region --- Utwórz zadanie w Harmonogramie ---

$nazwaZadania   = "AutoBackup_Cerebro"
$opisZadania    = "Automatyczny backup folderu: $FOLDER_ZRODLOWY"
$powershellExe  = (Get-Command powershell.exe).Source

# Parametry uruchomienia skryptu
$argumenty = "-NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$backupPlik`""

# Definicja akcji
$akcja = New-ScheduledTaskAction `
    -Execute $powershellExe `
    -Argument $argumenty `
    -WorkingDirectory $skryptDir

# Harmonogram: codziennie o wybranej godzinie
$czasUruchomienia = [datetime]::Today.AddHours($GODZINA).AddMinutes($MINUTA)
$wyzwalacz = New-ScheduledTaskTrigger -Daily -At $czasUruchomienia

# Ustawienia zadania
$ustawienia = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Hours 4) `
    -Priority 7 `
    -StartWhenAvailable `
    -WakeToRun `
    -MultipleInstances IgnoreNew `
    -RunOnlyIfNetworkAvailable:$false

# Uruchom jako aktualny użytkownik (z hasłem zachowanym w systemie)
$principal = New-ScheduledTaskPrincipal `
    -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) `
    -LogonType S4U `
    -RunLevel Highest

# Usuń stare zadanie jeśli istnieje
if (Get-ScheduledTask -TaskName $nazwaZadania -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $nazwaZadania -Confirm:$false
    Write-Host "Usunięto poprzednie zadanie '$nazwaZadania'."
}

# Zarejestruj zadanie
Register-ScheduledTask `
    -TaskName $nazwaZadania `
    -Description $opisZadania `
    -Action $akcja `
    -Trigger $wyzwalacz `
    -Settings $ustawienia `
    -Principal $principal `
    -Force | Out-Null

#endregion

#region --- Potwierdzenie ---

Write-Host ""
Write-Host "================================================================" -ForegroundColor Green
Write-Host "  GOTOWE! Zadanie zostało zainstalowane pomyślnie." -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Nazwa zadania : $nazwaZadania"
Write-Host "  Uruchomienie  : codziennie o $godzinaStr"
Write-Host "  Skrypt        : $backupPlik"
Write-Host ""
Write-Host "Gdzie szukać zadania w systemie:"
Write-Host "  Harmonogram zadań → Biblioteka → $nazwaZadania"
Write-Host ""

$testuj = Read-Host "Czy uruchomić backup TERAZ jako test? (T/N)"
if ($testuj -match '^[TtYy]') {
    Write-Host ""
    Write-Host "Uruchamiam backup testowy..." -ForegroundColor Cyan
    Start-ScheduledTask -TaskName $nazwaZadania
    Start-Sleep -Seconds 3

    $logsDir = Join-Path $skryptDir "logi"
    if (Test-Path $logsDir) {
        $ostatniLog = Get-ChildItem $logsDir -Filter "backup_*.log" |
                      Sort-Object LastWriteTime -Descending |
                      Select-Object -First 1
        if ($ostatniLog) {
            Write-Host ""
            Write-Host "Log z tego backupu:" -ForegroundColor Yellow
            Write-Host "  $($ostatniLog.FullName)"
            Write-Host ""
            Write-Host "Ostatnie 20 linii logu:" -ForegroundColor Yellow
            Get-Content $ostatniLog.FullName -Tail 20 | ForEach-Object { Write-Host "  $_" }
        }
    }
}

Write-Host ""
Read-Host "Naciśnij Enter aby zamknąć"

#endregion
