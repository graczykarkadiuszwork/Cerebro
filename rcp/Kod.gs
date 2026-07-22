// ============================================================
// Kod.gs — We SMILE RCP „OPOKA” v1.0
// Router, bezpieczeństwo, widok Pracownika.
// Przepływ pracownika: PIN → dotknięcie akcji → potwierdzenie.
// Stary arkusz `Ewidencja` pozostaje jedynym dziennikiem zdarzeń —
// dotychczasowe wiersze NIE są modyfikowane, nowe są dopisywane
// w zgodnym formacie z dodatkowymi kolumnami na końcu.
// ============================================================

var SS_ID   = '1wI3ysrolzGea5nNi7GYBo09t38y8oUgPoqGG3wn-ZsA'; // bez zmian względem v6.0
var STREFA  = 'Europe/Warsaw';

var TTL_SESJA_PRACOWNIK = 900;   // 15 min
var TTL_SESJA_PANEL     = 3600;  // 60 min (właściciel / admin)
var RATE_MAX            = 8;     // prób PIN / okno
var RATE_OKNO_SEC       = 300;
var DEDUP_SEC           = 45;    // ochrona przed podwójnym odbiciem
var LIMIT_DNI_WSTECZ    = 92;    // ręczne wpisy maks. 92 dni wstecz
var LIMIT_DNI_PRZOD     = 366;   // nieobecności maks. rok w przód
var OKNO_KART_DNI       = 45;    // ile dni wstecz szukamy „dziur” pracownika

// Kolumny arkusza Ewidencja (0-indeks). 0–7 = istniejące, 8–12 = nowe.
var EW = { TS: 0, EMP: 1, IMIE: 2, NAZ: 3, AKCJA: 4, DATA: 5, GODZ: 6, ZRODLO: 7,
           ID: 8, UZAS: 9, STATUS: 10, META: 11, ZATW: 12 };
var EW_KOLUMN = 13;

// Kolumny arkusza Pracownicy (0-indeks). 0–5 = istniejące, 6–10 = nowe.
var PR = { ID: 0, IMIE: 1, NAZ: 2, STANOWISKO: 3, STATUS: 4, PIN: 5,
           HASH: 6, SOL: 7, WLASCICIEL: 8, ADMIN: 9, FORMA: 10 };
var PR_KOLUMN = 11;

// Kolumny arkusza Nieobecnosci.
var NB = { ID: 0, EMP: 1, DATA: 2, TYP: 3, OPIS: 4, OZNACZYL: 5, TS: 6, STATUS: 7, ZATW: 8 };

// ── Router ───────────────────────────────────────────────────

