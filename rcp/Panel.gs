// ============================================================
// Panel.gs — We SMILE RCP „OPOKA” v1.0
// Widok Właściciela (Kadry): Dziś / Skrzynka / Miesiąc / Eksport.
// Zasada: żadna korekta nie kasuje wierszy — anulowanie to wpis
// w nowych kolumnach STATUS/META, nowe godziny to nowe wiersze.
// ============================================================

function _sesjaWl(token) {
  var empId = _sesjaEmp('sw_', token, TTL_SESJA_PANEL);
  if (!empId) return null;
  var p = _pracownikPoId(empId);
  return (p && p.aktywny && p.wlasciciel) ? p : null;
}

function wlLogin(pin) {
  if (!poprawnyPin(pin)) return { ok: false, msg: 'PIN musi mieć 4 cyfry.' };
  if (!_ogrRate('wl')) return { ok: false, msg: 'Zbyt wiele prób. Odczekaj 5 minut.' };
  var p = _pracownikPoPinie(pin);
  if (!p || !p.wlasciciel) {
    _anomalia('—', 'Nieudana próba logowania do panelu właściciela.');
    return { ok: false, msg: 'Brak dostępu.' };
  }
  _resetRate('wl');
  var token = _sesjaNowa('sw_', p.id, TTL_SESJA_PANEL);
  _log('LogowanieWlasciciel', p.id, p.imie + ' ' + p.nazwisko);
  return { ok: true, token: token, imie: p.imie, dzis: _dzis() };
}

// ── Dziś ─────────────────────────────────────────────────────

function wlDzis(token) {
  var wl = _sesjaWl(token);
  if (!wl) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };

  var dzis = _dzis();
  var wszystkie = _zdarzenia();
  var nieobDzis = {};
  _nieobecnosci().forEach(function (n) { if (n.data === dzis) nieobDzis[n.empId] = n; });

  var lista = _pracownicy().filter(function (p) { return p.aktywny; }).map(function (p) {
    var par = parujOdcinki(_zdarzeniaDnia(wszystkie, p.id, dzis));
    var stan, opis;
    if (par.otwarteOd !== null) { stan = 'OBECNY'; opis = 'w pracy od ' + par.otwarteOd; }
    else if (par.odcinki.length) { stan = 'SKONCZYL'; opis = 'skończył(a) — ' + formatujMinuty(par.minuty) + ' h'; }
    else if (nieobDzis[p.id]) { stan = 'NIEOBECNY'; opis = nieobDzis[p.id].typ; }
    else { stan = 'BRAK'; opis = 'brak odbić'; }
    return {
      id: p.id, imie: p.imie, nazwisko: p.nazwisko, stanowisko: p.stanowisko,
      stan: stan, opis: opis, odcinkiTekst: opiszOdcinki(par), bledy: par.bledy
    };
  });
  return { ok: true, dzis: dzis, teraz: _teraz(), lista: lista };
}

// ── Skrzynka: karty do decyzji [Potwierdź] / [Edytuj] ────────

