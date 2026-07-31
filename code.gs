// ============================================================
// CEREBRO — Code.gs
// Google Apps Script backend — główna logika
// ============================================================

const FOLDER_NAME = 'Cerebro';

// Główny handler HTTP
// ?view=app  -> właściwa aplikacja Cerebro (Index / moduły)
// (brak parametru, cokolwiek innego) -> Hub — pulpit-rozdroże w stylu Windows 98
function doGet(e) {
  const view = (e.parameter.view || 'hub').toLowerCase();

  if (view === 'app') {
    return HtmlService
      .createTemplateFromFile('Index')
      .evaluate()
      .setTitle('Cerebro')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  return HtmlService
    .createHtmlOutputFromFile('Hub')
    .setTitle('Cerebro')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Includowanie plików HTML
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// Ładowanie modułów dynamicznie
function getModuleHtml(moduleName) {
  try {
    return HtmlService.createHtmlOutputFromFile(moduleName).getContent();
  } catch(e) {
    return '<div class="p-6"><div class="text-red-600">Błąd ładowania modułu: ' + e.toString() + '</div></div>';
  }
}

// ============================================================
// SETUP
// ============================================================

function setupCerebro() {
  try {
    // Utwórz arkusz kalkulacyjny
    const ss = SpreadsheetApp.create('Cerebro — Baza Danych');
    const id = ss.getId();

    // Zapisz ID w Properties
    PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', id);

    // Utwórz arkusze
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
      {
        name: 'ustawienia',
        headers: ['klucz','wartosc']
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

    // Usuń domyślny Sheet1
    const defaultSheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('Arkusz1');
    if (defaultSheet) ss.deleteSheet(defaultSheet);

    // Utwórz strukturę folderów na Drive
    setupDriveFolders();

    // Ustaw trigger auto-importu
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
    const sheet = getSpreadsheet().getSheetByName('zadania');
    const id = generateId();
    const now = new Date().toISOString();
    sheet.appendRow([
      id, data.tytul, data.opis||'', data.termin||'',
      data.priorytet||'normalny', data.kategoria||'Ogólne',
      data.status||'todo', data.tagi||'',
      data.powtarzaj||'nigdy', now, now
    ]);
    return { success: true, id };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

function updateTask(data) {
  try {
    const sheet = getSpreadsheet().getSheetByName('zadania');
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === data.id) {
        sheet.getRange(i+1, 1, 1, 11).setValues([[
          data.id, data.tytul, data.opis||'', data.termin||'',
          data.priorytet||'normalny', data.kategoria||'Ogólne',
          data.status||'todo', data.tagi||'',
          data.powtarzaj||'nigdy', rows[i][9], new Date().toISOString()
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
    const sheet = getSpreadsheet().getSheetByName('wiedza');
    const id = generateId();
    const now = new Date().toISOString();
    sheet.appendRow([
      id, data.tytul, data.kategoria||'notatki',
      data.tagi||'', data.widocznosc||'prywatny',
      data.tresc||'', data.zrodlo||'', now, now, 1
    ]);
    return { success: true, id };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

function updateKnowledge(data) {
  try {
    const sheet = getSpreadsheet().getSheetByName('wiedza');
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === data.id) {
        const version = (parseInt(rows[i][9]) || 1) + 1;
        sheet.getRange(i+1, 1, 1, 10).setValues([[
          data.id, data.tytul, data.kategoria,
          data.tagi||'', data.widocznosc,
          data.tresc||'', data.zrodlo||'',
          rows[i][7], new Date().toISOString(), version
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
    const sheet = getSpreadsheet().getSheetByName('wydarzenia');
    const id = generateId();
    sheet.appendRow([
      id, data.tytul, data.data,
      data.godzina_od||'', data.godzina_do||'',
      data.typ||'ogolne', data.notatki||'',
      new Date().toISOString()
    ]);
    return { success: true, id };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

function updateEvent(data) {
  try {
    const sheet = getSpreadsheet().getSheetByName('wydarzenia');
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === data.id) {
        sheet.getRange(i+1, 1, 1, 8).setValues([[
          data.id, data.tytul, data.data,
          data.godzina_od||'', data.godzina_do||'',
          data.typ||'ogolne', data.notatki||'', rows[i][7]
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
// SETTINGS
// ============================================================

function getSettings() {
  try {
    const props = PropertiesService.getUserProperties().getProperties();
    return { success: true, data: props };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

function saveSettings(data) {
  try {
    PropertiesService.getUserProperties().setProperties(data);
    return { success: true };
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
    const sheet = getSpreadsheet().getSheetByName(sheetName);
    const data = sheet.getDataRange().getValues();
    const csv = data.map(row =>
      row.map(cell => {
        if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"'))) {
          return '"' + cell.replace(/"/g, '""') + '"';
        }
        return cell;
      }).join(',')
    ).join('\n');
    return { success: true, data: csv, filename: sheetName + '.csv' };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

// ============================================================
// CEREBRO — Hub: dane RCP/BatCave czytane NA ŻYWO z Dysku Google.
// (Wcześniej w osobnym pliku HubData.gs — scalone tutaj, żeby wdrożenie
// wymagało pilnowania jednego pliku serwerowego, nie dwóch.)
// ============================================================

// Dokument "RCP linki" (folder HR/RCP) — lista linków do wdrożeń RCP,
// każdy jako osobny akapit z hiperłączem na tekście.
const RCP_LINKS_DOC_ID = '1_WRadAW5SgMYuQxHfgU9oqAs98QW6oUNt6kFkS6A1P4';

// Arkusz "WS ewidencja czasu pracy", zakładka "Pracownicy" — tu jest PIN
// właściciela/admina RCP (wiersz z kolumną Rola = "Admin").
const RCP_STAFF_SHEET_ID = '1wI3ysrolzGea5nNi7GYBo09t38y8oUgPoqGG3wn-ZsA';
const RCP_STAFF_SHEET_TAB = 'Pracownicy';

// ---------------------------------------------------------------------------
// RCP — lista widoków, czytana live z treści dokumentu "RCP linki".
// ---------------------------------------------------------------------------
function getRcpViews() {
  try {
    const doc = DocumentApp.openById(RCP_LINKS_DOC_ID);
    const data = extractLinksFromBody(doc.getBody());
    return { success: true, data: data };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// Przechodzi po akapitach dokumentu i wyciąga te, których tekst ma
// przypięty hiperłącz (getLinkUrl na dowolnym znaku akapitu).
function extractLinksFromBody(body) {
  const results = [];
  const numChildren = body.getNumChildren();
  for (let i = 0; i < numChildren; i++) {
    const el = body.getChild(i);
    if (el.getType() !== DocumentApp.ElementType.PARAGRAPH) continue;
    const text = el.asParagraph().editAsText();
    const content = text.getText().trim();
    if (!content) continue;

    let url = null;
    for (let c = 0; c < content.length; c++) {
      const linkUrl = text.getLinkUrl(c);
      if (linkUrl) { url = linkUrl; break; }
    }
    if (url) results.push({ name: content, url: url });
  }
  return results;
}

// ---------------------------------------------------------------------------
// BatCave — brama PIN-em właściciela RCP. Zwraca WYŁĄCZNIE prawda/fałsz,
// PIN nigdy nie opuszcza serwera w stronę przeglądarki.
// ---------------------------------------------------------------------------
function verifyRcpOwnerPin(pin) {
  try {
    const sheet = SpreadsheetApp.openById(RCP_STAFF_SHEET_ID).getSheetByName(RCP_STAFF_SHEET_TAB);
    if (!sheet) return { success: false, error: 'Nie znaleziono zakładki "' + RCP_STAFF_SHEET_TAB + '".' };

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idxRola = headers.indexOf('Rola');
    const idxPin = headers.indexOf('PIN_HASH');
    if (idxRola === -1 || idxPin === -1) {
      return { success: false, error: 'Nie znaleziono kolumn Rola/PIN_HASH w arkuszu.' };
    }

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idxRola]).trim() === 'Admin') {
        const valid = String(data[i][idxPin]).trim() === String(pin).trim();
        return { success: true, valid: valid };
      }
    }
    return { success: false, error: 'Nie znaleziono właściciela RCP (rola Admin) w arkuszu.' };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// Prosta funkcja diagnostyczna — wywołaj ją z Huba (patrz przycisk debug),
// żeby sprawdzić, czy ta wersja Code.gs w ogóle jest tą, która odpowiada
// na żywym wdrożeniu (pomaga wykryć "zapomniałem zrobić nowej wersji").
function pingHub() {
  return { success: true, message: 'Code.gs odpowiada, wersja z getRcpViews/verifyRcpOwnerPin obecna.' };
}
