# ==============================================================
#  KONFIGURACJA BACKUPU — edytuj TYLKO ten plik
#  Pozostałe pliki (backup.ps1, setup.ps1) zostaw bez zmian
# ==============================================================

# --------------------------------------------------------------
#  SKĄD robić backup?
#  Podaj pełną ścieżkę do folderu źródłowego.
#  Przykład: "C:\Users\Jan\Dokumenty"
# --------------------------------------------------------------
$FOLDER_ZRODLOWY = "C:\Users\Jan\Dokumenty"


# --------------------------------------------------------------
#  DOKĄD robić backup?
#  Możesz podać jedno lub wiele miejsc docelowych.
#  Każda ścieżka w osobnej linii, zakończona przecinkiem
#  (ostatnia linia BEZ przecinka).
#
#  Przykłady:
#    "D:\Backup"                  — drugi dysk wewnętrzny
#    "E:\Backup"                  — pendrive lub dysk zewnętrzny
#    "\\NAS\backup\dokumenty"     — dysk sieciowy (NAS)
# --------------------------------------------------------------
$FOLDERY_DOCELOWE = @(
    "D:\Backup\Dokumenty",
    "E:\Backup\Dokumenty"
)


# --------------------------------------------------------------
#  O KTÓREJ GODZINIE uruchamiać backup?
#  Format 24-godzinny. Przykłady:
#    2  = 02:00 w nocy
#   14  = 14:00 (godzina 14:00)
#   22  = 22:00 (godzina 22:00)
# --------------------------------------------------------------
$GODZINA = 2
$MINUTA  = 0


# --------------------------------------------------------------
#  ILE DNI przechowywać logi?
#  Logi starsze niż podana liczba dni będą kasowane automatycznie.
# --------------------------------------------------------------
$DNI_LOGOW = 30


# --------------------------------------------------------------
#  CZY WYSYŁAĆ powiadomienie po zakończeniu backupu?
#  $true  = tak, pokaż dymek na pasku zadań
#  $false = nie, tylko zapisz do logu
# --------------------------------------------------------------
$POWIADOMIENIA = $true