function wlSkrzynka(token) {
  var wl = _sesjaWl(token);
  if (!wl) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };

  var dzis = _dzis();
  var wszystkie = _zdarzenia();
  var prac = {};
  _pracownicy().forEach(function (p) { prac[p.id] = p; });
  var karty = [];

  // 1) Ręczne wpisy pracowników czekające na decyzję — grupowane po (pracownik, dzień).
  var grupy = {};
  _aktywne(wszystkie).forEach(function (z) {
    if (z.zrodlo !== 'reczne' || z.zatw !== '') return;
    var k = z.empId + '|' + z.data;
    (grupy[k] = grupy[k] || []).push(z);
  });
  Object.keys(grupy).sort().forEach(function (k) {
    var czesci = k.split('|'), empId = czesci[0], data = czesci[1];
    var p = prac[empId];
    if (!p) return;
    var par = parujOdcinki(_zdarzeniaDnia(wszystkie, empId, data));
    var uzasy = [];
    grupy[k].forEach(function (z) { if (z.uzas && uzasy.indexOf(z.uzas) === -1) uzasy.push(z.uzas); });
    karty.push({
      typ: 'RECZNE', empId: empId, data: data,
      kto: p.imie + ' ' + p.nazwisko,
      naglowek: p.imie + ' wpisał(a) ręcznie godziny — ' + data,
      szczegoly: opiszOdcinki(par) + (par.minuty ? ' (' + formatujMinuty(par.minuty) + ' h)' : ''),
      uzasadnienie: uzasy.join(' • ')
    });
  });

  // 2) Niedokończone dni z przeszłości (WEJŚCIE bez WYJŚCIA lub błędy sekwencji).
  var dniMapa = {};
  _aktywne(wszystkie).forEach(function (z) {
    if (!poprawnaData(z.data)) return;
    var dni = rozniceDni(z.data, dzis);
    if (dni <= 0 || dni > OKNO_KART_DNI) return;
    var k = z.empId + '|' + z.data;
    if (grupy[k]) return; // już obsłużone kartą RECZNE
    (dniMapa[k] = dniMapa[k] || []).push({ akcja: z.akcja, godzina: z.godzina, kolejnosc: z.wiersz });
  });
  Object.keys(dniMapa).sort().forEach(function (k) {
    var czesci = k.split('|'), empId = czesci[0], data = czesci[1];
    var p = prac[empId];
    if (!p) return;
    var par = parujOdcinki(dniMapa[k]);
    if (par.otwarteOd === null && par.bledy.length === 0) return;
    karty.push({
      typ: 'NIEDOKONCZONY', empId: empId, data: data,
      kto: p.imie + ' ' + p.nazwisko,
      naglowek: p.imie + ' — dzień do uzupełnienia (' + data + ')',
      szczegoly: par.otwarteOd !== null ? ('Niedokończone WEJŚCIE o ' + par.otwarteOd) : par.bledy[0],
      uzasadnienie: ''
    });
  });

  // 3) Nieobecności czekające na potwierdzenie.
  _nieobecnosci().forEach(function (n) {
    if (n.status !== '') return;
    var p = prac[n.empId];
    if (!p) return;
    karty.push({
      typ: 'NIEOBECNOSC', empId: n.empId, data: n.data, wpisId: n.id,
      kto: p.imie + ' ' + p.nazwisko,
      naglowek: p.imie + ' oznaczył(a): ' + n.typ + ' — ' + n.data,
      szczegoly: n.opis || '',
      uzasadnienie: ''
    });
  });

  karty.sort(function (a, b) { return a.data < b.data ? -1 : a.data > b.data ? 1 : 0; });
  return { ok: true, karty: karty };
}

/** [Potwierdź] dla ręcznego wpisu: godziny zostają, jakby pracownik był w pracy. */
function wlZatwierdzReczne(token, empId, data) {
  var wl = _sesjaWl(token);
  if (!wl) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  if (!poprawnaData(String(data || ''))) return { ok: false, msg: 'Nieprawidłowa data.' };

  return _zLockiem(function () {
    var sh = _ark('Ewidencja');
    var ile = 0;
    _zdarzenia().forEach(function (z) {
      if (z.empId === String(empId) && z.data === String(data) &&
          z.zrodlo === 'reczne' && z.zatw === '' && z.status !== 'ANULOWANE') {
        sh.getRange(z.wiersz, EW.ZATW + 1).setValue(wl.id + ' ' + _stempel());
        ile++;
      }
    });
    if (!ile) return { ok: false, msg: 'Brak wpisów do zatwierdzenia (być może już zatwierdzone).' };
    _log('ZatwierdzenieRecznego', wl.id, empId + ' ' + data + ' (' + ile + ' zdarzeń)');
    return { ok: true, ile: ile };
  });
}

