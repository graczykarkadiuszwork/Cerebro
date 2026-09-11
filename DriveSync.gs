// ============================================================
// CEREBRO — DriveSync.gs
// Automatyczny import plików z Google Drive do bazy wiedzy
// ============================================================

const FOLDER_CATEGORY_MAP = {
  'Procedury':  { kategoria: 'procedury',  tagi: 'procedury,import-drive' },
  'Cenniki':    { kategoria: 'cenniki',    tagi: 'cenniki,import-drive' },
  'Szablony':   { kategoria: 'szablony',   tagi: 'szablony,import-drive' },
  'Materiały':  { kategoria: 'materialy',  tagi: 'materialy,import-drive' },
  'Prywatne':   { kategoria: 'prywatne',   tagi: 'prywatne,import-drive' },
  'Notatki':    { kategoria: 'notatki',    tagi: 'notatki,import-drive' },
};

function setupDriveFolders() {
  try {
    const root = DriveApp.getRootFolder();

    // Utwórz główny folder Cerebro
    let cerebro = null;
    const folders = root.getFoldersByName(FOLDER_NAME);
    if (folders.hasNext()) {
      cerebro = folders.next();
    } else {
      cerebro = root.createFolder(FOLDER_NAME);
    }

    // Utwórz podfoldery
    Object.keys(FOLDER_CATEGORY_MAP).forEach(name => {
      const existing = cerebro.getFoldersByName(name);
      if (!existing.hasNext()) {
        cerebro.createFolder(name);
      }
    });

    // Zapisz ID folderu
    PropertiesService.getScriptProperties()
      .setProperty('CEREBRO_FOLDER_ID', cerebro.getId());

    return { success: true, folderId: cerebro.getId() };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

function setupDriveTrigger() {
  try {
    // Usuń istniejące triggery tego typu
    ScriptApp.getProjectTriggers().forEach(trigger => {
      if (trigger.getHandlerFunction() === 'syncDriveFiles') {
        ScriptApp.deleteTrigger(trigger);
      }
    });

    // Ustaw trigger co 1 godzinę
    ScriptApp.newTrigger('syncDriveFiles')
      .timeBased()
      .everyHours(1)
      .create();

    return { success: true };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

function syncDriveFiles() {
  try {
    const folderId = PropertiesService.getScriptProperties()
      .getProperty('CEREBRO_FOLDER_ID');
    if (!folderId) return { success: false, error: 'Folder Cerebro nie istnieje' };

    const cerebro = DriveApp.getFolderById(folderId);
    const processedIds = getProcessedFileIds();
    const newEntries = [];

    // Sprawdź każdy podfolder
    const subfolders = cerebro.getFolders();
    while (subfolders.hasNext()) {
      const subfolder = subfolders.next();
      const folderName = subfolder.getName();
      const mapping = FOLDER_CATEGORY_MAP[folderName];
      if (!mapping) continue;

      // Sprawdź pliki w podfolderze
      const files = subfolder.getFiles();
      while (files.hasNext()) {
        const file = files.next();
        const fileId = file.getId();

        // Pomiń już przetworzone
        if (processedIds.includes(fileId)) continue;

        // Odczytaj treść pliku
        let content = '';
        try {
          const mimeType = file.getMimeType();
          if (mimeType === 'application/vnd.google-apps.document') {
            content = DocumentApp.openById(fileId).getBody().getText();
          } else if (mimeType === 'text/plain') {
            content = file.getBlob().getDataAsString('utf-8');
          } else {
            content = `[Plik: ${file.getName()}]\n[Typ: ${mimeType}]\n[Rozmiar: ${file.getSize()} B]\n[Dodano: ${file.getDateCreated()}]\n\nPlik dostępny na Drive: ${file.getUrl()}`;
          }
        } catch(err) {
          content = `[Błąd odczytu pliku: ${err.toString()}]\n\nPlik dostępny na Drive: ${file.getUrl()}`;
        }

        // Wyciągnij tagi ze słów kluczowych w nazwie pliku
        const extraTags = extractTagsFromFilename(file.getName());
        const allTags = [mapping.tagi, extraTags].filter(Boolean).join(',');

        // Utwórz wpis w bazie wiedzy
        const entry = {
          tytul: file.getName().replace(/\.[^/.]+$/, ''),
          kategoria: mapping.kategoria,
          tagi: allTags,
          widocznosc: folderName === 'Prywatne' ? 'prywatny' : 'udostepniony',
          tresc: content,
          zrodlo: `Google Drive — ${folderName}`
        };

        createKnowledge(entry);
        newEntries.push(fileId);
        markFileAsProcessed(fileId);
      }
    }

    return { success: true, imported: newEntries.length };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

function extractTagsFromFilename(filename) {
  const keywordMap = {
    'procedura': 'procedura',
    'cennik': 'cennik',
    'szablon': 'szablon',
    'umowa': 'umowa',
    'regulamin': 'regulamin',
    'instrukcja': 'instrukcja',
    'raport': 'raport',
    'protokol': 'protokol',
    'zgoda': 'zgoda',
  };

  const lower = filename.toLowerCase();
  const tags = [];
  Object.entries(keywordMap).forEach(([keyword, tag]) => {
    if (lower.includes(keyword)) tags.push(tag);
  });
  return tags.join(',');
}

function getProcessedFileIds() {
  const stored = PropertiesService.getScriptProperties()
    .getProperty('PROCESSED_FILE_IDS');
  return stored ? JSON.parse(stored) : [];
}

function markFileAsProcessed(fileId) {
  const ids = getProcessedFileIds();
  ids.push(fileId);
  const trimmed = ids.slice(-1000);
  PropertiesService.getScriptProperties()
    .setProperty('PROCESSED_FILE_IDS', JSON.stringify(trimmed));
}

function manualSyncDrive() {
  return syncDriveFiles();
}

function resetProcessedFiles() {
  PropertiesService.getScriptProperties().deleteProperty('PROCESSED_FILE_IDS');
  return { success: true };
}
