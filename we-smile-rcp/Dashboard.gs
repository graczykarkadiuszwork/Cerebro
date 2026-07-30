// ============================================================
// Dashboard.gs — We SMILE RCP v12.0
// ============================================================

const DASH_TTL = 3600;

// ── Sesja ────────────────────────────────────────────────────

function _dashOk(token) {
  if (!token) return false;
  const k = 'ds_' + String(token).slice(0, 50);
  if (_cache().get(k) !== '1') return false;
  _cache().put(k, '1', DASH_TTL);
  return true;
}

// ── Logi admina → arkusz Logi_Admin ──────────────────────────

function _logAdmin(action, empId, details) {
  try {
    const ss = _ss();
    let sh = ss.getSheetByName('Logi_Admin');
    if (!sh) {
      sh = ss.insertSheet('Logi_Admin');
      sh.appendRow(['Timestamp', 'Akcja', 'EmpID', 'Szczegoly']);
    }
    sh.appendRow([new Date().toISOString(), String(action), String(empId || '—'), String(details || '')]);
  } catch (e) {
    Logger.log('_logAdmin error: ' + e);
  }
}

// ── Mapy nieobecności i przekroczeń ──────────────────────────

// { 'EmpID_yyyy-MM-dd': { code, typ, note } }
function _absenceMapAll() {
  const sh = _ss().getSheetByName('Nieobecnosci');
  const rows = (sh && sh.getLastRow() >= 2) ? sh.getDataRange().getValues().slice(1) : [];
  const map = {};
  rows.forEach(r => {
    const ds = _sheetDate(r[4]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ds)) return;
    map[String(r[1]) + '_' + ds] = {
      code: String(r[5] || ''),
      typ:  String(r[6] || ''),
      note: String(r[7] || '')
    };
  });
  return map;
}

// { 'EmpID_yyyy-MM-dd': 'uzasadnienie' }
function _overtimeNotesAll() {
  const sh = _ss().getSheetByName('Przekroczenia');
  const rows = (sh && sh.getLastRow() >= 2) ? sh.getDataRange().getValues().slice(1) : [];
  const map = {};
  rows.forEach(r => {
    const ds = _sheetDate(r[2]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ds)) return;
    map[String(r[1]) + '_' + ds] = String(r[3] || '');
  });
  return map;
}

// ── Login ─────────────────────────────────────────────────────

function dashLogin(pin) {
  if (!pin || !/^\d{4}$/.test(String(pin))) {
    return { ok: false, msg: 'PIN musi mieć 4 cyfry.' };
  }
  if (!_checkRate('dlog')) {
    return { ok: false, msg: 'Zbyt wiele prób. Odczekaj 5 minut.' };
  }
  const worker = _getWorkers().find(r => _pinMatch(r[5], pin));
  if (!worker) {
    return { ok: false, msg: 'Nieprawidłowy PIN.' };
  }
  _resetRate('dlog');
  const token = Utilities.getUuid();
  _cache().put('ds_' + token, '1', DASH_TTL);
  const name = String(worker[1]) + ' ' + String(worker[2]);
  _logAdmin('Logowanie', String(worker[0]), 'Zalogowano: ' + name);
  return { ok: true, token, name };
}

// ── Kto jest teraz w pracy / kto już skończył dziś ────────────

function getActiveNow(token) {
  if (!_dashOk(token)) {
    return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  }
  return _activeNowData();
}

// Wariant dla panelu Właściciela — właściciel jest już uwierzytelniony
// swoim PIN-em (masterLogin), nie potrzebuje osobnej sesji Raportów.
function masterGetActive(token) {
  if (!_masterOk(token)) {
    return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  }
  return _activeNowData();
}

function _activeNowData() {
  const today = _todayPL();
  const ewidSh = _ss().getSheetByName('Ewidencja');
  const rows = (ewidSh && ewidSh.getLastRow() >= 2)
    ? ewidSh.getDataRange().getValues().slice(1) : [];

  const byEmp = {};
  rows.forEach(r => {
    const ds = _sheetDate(r[5]);
    if (ds !== today) return;
    const empId = String(r[1]);
    const akcja = String(r[4]).trim();
    const godz  = _sheetTime(r[6]);
    if (!byEmp[empId]) byEmp[empId] = { e: [], x: [], last: null, lastGodz: null };
    if (akcja === 'WEJSCIE') byEmp[empId].e.push(godz);
    else if (akcja === 'WYJSCIE') byEmp[empId].x.push(godz);
    if (!byEmp[empId].lastGodz || _t2m(godz) >= _t2m(byEmp[empId].lastGodz)) {
      byEmp[empId].last = akcja;
      byEmp[empId].lastGodz = godz;
    }
  });

  const workers = _getWorkers();
  const active = [];
  const finished = [];

  Object.keys(byEmp).forEach(empId => {
    const w = workers.find(row => String(row[0]) === empId);
    if (!w) return;
    const rec = byEmp[empId];
    const wejscie = rec.e.length ? rec.e.slice().sort()[0] : null;
    const wyjscie = rec.x.length ? rec.x.slice().sort().reverse()[0] : null;
    const entry = { id: empId, imie: String(w[1]), nazwisko: String(w[2]), wejscie, wyjscie };

    if (rec.last === 'WEJSCIE') {
      active.push(entry);
    } else if (rec.last === 'WYJSCIE') {
      finished.push(entry);
    }
  });

  active.sort((a, b) => _t2m(a.wejscie) - _t2m(b.wejscie));
  finished.sort((a, b) => _t2m(a.wyjscie) - _t2m(b.wyjscie));

  return { ok: true, active, finished };
}

