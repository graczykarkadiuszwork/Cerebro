/**
 * CEREBRO — BACKUP AUTOMATYCZNY (Dysk Google)
 * ============================================================================
 * Ten plik żyje w TYM SAMYM projekcie Apps Script co Code.gs i DriveSync
 * (nie jest osobnym projektem). Działa bezpośrednio na plikach Dysku Google
 * (folder "Cerebro core"), niezależnie od arkusza bazy danych aplikacji —
 * dlatego `setupTriggers()` poniżej kasuje wyłącznie SWOJE dwa triggery,
 * nie ruszając triggera `syncDriveFiles` z DriveSync.
 *
 * Instalacja (jednorazowo, w istniejącym projekcie Cerebro):
 *  1) Extensions/Rozszerzenia -> Apps Script (albo bezpośrednio na
 *     script.google.com, jeśli projekt jest samodzielny) -> otwórz projekt
 *     Cerebro, w którym jest już Code.gs.
 *  2) Dodaj nowy plik skryptu o nazwie "Backup" i wklej tu całą zawartość.
 *  3) Po lewej stronie kliknij "Usługi" (Services) -> "+" -> dodaj
 *     "Drive API" (Advanced Google Services). Bez tego kroku aktualizacja
 *     treści zmienionych plików w dziennym mirrorze nie zadziała.
 *  4) Uzupełnij stałe SOURCE_ROOT_ID / DAILY_ROOT_ID / MONTHLY_ROOT_ID
 *     poniżej (ID folderów z Dysku Google — patrz sekcja KONFIGURACJA).
 *  5) Uruchom funkcję `setupTriggers` (menu Uruchom / Run) -> przy pierwszym
 *     uruchomieniu Google poprosi o autoryzację dostępu do Dysku -> zaakceptuj.
 *  6) Gotowe. Od teraz backup działa sam, w tle, bez Twojego udziału.
 *
 * Co robi:
 *  - runDailyMirror()   -> codziennie o ok. 3:00 nadpisuje folder "Daily"
 *                          tak, żeby był lustrzanym odbiciem "Cerebro core".
 *                          Pliki które już tam są i się nie zmieniły -
 *                          NIE są tykane (ten sam ID, ta sama wersja).
 *                          Zmienione pliki -> podmieniana jest ich treść
 *                          (ten sam ID -> linki się nie psują).
 *                          Nowe pliki -> dopisywane. Usunięte w źródle ->
 *                          usuwane z backupu (żeby nie rosło w nieskończoność).
 *  - runMonthlySnapshot() -> raz w miesiącu (1. dnia, ok. 4:00) tworzy NOWY,
 *                          w pełni odrębny, datowany folder-archiwum
 *                          "Cerebro_Backup_YYYY-MM-DD" wewnątrz "Monthly".
 *                          Stare snapshoty NIE są ruszane - to świadome
 *                          wersjonowanie w czasie. Trzymane jest ostatnie
 *                          MONTHLY_RETENTION miesięcy (potem najstarszy
 *                          snapshot jest kasowany, żeby dysk nie spuchł
 *                          w nieskończoność).
 *
 * Przywracanie po awarii (ręcznie, bez kodu):
 *  - Wejdź do folderu backupu "Daily" (albo do konkretnego datowanego
 *    snapshotu w "Monthly").
 *  - Zaznacz całą zawartość -> kopiuj (Ctrl/Cmd+C).
 *  - Wejdź do oryginalnego folderu "Cerebro core" -> wklej (Ctrl/Cmd+V).
 *  - Dysk zapyta o pliki o tych samych nazwach -> wybierz "Zamień"
 *    ("Replace"), NIE "Zachowaj obie" ("Keep both"). "Zamień" nadpisuje
 *    istniejący plik jako nową wersję pod tym samym ID -> wszystkie linki
 *    (np. w Hub.html) nadal działają.
 *  - Jeśli po przywróceniu coś nadal nie działa - to znaczy, że problem nie
 *    leży w nadpisanych plikach, tylko gdzie indziej (np. w uprawnieniach,
 *    w innej integracji) - szukaj dalej tam.
 * ============================================================================
 */

// ---- KONFIGURACJA -------------------------------------------------------
// Wklej tu ID trzech folderów na Dysku Google (fragment adresu URL po
// "folders/"): folder źródłowy "Cerebro core", oraz dwa docelowe foldery
// backupu, które sam utworzysz na Dysku (np. "Cerebro_Backups/Daily" i
// "Cerebro_Backups/Monthly").
const SOURCE_ROOT_ID   = 'WKLEJ_ID_FOLDERU_CEREBRO_CORE';
const DAILY_ROOT_ID    = 'WKLEJ_ID_FOLDERU_DAILY';
const MONTHLY_ROOT_ID  = 'WKLEJ_ID_FOLDERU_MONTHLY';
const MONTHLY_RETENTION = 12; // ile ostatnich miesięcznych snapshotów trzymać
// --------------------------------------------------------------------------