/** [Potwierdź] dla nieobecności. */
function wlZatwierdzNieobecnosc(token, wpisId) {
  var wl = _sesjaWl(token);
  if (!wl) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };

  return _zLockiem(function () {
    var sh = _ark('Nieobecnosci');
    var znaleziono = false;
    _nieobecnosci().forEach(function (n) {
      if (n.id === String(wpisId) && n.status === '') {
        sh.getRange(n.wiersz, NB.STATUS + 1).setValue('ZATWIERDZONA');
        sh.getRange(n.wiersz, NB.ZATW + 1).setValue(wl.id + ' ' + _stempel());
        znaleziono = true;
      }
    });
    if (!znaleziono) return { ok: false, msg: 'Nie znaleziono wpisu do zatwierdzenia.' };
    _log('ZatwierdzenieNieobecnosci', wl.id, String(wpisId));
    return { ok: true };
  });
}

// ── Edytor dnia ──────────────────────────────────────────────

function wlDzien(token, empId, data) {
  var wl = _sesjaWl(token);
  if (!wl) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  data = String(data || '');
  if (!poprawnaData(data)) return { ok: false, msg: 'Nieprawidłowa data.' };
  var p = _pracownikPoId(empId);
  if (!p) return { ok: false, msg: 'Nie znaleziono pracownika.' };

  var dnia = _zdarzeniaDnia(_zdarzenia(), p.id, data);
  var par = parujOdcinki(dnia);
  var odc = par.odcinki.map(function (o) { return { od: o.od, do: o.do }; });
  if (par.otwarteOd !== null) odc.push({ od: par.otwarteOd, do: '' });

  var nieob = null;
  _nieobecnosci().forEach(function (n) { if (n.empId === p.id && n.data === data) nieob = { typ: n.typ, opis: n.opis, status: n.status }; });

  return {
    ok: true, empId: p.id, kto: p.imie + ' ' + p.nazwisko, data: data,
    odcinki: odc, bledy: par.bledy, nieobecnosc: nieob,
    typyNieobecnosci: typyDlaFormy(p.forma),
    zdarzenia: dnia.map(function (z) { return { akcja: z.akcja, godzina: z.godzina, zrodlo: z.zrodlo, uzas: z.uzas, zatw: z.zatw }; })
  };
}

/**
 * [Edytuj] → zapis dnia przez Właściciela: nowy, kompletny zestaw odcinków
 * i/lub nieobecność. Stare zdarzenia dnia są ANULOWANE (nie kasowane),
 * nowe dopisywane ze źródłem 'wlasciciel' i obowiązkowym powodem.
 */
