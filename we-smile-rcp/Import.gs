// ============================================================
// Import.gs — zasilanie grafiku z zewnętrznego kalendarza
// ============================================================
//
// Cel: nie wpisywać ręcznie, kiedy który lekarz pracuje. Szkielet
// grafiku powstaje z kalendarza lekarzy, a właściciel dokłada do niego
// tylko asystę i dyżury higienizacyjne.
//
// Uwaga o formacie: adres typu /extcal/{id} to zwykle „external calendar”.
// Nie zakładamy jednak z góry, co zwraca — parser rozpoznaje format sam
// (iCalendar / JSON / HTML z linkiem do .ics), a funkcja diagnostyczna
// pokazuje wprost, co przyszło. Dzięki temu import nie opiera się na
// domysłach co do cudzego API.
//
// Zasada bezpieczeństwa: import NIGDY nie zapisuje od razu. Najpierw
// zwraca podgląd (co zostanie utworzone, kogo nie rozpoznano), a zapis
// następuje dopiero po zatwierdzeniu. Grafik jest szkieletem całej
// organizacji pracy — cicha nadpisanie byłoby kosztowne.
// ============================================================

const IMPORT_TZ = 'Europe/Warsaw';

// ── Pobranie źródła ──────────────────────────────────────────

function _fetchKalendarz(url) {
  const opts = {
    muteHttpExceptions: true,
    followRedirects: true,
    headers: { 'Accept': 'text/calendar, application/json;q=0.9, text/html;q=0.8, */*;q=0.5' }
  };
  const resp = UrlFetchApp.fetch(url, opts);
  return {
    kod: resp.getResponseCode(),
    typ: String(resp.getHeaders()['Content-Type'] || resp.getHeaders()['content-type'] || ''),
    tresc: resp.getContentText()
  };
}

// Rozpoznanie formatu po treści, nie po nagłówku — serwery bywają
// niedbałe w Content-Type, a treść nie kłamie.
function _rozpoznajFormat(tresc, typ) {
  const t = String(tresc || '').trim();
  if (/BEGIN:VCALENDAR/i.test(t)) return 'ics';
  if (t.startsWith('{') || t.startsWith('[')) {
    try { JSON.parse(t); return 'json'; } catch (e) { /* nie JSON */ }
  }
  if (/<html|<!doctype/i.test(t)) return 'html';
  if (/json/i.test(typ)) return 'json';
  if (/calendar/i.test(typ)) return 'ics';
  return 'nieznany';
}

/**
 * Diagnostyka źródła — uruchom raz z edytora Apps Script albo z panelu.
 * Pokazuje, co realnie zwraca adres, żeby import nie opierał się na domysłach.
 */