function setupTriggers() {
  // Usuwa TYLKO triggery tego pliku — zostawia w spokoju np. syncDriveFiles
  // z DriveSync, które żyje w tym samym projekcie.
  const ownHandlers = ['runDailyMirror', 'runMonthlySnapshot'];
  ScriptApp.getProjectTriggers().forEach(t => {
    if (ownHandlers.includes(t.getHandlerFunction())) ScriptApp.deleteTrigger(t);
  });

  ScriptApp.newTrigger('runDailyMirror')
    .timeBased().everyDays(1).atHour(3).create();

  ScriptApp.newTrigger('runMonthlySnapshot')
    .timeBased().onMonthDay(1).atHour(4).create();

  Logger.log('Triggery ustawione: dzienny mirror (03:00) i miesięczny snapshot (1. dnia, 04:00).');
}

// =========================== DZIENNY MIRROR ==============================
function runDailyMirror() {
  const source = DriveApp.getFolderById(SOURCE_ROOT_ID);
  const dest   = DriveApp.getFolderById(DAILY_ROOT_ID);
  mirrorFolder(source, dest);
  Logger.log('Daily mirror zakończony: ' + new Date());
}

// Rekurencyjnie synchronizuje dest tak, by odzwierciedlał source.
// Nie nadpisuje niezmienionych plików (porównanie po getLastUpdated),
// aktualizuje treść zmienionych PLIKÓW POD TYM SAMYM ID, usuwa z dest
// to czego już nie ma w source.
function mirrorFolder(source, dest) {
  const srcFiles = indexByName(source.getFiles());
  const dstFiles = indexByName(dest.getFiles());

  for (const name in srcFiles) {
    const srcFile = srcFiles[name];
    const dstFile = dstFiles[name];
    if (!dstFile) {
      srcFile.makeCopy(name, dest);
    } else if (srcFile.getLastUpdated().getTime() !== dstFile.getLastUpdated().getTime()) {
      updateFileContent(srcFile, dstFile);
    }
    delete dstFiles[name];
  }
  // co zostało w dstFiles nie ma już w źródle -> usuń (żeby backup nie puchł)
  for (const name in dstFiles) {
    dstFiles[name].setTrashed(true);
  }

  const srcFolders = indexByName(source.getFolders());
  const dstFolders = indexByName(dest.getFolders());

  for (const name in srcFolders) {
    let dstSub = dstFolders[name];
    if (!dstSub) dstSub = dest.createFolder(name);
    mirrorFolder(srcFolders[name], dstSub);
    delete dstFolders[name];
  }
  for (const name in dstFolders) {
    dstFolders[name].setTrashed(true);
  }
}

// Podmienia treść istniejącego pliku (ten sam ID), zamiast go kasować
// i tworzyć od nowa - dzięki temu ewentualne linki do backupu też przeżyją.
function updateFileContent(srcFile, dstFile) {
  const blob = srcFile.getBlob();
  const mime = srcFile.getMimeType();
  // Pliki Google (Doc/Sheet/Slides) trzeba skopiować na nowo pod tym samym ID
  // nie da się "podmienić treści" natywnego pliku Google przez Advanced Drive
  // bez utraty formatowania w prostym API, więc dla nich robimy trash+copy.
  if (mime.indexOf('application/vnd.google-apps') === 0 && mime !== 'application/vnd.google-apps.folder') {
    const parent = dstFile.getParents().next();
    dstFile.setTrashed(true);
    srcFile.makeCopy(srcFile.getName(), parent);
  } else {
    Drive.Files.update({}, dstFile.getId(), blob);
  }
}

function indexByName(iterator) {
  const map = {};
  while (iterator.hasNext()) {
    const f = iterator.next();
    map[f.getName()] = f;
  }
  return map;
}

// ========================= MIESIĘCZNY SNAPSHOT ============================
function runMonthlySnapshot() {
  const source = DriveApp.getFolderById(SOURCE_ROOT_ID);
  const monthlyRoot = DriveApp.getFolderById(MONTHLY_ROOT_ID);

  const today = new Date();
  const stamp = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const snapshotName = 'Cerebro_Backup_' + stamp;

  const existing = monthlyRoot.getFoldersByName(snapshotName);
  const snapshotFolder = existing.hasNext() ? existing.next() : monthlyRoot.createFolder(snapshotName);

  copyFolderTree(source, snapshotFolder);
  enforceMonthlyRetention(monthlyRoot);

  Logger.log('Monthly snapshot utworzony: ' + snapshotName);
}

// Pełna, świeża kopia (nowe ID dla każdego pliku) - to jest ARCHIWALNY
// snapshot, nie ma potrzeby zachowywać ID.
function copyFolderTree(source, dest) {
  const files = source.getFiles();
  while (files.hasNext()) {
    const f = files.next();
    f.makeCopy(f.getName(), dest);
  }
  const folders = source.getFolders();
  while (folders.hasNext()) {
    const sub = folders.next();
    const destSub = dest.createFolder(sub.getName());
    copyFolderTree(sub, destSub);
  }
}

// Kasuje najstarsze snapshoty ponad ustalony limit, żeby dysk nie rósł
// w nieskończoność - tylko dla wersji miesięcznych (dzienne i tak są
// nadpisywane w miejscu, więc tu chodzi wyłącznie o archiwum).
function enforceMonthlyRetention(monthlyRoot) {
  const folders = [];
  const it = monthlyRoot.getFolders();
  while (it.hasNext()) folders.push(it.next());

  folders.sort((a, b) => a.getName().localeCompare(b.getName())); // rosnąco po dacie w nazwie
  while (folders.length > MONTHLY_RETENTION) {
    folders.shift().setTrashed(true);
  }
}