function wlZapiszDzien(token, empId, data, odcinkiJson, nieobJson, powod) {
  var wl = _sesjaWl(token);
  if (!wl) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };

  data = String(data || '');
  if (!poprawnaData(data)) return { ok: false, msg: 'Nieprawidłowa data.' };
  if (rozniceDni(data, _dzis()) < 0) return { ok: false, msg: 'Nie można edytować dni w przyszłości.' };
  if (!poprawneUzasadnienie(powod)) return { ok: false, msg: 'Powód korekty jest obowiązkowy (min. 5 znaków).' };

  var odcinki, nieob;
  try {
    odcinki = JSON.parse(odcinkiJson || '[]');
    nieob = nieobJson ? JSON.parse(nieobJson) : null;
  } catch (e) { return { ok: false, msg: 'Nieprawidłowe dane formularza.' }; }

  var blad = walidujOdcinkiDnia(odcinki);
  if (blad) return { ok: false, msg: blad };
  var czyste = czysteOdcinkiDnia(odcinki);

  if (nieob && czyste.length > 0) return { ok: false, msg: 'Dzień nie może mieć jednocześnie godzin pracy i nieobecności.' };

  return _zLockiem(function () {
    var p = _pracownikPoId(empId);
    if (!p) return { ok: false, msg: 'Nie znaleziono pracownika.' };
    if (nieob && typyDlaFormy(p.forma).indexOf(String(nieob.typ || '')) === -1) {
      return { ok: false, msg: 'Nieprawidłowy typ nieobecności dla formy zatrudnienia tej osoby.' };
    }

    var sh = _ark('Ewidencja');
    var meta = wl.id + ' ' + _stempel();
    var anulowane = 0;

    // 1) Anuluj wszystkie aktywne zdarzenia dnia (bez kasowania wierszy).
    _zdarzenia().forEach(function (z) {
      if (z.empId === p.id && z.data === data && z.status !== 'ANULOWANE') {
        sh.getRange(z.wiersz, EW.STATUS + 1).setValue('ANULOWANE');
        sh.getRange(z.wiersz, EW.META + 1).setValue(meta);
        anulowane++;
      }
    });

    // 2) Dopisz nowe odcinki (auto-zatwierdzone — wpisał je Właściciel).
    var pow = String(powod).trim();
    czyste.forEach(function (o) {
      _dopiszZdarzenie(p, 'WEJSCIE', data, o.od, 'wlasciciel', pow, meta);
      _dopiszZdarzenie(p, 'WYJSCIE', data, o.do, 'wlasciciel', pow, meta);
    });

    // 3) Nieobecność: anuluj dotychczasową, ewentualnie zapisz nową (zatwierdzoną).
    var shN = _ark('Nieobecnosci');
    _nieobecnosci().forEach(function (n) {
      if (n.empId === p.id && n.data === data) {
        shN.getRange(n.wiersz, NB.STATUS + 1).setValue('ANULOWANA');
        shN.getRange(n.wiersz, NB.ZATW + 1).setValue(meta);
      }
    });
    if (nieob) {
      shN.appendRow([_uuid(), p.id, "'" + data, String(nieob.typ), String(nieob.opis || '').slice(0, 300),
                     wl.id, new Date().toISOString(), 'ZATWIERDZONA', meta]);
    }

    _log('KorektaDnia', wl.id, p.id + ' ' + data + ' → ' +
      (czyste.map(function (o) { return o.od + '–' + o.do; }).join(', ') || (nieob ? nieob.typ : 'wyczyszczono')) +
      ' | anulowano ' + anulowane + ' | powód: ' + pow);
    return { ok: true };
  });
}

// ── Miesiąc ──────────────────────────────────────────────────

function wlMiesiac(token, rok, mies) {
  var wl = _sesjaWl(token);
  if (!wl) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  var y = parseInt(rok, 10), m = parseInt(mies, 10);
  if (isNaN(y) || isNaN(m) || m < 1 || m > 12 || y < 2000 || y > 2100) return { ok: false, msg: 'Nieprawidłowy miesiąc.' };

  var pfx = y + '-' + ('0' + m).slice(-2);
  var dniWMies = new Date(y, m, 0).getDate();
  var DOW = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];

  var wszystkie = _aktywne(_zdarzenia());
  var nieobMapa = {};
  _nieobecnosci().forEach(function (n) {
    if (n.data.slice(0, 7) === pfx) nieobMapa[n.empId + '|' + n.data] = n;
  });

  var mapa = {};
  wszystkie.forEach(function (z) {
    if (z.data.slice(0, 7) !== pfx) return;
    var k = z.empId + '|' + z.data;
    (mapa[k] = mapa[k] || []).push(z);
  });

  var pracownicy = _pracownicy().filter(function (p) { return p.aktywny; }).map(function (p) {
    var suma = 0, dni = [];
    for (var d = 1; d <= dniWMies; d++) {
      var ds = pfx + '-' + ('0' + d).slice(-2);
      var zd = (mapa[p.id + '|' + ds] || []).map(function (z) {
        return { akcja: z.akcja, godzina: z.godzina, kolejnosc: z.wiersz, zrodlo: z.zrodlo, zatw: z.zatw };
      });
      var par = parujOdcinki(zd);
      suma += par.minuty;
      var flagi = [];
      if (zd.some(function (z) { return z.zrodlo === 'reczne' && z.zatw === ''; })) flagi.push('RECZNE');
      else if (zd.some(function (z) { return z.zrodlo === 'reczne'; })) flagi.push('RECZNE_OK');
      if (zd.some(function (z) { return z.zrodlo === 'wlasciciel' || z.zrodlo === 'admin_override'; })) flagi.push('EDYCJA');
      if (par.otwarteOd !== null || par.bledy.length) flagi.push('PROBLEM');
      var nb = nieobMapa[p.id + '|' + ds];
      dni.push({
        data: ds, dow: DOW[new Date(ds + 'T12:00:00').getDay()],
        odcinkiTekst: opiszOdcinki(par), minuty: par.minuty,
        minutyTekst: par.minuty ? formatujMinuty(par.minuty) : '',
        nieobecnosc: nb ? nb.typ + (nb.status === '' ? ' (niepotw.)' : '') : '',
        flagi: flagi
      });
    }
    return {
      id: p.id, imie: p.imie, nazwisko: p.nazwisko,
      suma: suma, sumaTekst: formatujMinuty(suma), dni: dni
    };
  });

  _log('OdczytMiesiaca', wl.id, pfx);
  return { ok: true, rok: y, mies: m, pracownicy: pracownicy };
}

