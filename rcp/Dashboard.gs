// ============================================================
// Dashboard.gs — We SMILE RCP v7.0
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
  return { ok: true, token, name: String(worker[1]) + ' ' + String(worker[2]) };
}

// ── Dane miesiąca ─────────────────────────────────────────────

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
    const pfx = y + '-' + String(m).padStart(2, '0');

    // Norma godzin dla miesiąca (globalna, z PropertiesService)
    const etatKey = 'etat_' + y + '_' + String(m).padStart(2, '0');
    const etat = parseFloat(PropertiesService.getScriptProperties().getProperty(etatKey) || '') || 0;

    // Czytaj Ewidencja — obsługuje daty jako Date lub string
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

          let wejscie = null, wyjscie = null, hours = null;
          if (rcp) {
            if (rcp.e.length) wejscie = rcp.e.slice().sort()[0];
            if (rcp.x.length) wyjscie = rcp.x.slice().sort().reverse()[0];
            if (wejscie && wyjscie) {
              const mins = _t2m(wyjscie) - _t2m(wejscie);
              if (mins > 0) { hours = Math.round(mins / 6) / 10; totalH += hours; }
            }
          }

          const dow = DOW[new Date(ds + 'T12:00:00').getDay()];
          days.push({ date: ds, dow, wejscie, wyjscie, hours });
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

    return { ok: true, year: y, month: m, etat, employees };

  } catch (e) {
    Logger.log('getDashboard error: ' + e);
    return { ok: false, msg: 'Błąd serwera: ' + e.toString() };
  }
}

// ── Zapis normy godzin dla miesiąca ──────────────────────────

function setEtat(token, year, month, hours) {
  if (!_dashOk(token)) {
    return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  }
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  const h = parseFloat(hours);
  if (isNaN(y) || isNaN(m) || isNaN(h) || h < 0 || h > 800) {
    return { ok: false, msg: 'Nieprawidłowe dane.' };
  }
  const key = 'etat_' + y + '_' + String(m).padStart(2, '0');
  PropertiesService.getScriptProperties().setProperty(key, String(h));
  return { ok: true };
}

// ── Eksport CSV ───────────────────────────────────────────────

function dashExportCsv(token, year, month) {
  const res = getDashboard(token, year, month);
  if (!res.ok) return res;

  const MN = ['','Styczen','Luty','Marzec','Kwiecien','Maj','Czerwiec',
              'Lipiec','Sierpien','Wrzesien','Pazdziernik','Listopad','Grudzien'];
  const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';

  let csv = '﻿';
  csv += 'EmpID;Imie;Nazwisko;Rola;Data;Dzien;Wejscie;Wyjscie;Godziny\r\n';

  res.employees.forEach(emp => {
    csv += [emp.id, emp.imie, emp.nazwisko, emp.rola,
            'RAZEM ' + MN[res.month] + ' ' + res.year, '', '', '',
            String(emp.totalHours).replace('.', ',')]
      .map(q).join(';') + '\r\n';
    emp.days.forEach(d => {
      const h = (d.hours !== null && d.hours !== undefined) ? String(d.hours).replace('.', ',') : '';
      csv += [emp.id, emp.imie, emp.nazwisko, emp.rola,
              d.date, d.dow, d.wejscie || '', d.wyjscie || '', h]
        .map(q).join(';') + '\r\n';
    });
    csv += '\r\n';
  });

  return { ok: true, csv };
}

// ── Pomocnicze — konwersja wartości z Sheets ──────────────────

function _t2m(t) {
  const p = String(t).split(':');
  return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
}

// Sheets auto-konwertuje "2026-05-29" → Date; obsługujemy oba formaty
function _sheetDate(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Europe/Warsaw', 'yyyy-MM-dd');
  return String(v);
}

// Sheets auto-konwertuje "08:24" → Date (1899-12-30T08:24); obsługujemy oba formaty
function _sheetTime(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Europe/Warsaw', 'HH:mm');
  const s = String(v);
  // ułamek doby (np. 0.35 = 08:24)
  if (s !== '' && !isNaN(s) && s.indexOf(':') === -1) {
    const mins = Math.round(parseFloat(s) * 1440);
    return String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
  }
  return s;
}

// ── Diagnostyka ───────────────────────────────────────────────

function diagEwidencja() {
  const sh = _ss().getSheetByName('Ewidencja');
  if (!sh || sh.getLastRow() < 2) { Logger.log('Brak danych'); return; }
  const rows = sh.getDataRange().getValues().slice(1);
  Logger.log('Liczba wierszy: ' + rows.length);
  rows.forEach((r, i) => {
    Logger.log('W' + (i + 2) + ': emp=' + r[1] + ' akcja=' + r[4] +
      ' data_fmt=' + _sheetDate(r[5]) + ' godz_fmt=' + _sheetTime(r[6]));
  });
}