function doGet(e) {
  var p = (e && e.parameter && e.parameter.page) || 'pracownik';
  var plik = { pracownik: 'Pracownik', wlasciciel: 'Wlasciciel', admin: 'Admin' }[p] || 'Pracownik';
  return HtmlService.createTemplateFromFile(plik)
    .evaluate()
    .setTitle('We SMILE — RCP')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(nazwa) {
  return HtmlService.createHtmlOutputFromFile(nazwa).getContent();
}

// ── Dispatcher ───────────────────────────────────────────────

function callRCP(action, argsJson) {
  try {
    var a = JSON.parse(argsJson || '[]');
    switch (action) {
      // Pracownik
      case 'pinLogin':        return pinLogin(a[0]);
      case 'getStart':        return getStart(a[0]);
      case 'odbij':           return odbij(a[0], a[1]);
      case 'reczneOdbicie':   return reczneOdbicie(a[0], a[1], a[2], a[3], a[4]);
      case 'oznaczNieobecnosc': return oznaczNieobecnosc(a[0], a[1], a[2], a[3]);
      // Właściciel (Panel.gs)
      case 'wlLogin':         return wlLogin(a[0]);
      case 'wlDzis':          return wlDzis(a[0]);
      case 'wlSkrzynka':      return wlSkrzynka(a[0]);
      case 'wlZatwierdzReczne':      return wlZatwierdzReczne(a[0], a[1], a[2]);
      case 'wlZatwierdzNieobecnosc': return wlZatwierdzNieobecnosc(a[0], a[1]);
      case 'wlDzien':         return wlDzien(a[0], a[1], a[2]);
      case 'wlZapiszDzien':   return wlZapiszDzien(a[0], a[1], a[2], a[3], a[4], a[5]);
      case 'wlMiesiac':       return wlMiesiac(a[0], a[1], a[2]);
      case 'wlEksport':       return wlEksport(a[0], a[1], a[2]);
      // Admin (Administrator.gs)
      case 'adLogin':         return adLogin(a[0]);
      case 'adPracownicy':    return adPracownicy(a[0]);
      case 'adDodaj':         return adDodaj(a[0], a[1], a[2], a[3], a[4], a[5], a[6]);
      case 'adStatus':        return adStatus(a[0], a[1], a[2]);
      case 'adResetPin':      return adResetPin(a[0], a[1]);
      case 'adLogi':          return adLogi(a[0]);
      default:                return { ok: false, msg: 'Nieznana akcja.' };
    }
  } catch (err) {
    Logger.log('RCP błąd [' + action + ']: ' + err + (err && err.stack ? '\n' + err.stack : ''));
    return { ok: false, msg: 'Błąd serwera. Spróbuj ponownie.' };
  }
}

// ── Pomocnicze: arkusz / czas / cache ────────────────────────

var _ssCache = null;
function _ss() { if (!_ssCache) _ssCache = SpreadsheetApp.openById(SS_ID); return _ssCache; }
function _ark(nazwa) {
  var sh = _ss().getSheetByName(nazwa);
  if (!sh) throw new Error('Brak arkusza „' + nazwa + '” — uruchom setupOpoka().');
  return sh;
}
function _cache() { return CacheService.getScriptCache(); }
function _props() { return PropertiesService.getScriptProperties(); }
function _dzis()  { return Utilities.formatDate(new Date(), STREFA, 'yyyy-MM-dd'); }
function _teraz() { return Utilities.formatDate(new Date(), STREFA, 'HH:mm'); }
function _stempel() { return Utilities.formatDate(new Date(), STREFA, "yyyy-MM-dd HH:mm:ss"); }
function _uuid()  { return Utilities.getUuid(); }

function _hex(bajty) {
  return bajty.map(function (b) {
    var v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

// Normalizacja wartości z Sheets (auto-konwersje dat/godzin) — zachowana z v6.0.
function _sheetDate(v) {
  if (v instanceof Date) return Utilities.formatDate(v, STREFA, 'yyyy-MM-dd');
  return String(v || '');
}
function _sheetTime(v) {
  if (v instanceof Date) return Utilities.formatDate(v, STREFA, 'HH:mm');
  var s = String(v == null ? '' : v);
  if (s !== '' && !isNaN(s) && s.indexOf(':') === -1) {
    var m = Math.round(parseFloat(s) * 1440);
    return minutyNaCzas(m);
  }
  if (/^\d:\d\d$/.test(s)) s = '0' + s;
  return s;
}
function _bool(v) {
  if (v === true) return true;
  var s = String(v || '').trim().toUpperCase();
  return s === 'TRUE' || s === 'TAK' || s === '1';
}

// ── Bezpieczeństwo: hash PIN, sesje, rate limit, lock ────────

function _pieprz() {
  var p = _props().getProperty('PEPPER');
  if (!p) throw new Error('Brak sekretu PEPPER — uruchom setupOpoka().');
  return p;
}

/** HMAC-SHA256(sol:pin, PEPPER) — weryfikowalny tylko z sekretem spoza arkusza. */
function _hashPin(pin, sol) {
  return _hex(Utilities.computeHmacSha256Signature(String(sol) + ':' + String(pin), _pieprz()));
}

function _losowyPin() {
  var b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, _uuid());
  var n = 0;
  for (var i = 0; i < 4; i++) n = (n * 256 + (b[i] < 0 ? b[i] + 256 : b[i])) % 10000;
  return ('000' + n).slice(-4);
}

function _sesjaNowa(pfx, empId, ttl) {
  var t = _uuid();
  _cache().put(pfx + t, String(empId), ttl);
  return t;
}
function _sesjaEmp(pfx, token, ttl) {
  if (!token) return null;
  var k = pfx + String(token).slice(0, 80);
  var v = _cache().get(k);
  if (v) _cache().put(k, v, ttl); // odśwież TTL
  return v;
}

function _ogrRate(klucz) {
  var k = 'rl_' + klucz;
  var v = parseInt(_cache().get(k) || '0', 10);
  if (v >= RATE_MAX) return false;
  _cache().put(k, String(v + 1), RATE_OKNO_SEC);
  return true;
}
function _resetRate(klucz) { _cache().remove('rl_' + klucz); }

function _zLockiem(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, msg: 'System chwilowo zajęty — spróbuj za moment.' };
  try { return fn(); }
  finally { lock.releaseLock(); }
}

function _log(akcja, empId, szczegoly) {
  try {
    _ark('Logi_Admin').appendRow([new Date().toISOString(), String(akcja), String(empId || '—'), String(szczegoly || '').slice(0, 500)]);
  } catch (e) { Logger.log('_log: ' + e); }
}
function _anomalia(empId, opis) {
  try {
    _ark('Anomalie').appendRow([new Date().toISOString(), String(empId || '—'), String(opis || '').slice(0, 500)]);
  } catch (e) { Logger.log('_anomalia: ' + e); }
}

// ── Odczyt pracowników / zdarzeń ─────────────────────────────

function _pracownicy() {
  var sh = _ark('Pracownicy');
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, Math.max(sh.getLastColumn(), PR_KOLUMN)).getValues()
    .map(function (r, i) {
      return {
        wiersz: i + 2,
        id: String(r[PR.ID] || ''),
        imie: String(r[PR.IMIE] || ''),
        nazwisko: String(r[PR.NAZ] || ''),
        stanowisko: String(r[PR.STANOWISKO] || ''),
        aktywny: String(r[PR.STATUS] || '').toLowerCase() === 'aktywny',
        pinHash: String(r[PR.HASH] || ''),
        pinSol: String(r[PR.SOL] || ''),
        wlasciciel: _bool(r[PR.WLASCICIEL]),
        admin: _bool(r[PR.ADMIN]),
        forma: String(r[PR.FORMA] || '') || 'Umowa o pracę'
      };
    })
    .filter(function (p) { return p.id !== ''; });
}

function _pracownikPoPinie(pin) {
  if (!poprawnyPin(pin)) return null;
  var lista = _pracownicy();
  for (var i = 0; i < lista.length; i++) {
    var p = lista[i];
    if (!p.aktywny || !p.pinHash || !p.pinSol) continue;
    if (_hashPin(pin, p.pinSol) === p.pinHash) return p;
  }
  return null;
}

function _pracownikPoId(empId) {
  var lista = _pracownicy();
  for (var i = 0; i < lista.length; i++) if (lista[i].id === String(empId)) return lista[i];
  return null;
}

/** Wszystkie zdarzenia Ewidencji jako obiekty. Stare wiersze (8 kolumn) czytane bezpiecznie. */
function _zdarzenia() {
  var sh = _ark('Ewidencja');
  if (sh.getLastRow() < 2) return [];
  var dane = sh.getRange(2, 1, sh.getLastRow() - 1, Math.max(sh.getLastColumn(), EW_KOLUMN)).getValues();
  return dane.map(function (r, i) {
    return {
      wiersz: i + 2,
      empId: String(r[EW.EMP] || ''),
      akcja: String(r[EW.AKCJA] || '').trim(),
      data: _sheetDate(r[EW.DATA]),
      godzina: _sheetTime(r[EW.GODZ]),
      zrodlo: String(r[EW.ZRODLO] || ''),
      id: String(r[EW.ID] || ''),
      uzas: String(r[EW.UZAS] || ''),
      status: String(r[EW.STATUS] || ''),
      zatw: String(r[EW.ZATW] || '')
    };
  }).filter(function (z) { return z.empId !== ''; });
}

function _aktywne(zdarzenia) {
  return zdarzenia.filter(function (z) { return z.status !== 'ANULOWANE'; });
}

function _zdarzeniaDnia(zdarzenia, empId, data) {
  return _aktywne(zdarzenia).filter(function (z) { return z.empId === empId && z.data === data; })
    .map(function (z) { return { akcja: z.akcja, godzina: z.godzina, kolejnosc: z.wiersz, zrodlo: z.zrodlo, uzas: z.uzas, zatw: z.zatw, wiersz: z.wiersz }; });
}

function _dopiszZdarzenie(p, akcja, data, godzina, zrodlo, uzas, zatw) {
  var wiersz = new Array(EW_KOLUMN).fill('');
  wiersz[EW.TS] = new Date().toISOString();
  wiersz[EW.EMP] = p.id; wiersz[EW.IMIE] = p.imie; wiersz[EW.NAZ] = p.nazwisko;
  wiersz[EW.AKCJA] = akcja; wiersz[EW.DATA] = "'" + data; wiersz[EW.GODZ] = "'" + godzina;
  wiersz[EW.ZRODLO] = zrodlo; wiersz[EW.ID] = _uuid();
  wiersz[EW.UZAS] = String(uzas || '').slice(0, 300);
  wiersz[EW.ZATW] = String(zatw || '');
  _ark('Ewidencja').appendRow(wiersz);
}

function _nieobecnosci() {
  var sh = _ark('Nieobecnosci');
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 9).getValues().map(function (r, i) {
    return {
      wiersz: i + 2, id: String(r[NB.ID] || ''), empId: String(r[NB.EMP] || ''),
      data: _sheetDate(r[NB.DATA]), typ: String(r[NB.TYP] || ''), opis: String(r[NB.OPIS] || ''),
      oznaczyl: String(r[NB.OZNACZYL] || ''), status: String(r[NB.STATUS] || ''), zatw: String(r[NB.ZATW] || '')
    };
  }).filter(function (n) { return n.empId !== '' && n.status !== 'ANULOWANA'; });
}

