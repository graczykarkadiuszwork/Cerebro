// ============================================================
// CEREBRO — Code.gs
// Google Apps Script backend — główna logika
// ============================================================

const FOLDER_NAME = 'Cerebro';

const ALLOWED_MODULES = ['Pulpit', 'Zadania', 'Wiedza', 'Chat', 'Terminarz', 'Personel', 'Ustawienia'];
const ALLOWED_SETTINGS_KEYS = ['organizationName', 'contactEmail', 'claudeApiKey', 'claudeModel', 'claudeSystemPrompt'];

// Główny handler HTTP
function doGet(e) {
  return HtmlService
    .createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Cerebro')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.SAMEORIGIN);
}

// Includowanie plików HTML
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// Ładowanie modułów dynamicznie — z whitelistą po stronie serwera
function getModuleHtml(moduleName) {
  if (!ALLOWED_MODULES.includes(moduleName)) {
    return '<div class="p-6"><div class="text-red-600">Niedozwolony moduł.</div></div>';
  }
  try {
    return HtmlService.createHtmlOutputFromFile(moduleName).getContent();
  } catch(e) {
    return '<div class="p-6"><div class="text-red-600">Błąd ładowania modułu.</div></div>';
  }
}

// ============================================================
// SETUP
// ============================================================

function setupCerebro() {
  try {
    const ss = SpreadsheetApp.create('Cerebro — Baza Danych');
    const id = ss.getId();
    PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', id);

    const sheets = [
      {
        name: 'zadania',
        headers: ['id','tytul','opis','termin','priorytet','kategoria','status','tagi','powtarzaj','data_utworzenia','data_aktualizacji']
      },
      {
        name: 'wiedza',
        headers: ['id','tytul','kategoria','tagi','widocznosc','tresc','zrodlo','data_utworzenia','data_aktualizacji','wersja']
      },
      {
        name: 'wydarzenia',
        headers: ['id','tytul','data','godzina_od','godzina_do','typ','notatki','data_utworzenia']
      },
    ];

    sheets.forEach(cfg => {
      let sheet = ss.getSheetByName(cfg.name);
      if (!sheet) sheet = ss.insertSheet(cfg.name);
      else sheet.clearContents();
      sheet.getRange(1, 1, 1, cfg.headers.length)
        .setValues([cfg.headers])
        .setFontWeight('bold')
        .setBackground('#f2f2f7');
    });

    const defaultSheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('Arkusz1');
    if (defaultSheet) ss.deleteSheet(defaultSheet);

    setupDriveFolders();
    setupDriveTrigger();

    return {
      success: true,
      spreadsheetUrl: ss.getUrl(),
      message: 'Cerebro zainicjowane pomyślnie'
    };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

function getSpreadsheet() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('Cerebro nie jest zainicjowane. Kliknij "Konfiguruj Cerebro" w Ustawieniach.');
  return SpreadsheetApp.openById(id);
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1)
    .filter(row => row[0] !== '')
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });
}

// ============================================================
// TASKS — Zadania
// ============================================================

