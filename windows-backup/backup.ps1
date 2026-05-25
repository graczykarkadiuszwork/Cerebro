# ==============================================================
#  backup.ps1 — Główny skrypt backupu
#  NIE EDYTUJ tego pliku. Zmiany rób w KONFIGURACJA.ps1
# ==============================================================

#region --- Wczytaj konfigurację ---

$skryptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$konfigPlik = Join-Path $skryptDir "KONFIGURACJA.ps1"

if (-not (Test-Path $konfigPlik)) {
    Write-Error "Brak pliku KONFIGURACJA.ps1 w folderze: $skryptDir"
    exit 1
}
. $konfigPlik

#endregion

#region --- Przygotuj logi ---

$logsDir = Join-Path $skryptDir "logi"
if (-not (Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir | Out-Null
}

$dataSygn   = Get-Date -Format "yyyy-MM-dd_HH-mm"
$dataLabel  = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$logPlik    = Join-Path $logsDir "backup_$dataSygn.log"

function Zapisz {
    param([string]$tekst, [string]$poziom = "INFO")
    $linia = "[$dataLabel] [$poziom] $tekst"
    Add-Content -Path $logPlik -Value $linia -Encoding UTF8
    Write-Host $linia
}

#endregion

#region --- Funkcja powiadomień ---

function Powiadom {
    param([string]$tytul, [string]$tresc, [string]$typ = "Info")
    if (-not $POWIADOMIENIA) { return }
    try {
        Add-Type -AssemblyName System.Windows.Forms
        $ikona = [System.Windows.Forms.ToolTipIcon]::$typ
        $ni = New-Object System.Windows.Forms.NotifyIcon
        $ni.Icon = [System.Drawing.SystemIcons]::Information
        $ni.Visible = $true
        $ni.ShowBalloonTip(8000, $tytul, $tresc, $ikona)
        Start-Sleep -Seconds 9
        $ni.Dispose()
    } catch {
        Zapisz "Nie udało się wyświetlić powiadomienia: $_" "OSTRZEZENIE"
    }
}

#endregion

#region --- Kasuj stare logi ---

try {
    $granica = (Get-Date).AddDays(-$DNI_LOGOW)
    Get-ChildItem -Path $logsDir -Filter "backup_*.log" |
        Where-Object { $_.LastWriteTime -lt $granica } |
        ForEach-Object {
            Remove-Item $_.FullName -Force
            Zapisz "Usunięto stary log: $($_.Name)"
        }
} catch {
    Zapisz "Błąd podczas czyszczenia starych logów: $_" "OSTRZEZENIE"
}

#endregion

#region --- Start ---

Zapisz "======================================================"
Zapisz "START BACKUPU"
Zapisz "Źródło: $FOLDER_ZRODLOWY"
Zapisz "Liczba miejsc docelowych: $($FOLDERY_DOCELOWE.Count)"

#endregion

#region --- Sprawdź źródło ---

if (-not (Test-Path $FOLDER_ZRODLOWY)) {
    Zapisz "BŁĄD: Folder źródłowy nie istnieje lub jest niedostępny: $FOLDER_ZRODLOWY" "BLAD"
    Powiadom "Backup — BŁĄD" "Folder źródłowy nie istnieje:`n$FOLDER_ZRODLOWY" "Error"
    exit 2
}

Zapisz "Folder źródłowy: OK"

#endregion

#region --- Wykonaj backup dla każdego miejsca docelowego ---

$sukcesy  = 0
$bledy    = 0
$pomiete  = 0

foreach ($cel in $FOLDERY_DOCELOWE) {

    Zapisz "------------------------------------------------------"
    Zapisz "Cel: $cel"

    # Sprawdź czy dysk docelowy jest podłączony
    $dyskCelu = Split-Path -Qualifier $cel -ErrorAction SilentlyContinue
    if ($dyskCelu -and -not (Test-Path $dyskCelu)) {
        Zapisz "POMINIĘTO: Dysk $dyskCelu nie jest podłączony (cel: $cel)" "OSTRZEZENIE"
        $pomiete++
        continue
    }

    # Utwórz folder docelowy jeśli nie istnieje
    if (-not (Test-Path $cel)) {
        try {
            New-Item -ItemType Directory -Path $cel -Force | Out-Null
            Zapisz "Utworzono folder docelowy: $cel"
        } catch {
            Zapisz "BŁĄD: Nie można utworzyć folderu $cel — $_" "BLAD"
            $bledy++
            continue
        }
    }

    # Log robocopy dla tego celu
    $logRobocopy = Join-Path $logsDir "robocopy_$($dataSygn)_$(($cel -replace '[:\\\/]','_').Trim('_')).log"

    # Uruchom robocopy
    # /E        — kopiuj podfoldery (łącznie z pustymi)
    # /COPY:DAT — kopiuj dane, atrybuty i znaczniki czasu
    # /DCOPY:DA — kopiuj atrybuty i czas folderów
    # /R:3      — 3 próby po błędzie
    # /W:10     — 10 sekund przerwy między próbami
    # /NP       — bez paska postępu (czystszy log)
    # /NFL      — bez listowania skopiowanych plików (mniejszy log)
    # /NDL      — bez listowania folderów
    # /TEE      — zapisz jednocześnie do pliku i na ekran
    $robocopyArgs = @(
        "`"$FOLDER_ZRODLOWY`"",
        "`"$cel`"",
        "/E",
        "/COPY:DAT",
        "/DCOPY:DA",
        "/R:3",
        "/W:10",
        "/NP",
        "/NFL",
        "/NDL",
        "/TEE",
        "/LOG+:`"$logRobocopy`""
    )

    $proc = Start-Process -FilePath "robocopy" `
                          -ArgumentList $robocopyArgs `
                          -Wait -PassThru -WindowStyle Hidden

    # Kody wyjścia robocopy: 0-7 = sukces lub brak zmian, 8+ = błąd
    if ($proc.ExitCode -lt 8) {
        Zapisz "OK: Backup do '$cel' zakończony (kod: $($proc.ExitCode))"
        $sukcesy++
    } else {
        Zapisz "BŁĄD: Robocopy zwrócił kod $($proc.ExitCode) dla celu '$cel'" "BLAD"
        $bledy++
    }
}

#endregion

#region --- Podsumowanie ---

Zapisz "======================================================"
Zapisz "PODSUMOWANIE:"
Zapisz "  Sukcesy  : $sukcesy"
Zapisz "  Pominięte: $pomiete  (dyski niepodłączone)"
Zapisz "  Błędy    : $bledy"
Zapisz "  Log      : $logPlik"

if ($bledy -gt 0) {
    Zapisz "BACKUP ZAKOŃCZONY Z BŁĘDAMI" "BLAD"
    Powiadom "Backup — BŁĄD" "Backup zakończony z $bledy błędem(ami).`nSprawdź log: $logPlik" "Error"
    exit 3
} elseif ($pomiete -eq $FOLDERY_DOCELOWE.Count) {
    Zapisz "BACKUP POMINIĘTY — żaden dysk docelowy nie był dostępny" "OSTRZEZENIE"
    Powiadom "Backup — pominięty" "Żaden dysk docelowy nie był podłączony.`nBackup nie został wykonany." "Warning"
    exit 4
} else {
    $komunikat = "Sukces: $sukcesy cel(e)"
    if ($pomiete -gt 0) { $komunikat += ", pominięto $pomiete (brak dysku)" }
    Zapisz "BACKUP ZAKOŃCZONY POMYŚLNIE"
    Powiadom "Backup — OK" $komunikat "Info"
    exit 0
}

#endregion