// ── Dane miesiąca (widok panelu) ──────────────────────────────

function getDashboard(token, year, month) {
  if (!_dashOk(token)) {
    return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła. Zaloguj się ponownie.' };
  }
  return _dashboardData(year, month);
}

// Wariant dla panelu Właściciela — jego własna sesja (masterLogin) wystarcza.
function masterGetDashboard(token, year, month) {
  if (!_masterOk(token)) {
    return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  }
  return _dashboardData(year, month);
}

function _dashboardData(year, month) {
  try {
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    if (isNaN(y) || isNaN(m) || m < 1 || m > 12) {
      return { ok: false, msg: 'Nieprawidłowy miesiąc/rok.' };
    }

    const daysInMonth = new Date(y, m, 0).getDate();
    const pfx = y + '-' + String(m).padStart(2, '0');
    const props = PropertiesService.getScriptProperties();

    const etatKey = 'etat_' + y + '_' + String(m).padStart(2, '0');
    const etat = parseFloat(props.getProperty(etatKey) || '') || 0;

    const ewidSh = _ss().getSheetByName('Ewidencja');
    const ewidRows = (ewidSh && ewidSh.getLastRow() >= 2)
      ? ewidSh.getDataRange().getValues().slice(1) : [];

    const rcpMap = {};
    ewidRows.forEach(r => {
      const ds = _sheetDate(r[5]);
      if (!ds.startsWith(pfx)) return;
      const k = String(r[1]) + '_' + ds;
      if (!rcpMap[k]) rcpMap[k] = { e: [], x: [] };
      const akcja = String(r[4]).trim();
      const godz  = _sheetTime(r[6]);
      if (akcja === 'WEJSCIE') rcpMap[k].e.push(godz);
      else if (akcja === 'WYJSCIE') rcpMap[k].x.push(godz);
    });

    const absMap   = _absenceMapAll();
    const ovrNotes = _overtimeNotesAll();

    const DOW = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];

    const employees = _getWorkers()
      .filter(_isRcpWorker)
      .map(w => {
        const id = String(w[0]);
        const forma = String(w[6] || '');
        let totalMins = 0;
        let absDays = 0;
        let paidAbsDays = 0;
        let ovrDays = 0;
        let ovrMinutes = 0;

        const days = [];
        for (let d = 1; d <= daysInMonth; d++) {
          const ds  = pfx + '-' + String(d).padStart(2, '0');
          const key = id + '_' + ds;
          const rcp = rcpMap[key];

          let wejscie = null, wyjscie = null, mins = null;
          if (rcp) {
            if (rcp.e.length) wejscie = rcp.e.slice().sort()[0];
            if (rcp.x.length) wyjscie = rcp.x.slice().sort().reverse()[0];
            if (wejscie && wyjscie) {
              const diff = _t2m(wyjscie) - _t2m(wejscie);
              if (diff > 0) { mins = diff; totalMins += diff; }
            }
          }

          const absence  = absMap[key] || null;
          const overtime = _dayOutsideClinic(ds, wejscie, wyjscie);
          const overtimeMinutes = _overtimeMinutes(ds, wejscie, wyjscie);
          const overtimeNote = ovrNotes[key] || '';
          if (absence)  absDays++;
          if (overtime) { ovrDays++; ovrMinutes += overtimeMinutes; }

          // Urlop UoP z kodu płatnego 8h/dzień dolicza się do sumy miesięcznej,
          // niezależnie od tego, że w tym dniu nie ma odbić w Ewidencji.
          if (absence && forma === FORMA_UOP && PAID_8H_CODES.indexOf(absence.code) !== -1) {
            mins = 480;
            totalMins += 480;
            paidAbsDays++;
          }

          const dow = DOW[new Date(ds + 'T12:00:00').getDay()];
          days.push({ date: ds, dow, wejscie, wyjscie, mins, absence, overtime, overtimeMinutes, overtimeNote });
        }

        const noteKey = 'note_' + id + '_' + y + '_' + String(m).padStart(2, '0');
        const note = props.getProperty(noteKey) || '';

        return {
          id,
          imie:         String(w[1]),
          nazwisko:     String(w[2]),
          rola:         String(w[3]),
          totalMinutes: totalMins,
          totalHours:   Math.round((totalMins / 60) * 10) / 10,
          absDays,
          paidAbsDays,
          ovrDays,
          ovrMinutes,
          ovrHours: Math.round((ovrMinutes / 60) * 10) / 10,
          note,
          days
        };
      });

    return { ok: true, year: y, month: m, etat, employees };

  } catch (e) {
    Logger.log('getDashboard error: ' + e);
    return { ok: false, msg: 'Błąd serwera: ' + e.toString() };
  }
}