function getTasks() {
  try {
    const sheet = getSpreadsheet().getSheetByName('zadania');
    return { success: true, data: sheetToObjects(sheet) };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

function createTask(data) {
  try {
    if (!data || !data.tytul || String(data.tytul).trim() === '') {
      return { success: false, error: 'Tytuł jest wymagany' };
    }
    const ALLOWED_PRIORITIES = ['niski','normalny','wysoki','pilne'];
    const ALLOWED_STATUSES = ['todo','inprogress','done'];
    const sheet = getSpreadsheet().getSheetByName('zadania');
    const id = generateId();
    const now = new Date().toISOString();
    sheet.appendRow([
      id,
      String(data.tytul).trim(),
      data.opis ? String(data.opis) : '',
      data.termin ? String(data.termin) : '',
      ALLOWED_PRIORITIES.includes(data.priorytet) ? data.priorytet : 'normalny',
      data.kategoria ? String(data.kategoria) : 'Ogólne',
      ALLOWED_STATUSES.includes(data.status) ? data.status : 'todo',
      data.tagi ? String(data.tagi) : '',
      data.powtarzaj ? String(data.powtarzaj) : 'nigdy',
      now, now
    ]);
    return { success: true, id };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

function updateTask(data) {
  try {
    if (!data || !data.id) return { success: false, error: 'Brak ID zadania' };
    if (!data.tytul || String(data.tytul).trim() === '') {
      return { success: false, error: 'Tytuł jest wymagany' };
    }
    const ALLOWED_PRIORITIES = ['niski','normalny','wysoki','pilne'];
    const ALLOWED_STATUSES = ['todo','inprogress','done'];
    const sheet = getSpreadsheet().getSheetByName('zadania');
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === data.id) {
        sheet.getRange(i+1, 1, 1, 11).setValues([[
          data.id,
          String(data.tytul).trim(),
          data.opis ? String(data.opis) : '',
          data.termin ? String(data.termin) : '',
          ALLOWED_PRIORITIES.includes(data.priorytet) ? data.priorytet : 'normalny',
          data.kategoria ? String(data.kategoria) : 'Ogólne',
          ALLOWED_STATUSES.includes(data.status) ? data.status : 'todo',
          data.tagi ? String(data.tagi) : '',
          data.powtarzaj ? String(data.powtarzaj) : 'nigdy',
          rows[i][9],
          new Date().toISOString()
        ]]);
        return { success: true };
      }
    }
    return { success: false, error: 'Nie znaleziono zadania' };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

function deleteTask(id) {
  try {
    const sheet = getSpreadsheet().getSheetByName('zadania');
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === id) {
        sheet.deleteRow(i+1);
        return { success: true };
      }
    }
    return { success: false, error: 'Nie znaleziono zadania' };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

// ============================================================
// KNOWLEDGE BASE — Baza Wiedzy
// ============================================================

function getKnowledge(filterVisibility) {
  try {
    const sheet = getSpreadsheet().getSheetByName('wiedza');
    let data = sheetToObjects(sheet);
    if (filterVisibility === 'shared') {
      data = data.filter(r => r.widocznosc === 'udostepniony');
    }
    return { success: true, data };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

function createKnowledge(data) {
  try {
    if (!data || !data.tytul || String(data.tytul).trim() === '') {
      return { success: false, error: 'Tytuł jest wymagany' };
    }
    const ALLOWED_CATEGORIES = ['notatki','procedury','cenniki','szablony','materialy','materiały','inne','chat'];
    const ALLOWED_VISIBILITY = ['prywatny','udostepniony'];
    const sheet = getSpreadsheet().getSheetByName('wiedza');
    const id = generateId();
    const now = new Date().toISOString();
    sheet.appendRow([
      id,
      String(data.tytul).trim(),
      ALLOWED_CATEGORIES.includes(data.kategoria) ? data.kategoria : 'notatki',
      data.tagi ? String(data.tagi) : '',
      ALLOWED_VISIBILITY.includes(data.widocznosc) ? data.widocznosc : 'prywatny',
      data.tresc ? String(data.tresc) : '',
      data.zrodlo ? String(data.zrodlo) : '',
      now, now, 1
    ]);
    return { success: true, id };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

function updateKnowledge(data) {
  try {
    if (!data || !data.id) return { success: false, error: 'Brak ID wpisu' };
    if (!data.tytul || String(data.tytul).trim() === '') {
      return { success: false, error: 'Tytuł jest wymagany' };
    }
    const ALLOWED_CATEGORIES = ['notatki','procedury','cenniki','szablony','materialy','materiały','inne','chat'];
    const ALLOWED_VISIBILITY = ['prywatny','udostepniony'];
    const sheet = getSpreadsheet().getSheetByName('wiedza');
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === data.id) {
        const version = (parseInt(rows[i][9]) || 1) + 1;
        sheet.getRange(i+1, 1, 1, 10).setValues([[
          data.id,
          String(data.tytul).trim(),
          ALLOWED_CATEGORIES.includes(data.kategoria) ? data.kategoria : 'notatki',
          data.tagi ? String(data.tagi) : '',
          ALLOWED_VISIBILITY.includes(data.widocznosc) ? data.widocznosc : 'prywatny',
          data.tresc ? String(data.tresc) : '',
          data.zrodlo ? String(data.zrodlo) : '',
          rows[i][7],
          new Date().toISOString(),
          version
        ]]);
        return { success: true };
      }
    }
    return { success: false, error: 'Nie znaleziono wpisu' };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

function deleteKnowledge(id) {
  try {
    const sheet = getSpreadsheet().getSheetByName('wiedza');
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === id) {
        sheet.deleteRow(i+1);
        return { success: true };
      }
    }
    return { success: false, error: 'Nie znaleziono wpisu' };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

// ============================================================
// EVENTS — Terminarz
// ============================================================

function getEvents() {
  try {
    const sheet = getSpreadsheet().getSheetByName('wydarzenia');
    return { success: true, data: sheetToObjects(sheet) };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

function createEvent(data) {
  try {
    if (!data || !data.tytul || String(data.tytul).trim() === '') {
      return { success: false, error: 'Tytuł jest wymagany' };
    }
    if (!data.data) return { success: false, error: 'Data jest wymagana' };
    const ALLOWED_TYPES = ['ogolne','spotkanie','deadline','wolne','inne'];
    const sheet = getSpreadsheet().getSheetByName('wydarzenia');
    const id = generateId();
    sheet.appendRow([
      id,
      String(data.tytul).trim(),
      String(data.data),
      data.godzina_od ? String(data.godzina_od) : '',
      data.godzina_do ? String(data.godzina_do) : '',
      ALLOWED_TYPES.includes(data.typ) ? data.typ : 'ogolne',
      data.notatki ? String(data.notatki) : '',
      new Date().toISOString()
    ]);
    return { success: true, id };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

function updateEvent(data) {
  try {
    if (!data || !data.id) return { success: false, error: 'Brak ID wydarzenia' };
    if (!data.tytul || String(data.tytul).trim() === '') {
      return { success: false, error: 'Tytuł jest wymagany' };
    }
    if (!data.data) return { success: false, error: 'Data jest wymagana' };
    const ALLOWED_TYPES = ['ogolne','spotkanie','deadline','wolne','inne'];
    const sheet = getSpreadsheet().getSheetByName('wydarzenia');
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === data.id) {
        sheet.getRange(i+1, 1, 1, 8).setValues([[
          data.id,
          String(data.tytul).trim(),
          String(data.data),
          data.godzina_od ? String(data.godzina_od) : '',
          data.godzina_do ? String(data.godzina_do) : '',
          ALLOWED_TYPES.includes(data.typ) ? data.typ : 'ogolne',
          data.notatki ? String(data.notatki) : '',
          rows[i][7]
        ]]);
        return { success: true };
      }
    }
    return { success: false, error: 'Nie znaleziono wydarzenia' };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

function deleteEvent(id) {
  try {
    const sheet = getSpreadsheet().getSheetByName('wydarzenia');
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === id) {
        sheet.deleteRow(i+1);
        return { success: true };
      }
    }
    return { success: false, error: 'Nie znaleziono wydarzenia' };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

// ============================================================
// SETTINGS — tylko dozwolone klucze
// ============================================================

function getSettings() {
  try {
    const allProps = PropertiesService.getUserProperties().getProperties();
    const safe = {};
    ALLOWED_SETTINGS_KEYS.forEach(key => {
      if (allProps[key] !== undefined) safe[key] = allProps[key];
    });
    safe._spreadsheetReady = !!PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    safe._driveFolderReady = !!PropertiesService.getScriptProperties().getProperty('CEREBRO_FOLDER_ID');
    return { success: true, data: safe };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

function saveSettings(data) {
  try {
    const safe = {};
    ALLOWED_SETTINGS_KEYS.forEach(key => {
      if (data[key] !== undefined) safe[key] = String(data[key]);
    });
    PropertiesService.getUserProperties().setProperties(safe);
    return { success: true };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

// ============================================================
// CLAUDE API
// ============================================================

function callClaudeApi(messages, systemPrompt) {
  try {
    const apiKey = PropertiesService.getUserProperties().getProperty('claudeApiKey');
    if (!apiKey || apiKey.trim() === '') {
      return { success: false, error: 'Brak klucza API Claude. Dodaj go w Ustawieniach.' };
    }

    const model = PropertiesService.getUserProperties().getProperty('claudeModel') || 'claude-opus-4-7';
    const defaultSystem = PropertiesService.getUserProperties().getProperty('claudeSystemPrompt') ||
      'Jesteś pomocnym asystentem o nazwie Cerebro. Odpowiadasz po polsku, chyba że użytkownik pisze w innym języku. Jesteś zwięzły, precyzyjny i przyjazny.';

    const payload = {
      model: model,
      max_tokens: 4096,
      system: systemPrompt || defaultSystem,
      messages: messages
    };

    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'x-api-key': apiKey.trim(),
        'anthropic-version': '2023-06-01'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', options);
    const result = JSON.parse(response.getContentText());

    if (result.error) {
      return { success: false, error: result.error.message || 'Błąd API Claude' };
    }
    if (!result.content || !result.content[0]) {
      return { success: false, error: 'Pusta odpowiedź z API' };
    }

    return { success: true, message: result.content[0].text, usage: result.usage };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

function saveChatConversationToDrive(title, messages) {
  try {
    const folderId = PropertiesService.getScriptProperties().getProperty('CEREBRO_FOLDER_ID');
    if (!folderId) {
      return { success: false, error: 'Folder Cerebro nie istnieje. Skonfiguruj Drive w Ustawieniach.' };
    }

    const cerebro = DriveApp.getFolderById(folderId);
    let chatsFolder;
    const existing = cerebro.getFoldersByName('Konwersacje_Claude');
    if (existing.hasNext()) {
      chatsFolder = existing.next();
    } else {
      chatsFolder = cerebro.createFolder('Konwersacje_Claude');
    }

    const dateStr = new Date().toLocaleDateString('pl-PL');
    const dateIso = new Date().toISOString().split('T')[0];
    let content = '# ' + title + '\n\nData: ' + dateStr + '\n\n---\n\n';
    messages.forEach(function(msg) {
      const role = msg.role === 'user' ? '## Użytkownik' : '## Claude';
      content += role + '\n\n' + msg.content + '\n\n---\n\n';
    });

    const filename = title.substring(0, 60) + ' — ' + dateIso + '.md';
    const blob = Utilities.newBlob(content, 'text/markdown', filename);
    const file = chatsFolder.createFile(blob);

    return { success: true, fileId: file.getId(), fileUrl: file.getUrl(), filename: filename };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

// ============================================================
// EXPORT
// ============================================================

function exportAllData() {
  try {
    const ss = getSpreadsheet();
    const result = {};
    ['zadania','wiedza','wydarzenia'].forEach(name => {
      result[name] = sheetToObjects(ss.getSheetByName(name));
    });
    return { success: true, data: JSON.stringify(result, null, 2) };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

function exportCSV(sheetName) {
  try {
    const ALLOWED_SHEETS = ['zadania','wiedza','wydarzenia'];
    if (!ALLOWED_SHEETS.includes(sheetName)) {
      return { success: false, error: 'Niedozwolona nazwa arkusza' };
    }
    const sheet = getSpreadsheet().getSheetByName(sheetName);
    const data = sheet.getDataRange().getValues();
    const csv = data.map(row =>
      row.map(cell => {
        const val = String(cell);
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          return '"' + val.replace(/"/g, '""') + '"';
        }
        return val;
      }).join(',')
    ).join('\n');
    return { success: true, data: csv, filename: sheetName + '.csv' };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}
