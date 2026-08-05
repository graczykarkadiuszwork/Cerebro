// ============================================================
// We SMILE — kopia zapasowa i log roczny na Dysku Google
// ============================================================
// Dwa osobne, niezależne mechanizmy w dwóch osobnych folderach
// wskazanych przez klinikę:
//  - BACKUP_FOLDER_ID: pełna kopia arkusza (Sheets), na wypadek
//    utraty/uszkodzenia danych źródłowych.
//  - LOG_FOLDER_ID: lekki plik CSV z historią akcji administracyjnych
//    (to samo co arkusz Logi_Admin, ale poza samą bazą — łatwiej
//    ustalić co się stało, nawet gdyby arkusz był niedostępny).
// ============================================================

const BACKUP_FOLDER_ID = '1izbpdAZPhWzU1yABuwGJn38refvyEYf0';
const BACKUP_PREFIX     = 'WeSMILE_RCP_backup_';
const BACKUP_MAX_KEEP   = 30; // ostatnie N kopii — starsze kasowane, żeby folder nie rósł bez końca

const LOG_FOLDER_ID = '1DsG9rM693hVbqtyQUe8cBy0-RvqpLfWJ';
const LOG_PREFIX     = 'WeSMILE_log_';

// ── Backup ────────────────────────────────────────────────────

function _wykonajBackup(zrodlo) {
  const folder = DriveApp.getFolderById(BACKUP_FOLDER_ID);
  const znacznik = Utilities.formatDate(new Date(), 'Europe/Warsaw', 'yyyy-MM-dd_HH-mm');
  const nazwa = BACKUP_PREFIX + znacznik;
  const oryginal = DriveApp.getFileById(SS_ID);
  const kopia = oryginal.makeCopy(nazwa, folder);

  _oczyscStareBackupy(folder);
  _logAdmin('Backup', '—', 'Kopia zapasowa utworzona: ' + nazwa + ' (' + zrodlo + ')');

  return { ok: true, nazwa: nazwa, id: kopia.getId(), url: kopia.getUrl() };
}

// Trzyma tylko BACKUP_MAX_KEEP najnowszych kopii — starsze trafiają do
// kosza (nie kasowane trwale od razu, standardowe bezpieczeństwo Drive).
function _oczyscStareBackupy(folder) {
  const pliki = [];
  const it = folder.getFiles();
  while (it.hasNext()) {
    const f = it.next();
    if (f.getName().indexOf(BACKUP_PREFIX) === 0) pliki.push(f);
  }
  pliki.sort((a, b) => b.getDateCreated().getTime() - a.getDateCreated().getTime());
  pliki.slice(BACKUP_MAX_KEEP).forEach(f => f.setTrashed(true));
}

function _ostatniBackup() {
  const folder = DriveApp.getFolderById(BACKUP_FOLDER_ID);
  const it = folder.getFiles();
  let najnowszy = null;
  while (it.hasNext()) {
    const f = it.next();
    if (f.getName().indexOf(BACKUP_PREFIX) !== 0) continue;
    if (!najnowszy || f.getDateCreated().getTime() > najnowszy.getDateCreated().getTime()) najnowszy = f;
  }
  return najnowszy;
}

function masterBackupTeraz(token) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  try {
    return _wykonajBackup('ręczny');
  } catch (e) {
    return { ok: false, msg: 'Błąd tworzenia kopii zapasowej: ' + e.message };
  }
}

function masterBackupStatus(token) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  try {
    const f = _ostatniBackup();
    const trigerWlaczony = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'backupCodzienny');
    return {
      ok: true,
      trigerWlaczony,
      ostatni: f ? { nazwa: f.getName(), kiedy: f.getDateCreated().toISOString(), url: f.getUrl() } : null
    };
  } catch (e) {
    return { ok: false, msg: 'Błąd dostępu do folderu kopii zapasowych: ' + e.message };
  }
}

// Uruchamiane przez trigger czasowy (raz dziennie) — patrz
// _ensureBackupTrigger. Nazwa funkcji musi zostać jak jest, bo
// ScriptApp.newTrigger odwołuje się do niej po nazwie z tekstu.
function backupCodzienny() {
  try { _wykonajBackup('automatyczny (codzienny)'); }
  catch (e) { Logger.log('backupCodzienny error: ' + e); }
}

// Bezpieczne do wielokrotnego wywołania — nie tworzy duplikatu triggera.
function _ensureBackupTrigger() {
  const istnieje = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'backupCodzienny');
  if (istnieje) return false;
  ScriptApp.newTrigger('backupCodzienny').timeBased().everyDays(1).atHour(3).create();
  return true;
}

function masterWlaczAutoBackup(token) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  try {
    const utworzono = _ensureBackupTrigger();
    _logAdmin('WlaczAutoBackup', '—', utworzono ? 'Włączono harmonogram' : 'Harmonogram już był włączony');
    return { ok: true, utworzono };
  } catch (e) {
    return { ok: false, msg: 'Błąd instalacji harmonogramu: ' + e.message };
  }
}

// ── Log roczny (CSV, niska waga) ──────────────────────────────
// Dopięte pod _logAdmin (Dashboard.gs) — każda akcja administracyjna
// już zapisywana do arkusza Logi_Admin trafia też, tym samym
// wywołaniem, do pliku CSV na Dysku. Plik z bieżącym rokiem w nazwie;
// 1 stycznia kolejny zapis sam utworzy nowy plik dla nowego roku —
// nic nie trzeba ręcznie "przełączać".

function _logRoczny(akcja, empId, szczegoly) {
  try {
    const rok = new Date().getFullYear();
    const nazwa = LOG_PREFIX + rok + '.csv';
    const folder = DriveApp.getFolderById(LOG_FOLDER_ID);

    const it = folder.getFilesByName(nazwa);
    const znacznik = new Date().toISOString();
    const bezpieczny = s => String(s == null ? '' : s).replace(/[\r\n]+/g, ' ').replace(/"/g, "'");
    const linia = '"' + [znacznik, bezpieczny(akcja), bezpieczny(empId || '—'), bezpieczny(szczegoly)].join('","') + '"\n';

    if (it.hasNext()) {
      const plik = it.next();
      // Apps Script nie ma trybu "append" na pliki Drive — doklejenie
      // wymaga odczytu i ponownego zapisu całej treści. Pliki tego logu
      // są celowo lekkie (CSV, jedna linia na akcję), więc nawet po
      // roku codziennego użytku to tania operacja.
      const tresc = plik.getBlob().getDataAsString();
      plik.setContent(tresc + linia);
    } else {
      const naglowek = '"Znacznik czasu","Akcja","ID pracownika","Szczegóły"\n';
      folder.createFile(nazwa, naglowek + linia, MimeType.CSV);
    }
  } catch (e) {
    Logger.log('_logRoczny error: ' + e);
  }
}