// ── Zapis normy godzin ────────────────────────────────────────

function setEtat(token, year, month, hours) {
  if (!_dashOk(token)) {
    return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  }
  return _setEtatData(year, month, hours);
}

function masterSetEtat(token, year, month, hours) {
  if (!_masterOk(token)) {
    return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  }
  return _setEtatData(year, month, hours);
}

function _setEtatData(year, month, hours) {
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  const h = parseFloat(hours);
  if (isNaN(y) || isNaN(m) || isNaN(h) || h < 0 || h > 800) {
    return { ok: false, msg: 'Nieprawidłowe dane.' };
  }
  const key = 'etat_' + y + '_' + String(m).padStart(2, '0');
  PropertiesService.getScriptProperties().setProperty(key, String(h));
  _logAdmin('SetNorma', '—', 'Norma ' + y + '-' + String(m).padStart(2, '0') + ': ' + h + 'h');
  return { ok: true };
}

// ── Zapis adnotacji ───────────────────────────────────────────

function setNote(token, empId, year, month, note) {
  if (!_dashOk(token)) {
    return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  }
  return _setNoteData(empId, year, month, note);
}

function masterSetNote(token, empId, year, month, note) {
  if (!_masterOk(token)) {
    return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  }
  return _setNoteData(empId, year, month, note);
}

function _setNoteData(empId, year, month, note) {
  if (!empId) return { ok: false, msg: 'Brak danych.' };
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  if (isNaN(y) || isNaN(m)) return { ok: false, msg: 'Nieprawidłowy miesiąc.' };
  const key = 'note_' + String(empId) + '_' + y + '_' + String(m).padStart(2, '0');
  const text = String(note || '').slice(0, 500);
  PropertiesService.getScriptProperties().setProperty(key, text);
  _logAdmin('SetAdnotacja', String(empId), text.slice(0, 100));
  return { ok: true };
}

// ── Metadane do okna eksportu ──────────────────────────────────

function getExportMeta(token) {
  if (!_dashOk(token)) {
    return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  }
  return _exportMetaData();
}

function masterGetExportMeta(token) {
  if (!_masterOk(token)) {
    return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  }
  return _exportMetaData();
}

function _exportMetaData() {
  const { minDate } = _buildEwidMap();
  const today = _todayPL();
  const employees = _getWorkers()
    .filter(_isRcpWorker)
    .map(w => ({ id: String(w[0]), imie: String(w[1]), nazwisko: String(w[2]) }));

  return {
    ok: true,
    earliest: minDate || today,
    today,
    employees
  };
}

// ── Eksport Excel (arkusz na pracownika, zakres + filtr) ───────

function dashExportXlsx(token, opts) {
  if (!_dashOk(token)) {
    return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  }
  return _dashExportXlsxData(opts);
}

function masterDashExportXlsx(token, opts) {
  if (!_masterOk(token)) {
    return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  }
  return _dashExportXlsxData(opts);
}