// ── Widok PRACOWNIK ──────────────────────────────────────────

/** Krok 1: PIN. Zwraca sesję + stan startowy. */
function pinLogin(pin) {
  if (!poprawnyPin(pin)) return { ok: false, msg: 'PIN musi mieć 4 cyfry.' };
  if (!_ogrRate('pin')) return { ok: false, msg: 'Zbyt wiele prób. Odczekaj 5 minut.' };
  var p = _pracownikPoPinie(pin);
  if (!p) {
    _anomalia('—', 'Nieudana próba PIN (pracownik).');
    return { ok: false, msg: 'Nieprawidłowy PIN lub konto nieaktywne.' };
  }
  _resetRate('pin');
  var token = _sesjaNowa('sp_', p.id, TTL_SESJA_PRACOWNIK);
  var stan = _stanPracownika(p);
  stan.ok = true; stan.token = token;
  return stan;
}

/** Odświeżenie ekranu głównego pracownika. */
function getStart(token) {
  var empId = _sesjaEmp('sp_', token, TTL_SESJA_PRACOWNIK);
  if (!empId) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła — wpisz PIN ponownie.' };
  var p = _pracownikPoId(empId);
  if (!p || !p.aktywny) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Konto nieaktywne.' };
  var stan = _stanPracownika(p);
  stan.ok = true;
  return stan;
}

