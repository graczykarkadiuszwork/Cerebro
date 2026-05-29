// ============================================================
// Dashboard.gs — We SMILE RCP v6.0
// Panel raportowy dla pracodawcy i admina
// ============================================================

const DASH_TTL = 3600;

// ── Sesja dashboardu ─────────────────────────────────────────

function _dashOk(token) {
  if (!token) return false;
  const k = 'ds_' + String(token).slice(0, 50);
  if (_cache().get(k) !== '1') return false;
  _cache().put(k, '1', DASH_TTL);
  return true;
}

// ── Logowanie do dashboardu (dowolny aktywny PIN) ────────────

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
  return { ok: true, token, name: String(worker[1]) + ' ' + String(worker[2]) };
}

// ── Dane miesiąca ────────────────────────────────────────────

function getDashboard(token, year, month) {
  try {
    if (!_dashOk(token)) {
      return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła. Zaloguj się ponownie.' };
    }

    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    if (isNaN(y) || isNaN(m) || m < 1 || m > 12) {
      return { ok: false, msg: 'Nieprawidłowy miesiąc/rok.' };
    }

    const daysInMonth = new Date(y, m, 0).getDate();
    const pfx         = y + '-' + String(m).padStart(2, '0');

    // Czytaj Ewidencja — grupuj wg empId_data
    const ewidSh   = _ss().getSheetByName('Ewidencja');
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

    // Czytaj Statusy
    const stSh   = _ss().getSheetByName('Statusy');
    const stMap  = {};
    if (stSh && stSh.getLastRow() >= 2) {
      stSh.getDataRange().getValues().slice(1).forEach(r => {
        const ds = _sheetDate(r[0]);
        if (!ds.startsWith(pfx)) return;
        stMap[String(r[1]) + '_' + ds] = { status: String(r[2]), notes: String(r[3] || '') };
      });
    }

    const DOW = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];

    const employees = _getWorkers()
      .filter(w => String(w[4]).toLowerCase() === 'aktywny')
      .map(w => {
        const id = String(w[0]);
        let totalH = 0;

        const days = [];
        for (let d = 1; d <= daysInMonth; d++) {
          const ds  = pfx + '-' + String(d).padStart(2, '0');
          const key = id + '_' + ds;
          const rcp = rcpMap[key];
          const st  = stMap[key];

          let wejscie = null, wyjscie = null, hours = null;

          if (rcp) {
            if (rcp.e.length) wejscie = rcp.e.slice().sort()[0];
            if (rcp.x.length) wyjscie = rcp.x.slice().sort().reverse()[0];
            if (wejscie && wyjscie) {
              const mins = _t2m(wyjscie) - _t2m(wejscie);
              if (mins > 0) { hours = Math.round(mins / 6) / 10; totalH += hours; }
            }
          }

          // Unikamy problemów ze strefą czasową przez ustawienie południa
          const dateObj = new Date(ds + 'T12:00:00');
          const dow     = DOW[dateObj.getDay()];
          const status  = st ? st.status : (wejscie ? 'Obecna' : '—');
          const notes   = st ? st.notes  : '';

          days.push({ date: ds, dow, wejscie, wyjscie, hours, status, notes });
        }

        return {
          id,
          imie:       String(w[1]),
          nazwisko:   String(w[2]),
          rola:       String(w[3]),
          totalHours: Math.round(totalH * 10) / 10,
          days
        };
      });

    return { ok: true, year: y, month: m, employees };
  } catch (e) {
    Logger.log('getDashboard error: ' + e);
    return { ok: false, msg: 'Błąd serwera: ' + e.toString() };
  }
}

function _t2m(t) {
  const p = String(t).split(':');
  return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
}

// Sheets auto-konwertuje daty/godziny na obiekty Date — obsługujemy oba formaty
function _sheetDate(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Europe/Warsaw', 'yyyy-MM-dd');
  return String(v);
}

function _sheetTime(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Europe/Warsaw', 'HH:mm');
  const s = String(v);
  // Sheets może też zwrócić ułamek doby (np. 0.35 = 08:24)
  if (!isNaN(s) && s.indexOf(':') === -1) {
    const mins = Math.round(parseFloat(s) * 1440);
    return String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
  }
  return s;
}

// ── Zapis statusu dnia ───────────────────────────────────────

function saveStatus(token, empId, date, status, notes) {
  if (!_dashOk(token)) {
    return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  }
  if (!empId || !date || !status) return { ok: false, msg: 'Brak danych.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return { ok: false, msg: 'Nieprawidłowa data.' };

  let sh = _ss().getSheetByName('Statusy');
  if (!sh) {
    sh = _ss().insertSheet('Statusy');
    sh.appendRow(['Date', 'EmpID', 'Status', 'Notes', 'Modified']);
  }

  const rows = sh.getLastRow() >= 2 ? sh.getDataRange().getValues() : [[]];
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === date && String(rows[i][1]) === empId) {
      sh.getRange(i + 1, 1, 1, 5).setValues([[
        date, empId, status, notes || '', new Date().toISOString()
      ]]);
      return { ok: true };
    }
  }
  sh.appendRow([date, empId, status, notes || '', new Date().toISOString()]);
  return { ok: true };
}

// ── Eksport CSV ──────────────────────────────────────────────

function dashExportCsv(token, year, month) {
  const res = getDashboard(token, year, month);
  if (!res.ok) return res;

  const MN = ['', 'Styczen', 'Luty', 'Marzec', 'Kwiecien', 'Maj', 'Czerwiec',
              'Lipiec', 'Sierpien', 'Wrzesien', 'Pazdziernik', 'Listopad', 'Grudzien'];

  const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';

  let csv = '﻿';
  csv += 'EmpID;Imie;Nazwisko;Rola;Data;Dzien;Wejscie;Wyjscie;Godziny;Status;Uwagi\r\n';

  res.employees.forEach(emp => {
    csv += [emp.id, emp.imie, emp.nazwisko, emp.rola,
            'RAZEM ' + MN[res.month] + ' ' + res.year,
            '', '', '', String(emp.totalHours).replace('.', ','), '', '']
      .map(q).join(';') + '\r\n';

    emp.days.forEach(d => {
      csv += [emp.id, emp.imie, emp.nazwisko, emp.rola,
              d.date, d.dow,
              d.wejscie || '', d.wyjscie || '',
              d.hours !== null ? String(d.hours).replace('.', ',') : '',
              d.status, d.notes]
        .map(q).join(';') + '\r\n';
    });
    csv += '\r\n';
  });

  return { ok: true, csv };
}
