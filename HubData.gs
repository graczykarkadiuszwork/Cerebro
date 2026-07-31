// ============================================================
// CEREBRO — HubData.gs
// Dane dla Hub.html czytane NA ŻYWO z Dysku Google — żadnych sztywnych
// linków wpisanych w HTML. Gdy zmienisz link w dokumencie/arkuszu źródłowym
// na Dysku, Hub pokaże nową wartość od razu przy następnym otwarciu węzła,
// bez edycji kodu.
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