// ── Eksport XLSX (mechanizm v6.0, rozszerzony o odcinki i nieobecności) ──

function wlEksport(token, rok, mies) {
  var wl = _sesjaWl(token);
  if (!wl) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  var dane = wlMiesiac(token, rok, mies);
  if (!dane.ok) return dane;

  var pfx = dane.rok + '-' + ('0' + dane.mies).slice(-2);
  var tmp = SpreadsheetApp.create('WeSMILE_RCP_' + pfx + '_' + _uuid().slice(0, 8));
  var domyslny = tmp.getSheets()[0];

  dane.pracownicy.forEach(function (p) {
    var nazwa = (p.imie + ' ' + p.nazwisko).replace(/[\\\/\?\*\[\]:]/g, ' ').slice(0, 90) || p.id;
    var sh = tmp.insertSheet(nazwa);
    var wiersze = [['Data', 'Dzień', 'Odcinki pracy', 'Suma', 'Nieobecność', 'Uwagi']];
    p.dni.forEach(function (d) {
      var uwagi = [];
      if (d.flagi.indexOf('RECZNE') !== -1) uwagi.push('wpis ręczny (niepotwierdzony)');
      if (d.flagi.indexOf('RECZNE_OK') !== -1) uwagi.push('wpis ręczny (potwierdzony)');
      if (d.flagi.indexOf('EDYCJA') !== -1) uwagi.push('korekta właściciela');
      if (d.flagi.indexOf('PROBLEM') !== -1) uwagi.push('do wyjaśnienia');
      wiersze.push([d.data, d.dow, d.odcinkiTekst === '—' ? '' : d.odcinkiTekst,
                    d.minutyTekst, d.nieobecnosc, uwagi.join(', ')]);
    });
    wiersze.push(['', '', 'RAZEM', p.sumaTekst, '', '']);
    sh.getRange(1, 1, wiersze.length, 6).setValues(wiersze);
    sh.getRange(1, 1, 1, 6).setFontWeight('bold');
    sh.autoResizeColumns(1, 6);
  });

  tmp.deleteSheet(domyslny);
  SpreadsheetApp.flush();

  var fileId = tmp.getId();
  var resp = UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/' + fileId + '/export?format=xlsx',
    { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } });
  var b64 = Utilities.base64Encode(resp.getContent());
  try { DriveApp.getFileById(fileId).setTrashed(true); } catch (e) { Logger.log('eksport sprzątanie: ' + e); }

  _log('EksportXLSX', wl.id, pfx);
  return { ok: true, filename: 'WeSMILE_RCP_' + pfx + '.xlsx', base64: b64 };
}