function _dashExportXlsxData(opts) {
  opts = opts || {};

  let fromStr, toStr;
  if (opts.mode === 'range') {
    fromStr = String(opts.from || '');
    toStr   = String(opts.to || '');
  } else {
    const y = parseInt(opts.year, 10);
    const m = parseInt(opts.month, 10);
    if (isNaN(y) || isNaN(m) || m < 1 || m > 12) {
      return { ok: false, msg: 'Nieprawidłowy miesiąc.' };
    }
    const dim = new Date(y, m, 0).getDate();
    fromStr = y + '-' + String(m).padStart(2, '0') + '-01';
    toStr   = y + '-' + String(m).padStart(2, '0') + '-' + String(dim).padStart(2, '0');
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromStr) || !/^\d{4}-\d{2}-\d{2}$/.test(toStr) || fromStr > toStr) {
    return { ok: false, msg: 'Nieprawidłowy zakres dat.' };
  }

  const workers = _getWorkers().filter(_isRcpWorker);
  const wantedIds = Array.isArray(opts.employeeIds) && opts.employeeIds.length
    ? opts.employeeIds.map(String)
    : workers.map(w => String(w[0]));

  const selected = workers.filter(w => wantedIds.indexOf(String(w[0])) !== -1);
  if (selected.length === 0) {
    return { ok: false, msg: 'Nie wybrano żadnego pracownika.' };
  }

  const { map } = _buildEwidMap();
  const absMap   = _absenceMapAll();
  const ovrNotes = _overtimeNotesAll();
  const DOW = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];

  const tmpName = 'WeSMILE_Raport_' + fromStr + '_' + toStr + '_' + Utilities.getUuid().slice(0, 8);
  const tmpSs = SpreadsheetApp.create(tmpName);
  const defaultSheet = tmpSs.getSheets()[0];

  selected.forEach(w => {
    const id = String(w[0]);
    const forma = String(w[6] || '');
    const rawName = String(w[1]) + ' ' + String(w[2]);
    const safeName = rawName.replace(/[\\\/\?\*\[\]:]/g, ' ').slice(0, 90) || id;
    const sh = tmpSs.insertSheet(safeName);
    const header = ['Data', 'Dzień', 'Wejście', 'Wyjście', 'Godziny', 'Nieobecność', 'Uwagi'];
    sh.appendRow(header);

    let totalMins = 0;
    const cursor = new Date(fromStr + 'T12:00:00');
    const end = new Date(toStr + 'T12:00:00');
    while (cursor <= end) {
      const ds = Utilities.formatDate(cursor, 'Europe/Warsaw', 'yyyy-MM-dd');
      const rcp = map[id + '_' + ds];
      let wejscie = '', wyjscie = '', godzTxt = '';
      let we = null, wy = null;
      if (rcp) {
        we = rcp.e.length ? rcp.e.slice().sort()[0] : null;
        wy = rcp.x.length ? rcp.x.slice().sort().reverse()[0] : null;
        wejscie = we || '';
        wyjscie = wy || '';
        if (we && wy) {
          const diff = _t2m(wy) - _t2m(we);
          if (diff > 0) { totalMins += diff; godzTxt = _fmtHM(diff); }
        }
      }

      const abs = absMap[id + '_' + ds] || null;
      if (abs && forma === FORMA_UOP && PAID_8H_CODES.indexOf(abs.code) !== -1) {
        totalMins += 480;
        godzTxt = _fmtHM(480);
      }
      const uwagi = [];
      if (abs && abs.note) uwagi.push(abs.note);
      if (_dayOutsideClinic(ds, we, wy)) {
        const ovrNote = ovrNotes[id + '_' + ds] || '';
        uwagi.push('Poza godzinami Kliniki' + (ovrNote ? ': ' + ovrNote : ' (brak uzasadnienia)'));
      }

      sh.appendRow([ds, DOW[cursor.getDay()], wejscie, wyjscie, godzTxt,
                    abs ? abs.typ : '', uwagi.join(' | ')]);
      cursor.setDate(cursor.getDate() + 1);
    }

    sh.appendRow(['', '', '', 'RAZEM', _fmtHM(totalMins), '', '']);
    sh.getRange(1, 1, 1, header.length).setFontWeight('bold');
    sh.autoResizeColumns(1, header.length);
  });

  tmpSs.deleteSheet(defaultSheet);
  SpreadsheetApp.flush();

  const fileId = tmpSs.getId();
  const url = 'https://docs.google.com/spreadsheets/d/' + fileId + '/export?format=xlsx';
  const resp = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }
  });
  const b64 = Utilities.base64Encode(resp.getContent());

  try { DriveApp.getFileById(fileId).setTrashed(true); } catch (e) { Logger.log('cleanup error: ' + e); }

  _logAdmin('ExportXLSX', '—', 'Eksport ' + fromStr + ' — ' + toStr + ' (' + selected.length + ' os.)');

  return {
    ok: true,
    filename: 'WeSMILE_' + fromStr + '_' + toStr + '.xlsx',
    base64: b64
  };
}

// ── Pomocnicze — konwersja wartości z Sheets ──────────────────

function _t2m(t) {
  const p = String(t).split(':');
  return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
}

function _fmtHM(mins) {
  if (mins === null || mins === undefined || isNaN(mins)) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h + ':' + String(m).padStart(2, '0');
}

function _sheetDate(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Europe/Warsaw', 'yyyy-MM-dd');
  return String(v);
}

function _sheetTime(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Europe/Warsaw', 'HH:mm');
  const s = String(v);
  if (s !== '' && !isNaN(s) && s.indexOf(':') === -1) {
    const mins = Math.round(parseFloat(s) * 1440);
    return String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
  }
  return s;
}

// Buduje pełną mapę EmpID_Data -> {e:[], x:[]} z całej Ewidencji + najwcześniejszą datę
function _buildEwidMap() {
  const ewidSh = _ss().getSheetByName('Ewidencja');
  const rows = (ewidSh && ewidSh.getLastRow() >= 2)
    ? ewidSh.getDataRange().getValues().slice(1) : [];
  const map = {};
  let minDate = null;
  rows.forEach(r => {
    const ds = _sheetDate(r[5]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ds)) return;
    if (!minDate || ds < minDate) minDate = ds;
    const k = String(r[1]) + '_' + ds;
    if (!map[k]) map[k] = { e: [], x: [] };
    const akcja = String(r[4]).trim();
    const godz  = _sheetTime(r[6]);
    if (akcja === 'WEJSCIE') map[k].e.push(godz);
    else if (akcja === 'WYJSCIE') map[k].x.push(godz);
  });
  return { map, minDate };
}