function _stanPracownika(p) {
  var wszystkie = _zdarzenia();
  var dzis = _dzis();
  var dnia = _zdarzeniaDnia(wszystkie, p.id, dzis);
  var par = parujOdcinki(dnia);
  var karty = _kartyPracownika(wszystkie, p, dzis);
  return {
    imie: p.imie, nazwisko: p.nazwisko, stanowisko: p.stanowisko,
    dzis: dzis, teraz: _teraz(),
    odcinki: par.odcinki, otwarteOd: par.otwarteOd,
    minuty: par.minuty, minutyTekst: formatujMinuty(par.minuty),
    nastepna: nastepnaAkcja(dnia),
    typyNieobecnosci: typyDlaFormy(p.forma),
    karty: karty
  };
}

/** Dni z ostatnich OKNO_KART_DNI wymagające uwagi pracownika (niedokończone / błędy sekwencji). */
function _kartyPracownika(wszystkie, p, dzis) {
  var mapa = {};
  _aktywne(wszystkie).forEach(function (z) {
    if (z.empId !== p.id) return;
    if (!poprawnaData(z.data)) return;
    var dni = rozniceDni(z.data, dzis);
    if (dni <= 0 || dni > OKNO_KART_DNI) return; // tylko dni PRZED dzisiejszym
    (mapa[z.data] = mapa[z.data] || []).push({ akcja: z.akcja, godzina: z.godzina, kolejnosc: z.wiersz });
  });
  var nieob = {};
  _nieobecnosci().forEach(function (n) { if (n.empId === p.id) nieob[n.data] = true; });
  var karty = [];
  Object.keys(mapa).sort().forEach(function (data) {
    if (nieob[data]) return;
    var par = parujOdcinki(mapa[data]);
    if (par.otwarteOd !== null) {
      karty.push({ data: data, problem: 'Niedokończone WEJŚCIE o ' + par.otwarteOd, otwarteOd: par.otwarteOd });
    } else if (par.bledy.length) {
      karty.push({ data: data, problem: par.bledy[0], otwarteOd: null });
    }
  });
  return karty.slice(0, 10);
}

