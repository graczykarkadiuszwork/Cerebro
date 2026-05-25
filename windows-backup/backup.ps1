# ==============================================================
#  backup.ps1 — Główny skrypt backupu z wersjonowaniem
#  NIE EDYTUJ tego pliku. Zmiany rób w KONFIGURACJA.ps1
#
#  Struktura na każdym dysku docelowym:
#    aktualny\   — zawsze bieżąca wersja (aktualizowana przez robocopy)
#    historia\   — poprzednie wersje zmienionych plików, pogrupowane
#                  wg daty zmiany (np. historia\2025-05-25_0200\)
#    logi\       — logi z każdego uruchomienia backupu
#
#  Nic nie jest nigdy kasowane.
# ==============================================================

#region --- Wczytaj konfigurację ---

$skryptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$konfigPlik = Join-Path $skryptDir "KONFIGURACJA.ps1"

if (-not (Test-Path $konfigPlik)) {
    Write-Error "Brak pliku KONFIGURACJA.ps1 w folderze: $skryptDir"
    exit 1
}
. $konfigPlik

#endregion

#region --- Przygotuj log sesji ---

$logsDir = Join-Path $skryptDir "logi"
if (-not (Test-Path $logsDir)) { New-Item -ItemType Directory -Path $logsDir | Out-Null }

$dataSygn  = Get-Date -Format "yyyy-MM-dd_HH-mm"
$logPlik   = Join-Path $logsDir "backup_$dataSygn.log"

function Zapisz {
    param([string]$tekst, [string]$poziom = "INFO")
    $znacznik = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $linia = "[$znacznik] [$poziom] $tekst"
    Add-Content -Path $logPlik -Value $linia -Encoding UTF8
    Write-Host $linia
}

#endregion

#region --- Powiadomienia systemowe ---

function Powiadom {
    param([string]$tytul, [string]$tresc, [string]$typ = "Info")
    if (-not $POWIADOMIENIA) { return }
    try {
        Add-Type -AssemblyName System.Windows.Forms
        $ni = New-Object System.Windows.Forms.NotifyIcon
        $ni.Icon    = [System.Drawing.SystemIcons]::Information
        $ni.Visible = $true
        $ni.ShowBalloonTip(8000, $tytul, $tresc, [System.Windows.Forms.ToolTipIcon]::$typ)
        Start-Sleep -Seconds 9
        $ni.Dispose()
    } catch {
        Zapisz "Nie udało się wyświetlić powiadomienia: $_" "OSTRZEZENIE"
    }
}

#endregion

#region --- Archiwizacja poprzednich wersji zmienionych plików ---

# Porównuje pliki źródła z folderem "aktualny".
# Jeśli plik istnieje w "aktualny" i różni się od wersji źródłowej
# (inny czas modyfikacji lub rozmiar), stara wersja jest kopiowana
# do "historia\TIMESTAMP\" z zachowaniem pełnej struktury podfolderów.
# Nowe pliki (nieistniejące jeszcze w "aktualny") są pomijane —
# nie mają poprzedniej wersji do zarchiwizowania.