function diagEwidencja() {
  const sh = _ss().getSheetByName('Ewidencja');
  if (!sh || sh.getLastRow() < 2) { Logger.log('Brak danych'); return; }
  const rows = sh.getDataRange().getValues().slice(1);
  Logger.log('Liczba wierszy: ' + rows.length);
  rows.forEach((r, i) => Logger.log('W' + (i+2) + ': emp=' + r[1] + ' akcja=' + r[4] +
    ' data=' + _sheetDate(r[5]) + ' godz=' + _sheetTime(r[6])));
}

// ============================================================
// Panel Właściciela (owner) — ręczna edycja czasu
// ============================================================

const MASTER_TTL = 3600;

function _masterOk(token) {
  if (!token) return false;
  const k = 'mo_' + String(token).slice(0, 50);
  if (_cache().get(k) !== '1') return false;
  _cache().put(k, '1', MASTER_TTL);
  return true;
}

function masterLogin(pin) {
  if (!pin || !/^\d{4}$/.test(String(pin))) {
    return { ok: false, msg: 'Nieprawidłowy PIN.' };
  }
  if (!_checkRate('mlog')) {
    return { ok: false, msg: 'Zbyt wiele prób. Odczekaj 5 minut.' };
  }
  const worker = _getWorkers().find(r => _pinMatch(r[5], pin));
  if (!worker || String(worker[3]).toLowerCase() !== 'admin') {
    return { ok: false, msg: 'Brak dostępu.' };
  }
  _resetRate('mlog');
  const token = Utilities.getUuid();
  _cache().put('mo_' + token, '1', MASTER_TTL);
  _logAdmin('MasterLogin', String(worker[0]), 'Zalogowano do panelu edycji: ' + worker[1] + ' ' + worker[2]);
  return { ok: true, token };
}

function masterGetEmployees(token) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  const employees = _getWorkers()
    .filter(w => String(w[4]).toLowerCase() === 'aktywny')
    .map(_workerToObj);
  return { ok: true, employees, tagiDostepne: DOCTOR_SPECIALIZATION_TAGS };
}

// Wspólne mapowanie wiersza arkusza na obiekt dla frontendu.
function _workerToObj(w) {
  const tagiRaw = String(w[7] || '').trim();
  return {
    id: String(w[0]),
    imie: String(w[1]),
    nazwisko: String(w[2]),
    rola: String(w[3]),
    status: String(w[4]),
    forma: String(w[6] || ''),
    tagi: tagiRaw ? tagiRaw.split(',').map(t => t.trim()).filter(t => t) : [],
    grupa: _grupaZawodowa(w[3]),
    maPin: !!String(w[5] == null ? '' : w[5]).trim()
  };
}

// ── Archiwum pracowników — usunięcie z zespołu = zmiana statusu,
// nigdy usunięcie wiersza. Historia (Ewidencja, Nieobecnosci, Logi)
// pozostaje nietknięta i wraca w pełni po przywróceniu. ──

function masterGetArchivedEmployees(token) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  const employees = _getWorkers()
    .filter(w => String(w[4]).toLowerCase() !== 'aktywny')
    .map(_workerToObj);
  return { ok: true, employees };
}

function masterRemoveEmployee(token, empId) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  if (!empId) return { ok: false, msg: 'Brak pracownika.' };

  const sh = _ss().getSheetByName('Pracownicy');
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(empId)) {
      if (String(rows[i][3]).toLowerCase() === 'admin') {
        return { ok: false, msg: 'Nie można zarchiwizować konta Admina.' };
      }
      sh.getRange(i + 1, 5).setValue('Zarchiwizowany');
      _logAdmin('ArchiwizacjaPracownika', String(empId), rows[i][1] + ' ' + rows[i][2]);
      return { ok: true };
    }
  }
  return { ok: false, msg: 'Pracownik nie istnieje.' };
}

function masterRestoreEmployee(token, empId) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  if (!empId) return { ok: false, msg: 'Brak pracownika.' };

  const sh = _ss().getSheetByName('Pracownicy');
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(empId)) {
      sh.getRange(i + 1, 5).setValue('Aktywny');
      _logAdmin('PrzywroceniePracownika', String(empId), rows[i][1] + ' ' + rows[i][2]);
      return { ok: true };
    }
  }
  return { ok: false, msg: 'Pracownik nie istnieje.' };
}

