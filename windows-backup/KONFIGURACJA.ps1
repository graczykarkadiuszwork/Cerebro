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
#    "D:\Backup"              — drugi dysk wewnętrzny
#    "E:\Backup"              — pendrive lub dysk zewnętrzny
#    "\\NAS\backup\medyczne"  — dysk sieciowy (NAS)
#
#  W każdym miejscu docelowym powstaną dwa podfoldery:
#    aktualny\  — zawsze najnowsza wersja wszystkich plików
#    historia\  — poprzednie wersje plików posortowane wg daty zmiany
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
#  OSTRZEŻENIE O MIEJSCU NA DYSKU
#  Jeśli wolnego miejsca na dysku będzie mniej niż podana
#  liczba gigabajtów (GB), backup wyświetli ostrzeżenie.
#  Historia nigdy nie jest kasowana automatycznie.
# --------------------------------------------------------------
$OSTRZEZENIE_GB = 20


# --------------------------------------------------------------
#  CZY WYSYŁAĆ powiadomienie po zakończeniu backupu?
#  $true  = tak, pokaż dymek na pasku zadań
#  $false = nie, tylko zapisz do logu
# --------------------------------------------------------------
$POWIADOMIENIA = $true