function grafikDiagnostykaZrodla(url) {
  try {
    const r = _fetchKalendarz(url);
    const format = _rozpoznajFormat(r.tresc, r.typ);
    const proba = String(r.tresc || '').slice(0, 1500);

    let dodatkowe = {};
    if (format === 'ics') {
      const ev = _parseICS(r.tresc);
      dodatkowe = {
        liczbaWydarzen: ev.length,
        przykladoweTytuly: ev.slice(0, 12).map(e => e.tytul),
        zakresDat: ev.length
          ? { od: ev.map(e => e.data).sort()[0], do: ev.map(e => e.data).sort().slice(-1)[0] }
          : null
      };
    }
    if (format === 'html') {
      // Strona HTML często udostępnia właściwy kanał iCal — wyłuskajmy go.
      const linki = [];
      const re = /href\s*=\s*["']([^"']+\.ics[^"']*)["']/gi;
      let m;
      while ((m = re.exec(r.tresc)) !== null) linki.push(m[1]);
      const webcal = String(r.tresc).match(/webcal:\/\/[^\s"'<>]+/gi) || [];
      dodatkowe = { linkiICS: linki.concat(webcal).slice(0, 10) };
    }

    const wynik = {
      ok: r.kod >= 200 && r.kod < 300,
      kodHttp: r.kod,
      contentType: r.typ,
      format: format,
      dlugosc: String(r.tresc || '').length,
      proba: proba,
      ...dodatkowe
    };
    Logger.log(JSON.stringify(wynik, null, 2));
    return wynik;
  } catch (err) {
    const wynik = { ok: false, msg: 'Nie udało się pobrać adresu: ' + err };
    Logger.log(JSON.stringify(wynik, null, 2));
    return wynik;
  }
}

// ── Parser iCalendar (RFC 5545) ──────────────────────────────

// Rozwinięcie złamanych linii: kontynuacja zaczyna się spacją lub tabem.
function _icsRozwin(tekst) {
  const linie = String(tekst).replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const out = [];
  linie.forEach(l => {
    if (l.length && (l[0] === ' ' || l[0] === '\t') && out.length) {
      out[out.length - 1] += l.slice(1);
    } else {
      out.push(l);
    }
  });
  return out;
}

// "DTSTART;TZID=Europe/Warsaw:20260105T090000" →
//   { nazwa:'DTSTART', params:{TZID:'Europe/Warsaw'}, wartosc:'20260105T090000' }
function _icsLinia(linia) {
  const i = linia.indexOf(':');
  if (i === -1) return null;
  const lewa = linia.slice(0, i);
  const wartosc = linia.slice(i + 1);
  const czesci = lewa.split(';');
  const params = {};
  for (let k = 1; k < czesci.length; k++) {
    const p = czesci[k].split('=');
    if (p.length === 2) params[p[0].toUpperCase()] = p[1].replace(/^"|"$/g, '');
  }
  return { nazwa: czesci[0].toUpperCase(), params, wartosc };
}

function _icsOdkoduj(s) {
  return String(s)
    .replace(/\\n/gi, ' ')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

// Zwraca { data:'yyyy-MM-dd', czas:'HH:mm'|null, utc:bool }
function _icsData(wartosc, params) {
  const w = String(wartosc).trim();
  const mDate = w.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (mDate) return { data: mDate[1] + '-' + mDate[2] + '-' + mDate[3], czas: null, calodniowe: true };

  const mFull = w.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!mFull) return null;

  const [, y, mo, d, h, mi, s, z] = mFull;

  // Czas w UTC (sufiks Z) trzeba przeliczyć na strefę Kliniki, inaczej
  // grafik przesunąłby się o 1–2 godziny zależnie od pory roku.
  if (z) {
    const dt = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
    return {
      data: Utilities.formatDate(dt, IMPORT_TZ, 'yyyy-MM-dd'),
      czas: Utilities.formatDate(dt, IMPORT_TZ, 'HH:mm'),
      calodniowe: false
    };
  }
  // Bez Z: czas lokalny (ewentualne TZID traktujemy jako czas Kliniki —
  // kalendarz kliniki i klinika są w tej samej strefie).
  return { data: y + '-' + mo + '-' + d, czas: h + ':' + mi, calodniowe: false };
}

/**
 * Parsuje treść .ics na płaską listę wystąpień:
 *   { tytul, opis, data:'yyyy-MM-dd', od:'HH:mm', do:'HH:mm', calodniowe }
 * Reguły cykliczne (RRULE) są rozwijane w zadanym oknie czasu.
 */
function _parseICS(tekst, oknoOd, oknoDo) {
  const linie = _icsRozwin(tekst);
  const wydarzenia = [];
  let biezace = null;

  linie.forEach(l => {
    const p = _icsLinia(l);
    if (!p) return;

    if (p.nazwa === 'BEGIN' && p.wartosc.toUpperCase() === 'VEVENT') {
      biezace = { exdate: [] };
      return;
    }
    if (p.nazwa === 'END' && p.wartosc.toUpperCase() === 'VEVENT') {
      if (biezace && biezace.start) wydarzenia.push(biezace);
      biezace = null;
      return;
    }
    if (!biezace) return;

    if (p.nazwa === 'SUMMARY')      biezace.tytul = _icsOdkoduj(p.wartosc);
    else if (p.nazwa === 'DESCRIPTION') biezace.opis = _icsOdkoduj(p.wartosc);
    else if (p.nazwa === 'LOCATION') biezace.miejsce = _icsOdkoduj(p.wartosc);
    else if (p.nazwa === 'DTSTART') biezace.start = _icsData(p.wartosc, p.params);
    else if (p.nazwa === 'DTEND')   biezace.koniec = _icsData(p.wartosc, p.params);
    else if (p.nazwa === 'RRULE')   biezace.rrule = p.wartosc;
    else if (p.nazwa === 'EXDATE') {
      p.wartosc.split(',').forEach(v => {
        const d = _icsData(v, p.params);
        if (d) biezace.exdate.push(d.data);
      });
    }
  });

  const out = [];
  wydarzenia.forEach(w => {
    if (!w.start) return;
    const od = w.start.czas;
    const doC = w.koniec ? w.koniec.czas : null;
    const baza = {
      tytul: w.tytul || '',
      opis: w.opis || '',
      miejsce: w.miejsce || '',
      od: od,
      do: doC,
      calodniowe: !!w.start.calodniowe
    };

    if (!w.rrule) {
      out.push(Object.assign({}, baza, { data: w.start.data }));
      return;
    }
    _rozwinRRULE(w.start.data, w.rrule, w.exdate, oknoOd, oknoDo).forEach(d => {
      out.push(Object.assign({}, baza, { data: d }));
    });
  });

  return out;
}

// Rozwinięcie reguły cyklicznej. Obsługujemy to, co realnie występuje
// w kalendarzach dyżurów: tygodniowe i dzienne, z BYDAY, INTERVAL,
// COUNT i UNTIL. Nieobsługiwane reguły dają samo wystąpienie bazowe —
// lepiej pokazać mniej niż zmyślić cykl, którego nie ma.
function _rozwinRRULE(dataStart, rrule, exdate, oknoOd, oknoDo) {
  const cz = {};
  String(rrule).split(';').forEach(p => {
    const kv = p.split('=');
    if (kv.length === 2) cz[kv[0].toUpperCase()] = kv[1];
  });

  const freq = String(cz.FREQ || '').toUpperCase();
  if (freq !== 'WEEKLY' && freq !== 'DAILY') return [dataStart];

  const interval = Math.max(1, parseInt(cz.INTERVAL || '1', 10));
  const count = cz.COUNT ? parseInt(cz.COUNT, 10) : null;
  const until = cz.UNTIL ? (_icsData(cz.UNTIL, {}) || {}).data : null;

  const DNI = { SU:0, MO:1, TU:2, WE:3, TH:4, FR:5, SA:6 };
  const byday = cz.BYDAY
    ? String(cz.BYDAY).split(',').map(d => DNI[d.replace(/^[-+]?\d+/, '').toUpperCase()])
        .filter(d => d !== undefined)
    : null;

  // Okno rozwijania — domyślnie 16 tygodni od startu. To wystarcza,
  // żeby wyłuskać powtarzalny wzorzec tygodnia, i nie generuje tysięcy dat.
  const start = new Date(dataStart + 'T12:00:00');
  const limitOd = oknoOd ? new Date(oknoOd + 'T00:00:00') : start;
  const limitDo = oknoDo ? new Date(oknoDo + 'T23:59:59')
                         : new Date(start.getTime() + 16 * 7 * 86400000);

  const out = [];
  const kursor = new Date(start.getTime());
  let iteracje = 0, wyprodukowane = 0;

  while (kursor <= limitDo && iteracje < 800) {
    iteracje++;
    const ds = Utilities.formatDate(kursor, IMPORT_TZ, 'yyyy-MM-dd');

    let pasuje = true;
    if (freq === 'WEEKLY' && byday && byday.length) {
      pasuje = byday.indexOf(kursor.getDay()) !== -1;
    }
    if (until && ds > until) break;

    if (pasuje && kursor >= limitOd && exdate.indexOf(ds) === -1) {
      out.push(ds);
      wyprodukowane++;
      if (count && wyprodukowane >= count) break;
    }

    if (freq === 'DAILY') kursor.setDate(kursor.getDate() + interval);
    else if (byday && byday.length) kursor.setDate(kursor.getDate() + 1);
    else kursor.setDate(kursor.getDate() + 7 * interval);
  }

  return out;
}

// ── Parser JSON (tolerancyjny) ───────────────────────────────
// Nie znamy z góry kształtu, więc szukamy najczęstszych nazw pól
// zamiast wymuszać jeden schemat.

function _parseJSONCal(obj) {
  let lista = obj;
  if (!Array.isArray(lista)) {
    const kand = ['events', 'items', 'data', 'entries', 'appointments', 'shifts', 'wydarzenia'];
    for (let i = 0; i < kand.length; i++) {
      if (Array.isArray(obj[kand[i]])) { lista = obj[kand[i]]; break; }
    }
  }
  if (!Array.isArray(lista)) return [];

  const pole = (o, nazwy) => {
    for (let i = 0; i < nazwy.length; i++) {
      if (o[nazwy[i]] !== undefined && o[nazwy[i]] !== null && o[nazwy[i]] !== '') return o[nazwy[i]];
    }
    return null;
  };

  const out = [];
  lista.forEach(e => {
    if (!e || typeof e !== 'object') return;
    const tytul = String(pole(e, ['title','summary','name','subject','tytul','osoba','doctor','lekarz']) || '');
    const start = pole(e, ['start','startDate','start_time','startTime','from','od','begin']);
    const koniec = pole(e, ['end','endDate','end_time','endTime','to','do','finish']);
    if (!start) return;

    const s = _jsonData(start), k = koniec ? _jsonData(koniec) : null;
    if (!s) return;
    out.push({
      tytul: tytul,
      opis: String(pole(e, ['description','desc','notes','opis']) || ''),
      miejsce: String(pole(e, ['location','room','gabinet','miejsce']) || ''),
      data: s.data, od: s.czas, do: k ? k.czas : null,
      calodniowe: !s.czas
    });
  });
  return out;
}

function _jsonData(v) {
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (m) {
    return { data: m[1] + '-' + m[2] + '-' + m[3], czas: m[4] ? (m[4] + ':' + m[5]) : null };
  }
  const n = Number(s);
  if (!isNaN(n) && n > 1000000000) {
    const dt = new Date(n < 1e12 ? n * 1000 : n);
    return {
      data: Utilities.formatDate(dt, IMPORT_TZ, 'yyyy-MM-dd'),
      czas: Utilities.formatDate(dt, IMPORT_TZ, 'HH:mm')
    };
  }
  return null;
}

// ── Dopasowanie nazwisk do kadry ─────────────────────────────

function _normalizuj(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/ą/g,'a').replace(/ć/g,'c').replace(/ę/g,'e').replace(/ł/g,'l')
    .replace(/ń/g,'n').replace(/ó/g,'o').replace(/ś/g,'s').replace(/ż/g,'z').replace(/ź/g,'z')
    // tytuły i skróty zawodowe potrafią zaburzyć dopasowanie
    .replace(/\b(dr|dr\.|lek|lek\.|lekarz|dent|dent\.|stom|stom\.|med|med\.|hab|prof)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Dopasowanie po nazwisku (mocniejszy sygnał) i imieniu.
function _dopasujOsobe(tytul, personel) {
  const t = ' ' + _normalizuj(tytul) + ' ';
  let najlepszy = null, najlepszyWynik = 0;

  personel.forEach(p => {
    const imie = _normalizuj(p.imie);
    const nazw = _normalizuj(p.nazwisko);
    if (!imie && !nazw) return;

    let wynik = 0;
    if (nazw && t.indexOf(' ' + nazw + ' ') !== -1) wynik += 3;
    if (imie && t.indexOf(' ' + imie + ' ') !== -1) wynik += 2;
    // inicjał imienia przy pełnym nazwisku: "A. Nowak"
    if (wynik === 3 && imie && t.indexOf(' ' + imie[0] + ' ') !== -1) wynik += 1;

    if (wynik > najlepszyWynik) { najlepszyWynik = wynik; najlepszy = p; }
  });

  // Samo imię (2 pkt) bywa niejednoznaczne — akceptujemy tylko, gdy
  // nikt inny w zespole nie ma tego imienia.
  if (najlepszyWynik === 2 && najlepszy) {
    const imie = _normalizuj(najlepszy.imie);
    const ilu = personel.filter(p => _normalizuj(p.imie) === imie).length;
    if (ilu > 1) return { osoba: null, pewnosc: 0 };
  }
  if (najlepszyWynik < 2) return { osoba: null, pewnosc: 0 };
  return { osoba: najlepszy, pewnosc: najlepszyWynik };
}

// ── Budowa szkieletu tygodnia ────────────────────────────────
// Kalendarz ma konkretne daty, a grafik jest szablonem tygodniowym.
// Dla każdej pary (dzień tygodnia, lekarz) bierzemy NAJCZĘSTSZY zakres
// godzin — to daje stabilny wzorzec zamiast przypadkowego tygodnia.

function _szkieletTygodnia(wystapienia, personel) {
  const wg = {}; // 'dzien_osobaId' -> { 'od-do': liczba }
  const nierozpoznane = {};

  wystapienia.forEach(w => {
    if (w.calodniowe || !w.od || !w.do) return;
    const dow = new Date(w.data + 'T12:00:00').getDay();
    if (GRAFIK_DAYS.indexOf(dow) === -1) return; // niedziela / poza oknem

    const dop = _dopasujOsobe(w.tytul + ' ' + w.opis, personel);
    if (!dop.osoba) {
      const klucz = (w.tytul || '(bez tytułu)').slice(0, 80);
      nierozpoznane[klucz] = (nierozpoznane[klucz] || 0) + 1;
      return;
    }
    if (dop.osoba.grupa !== GRUPA_LEKARZ) return;

    const k = dow + '_' + dop.osoba.id;
    const zakres = w.od + '-' + w.do;
    if (!wg[k]) wg[k] = {};
    wg[k][zakres] = (wg[k][zakres] || 0) + 1;
  });

  const bloki = [];
  Object.keys(wg).forEach(k => {
    const [dowStr, osobaId] = k.split('_');
    const warianty = wg[k];
    const najczestszy = Object.keys(warianty).sort((a, b) => warianty[b] - warianty[a])[0];
    const [od, do_] = najczestszy.split('-');
    bloki.push({
      dzien: parseInt(dowStr, 10),
      osobaId: osobaId,
      od: od,
      do: do_,
      wystapien: warianty[najczestszy],
      wariantow: Object.keys(warianty).length
    });
  });

  bloki.sort((a, b) => a.dzien - b.dzien || _t2m(a.od) - _t2m(b.od));
  return { bloki, nierozpoznane };
}

// Docięcie bloku do okna otwarcia — kalendarz lekarza może wystawać
// poza godziny kliniki, a grafik takiego bloku nie przyjmie.
function _dotnijDoOkna(dzien, od, do_) {
  const h = GRAFIK_HOURS[dzien];
  if (!h) return null;
  const o = Math.max(_t2m(od), h.open);
  const d = Math.min(_t2m(do_), h.close);
  if (d - o < 30) return null; // szczątkowa resztka nie ma sensu jako blok
  return { od: _hhmm(o), do: _hhmm(d), dociete: (o !== _t2m(od) || d !== _t2m(do_)) };
}

// ── API: podgląd importu ─────────────────────────────────────

function masterGrafikImportPodglad(token, url) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  url = String(url || '').trim();
  if (!/^https?:\/\//i.test(url)) return { ok: false, msg: 'Podaj pełny adres (https://…).' };

  let r;
  try { r = _fetchKalendarz(url); }
  catch (err) { return { ok: false, msg: 'Nie udało się pobrać adresu: ' + err }; }

  if (r.kod < 200 || r.kod >= 300) {
    return { ok: false, msg: 'Serwer kalendarza odpowiedział kodem ' + r.kod +
      '. Sprawdź, czy link jest publiczny (bez logowania).' };
  }

  const format = _rozpoznajFormat(r.tresc, r.typ);
  let wystapienia = [];

  if (format === 'ics') {
    wystapienia = _parseICS(r.tresc);
  } else if (format === 'json') {
    try { wystapienia = _parseJSONCal(JSON.parse(r.tresc)); }
    catch (e) { return { ok: false, msg: 'Nie udało się odczytać danych JSON z kalendarza.' }; }
  } else if (format === 'html') {
    const m = String(r.tresc).match(/href\s*=\s*["']([^"']+\.ics[^"']*)["']/i);
    if (!m) {
      return { ok: false, format: 'html',
        msg: 'Pod adresem jest strona HTML, a nie kanał kalendarza. Poszukaj w niej opcji ' +
             '„Eksportuj / Subskrybuj / iCal” i użyj tamtego linku (kończy się na .ics).' };
    }
    let ics = m[1];
    if (ics.indexOf('http') !== 0) {
      const baza = url.replace(/\/[^\/]*$/, '');
      ics = (ics[0] === '/') ? (url.match(/^https?:\/\/[^\/]+/)[0] + ics) : (baza + '/' + ics);
    }
    try {
      const r2 = _fetchKalendarz(ics);
      wystapienia = _parseICS(r2.tresc);
    } catch (e) {
      return { ok: false, msg: 'Znaleziono link do kalendarza, ale nie udało się go pobrać.' };
    }
  } else {
    return { ok: false, format: format,
      msg: 'Nie rozpoznano formatu kalendarza pod tym adresem. Uruchom grafikDiagnostykaZrodla("' +
           url + '") w edytorze Apps Script — pokaże, co dokładnie zwraca serwer.' };
  }

  if (!wystapienia.length) {
    return { ok: false, msg: 'Kalendarz pobrany, ale nie znaleziono w nim żadnych wydarzeń z godzinami.' };
  }

  const personel = _grafikPersonel();
  const szkielet = _szkieletTygodnia(wystapienia, personel);
  const gabinety = _gabinetyAll(false);
  const istniejace = _grafikBlokiAll();

  // Przypisanie do gabinetów: każdy blok trafia do pierwszego gabinetu
  // wolnego w tych godzinach. Kalendarz lekarza zwykle nie mówi, w którym
  // gabinecie pracuje — właściciel poprawi to jednym dotknięciem.
  const propozycje = [];
  const zajete = {}; // dzien -> gabinetId -> [{od,do}]
  istniejace.forEach(b => {
    if (!zajete[b.dzien]) zajete[b.dzien] = {};
    if (!zajete[b.dzien][b.gabinetId]) zajete[b.dzien][b.gabinetId] = [];
    zajete[b.dzien][b.gabinetId].push({ od: b.od, do: b.do });
  });

  szkielet.bloki.forEach(b => {
    const osoba = personel.find(p => p.id === b.osobaId);
    const przyciete = _dotnijDoOkna(b.dzien, b.od, b.do);
    if (!przyciete) {
      propozycje.push({
        dzien: b.dzien, dzienNazwa: GRAFIK_DAY_NAMES[b.dzien],
        osobaId: b.osobaId, osoba: osoba ? (osoba.imie + ' ' + osoba.nazwisko) : b.osobaId,
        od: b.od, do: b.do, status: 'poza-oknem',
        uwaga: 'Poza godzinami otwarcia (' + _hhmm(GRAFIK_HOURS[b.dzien].open) + '–' +
               _hhmm(GRAFIK_HOURS[b.dzien].close) + ') — pominięte.'
      });
      return;
    }

    if (!zajete[b.dzien]) zajete[b.dzien] = {};
    let wybrany = null;
    for (let i = 0; i < gabinety.length; i++) {
      const g = gabinety[i];
      const lista = zajete[b.dzien][g.id] || [];
      const koliduje = lista.some(x => _zakresyNachodza(przyciete.od, przyciete.do, x.od, x.do));
      if (!koliduje) { wybrany = g; break; }
    }

    if (!wybrany) {
      propozycje.push({
        dzien: b.dzien, dzienNazwa: GRAFIK_DAY_NAMES[b.dzien],
        osobaId: b.osobaId, osoba: osoba ? (osoba.imie + ' ' + osoba.nazwisko) : b.osobaId,
        od: przyciete.od, do: przyciete.do, status: 'brak-gabinetu',
        uwaga: 'Wszystkie gabinety zajęte w tych godzinach — dołóż gabinet albo popraw ręcznie.'
      });
      return;
    }

    if (!zajete[b.dzien][wybrany.id]) zajete[b.dzien][wybrany.id] = [];
    zajete[b.dzien][wybrany.id].push({ od: przyciete.od, do: przyciete.do });

    propozycje.push({
      dzien: b.dzien, dzienNazwa: GRAFIK_DAY_NAMES[b.dzien],
      gabinetId: wybrany.id, gabinet: wybrany.nazwa,
      osobaId: b.osobaId, osoba: osoba ? (osoba.imie + ' ' + osoba.nazwisko) : b.osobaId,
      od: przyciete.od, do: przyciete.do,
      status: 'do-utworzenia',
      uwaga: (przyciete.dociete ? 'Docięte do godzin otwarcia. ' : '') +
             (b.wariantow > 1 ? ('W kalendarzu ' + b.wariantow + ' różne warianty godzin — wzięto najczęstszy (' +
              b.wystapien + '×).') : '')
    });
  });

  return {
    ok: true,
    format: format,
    znalezionychWydarzen: wystapienia.length,
    propozycje: propozycje,
    doUtworzenia: propozycje.filter(p => p.status === 'do-utworzenia').length,
    nierozpoznane: Object.keys(szkielet.nierozpoznane).map(k => ({
      tytul: k, ile: szkielet.nierozpoznane[k]
    })).sort((a, b) => b.ile - a.ile).slice(0, 20),
    istniejacychBlokow: istniejace.length
  };
}

// ── API: zapis zatwierdzonych propozycji ─────────────────────

function masterGrafikImportZastosuj(token, propozycje, czyscicPrzed) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  if (!Array.isArray(propozycje) || !propozycje.length) {
    return { ok: false, msg: 'Brak pozycji do zapisania.' };
  }

  // Czyszczenie dotyczy WYŁĄCZNIE bloków lekarskich — higienizacje
  // i asysta to praca właściciela, której import nie ma prawa kasować.
  let usuniete = 0;
  if (czyscicPrzed) {
    const sh = _ss().getSheetByName('Grafik');
    const rows = sh.getDataRange().getValues();
    for (let i = rows.length - 1; i >= 1; i--) {
      if (String(rows[i][3]) === BLOK_LEKARZ) {
        _usunAsysteBloku(String(rows[i][0]));
        sh.deleteRow(i + 1);
        usuniete++;
      }
    }
  }

  let dodane = 0;
  const bledy = [];
  propozycje.forEach(p => {
    if (!p || p.status !== 'do-utworzenia') return;
    const res = masterSaveGrafikBlok(token, {
      id: '',
      gabinetId: p.gabinetId,
      dzien: p.dzien,
      typ: BLOK_LEKARZ,
      osobaId: p.osobaId,
      od: p.od,
      do: p.do,
      asystaWymagana: 1,
      asystaUwaga: ''
    });
    if (res && res.ok) dodane++;
    else bledy.push((p.osoba || p.osobaId) + ' ' + GRAFIK_DAY_NAMES[p.dzien] + ' ' +
                    p.od + '–' + p.do + ': ' + ((res && res.msg) || 'nieznany błąd'));
  });

  _logAdmin('ImportGrafiku', '—', 'dodano ' + dodane + ', usunięto ' + usuniete +
            (bledy.length ? (', błędów ' + bledy.length) : ''));

  return { ok: true, dodane, usuniete, bledy: bledy.slice(0, 20) };
}