function masterAddEmployee(token, imie, nazwisko, rola, pin) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  imie = String(imie || '').trim();
  nazwisko = String(nazwisko || '').trim();
  rola = String(rola || '').trim();
  pin = String(pin || '').trim();

  if (!imie || !nazwisko) return { ok: false, msg: 'Podaj imię i nazwisko.' };

  // Lekarze nie odbijają się w RCP — PIN jest dla nich opcjonalny. Trzymamy ich
  // jednak w tej samej tabeli Pracownicy, żeby cała kadra miała spójną strukturę
  // (jedna lista, jedno archiwum, jedne nieobecności).
  const grupa = _grupaZawodowa(rola);
  const pinOptional = (grupa === GRUPA_LEKARZ);

  if (!pin && !pinOptional) {
    return { ok: false, msg: 'PIN musi mieć dokładnie 4 cyfry.' };
  }
  if (pin && !/^\d{4}$/.test(pin)) {
    return { ok: false, msg: 'PIN musi mieć dokładnie 4 cyfry.' };
  }

  const sh = _ss().getSheetByName('Pracownicy');
  const rows = sh.getDataRange().getValues().slice(1);
  if (pin && rows.some(r => _pinMatch(r[5], pin))) {
    return { ok: false, msg: 'Ten PIN jest już używany przez innego pracownika.' };
  }

  let maxNum = 0;
  rows.forEach(r => {
    const m = String(r[0]).match(/^WS(\d+)$/);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  });
  const id = 'WS' + String(maxNum + 1).padStart(2, '0');

  sh.appendRow([id, imie, nazwisko, rola || '—', 'Aktywny', pin, '', '']);
  _logAdmin('DodaniePracownika', id, imie + ' ' + nazwisko + ' (' + (rola || '—') + ')');
  return {
    ok: true,
    employee: {
      id, imie, nazwisko, rola: rola || '—', status: 'Aktywny',
      forma: '', tagi: [], grupa
    }
  };
}

// ── Tagi specjalizacji lekarza ────────────────────────────────
// Lista wielokrotnego wyboru z DOCTOR_SPECIALIZATION_TAGS; zapisywana
// jako CSV w kolumnie 8. Zasila silnik rekomendacji grafiku.

function masterSetDoctorTags(token, empId, tags) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  if (!empId) return { ok: false, msg: 'Brak pracownika.' };

  const list = (Array.isArray(tags) ? tags : String(tags || '').split(','))
    .map(t => String(t).trim())
    .filter(t => t && DOCTOR_SPECIALIZATION_TAGS.indexOf(t) !== -1);

  const unique = [];
  list.forEach(t => { if (unique.indexOf(t) === -1) unique.push(t); });

  const sh = _ss().getSheetByName('Pracownicy');
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(empId)) {
      sh.getRange(i + 1, 8).setValue(unique.join(', '));
      _logAdmin('SetTagiSpecjalizacji', String(empId), unique.join(', ') || '(wyczyszczono)');
      return { ok: true, tagi: unique };
    }
  }
  return { ok: false, msg: 'Pracownik nie istnieje.' };
}

// ── Forma zatrudnienia — edycja przez właściciela ──────────────
// Puste forma = "nieustawiona" (samoobsługa pokaże wtedy pełną listę
// typów nieobecności, a urlop nie doliczy godzin do sumy miesięcznej).

function masterSetEmploymentForm(token, empId, forma) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  if (!empId) return { ok: false, msg: 'Brak pracownika.' };
  forma = String(forma || '').trim();
  if (forma && EMPLOYMENT_FORMS.indexOf(forma) === -1) {
    return { ok: false, msg: 'Nieprawidłowa forma zatrudnienia.' };
  }

  const sh = _ss().getSheetByName('Pracownicy');
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(empId)) {
      sh.getRange(i + 1, 7).setValue(forma);
      _logAdmin('SetFormaZatrudnienia', String(empId), forma || '(usunięto)');
      return { ok: true };
    }
  }
  return { ok: false, msg: 'Pracownik nie istnieje.' };
}

// ── Nieobecność w zakresie dat — edycja przez właściciela ──────
// Jeden pracownik, jeden zapis dla całego zakresu (zamiast dzień po dniu).
// Puste typeCode = usunięcie nieobecności w całym zakresie.

function masterSetAbsenceRange(token, empId, dateFrom, dateTo, typeCode, note) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  if (!empId) return { ok: false, msg: 'Wybierz pracownika.' };

  const re = /^\d{4}-\d{2}-\d{2}$/;
  dateFrom = String(dateFrom || '');
  dateTo   = String(dateTo || dateFrom);
  if (!re.test(dateFrom) || !re.test(dateTo) || dateFrom > dateTo) {
    return { ok: false, msg: 'Nieprawidłowy zakres dat.' };
  }

  const from = new Date(dateFrom + 'T12:00:00');
  const to   = new Date(dateTo + 'T12:00:00');
  const days = Math.round((to - from) / 86400000) + 1;
  if (days > ABSENCE_MAX_DAYS) {
    return { ok: false, msg: 'Maksymalny zakres to ' + ABSENCE_MAX_DAYS + ' dni.' };
  }

  const worker = _getWorkers().find(r => String(r[0]) === String(empId));
  if (!worker) return { ok: false, msg: 'Pracownik nie istnieje.' };

  typeCode = String(typeCode || '').trim();
  const type = typeCode ? _absType(typeCode) : null;
  if (typeCode && !type) return { ok: false, msg: 'Nieprawidłowy typ nieobecności.' };
  if (type && type.code === 'DW') {
    return { ok: false, msg: 'Ten typ jest zastrzeżony dla narzędzia „Dni wolne”.' };
  }

  note = String(note || '').trim().slice(0, 500);
  _upsertAbsence(String(empId), String(worker[1]), String(worker[2]), dateFrom, dateTo, type, note, 'admin_range');

  _logAdmin('MasterAbsenceRange', String(empId),
    dateFrom + ' — ' + dateTo + ' → ' + (type ? type.label : 'usunięto') + (note ? ' [' + note.slice(0, 80) + ']' : ''));

  return { ok: true, count: days };
}