/** Krok 2+3: dotknięcie akcji + potwierdzenie → zapis odbicia. */
function odbij(token, akcja) {
  var empId = _sesjaEmp('sp_', token, TTL_SESJA_PRACOWNIK);
  if (!empId) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła — wpisz PIN ponownie.' };
  if (akcja !== 'WEJSCIE' && akcja !== 'WYJSCIE') return { ok: false, msg: 'Nieprawidłowa akcja.' };

  return _zLockiem(function () {
    var p = _pracownikPoId(empId);
    if (!p || !p.aktywny) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Konto nieaktywne.' };

    var kluczDedup = 'dup_' + p.id;
    if (_cache().get(kluczDedup)) return { ok: false, msg: 'Odbicie już zarejestrowane. Odczekaj chwilę.' };

    var dzis = _dzis();
    var dnia = _zdarzeniaDnia(_zdarzenia(), p.id, dzis);
    var dozwolona = nastepnaAkcja(dnia);
    if (akcja !== dozwolona) {
      _anomalia(p.id, 'Odrzucone ' + akcja + ' — dozwolone ' + dozwolona + '.');
      return {
        ok: false,
        msg: dozwolona === 'WEJSCIE'
          ? 'Nie masz otwartego WEJŚCIA — najpierw zarejestruj wejście.'
          : 'Masz już otwarte WEJŚCIE — teraz możliwe jest tylko WYJŚCIE.'
      };
    }

    var godzina = _teraz();
    _dopiszZdarzenie(p, akcja, dzis, godzina, 'worker', '', '');
    _cache().put(kluczDedup, '1', DEDUP_SEC);

    var po = parujOdcinki(_zdarzeniaDnia(_zdarzenia(), p.id, dzis));
    return {
      ok: true, akcja: akcja, godzina: godzina,
      odcinki: po.odcinki, otwarteOd: po.otwarteOd,
      minuty: po.minuty, minutyTekst: formatujMinuty(po.minuty),
      nastepna: po.otwarteOd !== null ? 'WYJSCIE' : 'WEJSCIE'
    };
  });
}