function Archiwizuj-PoprzednieWersje {
    param(
        [string]$zrodlo,
        [string]$folderAktualny,
        [string]$folderHistoria,
        [string]$znacznikCzasu
    )

    $zarchiwizowano = 0
    $folderSesji    = $null   # tworzony tylko jeśli coś się zmieni

    try {
        $pliki = Get-ChildItem -Path $zrodlo -Recurse -File -ErrorAction Stop
    } catch {
        Zapisz "Błąd przy skanowaniu źródła: $_" "BLAD"
        return 0
    }

    foreach ($plikSrc in $pliki) {

        # Ścieżka względna (bez korzenia źródła)
        $wzgledna = $plikSrc.FullName.Substring($zrodlo.TrimEnd('\').Length).TrimStart('\')
        $plikAkt  = Join-Path $folderAktualny $wzgledna

        # Tylko jeśli stara wersja istnieje i jest inna
        if (-not (Test-Path $plikAkt)) { continue }

        $infoAkt = Get-Item $plikAkt -ErrorAction SilentlyContinue
        if (-not $infoAkt) { continue }

        $zmieniony = ($plikSrc.LastWriteTimeUtc -ne $infoAkt.LastWriteTimeUtc) -or
                     ($plikSrc.Length           -ne $infoAkt.Length)

        if (-not $zmieniony) { continue }

        # Utwórz folder sesji historycznej przy pierwszej zmianie
        if (-not $folderSesji) {
            $folderSesji = Join-Path $folderHistoria $znacznikCzasu
            New-Item -ItemType Directory -Path $folderSesji -Force | Out-Null
            Zapisz "Utworzono folder historyczny: $folderSesji"
        }

        # Skopiuj starą wersję do archiwum
        $destHistoria = Join-Path $folderSesji $wzgledna
        $destDir      = Split-Path $destHistoria -Parent
        if (-not (Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        }

        try {
            Copy-Item -Path $plikAkt -Destination $destHistoria -Force
            $zarchiwizowano++
        } catch {
            Zapisz "BŁĄD archiwizacji pliku '$plikAkt': $_" "BLAD"
        }
    }

    return $zarchiwizowano
}

#endregion

#region --- Sprawdzenie wolnego miejsca na dysku ---

function Sprawdz-MiejsceDysk {
    param([string]$sciezka)

    $dysk = Split-Path -Qualifier $sciezka -ErrorAction SilentlyContinue
    if (-not $dysk) { return }

    try {
        $info    = Get-PSDrive ($dysk.TrimEnd(':')) -ErrorAction Stop
        $wolneGB = [math]::Round($info.Free / 1GB, 1)
        if ($wolneGB -lt $OSTRZEZENIE_GB) {
            Zapisz "OSTRZEŻENIE: Mało miejsca na dysku $dysk — pozostało ${wolneGB} GB (próg: ${OSTRZEZENIE_GB} GB)" "OSTRZEZENIE"
            Powiadom "Backup — mało miejsca" "Dysk $dysk ma tylko ${wolneGB} GB wolnego miejsca.`nHistoria plików może wkrótce nie mieścić się na dysku." "Warning"
        } else {
            Zapisz "Wolne miejsce na dysku $dysk`: ${wolneGB} GB"
        }
    } catch {
        Zapisz "Nie udało się sprawdzić miejsca na dysku $dysk`: $_" "OSTRZEZENIE"
    }
}

#endregion

#region --- Start ---

Zapisz "======================================================"
Zapisz "START BACKUPU (z wersjonowaniem)"
Zapisz "Źródło          : $FOLDER_ZRODLOWY"
Zapisz "Miejsc docelowych: $($FOLDERY_DOCELOWE.Count)"

#endregion

#region --- Sprawdź źródło ---

if (-not (Test-Path $FOLDER_ZRODLOWY)) {
    Zapisz "BŁĄD: Folder źródłowy niedostępny: $FOLDER_ZRODLOWY" "BLAD"
    Powiadom "Backup — BŁĄD" "Folder źródłowy niedostępny:`n$FOLDER_ZRODLOWY" "Error"
    exit 2
}
Zapisz "Folder źródłowy: OK"

#endregion

#region --- Pętla po miejscach docelowych ---

$sukcesy = 0
$bledy   = 0
$pomiete = 0

foreach ($cel in $FOLDERY_DOCELOWE) {

    Zapisz "------------------------------------------------------"
    Zapisz "Cel: $cel"

    # Sprawdź dostępność dysku docelowego
    $dyskCelu = Split-Path -Qualifier $cel -ErrorAction SilentlyContinue
    if ($dyskCelu -and -not (Test-Path $dyskCelu)) {
        Zapisz "POMINIĘTO: Dysk $dyskCelu niepodłączony" "OSTRZEZENIE"
        $pomiete++
        continue
    }

    # Podstruktura: aktualny\ i historia\
    $folderAktualny = Join-Path $cel "aktualny"
    $folderHistoria = Join-Path $cel "historia"

    foreach ($f in @($cel, $folderAktualny, $folderHistoria)) {
        if (-not (Test-Path $f)) {
            try   { New-Item -ItemType Directory -Path $f -Force | Out-Null }
            catch { Zapisz "BŁĄD tworzenia folderu $f`: $_" "BLAD"; $bledy++; continue }
        }
    }

    # Sprawdź wolne miejsce
    Sprawdz-MiejsceDysk -sciezka $cel

    # Krok 1: Zarchiwizuj poprzednie wersje plików, które się zmieniły
    Zapisz "Krok 1/2: Archiwizacja zmienionych plików..."
    $zarchiwizowano = Archiwizuj-PoprzednieWersje `
        -zrodlo         $FOLDER_ZRODLOWY `
        -folderAktualny $folderAktualny `
        -folderHistoria $folderHistoria `
        -znacznikCzasu  $dataSygn

    Zapisz "Zarchiwizowano poprzednich wersji: $zarchiwizowano"

    # Krok 2: Aktualizuj folder "aktualny" przez robocopy
    # /E        — kopiuj wszystkie podfoldery (łącznie z pustymi)
    # /COPY:DAT — kopiuj dane, atrybuty i znaczniki czasu pliku
    # /DCOPY:DA — kopiuj atrybuty i czas folderów
    # /R:3      — 3 próby po błędzie
    # /W:10     — 10 sekund przerwy między próbami
    # /NP       — bez paska postępu (czystszy log)
    # /NFL /NDL — bez listowania plików i folderów w logu
    Zapisz "Krok 2/2: Aktualizacja folderu aktualny..."
    $logRobo = Join-Path $logsDir "robocopy_$($dataSygn)_$(($cel -replace '[:\\\/]','_').Trim('_')).log"

    $args = @(
        "`"$FOLDER_ZRODLOWY`"",
        "`"$folderAktualny`"",
        "/E", "/COPY:DAT", "/DCOPY:DA",
        "/R:3", "/W:10",
        "/NP", "/NFL", "/NDL",
        "/TEE",
        "/LOG+:`"$logRobo`""
    )

    $proc = Start-Process -FilePath "robocopy" -ArgumentList $args `
                          -Wait -PassThru -WindowStyle Hidden

    # Kody 0–7: sukces lub brak zmian. Kod 8+: błąd
    if ($proc.ExitCode -lt 8) {
        Zapisz "OK: Backup do '$cel' zakończony (kod robocopy: $($proc.ExitCode))"
        $sukcesy++
    } else {
        Zapisz "BŁĄD: Robocopy zwrócił kod $($proc.ExitCode) dla '$cel'" "BLAD"
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
Zapisz "  Log sesji: $logPlik"

if ($bledy -gt 0) {
    Zapisz "BACKUP ZAKOŃCZONY Z BŁĘDAMI" "BLAD"
    Powiadom "Backup — BŁĄD" "Backup zakończony z $bledy błędem(ami).`nSprawdź log: $logPlik" "Error"
    exit 3
} elseif ($pomiete -eq $FOLDERY_DOCELOWE.Count) {
    Zapisz "BACKUP POMINIĘTY — żaden dysk docelowy nie był dostępny" "OSTRZEZENIE"
    Powiadom "Backup — pominięty" "Żaden dysk docelowy nie był podłączony." "Warning"
    exit 4
} else {
    $info = "Sukces: $sukcesy cel(e)"
    if ($pomiete -gt 0) { $info += ", pominięto: $pomiete (brak dysku)" }
    Zapisz "BACKUP ZAKOŃCZONY POMYŚLNIE"
    Powiadom "Backup — OK" $info "Info"
    exit 0
}

#endregion