function masterGetDay(token, empId, date) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  if (!empId || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
    return { ok: false, msg: 'Nieprawidłowe dane.' };
  }
  const ewidSh = _ss().getSheetByName('Ewidencja');
  const rows = (ewidSh && ewidSh.getLastRow() >= 2) ? ewidSh.getDataRange().getValues().slice(1) : [];
  let wejscie = '', wyjscie = '';
  rows.forEach(r => {
    if (String(r[1]) !== String(empId)) return;
    if (_sheetDate(r[5]) !== date) return;
    const akcja = String(r[4]).trim();
    const godz  = _sheetTime(r[6]);
    if (akcja === 'WEJSCIE') wejscie = godz;
    else if (akcja === 'WYJSCIE') wyjscie = godz;
  });

  const key = String(empId) + '_' + date;
  const absence  = _absenceMapAll()[key] || null;
  const ovrNote  = _overtimeNotesAll()[key] || '';
  const overtime = _dayOutsideClinic(date, wejscie || null, wyjscie || null);

  return { ok: true, wejscie, wyjscie, absence, overtime, overtimeNote: ovrNote };
}

function masterSetDay(token, empId, date, wejscie, wyjscie) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  if (!empId || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
    return { ok: false, msg: 'Nieprawidłowe dane.' };
  }

  const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
  wejscie = String(wejscie || '').trim();
  wyjscie = String(wyjscie || '').trim();
  if (wejscie && !timeRe.test(wejscie)) return { ok: false, msg: 'Nieprawidłowy format wejścia (HH:MM).' };
  if (wyjscie && !timeRe.test(wyjscie)) return { ok: false, msg: 'Nieprawidłowy format wyjścia (HH:MM).' };

  const worker = _getWorkers().find(r => String(r[0]) === String(empId));
  if (!worker) return { ok: false, msg: 'Pracownik nie istnieje.' };

  const ewidSh = _ss().getSheetByName('Ewidencja');
  const lastRow = ewidSh.getLastRow();
  const rows = (lastRow >= 2) ? ewidSh.getDataRange().getValues().slice(1) : [];

  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    if (String(r[1]) === String(empId) && _sheetDate(r[5]) === date) {
      const akcja = String(r[4]).trim();
      if (akcja === 'WEJSCIE' || akcja === 'WYJSCIE') {
        ewidSh.deleteRow(i + 2);
      }
    }
  }

  if (wejscie) {
    ewidSh.appendRow([new Date().toISOString(), String(empId), String(worker[1]), String(worker[2]), 'WEJSCIE', date, wejscie, 'admin_override']);
  }
  if (wyjscie) {
    ewidSh.appendRow([new Date().toISOString(), String(empId), String(worker[1]), String(worker[2]), 'WYJSCIE', date, wyjscie, 'admin_override']);
  }

  _logAdmin('MasterEdit', String(empId), date + ' → wejście=' + (wejscie || '—') + ' wyjście=' + (wyjscie || '—'));

  // Zwróć aktualny stan flagi przekroczenia po edycji
  const overtime = _dayOutsideClinic(date, wejscie || null, wyjscie || null);

  return { ok: true, overtime };
}

// ── Nieobecność — edycja przez właściciela ────────────────────
// Puste typeCode = usunięcie nieobecności danego dnia.

function masterSetAbsence(token, empId, date, typeCode, note) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  if (!empId || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
    return { ok: false, msg: 'Nieprawidłowe dane.' };
  }
  const worker = _getWorkers().find(r => String(r[0]) === String(empId));
  if (!worker) return { ok: false, msg: 'Pracownik nie istnieje.' };

  typeCode = String(typeCode || '').trim();
  note = String(note || '').trim().slice(0, 500);

  if (!typeCode) {
    _upsertAbsence(String(empId), String(worker[1]), String(worker[2]), date, date, null, '', 'admin_override');
    _logAdmin('MasterAbsence', String(empId), date + ' → usunięto nieobecność');
    return { ok: true };
  }

  const type = _absType(typeCode);
  if (!type) return { ok: false, msg: 'Nieprawidłowy typ nieobecności.' };

  _upsertAbsence(String(empId), String(worker[1]), String(worker[2]), date, date, type, note, 'admin_override');
  _logAdmin('MasterAbsence', String(empId), date + ' → ' + type.label + (note ? ' [' + note.slice(0, 80) + ']' : ''));
  return { ok: true };
}