/** Ręczny wpis godzin z obowiązkowym uzasadnieniem — flagowany dla Właściciela/Admina. */
function reczneOdbicie(token, data, od, do_, uzasadnienie) {
  var empId = _sesjaEmp('sp_', token, TTL_SESJA_PRACOWNIK);
  if (!empId) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła — wpisz PIN ponownie.' };

  data = String(data || '').trim();
  od = String(od || '').trim();
  do_ = String(do_ || '').trim();

  if (!poprawnaData(data)) return { ok: false, msg: 'Nieprawidłowa data.' };
  var dzis = _dzis();
  var dni = rozniceDni(data, dzis);
  if (dni < 0) return { ok: false, msg: 'Ręczny wpis nie może dotyczyć przyszłości.' };
  if (dni > LIMIT_DNI_WSTECZ) return { ok: false, msg: 'Ręczny wpis możliwy maks. ' + LIMIT_DNI_WSTECZ + ' dni wstecz.' };
  if (!poprawneUzasadnienie(uzasadnienie)) {
    return { ok: false, msg: 'Uzasadnienie jest obowiązkowe (min. 5 znaków) — napisz, dlaczego wpisujesz godziny ręcznie.' };
  }

  return _zLockiem(function () {
    var p = _pracownikPoId(empId);
    if (!p || !p.aktywny) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Konto nieaktywne.' };

    var dnia = _zdarzeniaDnia(_zdarzenia(), p.id, data);
    var par = parujOdcinki(dnia);
    var blad = kolizjaOdcinka(par, od, do_);
    if (blad) return { ok: false, msg: blad };

    if (data === dzis) {
      var terazMin = czasNaMinuty(_teraz());
      if (od && czasNaMinuty(od) > terazMin) return { ok: false, msg: 'Godzina wejścia jest w przyszłości.' };
      if (do_ && czasNaMinuty(do_) > terazMin) return { ok: false, msg: 'Godzina wyjścia jest w przyszłości.' };
    }

    var uzas = String(uzasadnienie).trim();
    if (od)  _dopiszZdarzenie(p, 'WEJSCIE', data, od, 'reczne', uzas, '');
    if (do_) _dopiszZdarzenie(p, 'WYJSCIE', data, do_, 'reczne', uzas, '');
    _log('ReczneOdbicie', p.id, data + ' ' + (od || '…') + '–' + (do_ || '…') + ' | ' + uzas);

    var po = parujOdcinki(_zdarzeniaDnia(_zdarzenia(), p.id, data));
    return { ok: true, data: data, odcinki: po.odcinki, otwarteOd: po.otwarteOd, minutyTekst: formatujMinuty(po.minuty) };
  });
}

/** Oznaczenie nieobecności (typ filtrowany formą zatrudnienia) — do potwierdzenia przez Właściciela. */
function oznaczNieobecnosc(token, data, typ, opis) {
  var empId = _sesjaEmp('sp_', token, TTL_SESJA_PRACOWNIK);
  if (!empId) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła — wpisz PIN ponownie.' };

  data = String(data || '').trim();
  typ = String(typ || '').trim();
  if (!poprawnaData(data)) return { ok: false, msg: 'Nieprawidłowa data.' };
  var dni = rozniceDni(data, _dzis());
  if (dni > LIMIT_DNI_WSTECZ) return { ok: false, msg: 'Nieobecność możesz oznaczyć maks. ' + LIMIT_DNI_WSTECZ + ' dni wstecz.' };
  if (dni < -LIMIT_DNI_PRZOD) return { ok: false, msg: 'Zbyt odległa data w przyszłości.' };

  return _zLockiem(function () {
    var p = _pracownikPoId(empId);
    if (!p || !p.aktywny) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Konto nieaktywne.' };
    if (typyDlaFormy(p.forma).indexOf(typ) === -1) {
      return { ok: false, msg: 'Ten typ nieobecności nie jest dostępny dla Twojej formy zatrudnienia.' };
    }
    var jest = _nieobecnosci().some(function (n) { return n.empId === p.id && n.data === data; });
    if (jest) return { ok: false, msg: 'Na ten dzień jest już oznaczona nieobecność — o korektę poproś właściciela.' };

    var dnia = _zdarzeniaDnia(_zdarzenia(), p.id, data);
    if (dnia.length > 0) {
      return { ok: false, msg: 'Ten dzień ma zarejestrowane odbicia — nieobecności nie można nałożyć na godziny pracy.' };
    }

    _ark('Nieobecnosci').appendRow([
      _uuid(), p.id, "'" + data, typ, String(opis || '').slice(0, 300),
      p.id, new Date().toISOString(), '', ''
    ]);
    _log('Nieobecnosc', p.id, data + ' ' + typ + (opis ? ' | ' + String(opis).slice(0, 100) : ''));
    return { ok: true, data: data, typ: typ };
  });
}