// ── Uzasadnienie przekroczenia — edycja przez właściciela ─────
// Puste note = usunięcie uzasadnienia danego dnia.

function masterSetOvertimeNote(token, empId, date, note) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  if (!empId || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
    return { ok: false, msg: 'Nieprawidłowe dane.' };
  }
  note = String(note || '').trim().slice(0, 500);
  _saveOvertimeNote(String(empId), String(date), note, 'admin_override');
  _logAdmin('MasterOvertimeNote', String(empId), date + ' → ' + (note ? note.slice(0, 80) : 'usunięto uzasadnienie'));
  return { ok: true };
}

// ── Dzień wolny dla całej Kliniki — masowe oznaczenie ──────────
// Odrębne od edycji pojedynczego pracownika: jednym zapisem
// oznacza (lub czyści, gdy typeCode puste) nieobecność wszystkich
// aktywnych pracowników w podanym zakresie dat. Nie dotyka godzin
// w Ewidencji — tylko warstwy Nieobecnosci.

function masterSetClinicDayOff(token, dateFrom, dateTo, typeCode, note) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };

  const re = /^\d{4}-\d{2}-\d{2}$/;
  dateFrom = String(dateFrom || '');
  dateTo   = String(dateTo || dateFrom);
  if (!re.test(dateFrom) || !re.test(dateTo) || dateFrom > dateTo) {
    return { ok: false, msg: 'Nieprawidłowy zakres dat.' };
  }

  const from = new Date(dateFrom + 'T12:00:00');
  const to   = new Date(dateTo + 'T12:00:00');
  const days = Math.round((to - from) / 86400000) + 1;
  if (days > ABSENCE_MAX_DAYS) {
    return { ok: false, msg: 'Maksymalny zakres to ' + ABSENCE_MAX_DAYS + ' dni.' };
  }

  typeCode = String(typeCode || '').trim();
  const type = typeCode ? _absType(typeCode) : null;
  if (typeCode && !type) return { ok: false, msg: 'Nieprawidłowy typ.' };

  note = String(note || '').trim().slice(0, 500);

  const workers = _getWorkers().filter(_isRcpWorker);
  workers.forEach(w => {
    _upsertAbsence(String(w[0]), String(w[1]), String(w[2]), dateFrom, dateTo, type, note, 'admin_bulk');
  });

  _logAdmin('MasterBulkDayOff', '—',
    dateFrom + ' — ' + dateTo + ' → ' + (type ? type.label : 'usunięto') +
    ' (' + workers.length + ' os.)' + (note ? ' [' + note.slice(0, 80) + ']' : ''));

  return { ok: true, count: workers.length };
}

function masterGetMonth(token, empId, year, month) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  if (!empId || isNaN(y) || isNaN(m) || m < 1 || m > 12) {
    return { ok: false, msg: 'Nieprawidłowe dane.' };
  }
  const worker = _getWorkers().find(r => String(r[0]) === String(empId));
  if (!worker) return { ok: false, msg: 'Pracownik nie istnieje.' };

  const daysInMonth = new Date(y, m, 0).getDate();
  const pfx = y + '-' + String(m).padStart(2, '0');
  const ewidSh = _ss().getSheetByName('Ewidencja');
  const rows = (ewidSh && ewidSh.getLastRow() >= 2) ? ewidSh.getDataRange().getValues().slice(1) : [];

  const map = {};
  rows.forEach(r => {
    if (String(r[1]) !== String(empId)) return;
    const ds = _sheetDate(r[5]);
    if (!ds.startsWith(pfx)) return;
    if (!map[ds]) map[ds] = { e: [], x: [] };
    const akcja = String(r[4]).trim();
    const godz  = _sheetTime(r[6]);
    if (akcja === 'WEJSCIE') map[ds].e.push(godz);
    else if (akcja === 'WYJSCIE') map[ds].x.push(godz);
  });

  const absMap   = _absenceMapAll();
  const ovrNotes = _overtimeNotesAll();

  const DOW = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];
  const days = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const ds  = pfx + '-' + String(d).padStart(2, '0');
    const rcp = map[ds];
    const wejscie = (rcp && rcp.e.length) ? rcp.e.slice().sort()[0] : '';
    const wyjscie = (rcp && rcp.x.length) ? rcp.x.slice().sort().reverse()[0] : '';
    const dow = DOW[new Date(ds + 'T12:00:00').getDay()];
    const key = String(empId) + '_' + ds;
    days.push({
      date: ds, dow, wejscie, wyjscie,
      absence:         absMap[key] || null,
      overtime:        _dayOutsideClinic(ds, wejscie || null, wyjscie || null),
      overtimeMinutes: _overtimeMinutes(ds, wejscie || null, wyjscie || null),
      overtimeNote:    ovrNotes[key] || ''
    });
  }

  return { ok: true, imie: String(worker[1]), nazwisko: String(worker[2]), days };
}
