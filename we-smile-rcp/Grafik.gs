// ============================================================
// Grafik.gs — We SMILE: grafik obsady gabinetów + rekomendacje
// ============================================================
//
// Model:
//   Gabinety     : lista gabinetów (edytowalna — dodaj / zmień nazwę / wycofaj)
//   Grafik       : bloki obsady — jeden wiersz = jedna osoba w jednym gabinecie
//                  w jednym dniu tygodnia, w DOWOLNYCH godzinach (nie sztywne
//                  zmiany). Typ bloku: Lekarz albo Higienizacja.
//   GrafikAsysta : asysta przypisana do bloku (0, 1 lub więcej osób, każda
//                  z własnym zakresem godzin — asysta nie musi pokrywać
//                  całego bloku lekarza).
//
// Grafik jest szablonem TYGODNIOWYM (Pn–Sb), powtarzalnym co tydzień —
// odwzorowuje strukturę arkusza „GRAFIK OBSADY GABINETÓW". Jednorazowe
// odstępstwa (urlop, L4) obsługuje osobny moduł Nieobecności.
//
// Rekomendacje: silnik regułowy (_grafikRekomendacje) produkuje listę
// sugestii w ustandaryzowanym formacie. Format jest celowo taki sam, jaki
// zwróciłby model AI — dzięki temu podpięcie AI w przyszłości sprowadza się
// do podmiany źródła listy, bez zmian w interfejsie.
// ============================================================

// ── Odczyt danych ────────────────────────────────────────────

// Gabinety muszą istnieć zawsze — grafik bez nich nie ma się o co oprzeć.
// Tworzymy je przy pierwszym odczycie, zamiast wymagać pamiętania
// o ponownym uruchomieniu setupRCP() po aktualizacji.
// Trzy gabinety kliniki są stałe — istnieją zawsze i zawsze są dostępne
// przez całe godziny otwarcia. Brakujący gabinet jest odtwarzany, a nie
// tylko zakładany przy pustym arkuszu: dzięki temu żadna wcześniejsza
// pomyłka w danych nie zostawia grafiku bez podstawy.
const GABINETY_STALE = [
  { id: 'G1', nazwa: 'Gabinet 1', kolejnosc: 1 },
  { id: 'G2', nazwa: 'Gabinet 2', kolejnosc: 2 },
  { id: 'G3', nazwa: 'Gabinet 3', kolejnosc: 3 }
];

function _zapewnijGabinety() {
  const sh = _arkusz('Gabinety', ['ID', 'Nazwa', 'Kolejnosc', 'Aktywny']);
  const rows = sh.getLastRow() >= 2 ? sh.getDataRange().getValues().slice(1) : [];
  const maID = {};
  rows.forEach((r, i) => { maID[String(r[0])] = i + 2; });

  GABINETY_STALE.forEach(g => {
    const wiersz = maID[g.id];
    if (!wiersz) {
      sh.appendRow([g.id, g.nazwa, g.kolejnosc, 'TAK']);
    } else if (String(sh.getRange(wiersz, 4).getValue()).toUpperCase() === 'NIE') {
      // Stałego gabinetu nie da się trwale wycofać — przywracamy go.
      sh.getRange(wiersz, 4).setValue('TAK');
    }
  });
  return sh;
}

// Arkusze grafiku — tworzone leniwie z tego samego powodu.
function _zapewnijArkusz(nazwa, naglowki) {
  const ss = _ss();
  let sh = ss.getSheetByName(nazwa);
  if (!sh) {
    sh = ss.insertSheet(nazwa);
    sh.appendRow(naglowki);
  } else if (sh.getLastRow() === 0) {
    sh.appendRow(naglowki);
  }
  return sh;
}

function _shGrafik() {
  return _zapewnijArkusz('Grafik', ['ID','GabinetID','DzienTygodnia','Typ','OsobaID',
    'Od','Do','AsystaWymagana','AsystaUwaga','Zmodyfikowano']);
}
function _shAsysta() {
  return _zapewnijArkusz('GrafikAsysta', ['ID','BlokID','OsobaID','Od','Do','Zmodyfikowano']);
}
function _shSzablony() {
  return _zapewnijArkusz('GrafikSzablony',
    ['ID','Nazwa','Typ','Od','Do','AsystaWymagana','AsystaUwaga','Zmodyfikowano']);
}

// ── Szablony zmian ────────────────────────────────────────────
// Nazwany, wielokrotnego użytku zestaw godzin (np. „Zmiana poranna",
// „Higienizacja standard") — niezależny od konkretnej osoby czy dnia.
// Zastosowanie szablonu do dnia odbywa się po stronie klienta: pobiera
// pola szablonu, dokłada je do bloków danego dnia i zapisuje przez
// istniejące masterZapiszDzienGrafiku — bez osobnej ścieżki backendu,
// więc walidacja (siatka, kolizje, godziny otwarcia) jest dokładnie taka
// sama, jak przy ręcznej edycji.

function masterGetSzablonyZmian(token) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  const sh = _shSzablony();
  if (sh.getLastRow() < 2) return { ok: true, szablony: [] };
  const szablony = sh.getDataRange().getValues().slice(1).map(r => ({
    id: String(r[0]),
    nazwa: String(r[1]),
    typ: String(r[2]),
    od: _sheetTime(r[3]),
    do: _sheetTime(r[4]),
    asystaWymagana: (r[5] === '' || r[5] == null) ? null : parseInt(r[5], 10),
    asystaUwaga: String(r[6] || '')
  }));
  szablony.sort((a, b) => a.nazwa.localeCompare(b.nazwa, 'pl'));
  return { ok: true, szablony };
}

function masterSaveSzablonZmiany(token, szablon) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  szablon = szablon || {};
  const nazwa = String(szablon.nazwa || '').trim().slice(0, 80);
  if (!nazwa) return { ok: false, msg: 'Podaj nazwę szablonu.' };
  const typ = BLOK_TYPES.indexOf(szablon.typ) !== -1 ? szablon.typ : BLOK_LEKARZ;
  const od = String(szablon.od || '').trim(), do_ = String(szablon.do || '').trim();
  if (!_naSiatce(od) || !_naSiatce(do_)) {
    return { ok: false, msg: 'Godziny co ' + GRAFIK_KROK_MIN + ' minut.' };
  }
  if (_t2m(od) >= _t2m(do_)) return { ok: false, msg: '„Do" musi być późniejsze niż „od".' };

  const sh = _shSzablony();
  const teraz = new Date().toISOString();
  const asystaWymagana = (szablon.asystaWymagana === '' || szablon.asystaWymagana == null)
    ? '' : parseInt(szablon.asystaWymagana, 10);
  const asystaUwaga = String(szablon.asystaUwaga || '').trim().slice(0, 300);

  let id = String(szablon.id || '').trim();
  if (id) {
    const rows = sh.getLastRow() >= 2 ? sh.getDataRange().getValues() : [];
    let wiersz = -1;
    for (let i = 1; i < rows.length; i++) { if (String(rows[i][0]) === id) { wiersz = i + 1; break; } }
    if (wiersz === -1) return { ok: false, msg: 'Nie znaleziono szablonu.' };
    sh.getRange(wiersz, 1, 1, 8).setValues([[id, nazwa, typ, od, do_, asystaWymagana, asystaUwaga, teraz]]);
  } else {
    const rows = sh.getLastRow() >= 2 ? sh.getDataRange().getValues().slice(1) : [];
    id = _nextId(rows.map(r => ({ id: String(r[0]) })), 'SZ');
    sh.appendRow([id, nazwa, typ, od, do_, asystaWymagana, asystaUwaga, teraz]);
  }
  _logAdmin('ZapisSzablonuZmiany', id, nazwa);
  return { ok: true, id };
}

function masterDeleteSzablonZmiany(token, szablonId) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  szablonId = String(szablonId || '').trim();
  const sh = _shSzablony();
  if (sh.getLastRow() < 2) return { ok: false, msg: 'Nie znaleziono szablonu.' };
  const rows = sh.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][0]) === szablonId) {
      sh.deleteRow(i + 1);
      _logAdmin('UsuniecieSzablonuZmiany', szablonId, String(rows[i][1] || ''));
      return { ok: true };
    }
  }
  return { ok: false, msg: 'Nie znaleziono szablonu.' };
}

function _gabinetyAll(includeInactive) {
  const sh = _zapewnijGabinety();
  if (sh.getLastRow() < 2) return [];
  return sh.getDataRange().getValues().slice(1)
    .map(r => ({
      id: String(r[0]),
      nazwa: String(r[1]),
      kolejnosc: parseInt(r[2], 10) || 0,
      aktywny: String(r[3]).toUpperCase() !== 'NIE'
    }))
    .filter(g => g.id && (includeInactive || g.aktywny))
    .sort((a, b) => a.kolejnosc - b.kolejnosc || a.nazwa.localeCompare(b.nazwa));
}

function _grafikBlokiAll() {
  const sh = _shGrafik();
  if (sh.getLastRow() < 2) return [];
  return sh.getDataRange().getValues().slice(1)
    .map(r => ({
      id: String(r[0]),
      gabinetId: String(r[1]),
      dzien: parseInt(r[2], 10),
      typ: String(r[3]),
      osobaId: String(r[4]),
      od: _sheetTime(r[5]),
      do: _sheetTime(r[6]),
      asystaWymagana: (r[7] === '' || r[7] === null || r[7] === undefined) ? null : parseInt(r[7], 10),
      asystaUwaga: String(r[8] || '')
    }))
    .filter(b => b.id && b.gabinetId && GRAFIK_DAYS.indexOf(b.dzien) !== -1);
}

function _grafikAsystaAll() {
  const sh = _shAsysta();
  if (sh.getLastRow() < 2) return [];
  return sh.getDataRange().getValues().slice(1)
    .map(r => ({
      id: String(r[0]),
      blokId: String(r[1]),
      osobaId: String(r[2]),
      od: _sheetTime(r[3]),
      do: _sheetTime(r[4])
    }))
    .filter(a => a.id && a.blokId && a.osobaId);
}

// Personel dostępny do grafiku, pogrupowany. Lekarze nie odbijają się w RCP,
// ale są tu pełnoprawnymi osobami — grafik jest ich głównym miejscem w systemie.
function _grafikPersonel() {
  return _getWorkers()
    .filter(w => String(w[4]).toLowerCase() === 'aktywny')
    .map(_workerToObj);
}

// ── Walidacja ────────────────────────────────────────────────

function _validTime(t) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(t || '').trim());
}

// Oś czasu grafiku dzieli się co 5 minut — pilnujemy tego przy zapisie,
// żeby siatka nie rozjechała się na przypadkowych minutach.
function _naSiatce(t) {
  if (!_validTime(t)) return false;
  return (_t2m(t) % GRAFIK_KROK_MIN) === 0;
}

// Godzina zegarowa z minut, ZAWSZE dwucyfrowa (09:00, nie 9:00).
// To nie jest kosmetyka: <input type="time"> odrzuca wartość bez wiodącego
// zera, a _validTime() po stronie serwera też jej nie przepuści.
function _hhmm(mins) {
  const h = Math.floor(mins / 60), m = mins % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

// Czy zakres [od,do) mieści się w oknie otwarcia kliniki danego dnia.
function _wGodzinachKliniki(dzien, od, do_) {
  const h = GRAFIK_HOURS[dzien];
  if (!h) return false;
  return _t2m(od) >= h.open && _t2m(do_) <= h.close;
}

function _zakresyNachodza(aOd, aDo, bOd, bDo) {
  return _t2m(aOd) < _t2m(bDo) && _t2m(bOd) < _t2m(aDo);
}

function _nextId(rows, prefix) {
  let max = 0;
  rows.forEach(r => {
    const m = String(r.id || r[0]).match(new RegExp('^' + prefix + '(\\d+)$'));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return prefix + String(max + 1).padStart(3, '0');
}

// ── API: pełny odczyt grafiku ────────────────────────────────

function masterGetGrafik(token) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  return _grafikPayload();
}

function _grafikPayload() {
  const gabinety = _gabinetyAll(false);
  const personel = _grafikPersonel();
  const asysta   = _grafikAsystaAll();
  const bloki    = _grafikBlokiAll();

  const byBlok = {};
  asysta.forEach(a => {
    if (!byBlok[a.blokId]) byBlok[a.blokId] = [];
    byBlok[a.blokId].push(a);
  });
  bloki.forEach(b => { b.asysta = byBlok[b.id] || []; });

  const godziny = {};
  GRAFIK_DAYS.forEach(d => {
    const rano = _zmianaGodziny(d, ZMIANA_RANO);
    const popo = _zmianaGodziny(d, ZMIANA_POPO);
    godziny[d] = {
      open: _hhmm(GRAFIK_HOURS[d].open),
      close: _hhmm(GRAFIK_HOURS[d].close),
      nazwa: GRAFIK_DAY_NAMES[d],
      // Gotowe warianty pory pracy — punkt wyjścia, każdy do zmiany.
      zmiany: {
        rano: { od: _hhmm(rano.open), do: _hhmm(rano.close) },
        popo: { od: _hhmm(popo.open), do: _hhmm(popo.close) },
        caly: { od: _hhmm(GRAFIK_HOURS[d].open), do: _hhmm(GRAFIK_HOURS[d].close) }
      }
    };
  });

  const rekomendacje = _grafikRekomendacje({ gabinety, bloki, personel });

  return {
    ok: true,
    gabinety,
    bloki,
    personel,
    godziny,
    dni: GRAFIK_DAYS,
    tagiDostepne: DOCTOR_SPECIALIZATION_TAGS,
    krokMin: GRAFIK_KROK_MIN,
    adnotacje: _adnotacjeAll(),
    adnotacjeTypy: ADNOTACJA_TYPY,
    asystaZew: ASYSTA_ZEW,
    uwagaBrakAsysty: UWAGA_BRAK_ASYSTY,
    rekomendacje
  };
}

// ── API: gabinety ────────────────────────────────────────────

function masterSaveGabinet(token, gabinetId, nazwa, aktywny) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  nazwa = String(nazwa || '').trim();
  if (!nazwa) return { ok: false, msg: 'Podaj nazwę gabinetu.' };

  const sh = _zapewnijGabinety();
  const rows = sh.getDataRange().getValues();

  if (gabinetId) {
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(gabinetId)) {
        sh.getRange(i + 1, 2).setValue(nazwa);
        sh.getRange(i + 1, 4).setValue(aktywny === false ? 'NIE' : 'TAK');
        _logAdmin('EdycjaGabinetu', String(gabinetId), nazwa + (aktywny === false ? ' (wycofany)' : ''));
        return { ok: true, id: String(gabinetId) };
      }
    }
    return { ok: false, msg: 'Gabinet nie istnieje.' };
  }

  const existing = rows.slice(1).map(r => ({ id: String(r[0]) }));
  const id = _nextId(existing, 'G');
  const kolejnosc = rows.length; // nowy na końcu
  sh.appendRow([id, nazwa, kolejnosc, 'TAK']);
  _logAdmin('DodanieGabinetu', id, nazwa);
  return { ok: true, id };
}

// Wycofanie gabinetu nie kasuje jego bloków — po przywróceniu grafik wraca
// w całości. Blokujemy tylko wtedy, gdy zostałby ostatni aktywny gabinet.
function masterRemoveGabinet(token, gabinetId) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  if (GABINETY_STALE.some(g => g.id === String(gabinetId))) {
    return { ok: false, msg: 'To jeden z trzech stałych gabinetów kliniki — nie można go wycofać. ' +
      'Możesz zmienić jego nazwę.' };
  }
  const aktywne = _gabinetyAll(false);
  if (aktywne.length <= 1) {
    return { ok: false, msg: 'Musi zostać co najmniej jeden aktywny gabinet.' };
  }
  return masterSaveGabinet(token, gabinetId,
    (aktywne.find(g => g.id === String(gabinetId)) || {}).nazwa || 'Gabinet', false);
}

// ── API: bloki grafiku ───────────────────────────────────────

function masterSaveGrafikBlok(token, blok) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  blok = blok || {};

  const gabinetId = String(blok.gabinetId || '');
  const dzien = parseInt(blok.dzien, 10);
  const typ = String(blok.typ || '');
  const osobaId = String(blok.osobaId || '');
  const od = String(blok.od || '').trim();
  const do_ = String(blok.do || '').trim();

  if (GRAFIK_DAYS.indexOf(dzien) === -1) return { ok: false, msg: 'Nieprawidłowy dzień tygodnia.' };
  if (BLOK_TYPES.indexOf(typ) === -1) return { ok: false, msg: 'Nieprawidłowy typ bloku.' };
  if (!_validTime(od) || !_validTime(do_)) return { ok: false, msg: 'Godziny w formacie HH:MM.' };
  if (!_naSiatce(od) || !_naSiatce(do_)) {
    return { ok: false, msg: 'Godziny muszą być wielokrotnością ' + GRAFIK_KROK_MIN + ' minut.' };
  }
  if (_t2m(od) >= _t2m(do_)) return { ok: false, msg: 'Godzina „do" musi być późniejsza niż „od".' };

  const gabinet = _gabinetyAll(false).find(g => g.id === gabinetId);
  if (!gabinet) return { ok: false, msg: 'Gabinet nie istnieje lub jest wycofany.' };

  if (!_wGodzinachKliniki(dzien, od, do_)) {
    const h = GRAFIK_HOURS[dzien];
    return { ok: false, msg: 'Poza godzinami otwarcia w tym dniu (' +
      _hhmm(h.open) + '–' + _hhmm(h.close) + ').' };
  }

  const personel = _grafikPersonel();
  const osoba = personel.find(p => p.id === osobaId);
  if (!osoba) return { ok: false, msg: 'Wybierz osobę z listy.' };

  // Do bloku higienizacji wolno przypisać tylko higienistkę; blok lekarski
  // obsadza lekarz. To wprost wynika z wymagań — bez tego rekomendacje
  // liczyłyby obsadę, której realnie nie ma.
  if (typ === BLOK_HIGIENA && osoba.grupa !== GRUPA_HIGIENISTKA) {
    return { ok: false, msg: 'Higienizację może prowadzić tylko higienistka.' };
  }
  if (typ === BLOK_LEKARZ && osoba.grupa !== GRUPA_LEKARZ) {
    return { ok: false, msg: 'Blok lekarski może obsadzić tylko lekarz.' };
  }

  let asystaWymagana = blok.asystaWymagana;
  asystaWymagana = (asystaWymagana === '' || asystaWymagana === null || asystaWymagana === undefined)
    ? null : parseInt(asystaWymagana, 10);
  if (asystaWymagana !== null && (isNaN(asystaWymagana) || asystaWymagana < 0 || asystaWymagana > 4)) {
    return { ok: false, msg: 'Liczba asysty musi być z zakresu 0–4.' };
  }
  const asystaUwaga = String(blok.asystaUwaga || '').trim().slice(0, 500);

  // Odstępstwo od standardu (1 asysta przy lekarzu) musi mieć adnotację —
  // inaczej po miesiącu nikt nie pamięta, czemu ten gabinet działa inaczej.
  const domyslna = (typ === BLOK_LEKARZ) ? 1 : 0;
  if (asystaWymagana !== null && asystaWymagana !== domyslna && !asystaUwaga) {
    return { ok: false, msg: 'Odstępstwo od standardu asysty wymaga adnotacji (dlaczego).' };
  }

  const sh = _shGrafik();
  const rows = sh.getDataRange().getValues();
  const wszystkie = _grafikBlokiAll();
  const blokId = String(blok.id || '');

  // Kolizje: ten sam gabinet w tym samym dniu nie może mieć dwóch nakładających
  // się bloków, a ta sama osoba nie może być w dwóch gabinetach naraz.
  const kolizjaGabinet = wszystkie.find(b =>
    b.id !== blokId && b.gabinetId === gabinetId && b.dzien === dzien &&
    _zakresyNachodza(od, do_, b.od, b.do));
  if (kolizjaGabinet) {
    return { ok: false, msg: 'Ten gabinet ma już obsadę w godzinach ' +
      kolizjaGabinet.od + '–' + kolizjaGabinet.do + ' tego dnia.' };
  }

  const kolizjaOsoba = wszystkie.find(b =>
    b.id !== blokId && b.osobaId === osobaId && b.dzien === dzien &&
    _zakresyNachodza(od, do_, b.od, b.do));
  if (kolizjaOsoba) {
    const g = _gabinetyAll(true).find(x => x.id === kolizjaOsoba.gabinetId);
    return { ok: false, msg: osoba.imie + ' ' + osoba.nazwisko + ' jest w tym czasie w „' +
      ((g && g.nazwa) || kolizjaOsoba.gabinetId) + '" (' + kolizjaOsoba.od + '–' + kolizjaOsoba.do + ').' };
  }

  const teraz = new Date().toISOString();
  const wartosci = [gabinetId, dzien, typ, osobaId, od, do_,
                    asystaWymagana === null ? '' : asystaWymagana, asystaUwaga, teraz];

  if (blokId) {
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === blokId) {
        sh.getRange(i + 1, 2, 1, wartosci.length).setValues([wartosci]);
        _logAdmin('EdycjaBlokuGrafiku', osobaId,
          GRAFIK_DAY_NAMES[dzien] + ' ' + gabinet.nazwa + ' ' + od + '–' + do_);
        return { ok: true, id: blokId };
      }
    }
    return { ok: false, msg: 'Blok nie istnieje.' };
  }

  const id = _nextId(wszystkie, 'B');
  sh.appendRow([id].concat(wartosci));
  _logAdmin('DodanieBlokuGrafiku', osobaId,
    GRAFIK_DAY_NAMES[dzien] + ' ' + gabinet.nazwa + ' ' + od + '–' + do_ + ' (' + typ + ')');
  return { ok: true, id };
}

function masterDeleteGrafikBlok(token, blokId) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  blokId = String(blokId || '');
  if (!blokId) return { ok: false, msg: 'Brak bloku.' };

  const sh = _shGrafik();
  const rows = sh.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][0]) === blokId) {
      sh.deleteRow(i + 1);
      _usunAsysteBloku(blokId);
      _logAdmin('UsuniecieBlokuGrafiku', String(rows[i][4]), blokId);
      return { ok: true };
    }
  }
  return { ok: false, msg: 'Blok nie istnieje.' };
}

function _usunAsysteBloku(blokId) {
  const sh = _shAsysta();
  if (sh.getLastRow() < 2) return;
  const rows = sh.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][1]) === String(blokId)) sh.deleteRow(i + 1);
  }
}

// ── API: asysta ──────────────────────────────────────────────
// Zastępuje całą asystę bloku podaną listą (prostsze i odporniejsze
// niż dokładanie/usuwanie pojedynczo z interfejsu).

function masterSetGrafikAsysta(token, blokId, lista) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  blokId = String(blokId || '');
  const blok = _grafikBlokiAll().find(b => b.id === blokId);
  if (!blok) return { ok: false, msg: 'Blok nie istnieje.' };

  lista = Array.isArray(lista) ? lista : [];
  const personel = _grafikPersonel();
  const wynik = [];
  const uzyte = [];

  for (let i = 0; i < lista.length; i++) {
    const poz = lista[i] || {};
    const osobaId = String(poz.osobaId || '');
    const zew = _czyAsystaZew(osobaId);
    const osoba = zew ? null : personel.find(p => p.id === osobaId);
    if (!zew && !osoba) return { ok: false, msg: 'Wybierz asystę z listy.' };
    if (osoba && osoba.grupa !== GRUPA_ASYSTENTKA && osoba.grupa !== GRUPA_HIGIENISTKA) {
      return { ok: false, msg: osoba.imie + ' ' + osoba.nazwisko + ' nie jest asystentką ani higienistką.' };
    }
    if (uzyte.indexOf(osobaId) !== -1) {
      return { ok: false, msg: 'Ta sama osoba dwa razy w tym samym bloku.' };
    }
    uzyte.push(osobaId);
    const etykieta = zew ? _labelAsystaZew(osobaId) : (osoba.imie + ' ' + osoba.nazwisko);

    const od = String(poz.od || blok.od).trim();
    const do_ = String(poz.do || blok.do).trim();
    if (!_validTime(od) || !_validTime(do_)) return { ok: false, msg: 'Godziny asysty w formacie HH:MM.' };
    if (!_naSiatce(od) || !_naSiatce(do_)) {
      return { ok: false, msg: 'Godziny asysty muszą być wielokrotnością ' + GRAFIK_KROK_MIN + ' minut.' };
    }
    if (_t2m(od) >= _t2m(do_)) return { ok: false, msg: 'Godzina „do" musi być późniejsza niż „od".' };

    // Asysta nie może wystawać poza blok, który obsługuje.
    if (_t2m(od) < _t2m(blok.od) || _t2m(do_) > _t2m(blok.do)) {
      return { ok: false, msg: 'Asysta musi mieścić się w godzinach bloku (' +
        blok.od + '–' + blok.do + ').' };
    }

    // Ta sama asystentka nie może być w dwóch miejscach naraz.
    const inne = _grafikAsystaAll().filter(a => a.blokId !== blokId && a.osobaId === osobaId);
    const blokiMap = {};
    _grafikBlokiAll().forEach(b => { blokiMap[b.id] = b; });
    const konflikt = inne.find(a => {
      const b = blokiMap[a.blokId];
      return b && b.dzien === blok.dzien && _zakresyNachodza(od, do_, a.od, a.do);
    });
    if (konflikt) {
      return { ok: false, msg: etykieta +
        ' asystuje już w tym czasie w innym gabinecie (' + konflikt.od + '–' + konflikt.do + ').' };
    }

    wynik.push({ osobaId, od, do: do_ });
  }

  _usunAsysteBloku(blokId);
  const sh = _shAsysta();
  const teraz = new Date().toISOString();
  let seed = _grafikAsystaAll();
  wynik.forEach(w => {
    const id = _nextId(seed, 'A');
    sh.appendRow([id, blokId, w.osobaId, w.od, w.do, teraz]);
    seed = seed.concat([{ id }]);
  });

  _logAdmin('EdycjaAsystyGrafiku', blokId, wynik.length + ' os.');
  return { ok: true, count: wynik.length };
}

// ============================================================
// SILNIK REKOMENDACJI
// ============================================================
//
// Architektura celowo rozdziela DWIE rzeczy:
//
//   1. KATALOG SCENARIUSZY (GRAFIK_SCENARIUSZE) — ponumerowane wzorce
//      komunikatów z miejscami na dane ({gabinet}, {dzien}, {ile}…).
//      To jest „wiedza domenowa" zapisana deklaratywnie.
//
//   2. EWALUATOR (_grafikRekomendacje) — czyta grafik, wykrywa fakty
//      i dobiera pasujące scenariusze, wypełniając je danymi.
//
// Dzięki temu podpięcie AI w przyszłości nie wymaga przebudowy interfejsu:
// wystarczy, że model zwróci listę obiektów w tym samym formacie
// ({ kod, waga, tytul, tresc, akcja, dzien, gabinetId, blokId }), albo
// że dostanie ten katalog jako bazę wiedzy do rankingowania.
//
// Wagi: 'krytyczna' (dziura w obsłudze pacjenta) → 'wazna' (realna strata
// możliwości) → 'sugestia' (optymalizacja) → 'info' (potwierdzenie, że OK).

// Godziny największego ruchu — ZAŁOŻENIE do strojenia na danych z rejestracji.
// Dopóki nie mamy statystyk wizyt, przyjmujemy popołudnie jako szczyt.
const GRAFIK_SZCZYT = { od: 15 * 60, do: 19 * 60 };

// Progi używane przez reguły (w minutach / godzinach) — jedno miejsce do strojenia.
const G_PROG = {
  lukaDluga: 180,        // ≥ 3 h — pełny blok higienizacyjny
  lukaSrednia: 90,       // 1,5–3 h — krótka higienizacja / konsultacje
  lukaKrotka: 30,        // < 30 min traktujemy jako bufor, nie lukę
  blokKrotki: 120,       // blok < 2 h bywa nieopłacalny
  dzienDlugi: 600,       // > 10 h u jednej osoby
  tydzienDlugi: 2700,    // > 45 h tygodniowo
  przerwaDluga: 180,     // > 3 h przerwy w środku dnia lekarza
  obsadaNiska: 0.5,      // < 50 % wykorzystania okna gabinetu
  obsadaBardzoNiska: 0.25,
  higienizacjeMin: 3     // minimalna sensowna liczba bloków higieny w tygodniu
};

// Specjalizacje, których brak w grafiku realnie boli pacjenta.
const G_TAGI_KLUCZOWE = [
  'Endodoncja', 'Chirurgia stomatologiczna', 'Protetyka',
  'Pedodoncja (dzieci)', 'Ortodoncja', 'Periodontologia',
  'Implantologia', 'Stomatologia zachowawcza'
];

const GRAFIK_SCENARIUSZE = [
  // ── A. Puste sloty i luki w obsadzie (1–22) ──────────────────
  { kod:'A01', kat:'Puste sloty', waga:'wazna',      tytul:'Gabinet pusty przez cały dzień',
    tresc:'{gabinet} nie ma w {dzien} żadnej obsady — {okno} stoi bezużyteczne. To {ile} straconej zdolności przyjmowania pacjentów.',
    akcja:'Wstaw blok lekarski lub higienizację, albo świadomie zamknij ten gabinet w tym dniu.' },
  { kod:'A02', kat:'Puste sloty', waga:'wazna',      tytul:'Długa luka — idealna na higienizację',
    tresc:'{gabinet}, {dzien}: pusto {od}–{do} ({ile}). To mieści około {wizyt} wizyt higienizacyjnych.',
    akcja:'Wstaw blok higienizacji. Wolne w tym czasie: {kandydaci}.' },
  { kod:'A03', kat:'Puste sloty', waga:'sugestia',   tytul:'Średnia luka — krótka higienizacja lub konsultacje',
    tresc:'{gabinet}, {dzien}: pusto {od}–{do} ({ile}). Za krótko na pełny blok zabiegowy, w sam raz na higienizację lub konsultacje.',
    akcja:'Wstaw krótki blok. Wolne w tym czasie: {kandydaci}.' },
  { kod:'A04', kat:'Puste sloty', waga:'info',       tytul:'Krótka przerwa — zostaw jako bufor',
    tresc:'{gabinet}, {dzien}: przerwa {od}–{do} ({ile}). Tyle wystarcza na dezynfekcję i przygotowanie gabinetu.',
    akcja:'Nic nie rób — ta przerwa pracuje na jakość, nie jest stratą.' },
  { kod:'A05', kat:'Puste sloty', waga:'wazna',      tytul:'Luka wypada w godzinach największego ruchu',
    tresc:'{gabinet}, {dzien}: pusto {od}–{do}, czyli w szczycie ({szczyt}). Tu strata jest najdotkliwsza — o tej porze pacjenci najczęściej chcą wizyt.',
    akcja:'Priorytetowo obsadź ten slot. Wolne w tym czasie: {kandydaci}.' },
  { kod:'A06', kat:'Puste sloty', waga:'wazna',      tytul:'Luka na otwarciu — poproś o wcześniejszy start',
    tresc:'{gabinet}, {dzien}: obsada zaczyna się dopiero o {start}, a klinika otwiera o {otwarcie}. Pierwsze {ile} gabinet stoi pusty.',
    akcja:'Poproś {lekarz} o start o {otwarcie} albo wstaw tu higienizację — poranek dobrze się sprzedaje pacjentom przed pracą.' },
  { kod:'A07', kat:'Puste sloty', waga:'wazna',      tytul:'Luka na zamknięciu — poproś o wydłużenie',
    tresc:'{gabinet}, {dzien}: obsada kończy się o {koniec}, a klinika pracuje do {zamkniecie}. Ostatnie {ile} gabinet stoi pusty.',
    akcja:'Poproś {lekarz} o wydłużenie do {zamkniecie} — późne godziny to najczęściej proszony termin przez pacjentów pracujących.' },
  { kod:'A08', kat:'Puste sloty', waga:'sugestia',   tytul:'Lukę może wypełnić wolny lekarz',
    tresc:'{gabinet}, {dzien}: pusto {od}–{do}. {lekarz} nie ma w tym czasie żadnego przypisania i mógłby wejść bez kolizji.',
    akcja:'Zaproponuj {lekarz} ten slot — nie koliduje z jego innymi blokami.' },
  { kod:'A09', kat:'Puste sloty', waga:'krytyczna',  tytul:'Luka bez żadnych wolnych ludzi',
    tresc:'{gabinet}, {dzien}: pusto {od}–{do}, ale nikt z zespołu nie jest w tym czasie wolny. To nie jest problem grafiku — to brak rąk.',
    akcja:'Przesuń kogoś z innego gabinetu albo zaplanuj rekrutację. Samo układanie grafiku tego nie rozwiąże.' },
  { kod:'A10', kat:'Puste sloty', waga:'sugestia',   tytul:'Gabinet nieużywany przez cały tydzień',
    tresc:'{gabinet} nie ma ani jednego bloku w całym tygodniu. Utrzymanie nieużywanego gabinetu to koszt bez przychodu.',
    akcja:'Obsadź go, przeznacz na higienizację, albo wycofaj z listy gabinetów, żeby nie zaburzał statystyk.' },
  { kod:'A11', kat:'Puste sloty', waga:'sugestia',   tytul:'Dzień mocno niedoobsadzony',
    tresc:'{dzien}: obsadzone tylko {obsadzone} z {wszystkie} gabinetów. Reszta stoi pusta cały dzień.',
    akcja:'Rozważ skonsolidowanie pracy w mniejszej liczbie dni albo dobranie obsady na ten dzień.' },
  { kod:'A12', kat:'Puste sloty', waga:'krytyczna',  tytul:'Cała klinika pusta w dniu roboczym',
    tresc:'{dzien}: żaden gabinet nie ma obsady, a klinika ma być czynna {okno}.',
    akcja:'Albo obsadź ten dzień, albo świadomie ogłoś go dniem wolnym — pacjenci nie mogą trafić na zamknięte drzwi bez zapowiedzi.' },
  { kod:'A13', kat:'Puste sloty', waga:'sugestia',   tytul:'Wiele krótkich luk — grafik poszatkowany',
    tresc:'{gabinet}, {dzien}: {liczba} osobnych przerw, łącznie {ile}. Poszatkowany dzień męczy zespół i trudno go sprzedać rejestracji.',
    akcja:'Zsuń bloki tak, żeby powstała jedna dłuższa, użyteczna przerwa zamiast kilku bezużytecznych.' },
  { kod:'A14', kat:'Puste sloty', waga:'sugestia',   tytul:'Luka do wypełnienia przez higienistkę',
    tresc:'{gabinet}, {dzien}: pusto {od}–{do} ({ile}). {higienistka} jest w tym czasie wolna.',
    akcja:'Wstaw higienizację z {higienistka} — to najprostszy sposób na zamianę pustego gabinetu w przychód.' },
  { kod:'A15', kat:'Puste sloty', waga:'sugestia',   tytul:'Luka tuż przed końcem dnia',
    tresc:'{gabinet}, {dzien}: ostatnie {ile} przed zamknięciem stoi puste.',
    akcja:'Krótka higienizacja albo przesunięcie ostatniego pacjenta domknie dzień bez pustego przebiegu.' },
  { kod:'A16', kat:'Puste sloty', waga:'sugestia',   tytul:'Luka wypada w porze lunchu',
    tresc:'{gabinet}, {dzien}: przerwa {od}–{do} wypada w typowej porze przerwy obiadowej.',
    akcja:'Jeśli to zaplanowana przerwa — zostaw. Jeśli nie, to najłatwiejsze miejsce na dołożenie krótkiej wizyty.' },
  { kod:'A17', kat:'Puste sloty', waga:'wazna',      tytul:'Luka większa niż sam blok pracy',
    tresc:'{gabinet}, {dzien}: gabinet pracuje {praca}, a stoi pusty {ile}. Więcej przestoju niż pracy.',
    akcja:'Albo zagęść obsadę, albo tego dnia w ogóle nie otwieraj tego gabinetu.' },
  { kod:'A18', kat:'Puste sloty', waga:'sugestia',   tytul:'Poranek wolny w całej klinice',
    tresc:'{dzien}: o {otwarcie} żaden gabinet nie jest obsadzony. Klinika otwiera się „na pusto".',
    akcja:'Obsadź przynajmniej jeden gabinet od otwarcia — inaczej rejestracja nie ma czego sprzedawać na wczesne godziny.' },
  { kod:'A19', kat:'Puste sloty', waga:'wazna',      tytul:'Ostatnia godzina bez obsady w całej klinice',
    tresc:'{dzien}: po {do} żaden gabinet nie pracuje, mimo że klinika jest czynna do {zamkniecie}.',
    akcja:'Zostaw jeden gabinet czynny do końca — późne terminy to najczęstsza prośba pacjentów pracujących.' },
  { kod:'A20', kat:'Puste sloty', waga:'sugestia',   tytul:'Luka możliwa do zamknięcia przesunięciem sąsiada',
    tresc:'{gabinet}, {dzien}: luka {od}–{do} sąsiaduje z blokiem {lekarz}. Drobne przesunięcie zlikwidowałoby przestój.',
    akcja:'Zapytaj {lekarz}, czy może przesunąć swój blok o {ile} — to tańsze niż szukanie nowej osoby.' },
  { kod:'A21', kat:'Puste sloty', waga:'info',       tytul:'Gabinet obsadzony w pełnym oknie',
    tresc:'{gabinet}, {dzien}: obsada pokrywa całe okno {okno}, bez przestojów.',
    akcja:'Nic nie trzeba robić — tak ma wyglądać dobrze ułożony dzień.' },
  { kod:'A22', kat:'Puste sloty', waga:'sugestia',   tytul:'Luka powtarza się w tym samym miejscu co tydzień',
    tresc:'{gabinet}: przerwa {od}–{do} powtarza się w {dni}. Powtarzalna luka to powtarzalna strata.',
    akcja:'Rozwiąż ją raz, systemowo — stały blok higienizacji w tym oknie zamyka temat na stałe.' },

  // ── B. Asysta (23–44) ────────────────────────────────────────
  { kod:'B01', kat:'Asysta', waga:'krytyczna', tytul:'Lekarz bez asysty',
    tresc:'{gabinet}, {dzien} {od}–{do}: {lekarz} pracuje bez przypisanej asysty. Standardem jest jeden lekarz + jedna asystentka.',
    akcja:'Przypisz asystę. Wolne w tym czasie: {kandydaci}.' },
  { kod:'B02', kat:'Asysta', waga:'krytyczna', tytul:'Brak asysty i brak wolnych asystentek',
    tresc:'{gabinet}, {dzien} {od}–{do}: {lekarz} nie ma asysty, a wszystkie asystentki są w tym czasie zajęte gdzie indziej.',
    akcja:'Przesuń asystę z mniej obciążonego gabinetu albo skróć ten blok. Dokładanie pracy bez asysty odbije się na jakości.' },
  { kod:'B02b', kat:'Asysta', waga:'krytyczna', tytul:'Brak osób do asysty w zespole',
    tresc:'{gabinet}, {dzien} {od}–{do}: {lekarz} nie ma asysty, bo w systemie nie ma ani jednej aktywnej asystentki ani higienistki.',
    akcja:'Dodaj asystentki lub higienistki w zakładce Zespół albo świadomie oznacz te bloki jako pracę bez asysty z adnotacją.' },
  { kod:'B03', kat:'Asysta', waga:'wazna',     tytul:'Asysta pokrywa tylko część bloku',
    tresc:'{gabinet}, {dzien}: {lekarz} pracuje {od}–{do}, a asysta obejmuje tylko {pokrycie}. Bez asysty zostaje {brak}.',
    akcja:'Wydłuż asystę albo dobierz drugą osobę na pozostałą część bloku.' },
  { kod:'B04', kat:'Asysta', waga:'wazna',     tytul:'Asysta wchodzi po rozpoczęciu bloku',
    tresc:'{gabinet}, {dzien}: {lekarz} zaczyna o {od}, a asysta dopiero o {asystaOd}. Pierwsze {ile} lekarz jest sam.',
    akcja:'Przesuń start asysty na {od} — początek dnia to przygotowanie gabinetu, wtedy asysta jest najbardziej potrzebna.' },
  { kod:'B05', kat:'Asysta', waga:'wazna',     tytul:'Asysta kończy przed końcem bloku',
    tresc:'{gabinet}, {dzien}: asysta kończy o {asystaDo}, a {lekarz} pracuje do {do}. Ostatnie {ile} bez asysty.',
    akcja:'Wydłuż asystę do {do} albo skróć blok lekarza — końcówka dnia to sprzątanie i dezynfekcja.' },
  { kod:'B06', kat:'Asysta', waga:'sugestia',  tytul:'Więcej asysty niż standard, bez adnotacji',
    tresc:'{gabinet}, {dzien} {od}–{do}: przypisano {liczba} asystentki przy jednym lekarzu, bez wyjaśnienia.',
    akcja:'Dopisz adnotację (np. zabieg wymagający dwóch par rąk) albo zwolnij jedną osobę do innego gabinetu.' },
  { kod:'B07', kat:'Asysta', waga:'info',      tytul:'Odstępstwo od standardu asysty — opisane',
    tresc:'{gabinet}, {dzien} {od}–{do}: zaplanowano {liczba} asysty. Powód: {uwaga}',
    akcja:'Nic nie trzeba robić — odstępstwo jest świadome i udokumentowane.' },
  { kod:'B08', kat:'Asysta', waga:'wazna',     tytul:'Zaplanowano więcej asysty, niż przypisano',
    tresc:'{gabinet}, {dzien} {od}–{do}: blok wymaga {wymagana} asysty, a przypisano {liczba}.',
    akcja:'Uzupełnij brakującą asystę albo obniż wymaganie, jeśli sytuacja się zmieniła.' },
  { kod:'B09', kat:'Asysta', waga:'wazna',     tytul:'Asystentka przeciążona w jednym dniu',
    tresc:'{osoba} ma w {dzien} {ile} asysty — powyżej progu {prog}. Zmęczona asysta to wolniejsza praca całego gabinetu.',
    akcja:'Rozłóż część jej bloków na inne osoby.' },
  { kod:'B10', kat:'Asysta', waga:'sugestia',  tytul:'Asystentka biega między gabinetami',
    tresc:'{osoba} obsługuje w {dzien} {liczba} różnych gabinetów. Każde przejście to strata czasu i ryzyko pomyłki.',
    akcja:'Spróbuj przypisać ją do jednego gabinetu na dłuższy blok.' },
  { kod:'B11', kat:'Asysta', waga:'sugestia',  tytul:'Nierówne obciążenie asysty w tygodniu',
    tresc:'Rozrzut obciążenia asysty jest duży: {najwiecej} u {osobaMax} wobec {najmniej} u {osobaMin}.',
    akcja:'Wyrównaj przypisania — nierówny podział jest najczęstszym powodem napięć w zespole.' },
  { kod:'B12', kat:'Asysta', waga:'sugestia',  tytul:'Asystentka bez żadnego przypisania',
    tresc:'{osoba} jest aktywną asystentką, ale nie ma w grafiku ani jednego bloku.',
    akcja:'Przypisz ją do bloku albo sprawdź, czy nie powinna trafić do archiwum zespołu.' },
  { kod:'B13', kat:'Asysta', waga:'krytyczna', tytul:'Szczyt bez wolnej asysty',
    tresc:'{dzien}, godziny szczytu ({szczyt}): wszystkie asystentki są zajęte, a {liczba} bloków lekarskich nadal nie ma pełnej obsady.',
    akcja:'To wąskie gardło całego dnia — przesuń asystę z godzin spokojniejszych albo ogranicz liczbę równoległych gabinetów.' },
  { kod:'B14', kat:'Asysta', waga:'sugestia',  tytul:'Asysta bez przerwy przez cały dzień',
    tresc:'{osoba} ma w {dzien} ciągły blok {ile} bez ani jednej przerwy.',
    akcja:'Wstaw przerwę — praca bez przerwy przy fotelu jest nie do utrzymania na dłuższą metę.' },
  { kod:'B15', kat:'Asysta', waga:'info',      tytul:'Higienizacja bez asysty — zgodnie ze standardem',
    tresc:'{gabinet}, {dzien} {od}–{do}: blok higienizacji {osoba} bez asysty.',
    akcja:'Nic nie trzeba robić — higienistka pracuje samodzielnie.' },
  { kod:'B16', kat:'Asysta', waga:'sugestia',  tytul:'Asysta przypisana do higienizacji',
    tresc:'{gabinet}, {dzien} {od}–{do}: do bloku higienizacji przypisano asystę ({liczba}).',
    akcja:'Jeśli to nie zabieg wymagający wsparcia, zwolnij tę osobę do gabinetu lekarskiego.' },
  { kod:'B17', kat:'Asysta', waga:'wazna',     tytul:'Ta sama asysta rozpisana zbyt ciasno',
    tresc:'{osoba} kończy w jednym gabinecie o {do} i zaczyna w drugim o {od} — bez zapasu na przejście.',
    akcja:'Zostaw kilka minut marginesu, inaczej opóźnienie z jednego gabinetu przeniesie się na drugi.' },
  { kod:'B18', kat:'Asysta', waga:'sugestia',  tytul:'Blok lekarski krótszy niż asysta',
    tresc:'{gabinet}, {dzien}: asysta jest zaplanowana szerzej niż blok lekarza ({od}–{do}).',
    akcja:'Dopasuj godziny asysty do bloku albo wykorzystaj jej nadmiarowy czas w innym gabinecie.' },
  { kod:'B19', kat:'Asysta', waga:'wazna',     tytul:'Dzień z lekarzami bez pełnej asysty',
    tresc:'{dzien}: {liczba} z {wszystkie} bloków lekarskich nie ma pełnego pokrycia asystą.',
    akcja:'Zacznij od bloków w godzinach szczytu — tam brak asysty kosztuje najwięcej.' },
  { kod:'B20', kat:'Asysta', waga:'info',      tytul:'Pełne pokrycie asystą',
    tresc:'{dzien}: każdy blok lekarski ma asystę na całej długości.',
    akcja:'Nic nie trzeba robić — ten dzień jest obsadzony wzorcowo.' },

  // ── C. Obciążenie i czas pracy lekarza (45–60) ───────────────
  { kod:'C01', kat:'Obciążenie', waga:'wazna',     tytul:'Bardzo długi dzień lekarza',
    tresc:'{osoba} ma w {dzien} {ile} pracy przy fotelu — powyżej progu {prog}.',
    akcja:'Skróć blok albo rozłóż go na dwa dni. Po tylu godzinach precyzja spada, a to praca precyzyjna.' },
  { kod:'C02', kat:'Obciążenie', waga:'wazna',     tytul:'Przekroczony tygodniowy limit',
    tresc:'{osoba} ma w tygodniu {ile} — powyżej progu {prog}.',
    akcja:'Zdejmij jeden blok albo rozłóż obciążenie na kogoś innego.' },
  { kod:'C03', kat:'Obciążenie', waga:'sugestia',  tytul:'Praca sześć dni w tygodniu',
    tresc:'{osoba} pracuje we wszystkie {liczba} dni robocze kliniki, łącznie z sobotą.',
    akcja:'Zaplanuj jej dzień wolny — brak dnia przerwy to najkrótsza droga do wypalenia i rotacji.' },
  { kod:'C04', kat:'Obciążenie', waga:'sugestia',  tytul:'Bardzo krótki blok lekarski',
    tresc:'{gabinet}, {dzien}: {osoba} ma blok {od}–{do} ({ile}). Poniżej {prog} przygotowanie gabinetu zjada dużą część czasu.',
    akcja:'Wydłuż blok albo połącz go z innym dniem — krótkie wejścia są nieopłacalne.' },
  { kod:'C05', kat:'Obciążenie', waga:'sugestia',  tytul:'Lekarz obecny tylko raz w tygodniu',
    tresc:'{osoba} ma tylko jeden blok w tygodniu ({dzien} {od}–{do}).',
    akcja:'Przy takiej dostępności trudno prowadzić leczenie wieloetapowe. Rozważ drugi termin albo przypisanie mu tylko krótkich procedur.' },
  { kod:'C06', kat:'Obciążenie', waga:'wazna',     tytul:'Lekarz w ogóle nieobecny w grafiku',
    tresc:'{osoba} jest aktywnym lekarzem, ale nie ma ani jednego bloku w tygodniu.',
    akcja:'Przypisz mu terminy albo przenieś do archiwum — nieużywana pozycja zaburza planowanie i rekomendacje.' },
  { kod:'C07', kat:'Obciążenie', waga:'sugestia',  tytul:'Długa przerwa w środku dnia',
    tresc:'{osoba} ma w {dzien} przerwę {od}–{do} ({ile}) między swoimi blokami.',
    akcja:'Zsuń bloki albo wypełnij przerwę — sam gabinet też w tym czasie stoi.' },
  { kod:'C08', kat:'Obciążenie', waga:'sugestia',  tytul:'Lekarz w dwóch gabinetach tego samego dnia',
    tresc:'{osoba} pracuje w {dzien} w {liczba} różnych gabinetach.',
    akcja:'Jeśli to nie jest konieczne, zostaw go w jednym — przenoszenie sprzętu i dokumentacji kosztuje czas.' },
  { kod:'C09', kat:'Obciążenie', waga:'sugestia',  tytul:'Lekarz pracuje wyłącznie poza szczytem',
    tresc:'{osoba} ma wszystkie bloki poza godzinami największego ruchu ({szczyt}).',
    akcja:'Przesuń część jego godzin w szczyt — tam obłożenie fotela jest najwyższe.' },
  { kod:'C10', kat:'Obciążenie', waga:'info',      tytul:'Zrównoważone obciążenie',
    tresc:'{osoba}: {ile} w tygodniu, rozłożone na {liczba} dni.',
    akcja:'Nic nie trzeba robić — to zdrowy rozkład.' },
  { kod:'C11', kat:'Obciążenie', waga:'sugestia',  tytul:'Duży rozrzut obciążenia między lekarzami',
    tresc:'Najbardziej obciążony lekarz ma {najwiecej} ({osobaMax}), najmniej — {najmniej} ({osobaMin}).',
    akcja:'Wyrównaj, jeśli to nie wynika z umów. Nierówny podział bywa źródłem konfliktów.' },
  { kod:'C12', kat:'Obciążenie', waga:'wazna',     tytul:'Blok dłuższy niż okno otwarcia',
    tresc:'{gabinet}, {dzien}: blok {od}–{do} wykracza poza godziny otwarcia ({okno}).',
    akcja:'Popraw godziny bloku — inaczej pacjent dostanie termin, gdy klinika jest zamknięta.' },
  { kod:'C13', kat:'Obciążenie', waga:'sugestia',  tytul:'Lekarz zaczyna bardzo wcześnie po długim dniu',
    tresc:'{osoba} kończy w {dzienPoprzedni} o {do}, a w {dzien} zaczyna o {od} — krótka doba.',
    akcja:'Przesuń jeden z tych bloków, żeby zostawić sensowny odpoczynek.' },
  { kod:'C14', kat:'Obciążenie', waga:'sugestia',  tytul:'Cały tydzień skondensowany w dwóch dniach',
    tresc:'{osoba} ma {ile} tygodniowo, ale tylko w {liczba} dniach.',
    akcja:'Rozłóż to na trzy dni — krótsze dni są wydajniejsze i mniej ryzykowne przy pracy precyzyjnej.' },

  // ── D. Specjalizacje i dopasowanie (61–78) ───────────────────
  { kod:'D01', kat:'Specjalizacje', waga:'wazna',     tytul:'Brak pokrycia specjalizacji w tygodniu',
    tresc:'W całym tygodniu nikt w grafiku nie pokrywa specjalizacji: {tag}.',
    akcja:'Zaplanuj lekarza z tą specjalizacją albo świadomie kieruj tych pacjentów na zewnątrz.' },
  { kod:'D02', kat:'Specjalizacje', waga:'sugestia',  tytul:'Specjalizacja tylko w jednym dniu',
    tresc:'{tag} jest dostępna wyłącznie w {dni}. Pacjent z takim problemem w inny dzień czeka do następnego tygodnia.',
    akcja:'Rozłóż tę specjalizację na co najmniej dwa dni.' },
  { kod:'D03', kat:'Specjalizacje', waga:'wazna',     tytul:'Specjalizację pokrywa tylko jedna osoba',
    tresc:'{tag} zależy wyłącznie od jednej osoby: {osoba}. Jej nieobecność zamyka temat dla całej kliniki.',
    akcja:'Zbuduj zastępstwo — druga osoba z tą specjalizacją albo stała współpraca z kimś z zewnątrz.' },
  { kod:'D04', kat:'Specjalizacje', waga:'sugestia',  tytul:'Lekarz bez uzupełnionych specjalizacji',
    tresc:'{osoba} nie ma przypisanego żadnego tagu specjalizacji. Bez tego rekomendacje nie potrafią dopasować go do slotu.',
    akcja:'Uzupełnij tagi w zakładce Zespół — to warunek sensownego dopasowywania obsady.' },
  { kod:'D05', kat:'Specjalizacje', waga:'sugestia',  tytul:'Dwie te same specjalizacje równolegle',
    tresc:'{dzien} {od}–{do}: {liczba} lekarzy z tą samą specjalizacją ({tag}) pracuje jednocześnie, a {brakTag} nie jest w tym czasie dostępna.',
    akcja:'Rozsuń ich na różne dni i zrób miejsce dla brakującej specjalizacji.' },
  { kod:'D06', kat:'Specjalizacje', waga:'sugestia',  tytul:'Dopasowanie kandydata do luki',
    tresc:'{gabinet}, {dzien} {od}–{do}: {osoba} pasuje tu najlepiej — jest wolny i pokrywa {tag}, której tego dnia brakuje.',
    akcja:'Zaproponuj mu ten slot — to najlepsze dopasowanie w zespole.' },
  { kod:'D07', kat:'Specjalizacje', waga:'wazna',     tytul:'Sobota bez kluczowej specjalizacji',
    tresc:'W sobotę nie ma pokrycia: {tag}. Sobota to dzień pacjentów pilnych i pracujących.',
    akcja:'Zaplanuj tę specjalizację w sobotę albo jasno zakomunikuj rejestracji, czego w sobotę nie robimy.' },
  { kod:'D08', kat:'Specjalizacje', waga:'sugestia',  tytul:'Brak pokrycia stomatologii dziecięcej po południu',
    tresc:'Pedodoncja nie jest dostępna w godzinach popołudniowych, a to jedyna pora, kiedy dzieci są po szkole.',
    akcja:'Przesuń blok pedodontyczny na popołudnie — inaczej ci pacjenci nie mają jak przyjść.' },
  { kod:'D09', kat:'Specjalizacje', waga:'sugestia',  tytul:'Wąska specjalizacja w szczycie',
    tresc:'{osoba} ({tag}) zajmuje gabinet w szczycie ({szczyt}), a to specjalizacja o mniejszym wolumenie.',
    akcja:'W szczycie postaw procedury o największym obrocie, a wąskie specjalizacje przenieś poza szczyt.' },
  { kod:'D10', kat:'Specjalizacje', waga:'info',      tytul:'Pełne pokrycie kluczowych specjalizacji',
    tresc:'Wszystkie kluczowe specjalizacje ({liczba}) mają pokrycie w tygodniu.',
    akcja:'Nic nie trzeba robić — profil kliniki jest domknięty.' },
  { kod:'D11', kat:'Specjalizacje', waga:'sugestia',  tytul:'Brak higienizacji mimo dostępnych higienistek',
    tresc:'W grafiku jest {liczba} bloków higienizacji, a w zespole {ile} higienistek.',
    akcja:'Higienizacja to najstabilniejszy strumień przychodu i naturalne wejście dla nowych pacjentów. Dołóż bloki.' },
  { kod:'D12', kat:'Specjalizacje', waga:'sugestia',  tytul:'Specjalizacja bez wsparcia zabiegowego',
    tresc:'{tag} jest w grafiku, ale w tych godzinach nie ma pokrycia dla {brakTag}, które zwykle jest jej naturalnym uzupełnieniem.',
    akcja:'Zestaw te specjalizacje w tych samych godzinach — pacjent załatwia wszystko za jednym razem.' },
  { kod:'D13', kat:'Specjalizacje', waga:'sugestia',  tytul:'Konsultacje bez wolnego terminu w tym samym tygodniu',
    tresc:'Konsultacje są dostępne, ale gabinety w kolejnych dniach są pełne — pacjent nie ma gdzie wrócić na leczenie.',
    akcja:'Zostaw rezerwę w grafiku na leczenie po konsultacji, inaczej konsultacje nie konwertują.' },
  { kod:'D14', kat:'Specjalizacje', waga:'sugestia',  tytul:'Nadmiar jednej specjalizacji w tygodniu',
    tresc:'{tag} zajmuje {ile} tygodniowo — najwięcej ze wszystkich. Sprawdź, czy popyt to uzasadnia.',
    akcja:'Jeśli terminy się nie zapełniają, część tych godzin przenieś na specjalizacje z kolejką.' },
  { kod:'D15', kat:'Specjalizacje', waga:'wazna',     tytul:'Brak lekarza pierwszego kontaktu w dniu roboczym',
    tresc:'{dzien}: nikt nie pokrywa stomatologii zachowawczej ani konsultacji. To domyślne wejście dla nowego pacjenta.',
    akcja:'Zapewnij tego dnia przynajmniej jednego lekarza ogólnego — inaczej nowi pacjenci nie mają gdzie trafić.' },
  { kod:'D16', kat:'Specjalizacje', waga:'sugestia',  tytul:'Specjalizacja przypisana, ale niewykorzystana',
    tresc:'{osoba} ma tag {tag}, ale w tym tygodniu pracuje wyłącznie w blokach, gdzie ta kompetencja się nie przydaje.',
    akcja:'Zaplanuj mu blok pod tę specjalizację — to niewykorzystany zasób.' },

  // ── E. Sobota (79–86) ────────────────────────────────────────
  { kod:'E01', kat:'Sobota', waga:'wazna',     tytul:'Sobota bez żadnej obsady',
    tresc:'Sobota ({okno}) nie ma ani jednego bloku w żadnym gabinecie.',
    akcja:'Obsadź sobotę albo formalnie ją zamknij. Sobota to dzień pacjentów, którzy nie mogą przyjść w tygodniu.' },
  { kod:'E02', kat:'Sobota', waga:'sugestia',  tytul:'Sobota tylko z jednym gabinetem',
    tresc:'W sobotę pracuje tylko {gabinet}, pozostałe {liczba} stoją puste.',
    akcja:'Jeśli sobotnie terminy szybko się zapełniają, otwórz drugi gabinet.' },
  { kod:'E03', kat:'Sobota', waga:'sugestia',  tytul:'Sobotni blok nie pokrywa całego okna',
    tresc:'{gabinet}, sobota: obsada {od}–{do}, a klinika jest czynna {okno}.',
    akcja:'Wydłuż blok do pełnego okna — sobota jest krótka, każda godzina się liczy.' },
  { kod:'E04', kat:'Sobota', waga:'krytyczna', tytul:'Sobotni lekarz bez asysty',
    tresc:'Sobota, {gabinet} {od}–{do}: {lekarz} pracuje bez asysty.',
    akcja:'Zapewnij asystę również w sobotę — mniejsza obsada nie zmienia wymagań zabiegowych.' },
  { kod:'E05', kat:'Sobota', waga:'sugestia',  tytul:'Sobota wyłącznie higienizacyjna',
    tresc:'W sobotę zaplanowano wyłącznie higienizację, bez lekarza.',
    akcja:'Dodaj lekarza — pacjent z bólem w sobotę nie ma gdzie trafić, a to najczęstszy sobotni telefon.' },
  { kod:'E06', kat:'Sobota', waga:'info',      tytul:'Sobota obsadzona kompletnie',
    tresc:'Sobota: {liczba} gabinetów obsadzonych w pełnym oknie {okno}, z asystą.',
    akcja:'Nic nie trzeba robić.' },
  { kod:'E07', kat:'Sobota', waga:'sugestia',  tytul:'Ten sam lekarz w każdą sobotę',
    tresc:'{osoba} jest jedyną osobą obsadzającą soboty.',
    akcja:'Wprowadź rotację sobót — inaczej ta osoba nigdy nie ma pełnego weekendu.' },

  // ── F. Godziny brzegowe (87–96) ──────────────────────────────
  { kod:'F01', kat:'Godziny brzegowe', waga:'sugestia', tytul:'Późny start względem otwarcia',
    tresc:'{gabinet}, {dzien}: pierwszy blok dopiero o {od}, klinika otwiera o {otwarcie}.',
    akcja:'Przesuń start na otwarcie albo wstaw wcześniej krótką higienizację.' },
  { kod:'F02', kat:'Godziny brzegowe', waga:'sugestia', tytul:'Wczesne zamknięcie gabinetu',
    tresc:'{gabinet}, {dzien}: ostatni blok kończy o {do}, klinika pracuje do {zamkniecie}.',
    akcja:'Wydłuż obsadę albo skróć oficjalne godziny tego gabinetu, żeby nie obiecywać terminów, których nie ma.' },
  { kod:'F03', kat:'Godziny brzegowe', waga:'wazna',    tytul:'Klinika otwarta, ale nikt nie pracuje o otwarciu',
    tresc:'{dzien} o {otwarcie}: żaden gabinet nie ma obsady.',
    akcja:'Obsadź przynajmniej jeden gabinet od otwarcia — inaczej pierwsza godzina to czysty koszt.' },
  { kod:'F04', kat:'Godziny brzegowe', waga:'wazna',    tytul:'Klinika otwarta, ale nikt nie pracuje na zamknięciu',
    tresc:'{dzien} przed {zamkniecie}: żaden gabinet nie ma obsady.',
    akcja:'Zostaw jeden gabinet do końca — późne terminy to najczęstsza prośba pacjentów.' },
  { kod:'F05', kat:'Godziny brzegowe', waga:'sugestia', tytul:'Tylko jeden gabinet na zamknięciu',
    tresc:'{dzien}: ostatnią godzinę obsługuje wyłącznie {gabinet}.',
    akcja:'Jeśli późne terminy się zapełniają, dołóż drugi gabinet na końcówkę dnia.' },
  { kod:'F06', kat:'Godziny brzegowe', waga:'sugestia', tytul:'Wszystkie gabinety kończą o tej samej godzinie',
    tresc:'{dzien}: cała klinika kończy jednocześnie o {do}. Rejestracja i sprzątanie dostają skumulowany ruch.',
    akcja:'Rozsuń końce bloków o 15–30 minut — wyjście pacjentów rozłoży się płynniej.' },
  { kod:'F07', kat:'Godziny brzegowe', waga:'sugestia', tytul:'Wszystkie gabinety startują jednocześnie',
    tresc:'{dzien}: wszystkie gabinety zaczynają o {od} — kumulacja przy rejestracji na otwarciu.',
    akcja:'Rozsuń starty, żeby rejestracja obsłużyła pacjentów bez kolejki.' },
  { kod:'F08', kat:'Godziny brzegowe', waga:'info',     tytul:'Płynne pokrycie od otwarcia do zamknięcia',
    tresc:'{dzien}: klinika ma ciągłe pokrycie {okno} bez dziur na brzegach.',
    akcja:'Nic nie trzeba robić.' },

  // ── G. Ciągłość i fragmentacja (97–104) ──────────────────────
  { kod:'G01', kat:'Ciągłość', waga:'sugestia', tytul:'Dużo zmian obsady w jednym gabinecie',
    tresc:'{gabinet}, {dzien}: {liczba} osobnych bloków. Każda zmiana to przygotowanie gabinetu od nowa.',
    akcja:'Połącz bloki tej samej osoby albo zmniejsz liczbę zmian.' },
  { kod:'G02', kat:'Ciągłość', waga:'sugestia', tytul:'Bardzo krótki blok w środku dnia',
    tresc:'{gabinet}, {dzien}: blok {od}–{do} trwa tylko {ile}.',
    akcja:'Wydłuż go albo połącz z sąsiednim — krótkie wejścia rzadko się bilansują.' },
  { kod:'G03', kat:'Ciągłość', waga:'info',     tytul:'Gabinet prowadzony przez jedną osobę cały dzień',
    tresc:'{gabinet}, {dzien}: {osoba} prowadzi gabinet przez cały dzień bez zmian obsady.',
    akcja:'Nic nie trzeba robić — to najefektywniejszy układ.' },
  { kod:'G04', kat:'Ciągłość', waga:'sugestia', tytul:'Zmiana obsady w środku szczytu',
    tresc:'{gabinet}, {dzien}: zmiana obsady o {od}, w środku godzin największego ruchu.',
    akcja:'Przesuń zmianę poza szczyt — przerwa techniczna w szczycie kosztuje najwięcej.' },
  { kod:'G05', kat:'Ciągłość', waga:'sugestia', tytul:'Bloki stykają się bez przerwy technicznej',
    tresc:'{gabinet}, {dzien}: blok kończy się o {do} i natychmiast zaczyna kolejny, bez czasu na dezynfekcję.',
    akcja:'Zostaw 10–15 minut między blokami — inaczej opóźnienia będą się kumulować przez cały dzień.' },

  // ── H. Obłożenie gabinetów (105–112) ─────────────────────────
  { kod:'H01', kat:'Obłożenie', waga:'wazna',    tytul:'Bardzo niskie wykorzystanie gabinetu',
    tresc:'{gabinet}, {dzien}: obsadzone tylko {procent} okna ({praca} z {okno}).',
    akcja:'Dołóż obsadę albo zamknij ten gabinet w tym dniu i skoncentruj pacjentów w pozostałych.' },
  { kod:'H02', kat:'Obłożenie', waga:'sugestia', tytul:'Niskie wykorzystanie gabinetu',
    tresc:'{gabinet}, {dzien}: obsadzone {procent} okna.',
    akcja:'Wypełnij pozostały czas higienizacją — to najprostsze wypełnienie luki.' },
  { kod:'H03', kat:'Obłożenie', waga:'info',     tytul:'Gabinet wykorzystany w pełni',
    tresc:'{gabinet}, {dzien}: wykorzystanie {procent}.',
    akcja:'Nic nie trzeba robić.' },
  { kod:'H04', kat:'Obłożenie', waga:'sugestia', tytul:'Niskie wykorzystanie całej kliniki',
    tresc:'Tygodniowe wykorzystanie gabinetów: {procent}. Reszta to opłacany, ale nieużywany metraż.',
    akcja:'Zwiększ obsadę w najsłabszych dniach albo ogranicz liczbę czynnych gabinetów.' },
  { kod:'H05', kat:'Obłożenie', waga:'sugestia', tytul:'Nierówne wykorzystanie gabinetów',
    tresc:'{gabinetMax} jest wykorzystany w {procentMax}, a {gabinetMin} tylko w {procentMin}.',
    akcja:'Wyrównaj — równomierne zużycie foteli to też równomierne zużycie sprzętu.' },
  { kod:'H06', kat:'Obłożenie', waga:'info',     tytul:'Wysokie wykorzystanie — rozważ zwiększenie mocy',
    tresc:'Tygodniowe wykorzystanie: {procent}. Klinika pracuje blisko granicy.',
    akcja:'Przy takim obłożeniu kolejnym krokiem jest dodatkowy gabinet albo wydłużenie godzin.' },

  // ── I. Zespół i kadry (113–120) ──────────────────────────────
  { kod:'I01', kat:'Zespół', waga:'krytyczna', tytul:'Więcej gabinetów niż lekarzy w szczycie',
    tresc:'{dzien}, szczyt ({szczyt}): {gabinety} czynnych gabinetów, a tylko {lekarze} lekarzy.',
    akcja:'Grafiku nie da się domknąć obecną kadrą — to sygnał do rekrutacji, nie do przestawiania bloków.' },
  { kod:'I02', kat:'Zespół', waga:'wazna',     tytul:'Brak higienistek w systemie',
    tresc:'W zespole nie ma ani jednej aktywnej higienistki, a higienizacja to najprostsze wypełnienie luk.',
    akcja:'Dodaj higienistki w zakładce Zespół — bez nich część rekomendacji nie ma czym operować.' },
  { kod:'I03', kat:'Zespół', waga:'wazna',     tytul:'Brak lekarzy w systemie',
    tresc:'W zespole nie ma ani jednego aktywnego lekarza — grafiku nie da się zbudować.',
    akcja:'Dodaj lekarzy w zakładce Zespół (rola „Lekarz") i uzupełnij ich specjalizacje.' },
  { kod:'I04', kat:'Zespół', waga:'sugestia',  tytul:'Higienistka bez żadnego bloku',
    tresc:'{osoba} jest aktywną higienistką, ale nie ma w grafiku ani jednego bloku.',
    akcja:'Przypisz jej higienizacje — to gotowy, niewykorzystany zasób.' },
  { kod:'I05', kat:'Zespół', waga:'sugestia',  tytul:'Cały zespół obciążony nierówno',
    tresc:'Różnica między najbardziej i najmniej obciążoną osobą wynosi {roznica}.',
    akcja:'Wyrównaj obciążenia — to najczęstsze źródło poczucia niesprawiedliwości w zespole.' },
  { kod:'I06', kat:'Zespół', waga:'sugestia',  tytul:'Za mało asysty względem liczby gabinetów',
    tresc:'Czynnych gabinetów: {gabinety}, aktywnych asystentek: {asystentki}.',
    akcja:'Przy modelu jeden lekarz + jedna asysta potrzebujesz co najmniej tylu asystentek, ile równoległych gabinetów lekarskich.' },
  { kod:'I07', kat:'Zespół', waga:'info',      tytul:'Kadra wystarczająca do obsadzenia grafiku',
    tresc:'Lekarze: {lekarze}, higienistki: {higienistki}, asystentki: {asystentki} — dla {gabinety} gabinetów.',
    akcja:'Nic nie trzeba robić — zasoby pokrywają zaplanowaną obsadę.' },

  // ── J. Higienizacja (121–128) ────────────────────────────────
  { kod:'J01', kat:'Higienizacja', waga:'sugestia', tytul:'Za mało higienizacji w tygodniu',
    tresc:'W całym tygodniu zaplanowano tylko {liczba} bloków higienizacji (próg: {prog}).',
    akcja:'Higienizacja utrzymuje pacjenta przy klinice między leczeniami. Dołóż bloki w lukach — masz gdzie.' },
  { kod:'J02', kat:'Higienizacja', waga:'sugestia', tytul:'Higienizacja tylko w jednym dniu',
    tresc:'Higienizacja jest dostępna wyłącznie w {dni}.',
    akcja:'Rozłóż ją na kilka dni — pacjent profilaktyczny rzadko dopasuje się do jednego terminu.' },
  { kod:'J03', kat:'Higienizacja', waga:'sugestia', tytul:'Higienizacja zajmuje szczyt zamiast leczenia',
    tresc:'{gabinet}, {dzien} {od}–{do}: higienizacja w godzinach szczytu ({szczyt}).',
    akcja:'Przenieś ją poza szczyt, a w szczycie postaw leczenie o wyższej wartości wizyty.' },
  { kod:'J04', kat:'Higienizacja', waga:'info',     tytul:'Higienizacja dobrze rozłożona',
    tresc:'Higienizacja: {liczba} bloków w {dni}.',
    akcja:'Nic nie trzeba robić.' },
  { kod:'J05', kat:'Higienizacja', waga:'sugestia', tytul:'Brak higienizacji w sobotę',
    tresc:'Sobota nie ma bloku higienizacji, a to wygodny termin dla pacjentów profilaktycznych.',
    akcja:'Wstaw sobotni blok higieny — łatwo się zapełnia i nie wymaga asysty.' },
  { kod:'J06', kat:'Higienizacja', waga:'sugestia', tytul:'Higienistka pracuje bez przerwy',
    tresc:'{osoba} ma w {dzien} ciągły blok {ile} bez przerwy.',
    akcja:'Wstaw przerwę — higienizacja to praca w stałej pozycji, bez przerw kończy się kontuzją.' },
  { kod:'J07', kat:'Higienizacja', waga:'sugestia', tytul:'Higienizacja mogłaby wypełnić istniejącą lukę',
    tresc:'Jest {liczba} luk możliwych do wypełnienia higienizacją, a {ile} higienistek nie ma w tym czasie zajęcia.',
    akcja:'Dopasuj je do luk — to najszybszy zysk z tego grafiku, bez żadnych nowych kosztów.' },

  // ── K. Regularność i przewidywalność grafiku (129–142) ────────
  { kod:'K01', kat:'Regularność', waga:'sugestia', tytul:'Zmienne godziny pracy z dnia na dzień',
    tresc:'{osoba} zaczyna i kończy pracę o innej porze niemal każdego dnia — rozrzut godzin startu to {rozrzut}.',
    akcja:'Ujednolić godziny choćby w części dni — pacjentom (i samej osobie) łatwiej zapamiętać stały rytm.' },
  { kod:'K02', kat:'Regularność', waga:'info', tytul:'Stały, powtarzalny rytm pracy',
    tresc:'{osoba} zaczyna i kończy pracę o tej samej porze każdego dnia obecności ({od}–{do}).',
    akcja:'Nic nie trzeba robić — to ułatwia zapamiętanie grafiku pacjentom i planowanie reszty zespołu.' },
  { kod:'K03', kat:'Regularność', waga:'sugestia', tytul:'Częsta zmiana gabinetu między dniami',
    tresc:'{osoba} pracuje w innym gabinecie niemal każdego dnia obecności ({liczba} różnych gabinetów).',
    akcja:'Przypisz stały gabinet, jeśli to możliwe — łatwiej zorganizować narzędzia i materiały przypisane do miejsca.' },
  { kod:'K04', kat:'Regularność', waga:'info', tytul:'Stały gabinet przez cały tydzień',
    tresc:'{osoba} pracuje wyłącznie w {gabinet} przez cały tydzień.',
    akcja:'Nic nie trzeba robić — stabilna organizacja miejsca pracy.' },
  { kod:'K05', kat:'Regularność', waga:'sugestia', tytul:'Nikt nie ma dnia przerwy w środku tygodnia',
    tresc:'Każda aktywna osoba w zespole pracuje we wszystkie czynne dni tygodnia — nikt nie ma dnia bez bloku w środku tygodnia.',
    akcja:'Rozważ rotację, żeby przynajmniej część zespołu miała dzień wytchnienia w środku tygodnia, nie tylko w niedzielę.' },
  { kod:'K06', kat:'Regularność', waga:'wazna', tytul:'Praca przez wszystkie czynne dni tygodnia bez przerwy',
    tresc:'{osoba} ma blok w każdym z {liczba} czynnych dni tygodnia — bez ani jednego dnia przerwy.',
    akcja:'Zaplanuj jej choć jeden dzień bez bloków — ciągła praca bez przerwy zwiększa ryzyko wypalenia i błędów.' },
  { kod:'K07', kat:'Regularność', waga:'sugestia', tytul:'Duża rozbieżność w liczbie dni pracy między lekarzami',
    tresc:'{osobaMax} pracuje {dniMax} dni w tygodniu, a {osobaMin} tylko {dniMin}.',
    akcja:'Sprawdź, czy ta różnica jest celowa (np. inny wymiar etatu) — jeśli nie, wyrównaj liczbę dni.' },
  { kod:'K08', kat:'Regularność', waga:'info', tytul:'Wyrównana liczba dni pracy w zespole lekarzy',
    tresc:'Liczba dni pracy w tygodniu jest zbliżona u wszystkich aktywnych lekarzy.',
    akcja:'Nic nie trzeba robić.' },
  { kod:'K09', kat:'Regularność', waga:'sugestia', tytul:'Higienistka pracuje w innych dniach niż lekarze',
    tresc:'{osoba} nie ma w grafiku ani jednego dnia pokrywającego się z dniem pracy lekarza.',
    akcja:'Nakładające się dni ułatwiają przekazywanie pacjentów między higienizacją a leczeniem tego samego dnia.' },
  { kod:'K10', kat:'Regularność', waga:'sugestia', tytul:'Sobota znacznie krótsza niż pozostałe dni obsady',
    tresc:'W sobotę suma godzin obsady to {ileSobota}, podczas gdy średnio w pozostałe dni to {ileSrednia}.',
    akcja:'Sprawdź, czy to celowe ograniczenie, czy po prostu sobota została pominięta przy układaniu grafiku.' },
  { kod:'K11', kat:'Regularność', waga:'wazna', tytul:'Godzina rozpoczęcia różni się o ponad 2 godziny między dniami',
    tresc:'{osoba} zaczyna pracę raz o {najwczesniej}, a innym razem dopiero o {najpozniej} — różnica {roznica}.',
    akcja:'Duży rozrzut godziny startu utrudnia pacjentom umawianie się na stałą porę — rozważ ujednolicenie.' },
  { kod:'K12', kat:'Regularność', waga:'sugestia', tytul:'Wszyscy pracują dokładnie w tych samych godzinach',
    tresc:'{dzien}: wszystkie bloki zaczynają się i kończą o tej samej porze ({od}–{do}) — poza tym oknem klinika jest całkiem pusta.',
    akcja:'Rozważ przesunięcie części zmian, żeby wydłużyć okno, w którym ktoś jest dostępny tego dnia.' },
  { kod:'K13', kat:'Regularność', waga:'info', tytul:'Żaden dzień tygodnia nie jest całkowicie pusty',
    tresc:'W żadnym z {liczba} czynnych dni tygodnia klinika nie stoi całkowicie pusta — zawsze przynajmniej jeden gabinet ma obsadę.',
    akcja:'Nic nie trzeba robić.' },
  { kod:'K14', kat:'Regularność', waga:'sugestia', tytul:'Gabinet ma zupełnie inny rytm obsady niż pozostałe',
    tresc:'{gabinet} jest obsadzony w zupełnie innych dniach niż pozostałe gabinety ({dni}).',
    akcja:'Utrudnia to rotację personelu między gabinetami — sprawdź, czy to zamierzone.' }
];

// Indeks scenariuszy po kodzie — budowany raz przy pierwszym użyciu.
let _scenIdx = null;
function _scen(kod) {
  if (!_scenIdx) {
    _scenIdx = {};
    GRAFIK_SCENARIUSZE.forEach(s => { _scenIdx[s.kod] = s; });
  }
  return _scenIdx[kod] || null;
}

function _wypelnij(tekst, dane) {
  return String(tekst).replace(/\{(\w+)\}/g, (m, k) =>
    (dane[k] === undefined || dane[k] === null || dane[k] === '') ? m : String(dane[k]));
}

function _hm(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return h + ' h ' + m + ' min';
  if (h) return h + ' h';
  return m + ' min';
}

function _osobaLabel(p) { return p ? (p.imie + ' ' + p.nazwisko) : '—'; }

// ── Ewaluator ────────────────────────────────────────────────
// Czyta grafik, wykrywa fakty i dobiera pasujące scenariusze.
// Zwraca listę posortowaną wg wagi — najpierw to, co realnie boli.

function _grafikRekomendacje(ctx) {
  const gabinety = ctx.gabinety || [];
  const bloki    = ctx.bloki || [];
  const personel = ctx.personel || [];

  const out = [];
  const osobaById = {};
  personel.forEach(p => { osobaById[p.id] = p; });

  const lekarze     = personel.filter(p => p.grupa === GRUPA_LEKARZ);
  const higienistki = personel.filter(p => p.grupa === GRUPA_HIGIENISTKA);
  const asystentki  = personel.filter(p => p.grupa === GRUPA_ASYSTENTKA);

  function dodaj(kod, dane, ref) {
    const s = _scen(kod);
    if (!s) return;
    out.push({
      kod: s.kod,
      kategoria: s.kat,
      waga: s.waga,
      tytul: s.tytul,
      tresc: _wypelnij(s.tresc, dane || {}),
      akcja: _wypelnij(s.akcja, dane || {}),
      dzien: (ref && ref.dzien) || null,
      gabinetId: (ref && ref.gabinetId) || null,
      blokId: (ref && ref.blokId) || null
    });
  }

  // ── Braki kadrowe blokujące cokolwiek innego ──
  if (lekarze.length === 0) dodaj('I03', {});
  if (higienistki.length === 0) dodaj('I02', {});

  if (gabinety.length === 0) return out;

  // ── Indeksy ──
  const blokiPo = {};   // dzien -> gabinetId -> [bloki]
  const osobaDzien = {}; // osobaId -> dzien -> minuty
  const osobaTydz = {};  // osobaId -> minuty
  const osobaDni = {};   // osobaId -> Set dni
  const osobaBloki = {}; // osobaId -> [bloki]

  GRAFIK_DAYS.forEach(d => {
    blokiPo[d] = {};
    gabinety.forEach(g => { blokiPo[d][g.id] = []; });
  });

  bloki.forEach(b => {
    if (!blokiPo[b.dzien] || !blokiPo[b.dzien][b.gabinetId]) return;
    blokiPo[b.dzien][b.gabinetId].push(b);
    const dl = _t2m(b.do) - _t2m(b.od);
    osobaTydz[b.osobaId] = (osobaTydz[b.osobaId] || 0) + dl;
    if (!osobaDzien[b.osobaId]) osobaDzien[b.osobaId] = {};
    osobaDzien[b.osobaId][b.dzien] = (osobaDzien[b.osobaId][b.dzien] || 0) + dl;
    if (!osobaDni[b.osobaId]) osobaDni[b.osobaId] = {};
    osobaDni[b.osobaId][b.dzien] = true;
    if (!osobaBloki[b.osobaId]) osobaBloki[b.osobaId] = [];
    osobaBloki[b.osobaId].push(b);
  });

  GRAFIK_DAYS.forEach(d => {
    gabinety.forEach(g => {
      blokiPo[d][g.id].sort((a, b) => _t2m(a.od) - _t2m(b.od));
    });
  });

  // Kto jest wolny w danym dniu i oknie czasowym.
  function wolni(dzien, od, do_, grupa) {
    const grupy = Array.isArray(grupa) ? grupa : (grupa ? [grupa] : null);
    return personel.filter(p => {
      if (grupy && grupy.indexOf(p.grupa) === -1) return false;
      const kolizjaBlok = bloki.some(b =>
        b.osobaId === p.id && b.dzien === dzien && _zakresyNachodza(od, do_, b.od, b.do));
      if (kolizjaBlok) return false;
      const kolizjaAsysta = bloki.some(b =>
        b.dzien === dzien && (b.asysta || []).some(a =>
          a.osobaId === p.id && _zakresyNachodza(od, do_, a.od, a.do)));
      return !kolizjaAsysta;
    });
  }

  function nazwiska(lista, max) {
    if (!lista.length) return 'brak';
    const n = lista.slice(0, max || 3).map(_osobaLabel);
    return n.join(', ') + (lista.length > (max || 3) ? ' i ' + (lista.length - (max || 3)) + ' więcej' : '');
  }

  // ── A / F / G / H: analiza dzień po dniu, gabinet po gabinecie ──
  let tydzOkno = 0, tydzPraca = 0;
  const gabWykorzystanie = {};
  const lukiDoHigieny = [];

  GRAFIK_DAYS.forEach(dzien => {
    const h = GRAFIK_HOURS[dzien];
    const oknoOd = h.open, oknoDo = h.close, oknoDl = oknoDo - oknoOd;
    const nazwaDnia = GRAFIK_DAY_NAMES[dzien];
    const oknoTxt = _hhmm(oknoOd) + '–' + _hhmm(oknoDo);

    let obsadzoneGabinety = 0;
    let ktosNaOtwarciu = false, ktosNaZamknieciu = false;
    const startyDnia = [], koniceDnia = [];

    // Gdy cały dzień jest pusty, opisuje go jedna rekomendacja A12 —
    // powielanie tego samego komunikatu dla każdego gabinetu byłoby szumem.
    const dzienCalkiemPusty = gabinety.every(g => blokiPo[dzien][g.id].length === 0);

    gabinety.forEach(g => {
      const lista = blokiPo[dzien][g.id];
      tydzOkno += oknoDl;
      if (!gabWykorzystanie[g.id]) gabWykorzystanie[g.id] = { okno: 0, praca: 0, nazwa: g.nazwa };
      gabWykorzystanie[g.id].okno += oknoDl;

      if (lista.length === 0) {
        if (!dzienCalkiemPusty) {
          dodaj('A01', { gabinet: g.nazwa, dzien: nazwaDnia, okno: oknoTxt, ile: _hm(oknoDl) },
                { dzien, gabinetId: g.id });
        }
        return;
      }

      obsadzoneGabinety++;
      let praca = 0;
      lista.forEach(b => { praca += _t2m(b.do) - _t2m(b.od); });
      tydzPraca += praca;
      gabWykorzystanie[g.id].praca += praca;

      startyDnia.push(_t2m(lista[0].od));
      koniceDnia.push(_t2m(lista[lista.length - 1].do));
      if (_t2m(lista[0].od) <= oknoOd) ktosNaOtwarciu = true;
      if (_t2m(lista[lista.length - 1].do) >= oknoDo) ktosNaZamknieciu = true;

      // Luki: przed pierwszym, między, po ostatnim.
      const luki = [];
      let kursor = oknoOd;
      lista.forEach(b => {
        const bo = _t2m(b.od);
        if (bo > kursor) luki.push({ od: kursor, do: bo, typ: kursor === oknoOd ? 'start' : 'srodek' });
        kursor = Math.max(kursor, _t2m(b.do));
      });
      if (kursor < oknoDo) luki.push({ od: kursor, do: oknoDo, typ: 'koniec' });

      const lukiIstotne = luki.filter(l => (l.do - l.od) >= G_PROG.lukaKrotka);
      const sumaLuk = lukiIstotne.reduce((s, l) => s + (l.do - l.od), 0);

      lukiIstotne.forEach(l => {
        const dl = l.do - l.od;
        const odT = _hhmm(l.od), doT = _hhmm(l.do);
        const ref = { dzien, gabinetId: g.id };
        const wolniLek = wolni(dzien, odT, doT, GRUPA_LEKARZ);
        const wolneHig = wolni(dzien, odT, doT, GRUPA_HIGIENISTKA);
        const wszyscyWolni = wolniLek.concat(wolneHig);
        const dane = {
          gabinet: g.nazwa, dzien: nazwaDnia, od: odT, do: doT, ile: _hm(dl),
          otwarcie: _hhmm(oknoOd), zamkniecie: _hhmm(oknoDo), okno: oknoTxt,
          kandydaci: nazwiska(wszyscyWolni),
          wizyt: Math.max(1, Math.floor(dl / 45)),
          szczyt: _hhmm(GRAFIK_SZCZYT.od) + '–' + _hhmm(GRAFIK_SZCZYT.do)
        };

        if (l.typ === 'start') {
          // Luka na otwarciu: praca zaczyna się dopiero na KOŃCU tej luki.
          const pierwszy = osobaById[lista[0].osobaId];
          dodaj('A06', Object.assign({}, dane, {
            lekarz: _osobaLabel(pierwszy), start: doT }), ref);
        } else if (l.typ === 'koniec') {
          // Luka na zamknięciu: praca kończy się na POCZĄTKU tej luki.
          const ostatni = osobaById[lista[lista.length - 1].osobaId];
          dodaj('A07', Object.assign({}, dane, {
            lekarz: _osobaLabel(ostatni), koniec: odT }), ref);
        } else if (dl >= G_PROG.lukaDluga) {
          dodaj('A02', dane, ref);
        } else if (dl >= G_PROG.lukaSrednia) {
          dodaj('A03', dane, ref);
        } else {
          dodaj('A04', dane, ref);
        }

        if (dl >= G_PROG.lukaSrednia && _zakresyNachodza(odT, doT,
            _hhmm(GRAFIK_SZCZYT.od), _hhmm(GRAFIK_SZCZYT.do))) {
          dodaj('A05', dane, ref);
        }
        if (dl >= G_PROG.lukaSrednia && wszyscyWolni.length === 0) {
          dodaj('A09', dane, ref);
        }
        if (dl >= G_PROG.lukaSrednia && wolneHig.length > 0) {
          dodaj('A14', Object.assign({}, dane, { higienistka: _osobaLabel(wolneHig[0]) }), ref);
          lukiDoHigieny.push({ dzien, gabinetId: g.id });
        }
        if (dl >= G_PROG.lukaSrednia && wolniLek.length > 0) {
          dodaj('A08', Object.assign({}, dane, { lekarz: _osobaLabel(wolniLek[0]) }), ref);
        }
      });

      if (lukiIstotne.length >= 3) {
        dodaj('A13', { gabinet: g.nazwa, dzien: nazwaDnia,
          liczba: lukiIstotne.length, ile: _hm(sumaLuk) }, { dzien, gabinetId: g.id });
      }
      if (sumaLuk > praca) {
        dodaj('A17', { gabinet: g.nazwa, dzien: nazwaDnia,
          praca: _hm(praca), ile: _hm(sumaLuk) }, { dzien, gabinetId: g.id });
      }
      if (lukiIstotne.length === 0) {
        dodaj('A21', { gabinet: g.nazwa, dzien: nazwaDnia, okno: oknoTxt }, { dzien, gabinetId: g.id });
      }

      // Wykorzystanie gabinetu w tym dniu.
      const wyk = praca / oknoDl;
      const procent = Math.round(wyk * 100) + '%';
      if (wyk < G_PROG.obsadaBardzoNiska) {
        dodaj('H01', { gabinet: g.nazwa, dzien: nazwaDnia, procent,
          praca: _hm(praca), okno: _hm(oknoDl) }, { dzien, gabinetId: g.id });
      } else if (wyk < G_PROG.obsadaNiska) {
        dodaj('H02', { gabinet: g.nazwa, dzien: nazwaDnia, procent }, { dzien, gabinetId: g.id });
      }

      // Fragmentacja i styki bloków.
      if (lista.length >= 4) {
        dodaj('G01', { gabinet: g.nazwa, dzien: nazwaDnia, liczba: lista.length },
              { dzien, gabinetId: g.id });
      }
      if (lista.length === 1 && (_t2m(lista[0].do) - _t2m(lista[0].od)) >= oknoDl) {
        dodaj('G03', { gabinet: g.nazwa, dzien: nazwaDnia,
          osoba: _osobaLabel(osobaById[lista[0].osobaId]) }, { dzien, gabinetId: g.id });
      }
      for (let i = 1; i < lista.length; i++) {
        if (_t2m(lista[i].od) === _t2m(lista[i - 1].do)) {
          dodaj('G05', { gabinet: g.nazwa, dzien: nazwaDnia, do: lista[i - 1].do },
                { dzien, gabinetId: g.id, blokId: lista[i].id });
        }
      }
      lista.forEach(b => {
        const dl = _t2m(b.do) - _t2m(b.od);
        if (dl < G_PROG.blokKrotki && lista.length > 1) {
          dodaj('G02', { gabinet: g.nazwa, dzien: nazwaDnia, od: b.od, do: b.do, ile: _hm(dl) },
                { dzien, gabinetId: g.id, blokId: b.id });
        }
      });
    });

    // Poziom dnia.
    if (obsadzoneGabinety === 0) {
      dodaj('A12', { dzien: nazwaDnia, okno: oknoTxt }, { dzien });
    } else if (obsadzoneGabinety < gabinety.length) {
      dodaj('A11', { dzien: nazwaDnia, obsadzone: obsadzoneGabinety, wszystkie: gabinety.length }, { dzien });
    }
    if (obsadzoneGabinety > 0) {
      if (!ktosNaOtwarciu) dodaj('F03', { dzien: nazwaDnia, otwarcie: _hhmm(oknoOd) }, { dzien });
      if (!ktosNaZamknieciu) dodaj('F04', { dzien: nazwaDnia, zamkniecie: _hhmm(oknoDo) }, { dzien });
      if (ktosNaOtwarciu && ktosNaZamknieciu) dodaj('F08', { dzien: nazwaDnia, okno: oknoTxt }, { dzien });
      if (startyDnia.length > 1 && startyDnia.every(s => s === startyDnia[0])) {
        dodaj('F07', { dzien: nazwaDnia, od: _hhmm(startyDnia[0]) }, { dzien });
      }
      if (koniceDnia.length > 1 && koniceDnia.every(s => s === koniceDnia[0])) {
        dodaj('F06', { dzien: nazwaDnia, do: _hhmm(koniceDnia[0]) }, { dzien });
      }
    }
  });

  // ── B: asysta ──
  const asystaObciazenie = {};
  const asystaDzienGab = {};

  GRAFIK_DAYS.forEach(dzien => {
    let blokiLek = 0, blokiBezPelnej = 0;
    gabinety.forEach(g => {
      blokiPo[dzien][g.id].forEach(b => {
        const dl = _t2m(b.do) - _t2m(b.od);
        const osoba = osobaById[b.osobaId];
        const lista = b.asysta || [];
        const ref = { dzien, gabinetId: g.id, blokId: b.id };
        const wsp = {
          gabinet: g.nazwa, dzien: GRAFIK_DAY_NAMES[dzien],
          od: b.od, do: b.do, lekarz: _osobaLabel(osoba), osoba: _osobaLabel(osoba),
          liczba: lista.length, uwaga: b.asystaUwaga,
          szczyt: _hhmm(GRAFIK_SZCZYT.od) + '–' + _hhmm(GRAFIK_SZCZYT.do)
        };

        lista.forEach(a => {
          const adl = _t2m(a.do) - _t2m(a.od);
          asystaObciazenie[a.osobaId] = (asystaObciazenie[a.osobaId] || 0) + adl;
          const k = a.osobaId + '_' + dzien;
          if (!asystaDzienGab[k]) asystaDzienGab[k] = {};
          asystaDzienGab[k][g.id] = true;
        });

        if (b.typ === BLOK_HIGIENA) {
          if (lista.length === 0) dodaj('B15', wsp, ref);
          else dodaj('B16', wsp, ref);
          return;
        }

        blokiLek++;
        const wymagana = (b.asystaWymagana === null) ? 1 : b.asystaWymagana;

        if (wymagana === 0) {
          if (b.asystaUwaga) dodaj('B07', wsp, ref);
          return;
        }

        if (lista.length === 0) {
          blokiBezPelnej++;
          const wolneAs = wolni(dzien, b.od, b.do, [GRUPA_ASYSTENTKA, GRUPA_HIGIENISTKA]);
          if (asystentki.length === 0 && higienistki.length === 0) dodaj('B02b', wsp, ref);
          else if (wolneAs.length === 0) dodaj('B02', wsp, ref);
          else dodaj('B01', Object.assign({}, wsp, { kandydaci: nazwiska(wolneAs) }), ref);
          return;
        }

        if (lista.length < wymagana) {
          blokiBezPelnej++;
          dodaj('B08', Object.assign({}, wsp, { wymagana }), ref);
        } else if (lista.length > 1 && !b.asystaUwaga) {
          dodaj('B06', wsp, ref);
        } else if (b.asystaUwaga && lista.length !== 1) {
          dodaj('B07', wsp, ref);
        }

        // Pokrycie czasowe.
        let pokryte = 0;
        let najw = _t2m(b.od), najp = _t2m(b.do);
        lista.forEach(a => {
          pokryte += _t2m(a.do) - _t2m(a.od);
          najw = Math.min(najw, _t2m(a.od));
          najp = Math.max(najp, _t2m(a.do));
        });
        const pierwszaOd = Math.min.apply(null, lista.map(a => _t2m(a.od)));
        const ostatniaDo = Math.max.apply(null, lista.map(a => _t2m(a.do)));

        if (pierwszaOd > _t2m(b.od)) {
          blokiBezPelnej++;
          dodaj('B04', Object.assign({}, wsp, {
            asystaOd: _hhmm(pierwszaOd), ile: _hm(pierwszaOd - _t2m(b.od)) }), ref);
        }
        if (ostatniaDo < _t2m(b.do)) {
          blokiBezPelnej++;
          dodaj('B05', Object.assign({}, wsp, {
            asystaDo: _hhmm(ostatniaDo), ile: _hm(_t2m(b.do) - ostatniaDo) }), ref);
        }
        if (pokryte < dl && pierwszaOd <= _t2m(b.od) && ostatniaDo >= _t2m(b.do)) {
          dodaj('B03', Object.assign({}, wsp, {
            pokrycie: _hm(pokryte), brak: _hm(dl - pokryte) }), ref);
        }
      });
    });

    if (blokiLek > 0 && blokiBezPelnej === 0) {
      dodaj('B20', { dzien: GRAFIK_DAY_NAMES[dzien] }, { dzien });
    } else if (blokiBezPelnej > 0) {
      dodaj('B19', { dzien: GRAFIK_DAY_NAMES[dzien],
        liczba: blokiBezPelnej, wszystkie: blokiLek }, { dzien });
    }
  });

  Object.keys(asystaDzienGab).forEach(k => {
    const ile = Object.keys(asystaDzienGab[k]).length;
    if (ile >= 3) {
      const parts = k.split('_');
      dodaj('B10', { osoba: _osobaLabel(osobaById[parts[0]]),
        dzien: GRAFIK_DAY_NAMES[parseInt(parts[1], 10)], liczba: ile }, { dzien: parseInt(parts[1], 10) });
    }
  });

  asystentki.forEach(a => {
    if (!asystaObciazenie[a.id]) dodaj('B12', { osoba: _osobaLabel(a) });
  });

  // ── C: obciążenie ──
  personel.forEach(p => {
    const tydz = osobaTydz[p.id] || 0;
    const dni = Object.keys(osobaDni[p.id] || {}).length;

    if (p.grupa === GRUPA_LEKARZ && tydz === 0) { dodaj('C06', { osoba: _osobaLabel(p) }); return; }
    if (p.grupa === GRUPA_HIGIENISTKA && tydz === 0) { dodaj('I04', { osoba: _osobaLabel(p) }); return; }
    if (tydz === 0) return;

    if (tydz > G_PROG.tydzienDlugi) {
      dodaj('C02', { osoba: _osobaLabel(p), ile: _hm(tydz), prog: _hm(G_PROG.tydzienDlugi) });
    }
    if (dni >= GRAFIK_DAYS.length) dodaj('C03', { osoba: _osobaLabel(p), liczba: dni });
    if (dni === 1 && p.grupa === GRUPA_LEKARZ) {
      const b = osobaBloki[p.id][0];
      dodaj('C05', { osoba: _osobaLabel(p), dzien: GRAFIK_DAY_NAMES[b.dzien], od: b.od, do: b.do });
    }
    if (dni <= 2 && tydz >= G_PROG.tydzienDlugi * 0.6) {
      dodaj('C14', { osoba: _osobaLabel(p), ile: _hm(tydz), liczba: dni });
    }
    if (tydz <= G_PROG.tydzienDlugi && dni >= 3) {
      dodaj('C10', { osoba: _osobaLabel(p), ile: _hm(tydz), liczba: dni });
    }

    Object.keys(osobaDzien[p.id] || {}).forEach(dStr => {
      const d = parseInt(dStr, 10);
      const mins = osobaDzien[p.id][d];
      if (mins > G_PROG.dzienDlugi) {
        dodaj('C01', { osoba: _osobaLabel(p), dzien: GRAFIK_DAY_NAMES[d],
          ile: _hm(mins), prog: _hm(G_PROG.dzienDlugi) }, { dzien: d });
      }
      const wDniu = (osobaBloki[p.id] || []).filter(b => b.dzien === d)
        .sort((a, b) => _t2m(a.od) - _t2m(b.od));
      const gaby = {};
      wDniu.forEach(b => { gaby[b.gabinetId] = true; });
      if (Object.keys(gaby).length >= 2) {
        dodaj('C08', { osoba: _osobaLabel(p), dzien: GRAFIK_DAY_NAMES[d],
          liczba: Object.keys(gaby).length }, { dzien: d });
      }
      for (let i = 1; i < wDniu.length; i++) {
        const przerwa = _t2m(wDniu[i].od) - _t2m(wDniu[i - 1].do);
        if (przerwa > G_PROG.przerwaDluga) {
          dodaj('C07', { osoba: _osobaLabel(p), dzien: GRAFIK_DAY_NAMES[d],
            od: wDniu[i - 1].do, do: wDniu[i].od, ile: _hm(przerwa) }, { dzien: d });
        }
      }
      if (wDniu.length === 1 && mins >= G_PROG.dzienDlugi * 0.8) {
        const kod = (p.grupa === GRUPA_HIGIENISTKA) ? 'J06' : 'B14';
        dodaj(kod, { osoba: _osobaLabel(p), dzien: GRAFIK_DAY_NAMES[d], ile: _hm(mins) }, { dzien: d });
      }
    });

    (osobaBloki[p.id] || []).forEach(b => {
      const dl = _t2m(b.do) - _t2m(b.od);
      if (p.grupa === GRUPA_LEKARZ && dl < G_PROG.blokKrotki) {
        const g = gabinety.find(x => x.id === b.gabinetId);
        dodaj('C04', { osoba: _osobaLabel(p), gabinet: (g && g.nazwa) || b.gabinetId,
          dzien: GRAFIK_DAY_NAMES[b.dzien], od: b.od, do: b.do,
          ile: _hm(dl), prog: _hm(G_PROG.blokKrotki) }, { dzien: b.dzien, blokId: b.id });
      }
    });
  });

  // Rozrzut obciążenia lekarzy.
  const lekObc = lekarze.filter(l => osobaTydz[l.id]).map(l => ({ p: l, m: osobaTydz[l.id] }));
  if (lekObc.length >= 2) {
    lekObc.sort((a, b) => b.m - a.m);
    const max = lekObc[0], min = lekObc[lekObc.length - 1];
    if (max.m - min.m > 600) {
      dodaj('C11', { najwiecej: _hm(max.m), osobaMax: _osobaLabel(max.p),
        najmniej: _hm(min.m), osobaMin: _osobaLabel(min.p) });
    }
  }

  const asObc = asystentki.filter(a => asystaObciazenie[a.id])
    .map(a => ({ p: a, m: asystaObciazenie[a.id] }));
  if (asObc.length >= 2) {
    asObc.sort((a, b) => b.m - a.m);
    const max = asObc[0], min = asObc[asObc.length - 1];
    if (max.m - min.m > 480) {
      dodaj('B11', { najwiecej: _hm(max.m), osobaMax: _osobaLabel(max.p),
        najmniej: _hm(min.m), osobaMin: _osobaLabel(min.p) });
    }
    if (max.m > G_PROG.dzienDlugi) {
      Object.keys(osobaDzien).forEach(() => {});
    }
  }

  // ── D: specjalizacje ──
  const tagDni = {};       // tag -> { dzien: true }
  const tagOsoby = {};     // tag -> { osobaId: true }
  const tagMinuty = {};    // tag -> minuty
  bloki.forEach(b => {
    if (b.typ !== BLOK_LEKARZ) return;
    const p = osobaById[b.osobaId];
    if (!p) return;
    const dl = _t2m(b.do) - _t2m(b.od);
    (p.tagi || []).forEach(t => {
      if (!tagDni[t]) tagDni[t] = {};
      tagDni[t][b.dzien] = true;
      if (!tagOsoby[t]) tagOsoby[t] = {};
      tagOsoby[t][p.id] = true;
      tagMinuty[t] = (tagMinuty[t] || 0) + dl;
    });
  });

  lekarze.forEach(l => {
    if (!(l.tagi || []).length) dodaj('D04', { osoba: _osobaLabel(l) });
  });

  let pokryteKluczowe = 0;
  G_TAGI_KLUCZOWE.forEach(tag => {
    const dni = Object.keys(tagDni[tag] || {});
    if (dni.length === 0) { dodaj('D01', { tag }); return; }
    pokryteKluczowe++;
    if (dni.length === 1) {
      dodaj('D02', { tag, dni: GRAFIK_DAY_NAMES[parseInt(dni[0], 10)] });
    }
    const osoby = Object.keys(tagOsoby[tag] || {});
    if (osoby.length === 1) {
      dodaj('D03', { tag, osoba: _osobaLabel(osobaById[osoby[0]]) });
    }
    if (dni.indexOf('6') === -1 && lekarze.length > 0) {
      dodaj('D07', { tag });
    }
  });
  if (pokryteKluczowe === G_TAGI_KLUCZOWE.length) {
    dodaj('D10', { liczba: G_TAGI_KLUCZOWE.length });
  }

  const tagiWgCzasu = Object.keys(tagMinuty).map(t => ({ t, m: tagMinuty[t] }))
    .sort((a, b) => b.m - a.m);
  if (tagiWgCzasu.length >= 3 && tagiWgCzasu[0].m > tagiWgCzasu[1].m * 2) {
    dodaj('D14', { tag: tagiWgCzasu[0].t, ile: _hm(tagiWgCzasu[0].m) });
  }

  GRAFIK_DAYS.forEach(dzien => {
    const maBloki = gabinety.some(g => blokiPo[dzien][g.id].length > 0);
    if (!maBloki) return;
    const ogolny = bloki.some(b => {
      if (b.dzien !== dzien || b.typ !== BLOK_LEKARZ) return false;
      const p = osobaById[b.osobaId];
      return p && (p.tagi || []).some(t =>
        t === 'Stomatologia zachowawcza' || t === 'Konsultacje / pierwsza wizyta');
    });
    if (!ogolny && lekarze.some(l => (l.tagi || []).length)) {
      dodaj('D15', { dzien: GRAFIK_DAY_NAMES[dzien] }, { dzien });
    }
  });

  // ── E: sobota ──
  const sobota = 6;
  const hSob = GRAFIK_HOURS[sobota];
  const oknoSob = _hhmm(hSob.open) + '–' + _hhmm(hSob.close);
  const blokiSob = bloki.filter(b => b.dzien === sobota);
  const gabSob = gabinety.filter(g => blokiPo[sobota][g.id].length > 0);

  if (blokiSob.length === 0) {
    dodaj('E01', { okno: oknoSob }, { dzien: sobota });
  } else {
    if (gabSob.length === 1) {
      dodaj('E02', { gabinet: gabSob[0].nazwa, liczba: gabinety.length - 1 }, { dzien: sobota });
    }
    if (!blokiSob.some(b => b.typ === BLOK_LEKARZ)) {
      dodaj('E05', {}, { dzien: sobota });
    }
    if (!blokiSob.some(b => b.typ === BLOK_HIGIENA)) {
      dodaj('J05', {}, { dzien: sobota });
    }
    gabSob.forEach(g => {
      const lista = blokiPo[sobota][g.id];
      const od = _t2m(lista[0].od), do_ = _t2m(lista[lista.length - 1].do);
      if (od > hSob.open || do_ < hSob.close) {
        dodaj('E03', { gabinet: g.nazwa, od: _hhmm(od), do: _hhmm(do_), okno: oknoSob },
              { dzien: sobota, gabinetId: g.id });
      }
    });
    blokiSob.filter(b => b.typ === BLOK_LEKARZ && !(b.asysta || []).length).forEach(b => {
      const g = gabinety.find(x => x.id === b.gabinetId);
      dodaj('E04', { gabinet: (g && g.nazwa) || b.gabinetId, od: b.od, do: b.do,
        lekarz: _osobaLabel(osobaById[b.osobaId]) }, { dzien: sobota, blokId: b.id });
    });
    const lekSob = {};
    blokiSob.filter(b => b.typ === BLOK_LEKARZ).forEach(b => { lekSob[b.osobaId] = true; });
    if (Object.keys(lekSob).length === 1 && lekarze.length > 1) {
      dodaj('E07', { osoba: _osobaLabel(osobaById[Object.keys(lekSob)[0]]) }, { dzien: sobota });
    }
  }

  // ── H/I: poziom tygodnia ──
  if (tydzOkno > 0) {
    const wyk = tydzPraca / tydzOkno;
    const procent = Math.round(wyk * 100) + '%';
    if (wyk < G_PROG.obsadaNiska) dodaj('H04', { procent });
    else if (wyk > 0.85) dodaj('H06', { procent });
  }

  const wykList = Object.keys(gabWykorzystanie)
    .map(id => ({ id, ...gabWykorzystanie[id], w: gabWykorzystanie[id].praca / (gabWykorzystanie[id].okno || 1) }))
    .sort((a, b) => b.w - a.w);
  if (wykList.length >= 2 && (wykList[0].w - wykList[wykList.length - 1].w) > 0.3) {
    const mx = wykList[0], mn = wykList[wykList.length - 1];
    dodaj('H05', { gabinetMax: mx.nazwa, procentMax: Math.round(mx.w * 100) + '%',
      gabinetMin: mn.nazwa, procentMin: Math.round(mn.w * 100) + '%' });
  }

  gabinety.forEach(g => {
    const maCokolwiek = GRAFIK_DAYS.some(d => blokiPo[d][g.id].length > 0);
    if (!maCokolwiek) dodaj('A10', { gabinet: g.nazwa }, { gabinetId: g.id });
  });

  if (asystentki.length > 0 && asystentki.length < gabinety.length) {
    dodaj('I06', { gabinety: gabinety.length, asystentki: asystentki.length });
  }
  if (lekarze.length > 0 && higienistki.length > 0 && asystentki.length >= gabinety.length) {
    dodaj('I07', { lekarze: lekarze.length, higienistki: higienistki.length,
      asystentki: asystentki.length, gabinety: gabinety.length });
  }

  GRAFIK_DAYS.forEach(dzien => {
    const wSzczycie = bloki.filter(b => b.dzien === dzien && b.typ === BLOK_LEKARZ &&
      _zakresyNachodza(b.od, b.do, _hhmm(GRAFIK_SZCZYT.od), _hhmm(GRAFIK_SZCZYT.do)));
    const lekWSzczycie = {};
    wSzczycie.forEach(b => { lekWSzczycie[b.osobaId] = true; });
    const czynne = gabinety.filter(g => blokiPo[dzien][g.id].length > 0).length;
    if (czynne > 0 && Object.keys(lekWSzczycie).length < czynne && lekarze.length < czynne) {
      dodaj('I01', { dzien: GRAFIK_DAY_NAMES[dzien], gabinety: czynne, lekarze: lekarze.length,
        szczyt: _hhmm(GRAFIK_SZCZYT.od) + '–' + _hhmm(GRAFIK_SZCZYT.do) }, { dzien });
    }
  });

  // ── J: higienizacja ──
  const blokiHig = bloki.filter(b => b.typ === BLOK_HIGIENA);
  const dniHig = {};
  blokiHig.forEach(b => { dniHig[b.dzien] = true; });
  const dniHigList = Object.keys(dniHig).map(d => GRAFIK_DAY_NAMES[parseInt(d, 10)]);

  if (higienistki.length > 0) {
    if (blokiHig.length < G_PROG.higienizacjeMin) {
      dodaj('J01', { liczba: blokiHig.length, prog: G_PROG.higienizacjeMin });
      dodaj('D11', { liczba: blokiHig.length, ile: higienistki.length });
    } else if (dniHigList.length === 1) {
      dodaj('J02', { dni: dniHigList[0] });
    } else {
      dodaj('J04', { liczba: blokiHig.length, dni: dniHigList.join(', ') });
    }
    if (lukiDoHigieny.length > 0) {
      dodaj('J07', { liczba: lukiDoHigieny.length, ile: higienistki.length });
    }
  }

  blokiHig.forEach(b => {
    if (_zakresyNachodza(b.od, b.do, _hhmm(GRAFIK_SZCZYT.od), _hhmm(GRAFIK_SZCZYT.do))) {
      const g = gabinety.find(x => x.id === b.gabinetId);
      dodaj('J03', { gabinet: (g && g.nazwa) || b.gabinetId, dzien: GRAFIK_DAY_NAMES[b.dzien],
        od: b.od, do: b.do, szczyt: _hhmm(GRAFIK_SZCZYT.od) + '–' + _hhmm(GRAFIK_SZCZYT.do) },
        { dzien: b.dzien, gabinetId: b.gabinetId, blokId: b.id });
    }
  });

  // ── K: regularność i przewidywalność grafiku ──
  (function() {
    const osobyZBlokami = personel.filter(p => (osobaBloki[p.id] || []).length > 0);

    osobyZBlokami.forEach(p => {
      const blokiOs = (osobaBloki[p.id] || []);
      const dniList = Object.keys(osobaDni[p.id] || {}).map(d => parseInt(d, 10));

      // K01 / K02 / K11: rozrzut godziny startu pierwszego bloku między dniami.
      const startyPoDniu = {};
      blokiOs.forEach(b => {
        const t = _t2m(b.od);
        if (startyPoDniu[b.dzien] === undefined || t < startyPoDniu[b.dzien]) startyPoDniu[b.dzien] = t;
      });
      const starty = Object.keys(startyPoDniu).map(k => startyPoDniu[k]);
      if (starty.length >= 2) {
        const min = Math.min.apply(null, starty), max = Math.max.apply(null, starty);
        const roznica = max - min;
        if (roznica === 0) {
          const koniecMax = Math.max.apply(null, blokiOs.map(b => _t2m(b.do)));
          dodaj('K02', { osoba: _osobaLabel(p), od: _hhmm(min), do: _hhmm(koniecMax) });
        } else if (roznica > 120) {
          dodaj('K11', { osoba: _osobaLabel(p), najwczesniej: _hhmm(min), najpozniej: _hhmm(max), roznica: _hm(roznica) });
        } else if (roznica >= 30) {
          dodaj('K01', { osoba: _osobaLabel(p), rozrzut: _hm(roznica) });
        }
      }

      // K03 / K04: liczba różnych gabinetów w tygodniu.
      const gabSet = {};
      blokiOs.forEach(b => { gabSet[b.gabinetId] = true; });
      const gabIds = Object.keys(gabSet);
      if (dniList.length >= 2) {
        if (gabIds.length === 1) {
          const g = gabinety.find(x => x.id === gabIds[0]);
          dodaj('K04', { osoba: _osobaLabel(p), gabinet: (g && g.nazwa) || gabIds[0] });
        } else if (gabIds.length >= Math.max(3, Math.ceil(dniList.length * 0.75))) {
          dodaj('K03', { osoba: _osobaLabel(p), liczba: gabIds.length });
        }
      }

      // K06: praca we wszystkie czynne dni tygodnia bez ani jednej przerwy.
      if (dniList.length === GRAFIK_DAYS.length) {
        dodaj('K06', { osoba: _osobaLabel(p), liczba: GRAFIK_DAYS.length });
      }
    });

    // K05: nikt w zespole nie ma dnia przerwy w środku tygodnia.
    if (osobyZBlokami.length > 0 &&
        osobyZBlokami.every(p => Object.keys(osobaDni[p.id] || {}).length === GRAFIK_DAYS.length)) {
      dodaj('K05', {});
    }

    // K07 / K08: rozbieżność liczby dni pracy między lekarzami.
    const lekDni = lekarze.filter(l => osobaTydz[l.id])
      .map(l => ({ p: l, dni: Object.keys(osobaDni[l.id] || {}).length }));
    if (lekDni.length >= 2) {
      lekDni.sort((a, b) => b.dni - a.dni);
      const max = lekDni[0], min = lekDni[lekDni.length - 1];
      if (max.dni - min.dni >= 3) {
        dodaj('K07', { osobaMax: _osobaLabel(max.p), dniMax: max.dni, osobaMin: _osobaLabel(min.p), dniMin: min.dni });
      } else {
        dodaj('K08', {});
      }
    }

    // K09: higienistka bez ani jednego dnia wspólnego z lekarzem.
    const lekarzDniZbior = {};
    lekarze.forEach(l => { Object.keys(osobaDni[l.id] || {}).forEach(d => { lekarzDniZbior[d] = true; }); });
    higienistki.forEach(h => {
      const dniH = Object.keys(osobaDni[h.id] || {});
      if (dniH.length === 0 || lekarze.length === 0) return;
      const wspolne = dniH.some(d => lekarzDniZbior[d]);
      if (!wspolne) dodaj('K09', { osoba: _osobaLabel(h) });
    });

    // K10: sobota wyraźnie krótsza niż średnia pozostałych czynnych dni.
    if (GRAFIK_DAYS.indexOf(6) !== -1) {
      let sumaInne = 0, dniInneCzynne = 0;
      GRAFIK_DAYS.filter(d => d !== 6).forEach(d => {
        let suma = 0;
        gabinety.forEach(g => { blokiPo[d][g.id].forEach(b => { suma += _t2m(b.do) - _t2m(b.od); }); });
        if (suma > 0) { sumaInne += suma; dniInneCzynne++; }
      });
      let sumaSobota = 0;
      gabinety.forEach(g => { blokiPo[6][g.id].forEach(b => { sumaSobota += _t2m(b.do) - _t2m(b.od); }); });
      if (dniInneCzynne > 0 && sumaSobota > 0) {
        const sredniaInne = sumaInne / dniInneCzynne;
        if (sumaSobota < sredniaInne * 0.4) {
          dodaj('K10', { ileSobota: _hm(sumaSobota), ileSrednia: _hm(Math.round(sredniaInne)) });
        }
      }
    }

    // K12: wszystkie bloki danego dnia mają identyczne godziny od-do.
    GRAFIK_DAYS.forEach(dzien => {
      const wszystkie = [];
      gabinety.forEach(g => { blokiPo[dzien][g.id].forEach(b => wszystkie.push(b)); });
      if (wszystkie.length >= 2) {
        const od0 = wszystkie[0].od, do0 = wszystkie[0].do;
        if (wszystkie.every(b => b.od === od0 && b.do === do0)) {
          dodaj('K12', { dzien: GRAFIK_DAY_NAMES[dzien], od: od0, do: do0 }, { dzien });
        }
      }
    });

    // K13: żaden dzień tygodnia nie jest całkowicie pusty.
    const pustyDzienIstnieje = gabinety.length > 0 && GRAFIK_DAYS.some(dzien =>
      gabinety.every(g => blokiPo[dzien][g.id].length === 0));
    if (!pustyDzienIstnieje && gabinety.length > 0) {
      dodaj('K13', { liczba: GRAFIK_DAYS.length });
    }

    // K14: gabinet, który nie dzieli ani jednego dnia obsady z żadnym innym.
    if (gabinety.length >= 3) {
      const dniGab = {};
      gabinety.forEach(g => { dniGab[g.id] = GRAFIK_DAYS.filter(d => blokiPo[d][g.id].length > 0); });
      gabinety.forEach(g => {
        if (!dniGab[g.id].length) return;
        const inne = gabinety.filter(x => x.id !== g.id);
        const wspolne = inne.some(x => dniGab[g.id].some(d => dniGab[x.id].indexOf(d) !== -1));
        if (!wspolne) {
          dodaj('K14', { gabinet: g.nazwa, dni: dniGab[g.id].map(d => GRAFIK_DAY_NAMES[d]).join(', ') });
        }
      });
    }
  })();

  // Sortowanie: najpierw to, co realnie boli.
  const rank = { krytyczna: 0, wazna: 1, sugestia: 2, info: 3 };
  out.sort((a, b) => (rank[a.waga] - rank[b.waga]) ||
                     ((a.dzien || 9) - (b.dzien || 9)) ||
                     a.kod.localeCompare(b.kod));

  out.forEach((r, i) => { r.id = 'R' + (i + 1); });
  return out;
}

// ── Kreator grafiku ──────────────────────────────────────────
// Ścieżka: wybierz dni → ustaw godziny → dobierz asystę → zatwierdź.
// Celem jest wpisanie całego tygodnia lekarza za jednym razem, zamiast
// klikania bloku po bloku.

/**
 * Kto jest wolny w danym oknie czasu. Asystentka zajęta gdzie indziej
 * NIE trafia na listę — użytkownik nie powinien móc wybrać kogoś,
 * kogo i tak odrzuci walidacja przy zapisie.
 *
 * `zajete` to opcjonalne rezerwacje z trwającego kreatora (jeszcze
 * niezapisane) — bez nich ta sama osoba dałaby się wybrać dwa razy.
 */
function masterGrafikWolneAsysty(token, dzien, od, do_, zajete) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  dzien = parseInt(dzien, 10);
  if (GRAFIK_DAYS.indexOf(dzien) === -1) return { ok: false, msg: 'Nieprawidłowy dzień.' };
  if (!_validTime(od) || !_validTime(do_)) return { ok: false, msg: 'Nieprawidłowe godziny.' };

  const bloki = _grafikBlokiAll();
  const asysta = _grafikAsystaAll();
  const blokiMap = {};
  bloki.forEach(b => { blokiMap[b.id] = b; });

  const rezerwacje = Array.isArray(zajete) ? zajete : [];

  function wolna(id) {
    // zajęta w już zapisanym grafiku
    const kolizja = asysta.some(a => {
      if (String(a.osobaId) !== String(id)) return false;
      const b = blokiMap[a.blokId];
      return b && b.dzien === dzien && _zakresyNachodza(od, do_, a.od, a.do);
    });
    if (kolizja) return false;
    // zajęta w bieżącym kreatorze
    return !rezerwacje.some(r =>
      String(r.osobaId) === String(id) && parseInt(r.dzien, 10) === dzien &&
      _validTime(r.od) && _validTime(r.do) && _zakresyNachodza(od, do_, r.od, r.do));
  }

  const wolne = _grafikPersonel()
    .filter(p => p.grupa === GRUPA_ASYSTENTKA || p.grupa === GRUPA_HIGIENISTKA)
    .map(p => ({ id: p.id, label: p.imie + ' ' + p.nazwisko, zew: false, wolna: wolna(p.id) }));

  const zewnetrzne = ASYSTA_ZEW.map(a => ({
    id: a.id, label: a.label, zew: true, wolna: wolna(a.id)
  }));

  return {
    ok: true,
    dostepne: wolne.filter(x => x.wolna),
    zajete: wolne.filter(x => !x.wolna).map(x => x.label),
    zewnetrzne: zewnetrzne.filter(x => x.wolna)
  };
}

/**
 * Zbiorczy zapis z kreatora: jeden lekarz, wiele dni naraz.
 *
 * pozycje: [{ dzien, od, do, gabinetId?, asysta:[{osobaId,od?,do?}],
 *             brakAsysty?:bool, uwaga?:string }]
 *
 * Gabinet dobierany automatycznie (pierwszy wolny w tych godzinach),
 * chyba że podano wprost. Zapis jest atomowy „na pozycję”: jeśli któraś
 * się nie uda, pozostałe i tak przechodzą, a lista błędów wraca do
 * użytkownika — to lepsze niż wywalenie całego tygodnia przez jeden konflikt.
 */
function masterGrafikKreatorZapisz(token, osobaId, pozycje) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  osobaId = String(osobaId || '');
  if (!osobaId) return { ok: false, msg: 'Wybierz lekarza.' };
  if (!Array.isArray(pozycje) || !pozycje.length) return { ok: false, msg: 'Nie wybrano żadnego dnia.' };

  const personel = _grafikPersonel();
  const osoba = personel.find(p => p.id === osobaId);
  if (!osoba) return { ok: false, msg: 'Nie znaleziono tej osoby.' };
  if (osoba.grupa !== GRUPA_LEKARZ) return { ok: false, msg: 'Kreator obsadza bloki lekarskie.' };

  const gabinety = _gabinetyAll(false);
  if (!gabinety.length) return { ok: false, msg: 'Brak aktywnych gabinetów.' };

  const dodane = [];
  const bledy = [];

  pozycje.forEach(poz => {
    const dzien = parseInt(poz.dzien, 10);
    const od = String(poz.od || '').trim();
    const do_ = String(poz.do || '').trim();
    const etykietaDnia = (GRAFIK_DAY_NAMES[dzien] || dzien) + ' ' + od + '–' + do_;

    if (GRAFIK_DAYS.indexOf(dzien) === -1) { bledy.push(etykietaDnia + ': nieprawidłowy dzień.'); return; }

    // Gabinet: wskazany albo pierwszy wolny w tych godzinach.
    let gabinetId = String(poz.gabinetId || '');
    if (!gabinetId) {
      const biezace = _grafikBlokiAll().filter(b => b.dzien === dzien);
      const wolny = gabinety.find(g =>
        !biezace.some(b => b.gabinetId === g.id && _zakresyNachodza(od, do_, b.od, b.do)));
      if (!wolny) {
        bledy.push(etykietaDnia + ': wszystkie gabinety zajęte w tych godzinach.');
        return;
      }
      gabinetId = wolny.id;
    }

    const brakAsysty = !!poz.brakAsysty;
    const lista = Array.isArray(poz.asysta) ? poz.asysta : [];

    // Świadomy brak asysty musi zostawić ślad w grafiku — inaczej po tygodniu
    // nikt nie odróżni decyzji od przeoczenia.
    const uwaga = brakAsysty
      ? (String(poz.uwaga || '').trim()
          ? UWAGA_BRAK_ASYSTY + ': ' + String(poz.uwaga).trim().slice(0, 300)
          : UWAGA_BRAK_ASYSTY)
      : String(poz.uwaga || '').trim().slice(0, 300);

    const res = masterSaveGrafikBlok(token, {
      id: '',
      gabinetId: gabinetId,
      dzien: dzien,
      typ: BLOK_LEKARZ,
      osobaId: osobaId,
      od: od,
      do: do_,
      asystaWymagana: brakAsysty ? 0 : (lista.length || 1),
      asystaUwaga: uwaga
    });

    if (!res || !res.ok) {
      bledy.push(etykietaDnia + ': ' + ((res && res.msg) || 'nie udało się zapisać.'));
      return;
    }

    if (!brakAsysty && lista.length) {
      const asystaDoZapisu = lista.map(a => ({
        osobaId: a.osobaId,
        od: a.od || od,
        do: a.do || do_
      }));
      const r2 = masterSetGrafikAsysta(token, res.id, asystaDoZapisu);
      if (!r2 || !r2.ok) bledy.push(etykietaDnia + ' (asysta): ' + ((r2 && r2.msg) || 'błąd.'));
    }

    dodane.push({ id: res.id, dzien: dzien, od: od, do: do_, gabinetId: gabinetId });
  });

  _logAdmin('KreatorGrafiku', osobaId,
    osoba.imie + ' ' + osoba.nazwisko + ' — dodano ' + dodane.length +
    (bledy.length ? (', błędów ' + bledy.length) : ''));

  return { ok: true, dodane: dodane.length, bledy: bledy.slice(0, 20) };
}

// ── Adnotacje niestandardowe ─────────────────────────────────
// Notatka przypięta do konkretnego zakresu dat (dzień / tydzień /
// miesiąc / dowolny okres), opcjonalnie zawężona do gabinetu lub osoby.
// Grafik jest szablonem tygodniowym, więc to jedyne miejsce, w którym
// zapisujemy rzeczy dziejące się w konkretnych datach.

const ADNOTACJA_TYPY = [
  { id: 'info',   label: 'Informacja' },
  { id: 'uwaga',  label: 'Uwaga' },
  { id: 'wazne',  label: 'Ważne' },
  { id: 'wolne',  label: 'Nieczynne / wolne' }
];

function _shAdnotacje() {
  return _arkusz('GrafikAdnotacje',
    ['ID','Od','Do','Typ','Tresc','GabinetID','OsobaID','Zmodyfikowano']);
}

function _adnotacjeAll() {
  const sh = _shAdnotacje();
  if (sh.getLastRow() < 2) return [];
  return sh.getDataRange().getValues().slice(1)
    .map(r => ({
      id: String(r[0]),
      od: _sheetDate(r[1]),
      do: _sheetDate(r[2]),
      typ: String(r[3] || 'info'),
      tresc: String(r[4] || ''),
      gabinetId: String(r[5] || ''),
      osobaId: String(r[6] || '')
    }))
    .filter(a => a.id && /^\d{4}-\d{2}-\d{2}$/.test(a.od));
}

function _dataOk(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '').trim()); }

function masterGetAdnotacje(token) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  return { ok: true, adnotacje: _adnotacjeAll(), typy: ADNOTACJA_TYPY };
}

// Waliduje pola wspólne dla pojedynczej adnotacji i każdego wystąpienia
// serii — jedno miejsce, żeby oba tryby zapisu nie mogły się rozjechać.
function _walidujAdnotacje(a) {
  a = a || {};
  const od = String(a.od || '').trim();
  const do_ = String(a.do || od).trim();
  const tresc = String(a.tresc || '').trim().slice(0, 500);
  const typ = ADNOTACJA_TYPY.some(x => x.id === a.typ) ? a.typ : 'info';

  if (!_dataOk(od) || !_dataOk(do_)) return { blad: 'Podaj poprawny zakres dat.' };
  if (od > do_) return { blad: 'Data „od" nie może być późniejsza niż „do".' };
  if (!tresc) return { blad: 'Wpisz treść adnotacji.' };

  return { od, do: do_, typ, tresc, gabinetId: String(a.gabinetId || ''), osobaId: String(a.osobaId || '') };
}

function masterSaveAdnotacja(token, a) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  const v = _walidujAdnotacje(a);
  if (v.blad) return { ok: false, msg: v.blad };

  const sh = _shAdnotacje();
  const wartosci = [v.od, v.do, v.typ, v.tresc, v.gabinetId, v.osobaId, new Date().toISOString()];
  const id = String((a || {}).id || '');

  if (id) {
    const rows = sh.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === id) {
        sh.getRange(i + 1, 2, 1, wartosci.length).setValues([wartosci]);
        _logAdmin('EdycjaAdnotacji', id, v.od + '–' + v.do + ': ' + v.tresc.slice(0, 60));
        return { ok: true, id };
      }
    }
    return { ok: false, msg: 'Adnotacja nie istnieje.' };
  }

  const nowe = _nextId(_adnotacjeAll(), 'AD');
  sh.appendRow([nowe].concat(wartosci));
  _logAdmin('DodanieAdnotacji', nowe, v.od + '–' + v.do + ': ' + v.tresc.slice(0, 60));
  return { ok: true, id: nowe };
}

// ── Adnotacje powtarzające się ────────────────────────────────
// Nie ma osobnego pola „powtarzalności” w arkuszu — seria to po prostu
// kilka zwyczajnych adnotacji zapisanych jedna po drugiej, z tą samą
// treścią. Prostsze niż wprowadzanie wzorca powtarzania do modelu danych,
// a edycja/usunięcie pojedynczego wystąpienia działa dokładnie tak samo
// jak dla adnotacji, która nigdy nie była częścią serii.
const ADNOTACJA_SERIA_MAX = 104; // ok. 2 lata co tydzień — bezpiecznik przed nieskończoną pętlą

function _ymd(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function _przesunDniOd(dataStr, dni) {
  const d = new Date(dataStr + 'T12:00:00');
  d.setDate(d.getDate() + dni);
  return _ymd(d);
}

// Miesiąc/rok liczymy zawsze OD DATY BAZOWEJ (nie łańcuchowo od poprzedniego
// wystąpienia), z przycięciem dnia do długości docelowego miesiąca.
// Bez tego 31 stycznia co miesiąc „uciekłoby” przez luty: JS Date z
// setMonth() na dniu, którego docelowy miesiąc nie ma, przelewa się na
// kolejny (31 sty + 1 mies. → 3 marca zamiast 28 lutego), a każde kolejne
// wystąpienie liczone od takiego dryfu psułoby się coraz bardziej.
function _przesunDate(dataBazowa, tryb, ile) {
  const d = new Date(dataBazowa + 'T12:00:00');
  if (tryb === 'tydzien') { d.setDate(d.getDate() + 7 * ile); return _ymd(d); }

  const dzien = d.getDate();
  if (tryb === 'miesiac') {
    const rok = d.getFullYear(), mies = d.getMonth() + ile;
    const ostatni = new Date(rok, mies + 1, 0);
    ostatni.setDate(Math.min(dzien, ostatni.getDate()));
    return _ymd(ostatni);
  }
  if (tryb === 'rok') {
    const rok = d.getFullYear() + ile, mies = d.getMonth();
    const ostatni = new Date(rok, mies + 1, 0);
    ostatni.setDate(Math.min(dzien, ostatni.getDate()));
    return _ymd(ostatni);
  }
  return null;
}

function masterSaveAdnotacjaSeria(token, a, powtarzaj) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  const v = _walidujAdnotacje(a);
  if (v.blad) return { ok: false, msg: v.blad };

  powtarzaj = powtarzaj || {};
  const tryb = ['tydzien', 'miesiac', 'rok'].indexOf(powtarzaj.tryb) !== -1 ? powtarzaj.tryb : null;
  const koniec = String(powtarzaj.do || '').trim();
  if (!tryb) return { ok: false, msg: 'Wybierz sposób powtarzania.' };
  if (!_dataOk(koniec)) return { ok: false, msg: 'Podaj datę końca powtarzania.' };
  if (koniec < v.od) return { ok: false, msg: 'Data końca powtarzania musi być późniejsza niż pierwsze wystąpienie.' };

  // Wystąpienia mają tę samą długość, co pierwsze (np. tydzień urlopu
  // powtórzony co miesiąc nadal trwa tydzień).
  const dlugoscDni = Math.round((new Date(v.do + 'T12:00:00') - new Date(v.od + 'T12:00:00')) / 86400000);

  const wystapienia = [{ od: v.od, do: v.do }];
  for (let i = 1; i < ADNOTACJA_SERIA_MAX; i++) {
    const nastOd = _przesunDate(v.od, tryb, i);
    if (!nastOd || nastOd > koniec) break;
    wystapienia.push({ od: nastOd, do: _przesunDniOd(nastOd, dlugoscDni) });
  }

  const sh = _shAdnotacje();
  const teraz = new Date().toISOString();
  let seed = _adnotacjeAll();
  const utworzoneId = [];
  wystapienia.forEach(w => {
    const id = _nextId(seed, 'AD');
    seed = seed.concat([{ id }]);
    sh.appendRow([id, w.od, w.do, v.typ, v.tresc, v.gabinetId, v.osobaId, teraz]);
    utworzoneId.push(id);
  });

  _logAdmin('DodanieSeriiAdnotacji', utworzoneId.join(','),
    wystapienia.length + '× „' + v.tresc.slice(0, 60) + '” (' + tryb + ' do ' + koniec + ')');
  return { ok: true, utworzono: wystapienia.length, id: utworzoneId };
}

function masterDeleteAdnotacja(token, id) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  id = String(id || '');
  const sh = _shAdnotacje();
  const rows = sh.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][0]) === id) {
      sh.deleteRow(i + 1);
      _logAdmin('UsuniecieAdnotacji', id, '');
      return { ok: true };
    }
  }
  return { ok: false, msg: 'Adnotacja nie istnieje.' };
}

// ── Dane do wydruku ──────────────────────────────────────────
// Wydruk obejmuje zakres DAT (domyślnie cały miesiąc), a nie sam szablon
// tygodnia: szablon jest rzutowany na kolejne dni, dzięki czemu można
// wydrukować np. jednego pracownika w miesiącu albo jeden gabinet
// między dwiema datami w wybranych godzinach.

function masterGrafikWydruk(token, opts) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  opts = opts || {};

  let od = String(opts.od || '').trim();
  let do_ = String(opts.do || '').trim();

  // Domyślnie bieżący miesiąc.
  if (!_dataOk(od) || !_dataOk(do_)) {
    const dzis = _todayPL();
    const y = parseInt(dzis.slice(0, 4), 10), m = parseInt(dzis.slice(5, 7), 10);
    od = y + '-' + String(m).padStart(2, '0') + '-01';
    do_ = y + '-' + String(m).padStart(2, '0') + '-' + String(new Date(y, m, 0).getDate()).padStart(2, '0');
  }
  if (od > do_) return { ok: false, msg: 'Nieprawidłowy zakres dat.' };

  const godzOd = _validTime(opts.godzOd) ? opts.godzOd : null;
  const godzDo = _validTime(opts.godzDo) ? opts.godzDo : null;
  if (godzOd && godzDo && _t2m(godzOd) >= _t2m(godzDo)) {
    return { ok: false, msg: 'Nieprawidłowy zakres godzin.' };
  }

  const filtrGab = Array.isArray(opts.gabinetIds) && opts.gabinetIds.length
    ? opts.gabinetIds.map(String) : null;
  const filtrOsob = Array.isArray(opts.osobaIds) && opts.osobaIds.length
    ? opts.osobaIds.map(String) : null;

  const gabinety = _gabinetyAll(true);
  const gabMap = {};
  gabinety.forEach(g => { gabMap[g.id] = g.nazwa; });

  const personel = _grafikPersonel();
  const osobaMap = {};
  personel.forEach(p => { osobaMap[p.id] = p.imie + ' ' + p.nazwisko; });
  const nazwaOsoby = id => osobaMap[id] || (_czyAsystaZew(id) ? _labelAsystaZew(id) : id);

  const bloki = _grafikBlokiAll();
  const asysta = _grafikAsystaAll();
  const asystaWg = {};
  asysta.forEach(a => {
    if (!asystaWg[a.blokId]) asystaWg[a.blokId] = [];
    asystaWg[a.blokId].push(a);
  });

  const adnotacje = _adnotacjeAll();

  // Rzutowanie szablonu tygodniowego na kolejne daty zakresu.
  const dni = [];
  const kursor = new Date(od + 'T12:00:00');
  const koniec = new Date(do_ + 'T12:00:00');
  let strażnik = 0;

  while (kursor <= koniec && strażnik < 400) {
    strażnik++;
    const ds = Utilities.formatDate(kursor, 'Europe/Warsaw', 'yyyy-MM-dd');
    const dow = kursor.getDay();
    kursor.setDate(kursor.getDate() + 1);
    if (GRAFIK_DAYS.indexOf(dow) === -1) continue; // niedziela — klinika nieczynna

    const wDniu = bloki
      .filter(b => b.dzien === dow)
      .filter(b => !filtrGab || filtrGab.indexOf(b.gabinetId) !== -1)
      .filter(b => !filtrOsob || filtrOsob.indexOf(b.osobaId) !== -1)
      .filter(b => !godzOd || !godzDo || _zakresyNachodza(b.od, b.do, godzOd, godzDo))
      .sort((a, b) => _t2m(a.od) - _t2m(b.od) ||
                      String(gabMap[a.gabinetId] || '').localeCompare(String(gabMap[b.gabinetId] || '')))
      .map(b => ({
        gabinet: gabMap[b.gabinetId] || b.gabinetId,
        gabinetId: b.gabinetId,
        osoba: nazwaOsoby(b.osobaId),
        osobaId: b.osobaId,
        typ: b.typ,
        od: b.od, do: b.do,
        asysta: (asystaWg[b.id] || []).map(a => nazwaOsoby(a.osobaId)),
        brakAsysty: b.typ === BLOK_LEKARZ && !(asystaWg[b.id] || []).length,
        uwaga: b.asystaUwaga || ''
      }));

    const adnDnia = adnotacje
      .filter(a => a.od <= ds && ds <= a.do)
      .filter(a => !a.gabinetId || !filtrGab || filtrGab.indexOf(a.gabinetId) !== -1)
      .filter(a => !a.osobaId || !filtrOsob || filtrOsob.indexOf(a.osobaId) !== -1)
      .map(a => ({
        typ: a.typ, tresc: a.tresc,
        gabinet: a.gabinetId ? (gabMap[a.gabinetId] || a.gabinetId) : '',
        osoba: a.osobaId ? nazwaOsoby(a.osobaId) : ''
      }));

    // Dzień bez obsady i bez adnotacji nie wnosi nic do wydruku.
    if (!wDniu.length && !adnDnia.length) continue;

    dni.push({
      data: ds,
      dzien: GRAFIK_DAY_NAMES[dow],
      bloki: wDniu,
      adnotacje: adnDnia
    });
  }

  const opisFiltra = [];
  if (filtrGab)  opisFiltra.push('gabinety: ' + filtrGab.map(id => gabMap[id] || id).join(', '));
  if (filtrOsob) opisFiltra.push('osoby: ' + filtrOsob.map(nazwaOsoby).join(', '));
  if (godzOd && godzDo) opisFiltra.push('godziny: ' + godzOd + '–' + godzDo);

  return {
    ok: true,
    od, do: do_,
    filtr: opisFiltra.join(' · '),
    dni,
    gabinety: gabinety.map(g => ({ id: g.id, nazwa: g.nazwa })),
    personel: personel.map(p => ({ id: p.id, nazwa: p.imie + ' ' + p.nazwisko, grupa: p.grupa }))
  };
}

// ── Edycja konkretnych dni miesiąca ──────────────────────────
// Szablon tygodniowy jest domyślną podstawą, ale realny miesiąc rzadko
// jest idealnie powtarzalny. Dzień, który raz zostanie zmieniony, zapisuje
// się TU w całości i od tej pory wygrywa z szablonem.
//
// Materializacja całego dnia (a nie różnic) jest celowa: „co jest w tym
// dniu" da się wtedy odczytać jednym spojrzeniem, bez składania szablonu
// z listą wyjątków — a to właśnie ta złożoność sprawiała, że budowanie
// grafiku wydawało się nieintuicyjne.

function _shGrafikDni() {
  return _arkusz('GrafikDni',
    ['ID','Data','GabinetID','Typ','OsobaID','Od','Do','AsystaWymagana','AsystaUwaga','Asysta','Zmodyfikowano']);
}

function _dniNadpisaneAll() {
  const sh = _shGrafikDni();
  if (sh.getLastRow() < 2) return {};
  const map = {};
  sh.getDataRange().getValues().slice(1).forEach(r => {
    const data = _sheetDate(r[1]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return;
    if (!map[data]) map[data] = [];
    let asysta = [];
    try { asysta = JSON.parse(String(r[9] || '[]')); } catch (e) { asysta = []; }
    map[data].push({
      id: String(r[0]),
      gabinetId: String(r[2]),
      typ: String(r[3]),
      osobaId: String(r[4]),
      od: _sheetTime(r[5]),
      do: _sheetTime(r[6]),
      asystaWymagana: (r[7] === '' || r[7] == null) ? null : parseInt(r[7], 10),
      asystaUwaga: String(r[8] || ''),
      asysta: Array.isArray(asysta) ? asysta : []
    });
  });
  return map;
}

// Dni oznaczone jako edytowane, ale bez ani jednego bloku (świadomie puste).
function _dniPusteAll() {
  const props = PropertiesService.getScriptProperties();
  try { return JSON.parse(props.getProperty('grafik_dni_puste') || '[]'); }
  catch (e) { return []; }
}
function _zapiszDniPuste(lista) {
  PropertiesService.getScriptProperties()
    .setProperty('grafik_dni_puste', JSON.stringify(lista.slice(0, 2000)));
}

/**
 * Cały miesiąc dzień po dniu: co realnie obowiązuje w każdej dacie.
 * `zTemplate` mówi, czy dzień pochodzi z szablonu, czy został nadpisany —
 * dzięki temu interfejs może pokazać, gdzie ktoś świadomie odszedł od normy.
 */
// Kontekst wspólny dla wszystkich odczytów „co obowiązuje w danym dniu" —
// budowany raz, przekazywany do _grafikDzienStan dla każdej daty z osobna.
function _grafikKontekstDni() {
  const asystaWg = {};
  _grafikAsystaAll().forEach(a => {
    if (!asystaWg[a.blokId]) asystaWg[a.blokId] = [];
    asystaWg[a.blokId].push({ osobaId: a.osobaId, od: a.od, do: a.do });
  });
  return {
    szablon: _grafikBlokiAll(),
    asystaWg,
    nadpisane: _dniNadpisaneAll(),
    puste: _dniPusteAll()
  };
}

// Co realnie obowiązuje w jednej dacie: bloki z nadpisania, świadomie pusty
// dzień, albo — domyślnie — szablon tygodniowy. Wydzielone z masterGrafikMiesiac,
// żeby ten sam, jedyny algorytm mógł odpowiedzieć na pytanie o pojedynczy dzień
// (np. przy szukaniu zastępcy na urlop), bez powielania logiki.
function _grafikDzienStan(ds, ctx) {
  const dow = new Date(ds + 'T12:00:00').getDay();
  const czynny = GRAFIK_DAYS.indexOf(dow) !== -1;

  let bloki = [];
  let zTemplate = true;

  if (ctx.nadpisane[ds]) {
    bloki = ctx.nadpisane[ds];
    zTemplate = false;
  } else if (ctx.puste.indexOf(ds) !== -1) {
    bloki = [];
    zTemplate = false;
  } else if (czynny) {
    bloki = ctx.szablon.filter(b => b.dzien === dow).map(b => ({
      id: b.id, gabinetId: b.gabinetId, typ: b.typ, osobaId: b.osobaId,
      od: b.od, do: b.do, asystaWymagana: b.asystaWymagana,
      asystaUwaga: b.asystaUwaga, asysta: ctx.asystaWg[b.id] || []
    }));
  }

  bloki.sort((a, b) => _t2m(a.od) - _t2m(b.od));

  return {
    data: ds,
    dzienTygodnia: dow,
    nazwaDnia: czynny ? GRAFIK_DAY_NAMES[dow] : 'Niedziela',
    czynny: czynny,
    zTemplate: zTemplate,
    godziny: czynny ? { open: _hhmm(GRAFIK_HOURS[dow].open), close: _hhmm(GRAFIK_HOURS[dow].close) } : null,
    bloki: bloki
  };
}

function masterGrafikMiesiac(token, rok, mies) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  const y = parseInt(rok, 10), m = parseInt(mies, 10);
  if (isNaN(y) || isNaN(m) || m < 1 || m > 12) return { ok: false, msg: 'Nieprawidłowy miesiąc.' };

  const gabinety = _gabinetyAll(false);
  const personel = _grafikPersonel();
  const ctx = _grafikKontekstDni();
  const adnotacje = _adnotacjeAll();

  const ile = new Date(y, m, 0).getDate();
  const pfx = y + '-' + String(m).padStart(2, '0') + '-';
  const dni = [];

  for (let d = 1; d <= ile; d++) {
    const ds = pfx + String(d).padStart(2, '0');
    const stan = _grafikDzienStan(ds, ctx);
    dni.push(Object.assign(stan, {
      adnotacje: adnotacje.filter(a => a.od <= ds && ds <= a.do)
    }));
  }

  return {
    ok: true, rok: y, mies: m, dni,
    gabinety, personel,
    krokMin: GRAFIK_KROK_MIN,
    asystaZew: ASYSTA_ZEW
  };
}

// ── Eksport grafiku do Excela — układ wzorowany na ręcznie
// prowadzonym grafiku kliniki (dni tygodnia w kolumnach, tydzień pod
// tygodniem, kolorem oznaczony specjalista przyjmujący w gabinecie,
// bez wypełnienia — jego asysta bezpośrednio pod nim). ──

const GRAFIK_XLSX_KOL = { 1: 2, 2: 4, 3: 6, 4: 8, 5: 10, 6: 12 }; // dzień tygodnia -> kolumna startowa (B, D, F, H, J, L)
const GRAFIK_XLSX_PALETA = [
  '#92D050', '#FFD966', '#9FC5E8', '#D5A6BD', '#F6B26B', '#B4A7D6',
  '#93C47D', '#76A5AF', '#E06666', '#C9DAF8', '#FCE5CD', '#D9EAD3'
];
const GRAFIK_XLSX_MIESIACE = [
  'STYCZEŃ', 'LUTY', 'MARZEC', 'KWIECIEŃ', 'MAJ', 'CZERWIEC',
  'LIPIEC', 'SIERPIEŃ', 'WRZESIEŃ', 'PAŹDZIERNIK', 'LISTOPAD', 'GRUDZIEŃ'
];

function masterGrafikExportXlsx(token, rok, mies) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  const y = parseInt(rok, 10), m = parseInt(mies, 10);
  if (isNaN(y) || isNaN(m) || m < 1 || m > 12) return { ok: false, msg: 'Nieprawidłowy miesiąc.' };

  const gabinety = _gabinetyAll(false);
  const gabMap = {};
  gabinety.forEach(g => { gabMap[g.id] = g.nazwa; });
  const personel = _grafikPersonel();
  const osobaMap = {};
  personel.forEach(p => { osobaMap[p.id] = p; });
  const nazwaOsoby = id => {
    const p = osobaMap[id];
    if (p) return p.imie + ' ' + p.nazwisko;
    return _czyAsystaZew(id) ? _labelAsystaZew(id) : id;
  };

  const ctx = _grafikKontekstDni();
  const ile = new Date(y, m, 0).getDate();
  const pfx = y + '-' + String(m).padStart(2, '0') + '-';
  const dni = [];
  for (let d = 1; d <= ile; d++) dni.push(_grafikDzienStan(pfx + String(d).padStart(2, '0'), ctx));

  // Nowy tydzień zaczyna się w poniedziałek — tak jak w ręcznie prowadzonym
  // grafiku, dni przed pierwszym poniedziałkiem miesiąca (resztki
  // poprzedniego tygodnia) pomijamy; ostatni tydzień bywa niepełny.
  const tygodnie = [];
  let biezacy = [];
  let started = false;
  dni.forEach(d => {
    if (d.dzienTygodnia === 1) {
      if (started) tygodnie.push(biezacy);
      biezacy = [];
      started = true;
    }
    if (started) biezacy.push(d);
  });
  if (biezacy.length) tygodnie.push(biezacy);

  // Jeden kolor na osobę (lekarza/higienistkę) na cały eksport — ta sama
  // osoba zawsze wygląda tak samo, niezależnie od tego, w ilu dniach pracuje.
  const kolorOsoby = {};
  function kolorDla(id) {
    if (!kolorOsoby[id]) {
      const idx = Object.keys(kolorOsoby).length % GRAFIK_XLSX_PALETA.length;
      kolorOsoby[id] = GRAFIK_XLSX_PALETA[idx];
    }
    return kolorOsoby[id];
  }

  const tmpName = 'WeSMILE_Grafik_' + y + '-' + String(m).padStart(2, '0') + '_' + Utilities.getUuid().slice(0, 8);
  const tmpSs = SpreadsheetApp.create(tmpName);
  const sh = tmpSs.getSheets()[0];
  sh.setName(GRAFIK_XLSX_MIESIACE[m - 1] + ' ' + y);

  sh.getRange(1, 2).setValue(String(y)).setFontWeight('bold');
  sh.getRange(1, 4).setValue(GRAFIK_XLSX_MIESIACE[m - 1]).setFontWeight('bold');

  // "_dane" to ukryty arkusz-formatka: dla każdej wypełnionej komórki
  // zapamiętuje, KOGO i w jakim gabinecie/dniu ona przedstawia. Osoba
  // wypełniająca grafik w Excelu nigdy go nie widzi ani nie dotyka —
  // to on czyni ten sam plik jednocześnie eksportem (do przejrzenia)
  // i formatką (do wypełnienia i wgrania z powrotem): import czyta stąd
  // pewne dopasowania, a dla wierszy dopisanych ręcznie (bez wpisu tutaj)
  // pada z powrotem na dopasowanie po samym imieniu i nazwisku.
  const daneWiersze = [['Wiersz', 'Kolumna', 'Data', 'Rola', 'OsobaID', 'GabinetID']];

  let wiersz = 3;
  tygodnie.forEach(tydz => {
    const wierszNaglowek = wiersz;
    const wierszNumer = wiersz + 1;
    let maxRows = 0;

    tydz.forEach(d => {
      if (!d.czynny) return;
      const kol = GRAFIK_XLSX_KOL[d.dzienTygodnia];

      sh.getRange(wierszNaglowek, kol, 1, 2).merge()
        .setValue(GRAFIK_DAY_NAMES[d.dzienTygodnia].toUpperCase()).setFontWeight('bold');
      sh.getRange(wierszNumer, kol).setValue(parseInt(d.data.slice(8), 10)).setFontWeight('bold');
      daneWiersze.push([wierszNumer, kol, d.data, 'dzien', '', '']);

      let r = wierszNumer + 1;
      d.bloki.slice().sort((a, b) => _t2m(a.od) - _t2m(b.od)).forEach(b => {
        const gab = gabMap[b.gabinetId] || '';
        const etykieta = nazwaOsoby(b.osobaId).toUpperCase() + (gab ? ' (' + gab + ')' : '');
        sh.getRange(r, kol).setValue(etykieta);
        sh.getRange(r, kol + 1).setValue(b.od + '-' + b.do);
        sh.getRange(r, kol, 1, 2).setBackground(kolorDla(b.osobaId));
        daneWiersze.push([r, kol, d.data, 'obsada', b.osobaId, b.gabinetId]);
        r++;
        (b.asysta || []).forEach(a => {
          sh.getRange(r, kol).setValue(nazwaOsoby(a.osobaId));
          sh.getRange(r, kol + 1).setValue(a.od + '-' + a.do);
          daneWiersze.push([r, kol, d.data, 'asysta', a.osobaId, b.gabinetId]);
          r++;
        });
      });
      maxRows = Math.max(maxRows, r - wierszNumer);
    });

    wiersz = wierszNaglowek + Math.max(maxRows + 1, 2) + 2; // + wiersz numeru + pusty odstęp
  });

  sh.autoResizeColumns(1, 13);

  const shDane = tmpSs.insertSheet('_dane');
  daneWiersze.forEach(w => shDane.appendRow(w));
  shDane.hideSheet();

  SpreadsheetApp.flush();

  const fileId = tmpSs.getId();
  const url = 'https://docs.google.com/spreadsheets/d/' + fileId + '/export?format=xlsx';
  const resp = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }
  });
  const b64 = Utilities.base64Encode(resp.getContent());

  try { DriveApp.getFileById(fileId).setTrashed(true); } catch (e) { Logger.log('cleanup error: ' + e); }

  _logAdmin('EksportGrafikuXLSX', y + '-' + m, 'Eksport grafiku ' + GRAFIK_XLSX_MIESIACE[m - 1] + ' ' + y);

  return {
    ok: true,
    filename: 'WeSMILE_Grafik_' + y + '-' + String(m).padStart(2, '0') + '.xlsx',
    base64: b64
  };
}

// ── Import grafiku z formatki Excel ─────────────────────────────
// Plik pobrany przyciskiem "Pobierz Excel" (masterGrafikExportXlsx) można
// wypełnić w Excelu — dopisać/zmienić osoby i godziny w kolumnach dni —
// i wgrać z powrotem. Ukryty arkusz "_dane" w tym samym pliku mówi
// dokładnie, kto jest kim w każdej niezmienionej komórce; dla wierszy
// dopisanych ręcznie (bez wpisu w "_dane") system dopasowuje osobę po
// samym imieniu i nazwisku. Nic nie zapisuje się automatycznie —
// masterGrafikImportPreview tylko PROPONUJE, a właściciel przegląda
// i poprawia, zanim masterGrafikImportZatwierdz cokolwiek zapisze.

function _xmlUnescape(s) {
  return String(s || '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function _xlsxColToIdx(col) {
  let idx = 0;
  for (let i = 0; i < col.length; i++) idx = idx * 26 + (col.charCodeAt(i) - 64);
  return idx;
}

function _idxToCol(idx) {
  let s = '';
  while (idx > 0) {
    const r = (idx - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    idx = Math.floor((idx - 1) / 26);
  }
  return s;
}

function _xlsxParseSharedStrings(xml) {
  if (!xml) return [];
  const out = [];
  const siRe = /<si>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = siRe.exec(xml))) {
    const texts = [];
    const tRe = /<t[^>]*>([\s\S]*?)<\/t>/g;
    let tm;
    while ((tm = tRe.exec(m[1]))) texts.push(_xmlUnescape(tm[1]));
    out.push(texts.join(''));
  }
  return out;
}

// Zwraca mapę "B5" -> {value, row, col}. Obsługuje wspólne łańcuchy (t="s"),
// tekst formuły (t="str") i tekst inline (t="inlineStr") — trzy warianty,
// jakie w praktyce piszą Excel/LibreOffice/Arkusze Google.
function _xlsxParseSheetCells(xml, sharedStrings) {
  const cells = {};
  const cRe = /<c r="([A-Z]+)(\d+)"([^>]*)>([\s\S]*?)<\/c>/g;
  let m;
  while ((m = cRe.exec(xml))) {
    const col = m[1], row = parseInt(m[2], 10), attrs = m[3], inner = m[4];
    const tMatch = attrs.match(/t="([^"]+)"/);
    const t = tMatch ? tMatch[1] : null;
    let value = null;

    if (t === 'inlineStr') {
      const isMatch = inner.match(/<is>([\s\S]*?)<\/is>/);
      if (isMatch) {
        const texts = [];
        const tRe = /<t[^>]*>([\s\S]*?)<\/t>/g;
        let tm;
        while ((tm = tRe.exec(isMatch[1]))) texts.push(_xmlUnescape(tm[1]));
        value = texts.join('');
      }
    } else {
      const vMatch = inner.match(/<v>([\s\S]*?)<\/v>/);
      if (vMatch) {
        const raw = _xmlUnescape(vMatch[1]);
        value = (t === 's') ? (sharedStrings[parseInt(raw, 10)] || '') : raw;
      }
    }

    if (value !== null && value !== '') {
      cells[col + row] = { value, row, col: _xlsxColToIdx(col) };
    }
  }
  return cells;
}

function _xlsxParseWorkbookSheets(workbookXml, relsXml) {
  const ridToTarget = {};
  const relRe = /<Relationship Id="([^"]+)"[^>]*Target="([^"]+)"/g;
  let m;
  while ((m = relRe.exec(relsXml))) ridToTarget[m[1]] = m[2];

  const sheets = [];
  const shRe = /<sheet name="([^"]*)"[^>]*r:id="([^"]+)"/g;
  while ((m = shRe.exec(workbookXml))) {
    const target = ridToTarget[m[2]];
    if (target) sheets.push({ name: _xmlUnescape(m[1]), path: 'xl/' + target });
  }
  return sheets;
}

function _xlsxUnzipEntries(base64) {
  const bytes = Utilities.base64Decode(base64);
  const zipBlob = Utilities.newBlob(bytes, 'application/zip', 'import.zip');
  const blobs = Utilities.unzip(zipBlob);
  const map = {};
  blobs.forEach(b => { map[b.getName()] = b; });
  return map;
}

function masterGrafikImportPreview(token, base64) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  base64 = String(base64 || '');
  if (!base64) return { ok: false, msg: 'Brak pliku.' };

  let entries;
  try { entries = _xlsxUnzipEntries(base64); }
  catch (e) { return { ok: false, msg: 'Nie udało się odczytać pliku — czy to na pewno plik .xlsx?' }; }

  const workbookXml = entries['xl/workbook.xml'] ? entries['xl/workbook.xml'].getDataAsString() : '';
  const relsXml = entries['xl/_rels/workbook.xml.rels'] ? entries['xl/_rels/workbook.xml.rels'].getDataAsString() : '';
  if (!workbookXml || !relsXml) return { ok: false, msg: 'Plik nie wygląda na poprawny grafik Excela.' };

  const sheets = _xlsxParseWorkbookSheets(workbookXml, relsXml);
  const sharedXml = entries['xl/sharedStrings.xml'] ? entries['xl/sharedStrings.xml'].getDataAsString() : '';
  const shared = _xlsxParseSharedStrings(sharedXml);

  const glowny = sheets.find(s => s.name !== '_dane');
  const daneS = sheets.find(s => s.name === '_dane');
  if (!glowny || !entries[glowny.path]) return { ok: false, msg: 'Nie znaleziono arkusza z grafikiem.' };

  const cells = _xlsxParseSheetCells(entries[glowny.path].getDataAsString(), shared);

  // Mapa "wiersz,kolumna" -> {data, rola, osobaId, gabinetId} z ukrytego
  // arkusza "_dane" — pewne dopasowanie dla komórek, których osoba
  // wypełniająca formatkę nie ruszyła.
  const daneMap = {};
  if (daneS && entries[daneS.path]) {
    const daneCells = _xlsxParseSheetCells(entries[daneS.path].getDataAsString(), shared);
    const wiersze = {};
    Object.keys(daneCells).forEach(ref => {
      const c = daneCells[ref];
      if (!wiersze[c.row]) wiersze[c.row] = {};
      wiersze[c.row][c.col] = c.value;
    });
    Object.keys(wiersze).forEach(rIdx => {
      const w = wiersze[rIdx];
      if (!w[1] || w[1] === 'Wiersz') return; // nagłówek albo wiersz bez danych
      daneMap[w[1] + ',' + w[2]] = {
        data: String(w[3] || ''), rola: String(w[4] || ''),
        osobaId: String(w[5] || ''), gabinetId: String(w[6] || '')
      };
    });
  }

  const rok = parseInt(String((cells.B1 || {}).value || '').trim(), 10);
  const nazwaMiesiaca = String((cells.D1 || {}).value || '').trim().toUpperCase();
  const mies = GRAFIK_XLSX_MIESIACE.indexOf(nazwaMiesiaca) + 1;
  if (!rok || !mies) return { ok: false, msg: 'Nie rozpoznano roku/miesiąca w pliku (komórki B1/D1).' };

  const personel = _grafikPersonel();
  const gabinety = _gabinetyAll(false);
  const gabByNazwa = {};
  gabinety.forEach(g => { gabByNazwa[g.nazwa.toLowerCase()] = g.id; });

  const poPelnymImieniu = {};
  const poImieniu = {};
  personel.forEach(p => {
    poPelnymImieniu[(p.imie + ' ' + p.nazwisko).trim().toLowerCase()] = p;
    const imie = p.imie.trim().toLowerCase();
    if (!poImieniu[imie]) poImieniu[imie] = [];
    poImieniu[imie].push(p);
  });

  function dopasujOsobe(tekst) {
    const surowy = String(tekst || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
    const lower = surowy.toLowerCase();
    if (poPelnymImieniu[lower]) return { osoba: poPelnymImieniu[lower], pewne: true, kandydaci: [] };
    const pierwszy = lower.split(/\s+/)[0];
    const kand = poImieniu[pierwszy] || [];
    if (kand.length === 1) return { osoba: kand[0], pewne: true, kandydaci: [] };
    if (kand.length > 1) return { osoba: null, pewne: false, kandydaci: kand };
    return { osoba: null, pewne: false, kandydaci: [] };
  }

  function wyciagnijGabinet(tekst) {
    const m = String(tekst || '').match(/\(([^)]*)\)\s*$/);
    return m ? (gabByNazwa[m[1].trim().toLowerCase()] || null) : null;
  }

  const wpisy = [];
  const ileDni = new Date(rok, mies, 0).getDate();

  Object.keys(GRAFIK_XLSX_KOL).forEach(dzienStr => {
    const dzien = parseInt(dzienStr, 10);
    const kol = GRAFIK_XLSX_KOL[dzien];

    // Wiersze w tej kolumnie, które wyglądają jak numer dnia (1..N) —
    // każdy taki wiersz zaczyna kolejny blok tygodnia.
    const numeryDni = [];
    Object.keys(cells).forEach(ref => {
      const c = cells[ref];
      if (c.col !== kol) return;
      const txt = String(c.value).trim();
      const n = parseInt(txt, 10);
      if (!isNaN(n) && n >= 1 && n <= ileDni && txt === String(n)) numeryDni.push({ row: c.row, dzien: n });
    });
    numeryDni.sort((a, b) => a.row - b.row);

    numeryDni.forEach((nd, i) => {
      const dataStr = rok + '-' + String(mies).padStart(2, '0') + '-' + String(nd.dzien).padStart(2, '0');
      const kolejnyRow = (i + 1 < numeryDni.length) ? numeryDni[i + 1].row : (nd.row + 60);

      let biezacaObsada = null;
      let pustePodRzad = 0;
      for (let r = nd.row + 1; r < kolejnyRow; r++) {
        const nazwaC = cells[_idxToCol(kol) + r];
        if (!nazwaC || !String(nazwaC.value).trim()) {
          pustePodRzad++;
          if (pustePodRzad >= 2) break;
          continue;
        }
        pustePodRzad = 0;

        const godzC = cells[_idxToCol(kol + 1) + r];
        const godzTxt = godzC ? String(godzC.value).trim() : '';
        const godzM = godzTxt.match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/) ||
                      godzTxt.match(/^(\d{1,2})-(\d{1,2})$/);
        let od = '', do_ = '';
        if (godzM) {
          od = godzM[1].indexOf(':') === -1 ? godzM[1].padStart(2, '0') + ':00' : godzM[1];
          do_ = godzM[2].indexOf(':') === -1 ? godzM[2].padStart(2, '0') + ':00' : godzM[2];
        }

        const daneWpis = daneMap[r + ',' + kol];
        let dopasowanie;
        if (daneWpis && daneWpis.osobaId && personel.some(p => p.id === daneWpis.osobaId)) {
          dopasowanie = { osoba: personel.find(p => p.id === daneWpis.osobaId), pewne: true, kandydaci: [] };
        } else {
          dopasowanie = dopasujOsobe(nazwaC.value);
        }
        const p = dopasowanie.osoba;

        let jestObsada;
        if (daneWpis && daneWpis.rola) {
          jestObsada = daneWpis.rola === 'obsada';
        } else if (p && p.grupa === GRUPA_LEKARZ) {
          jestObsada = true; // lekarz zawsze zaczyna nowy blok
        } else if (p && p.grupa === GRUPA_HIGIENISTKA) {
          jestObsada = !biezacaObsada; // pierwsza w bloku = własny dyżur, kolejna = asysta
        } else {
          jestObsada = !biezacaObsada;
        }

        const gabinetId = (daneWpis && daneWpis.gabinetId) || wyciagnijGabinet(nazwaC.value) || null;

        const wpis = {
          data: dataStr, dzienTydzien: dzien, wiersz: r, kolumna: kol,
          rola: jestObsada ? 'obsada' : 'asysta',
          osobaTekst: String(nazwaC.value).trim(),
          osobaId: p ? p.id : '',
          osobaNazwa: p ? (p.imie + ' ' + p.nazwisko) : '',
          pewne: dopasowanie.pewne,
          kandydaci: dopasowanie.kandydaci.map(k => ({ id: k.id, nazwa: k.imie + ' ' + k.nazwisko })),
          gabinetId: gabinetId,
          od: od, do: do_
        };
        wpisy.push(wpis);
        if (jestObsada) biezacaObsada = wpis;
      }
    });
  });

  return {
    ok: true, rok, mies, wpisy,
    gabinety: gabinety.map(g => ({ id: g.id, nazwa: g.nazwa })),
    personel: personel.map(p => ({ id: p.id, nazwa: p.imie + ' ' + p.nazwisko, grupa: p.grupa }))
  };
}

/**
 * Zapisuje POTWIERDZONE (i ewentualnie poprawione w przeglądzie) pozycje
 * z importu. `wpisy` to gotowe bloki dnia — dokładnie w kształcie, jaki
 * przyjmuje masterZapiszDzienGrafiku — pogrupowane tu po dacie, żeby zapis
 * każdego dnia był atomowy: jedna zła data nie blokuje pozostałych.
 */
function masterGrafikImportZatwierdz(token, wpisy) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  wpisy = Array.isArray(wpisy) ? wpisy : [];
  if (!wpisy.length) return { ok: false, msg: 'Brak pozycji do zapisania.' };

  const personel = _grafikPersonel();
  const poDacie = {};
  wpisy.forEach(w => {
    if (!w || !_dataOk(w.data) || !w.osobaId) return;
    if (!poDacie[w.data]) poDacie[w.data] = [];
    const osoba = personel.find(p => p.id === w.osobaId);
    poDacie[w.data].push({
      gabinetId: w.gabinetId, osobaId: w.osobaId, od: w.od, do: w.do,
      typ: (osoba && osoba.grupa === GRUPA_HIGIENISTKA) ? BLOK_HIGIENA : BLOK_LEKARZ,
      asystaWymagana: null, asystaUwaga: '',
      asysta: Array.isArray(w.asysta) ? w.asysta : []
    });
  });

  const wyniki = [];
  Object.keys(poDacie).forEach(data => {
    const r = masterZapiszDzienGrafiku(token, data, poDacie[data]);
    wyniki.push({ data, ok: !!(r && r.ok), msg: (r && !r.ok && r.msg) || '', bloki: (r && r.bloki) || 0 });
  });

  _logAdmin('ImportGrafikuXLSX', '—', 'Import ' + Object.keys(poDacie).length + ' dni');
  return { ok: true, wyniki };
}

/**
 * Zapisuje komplet bloków dla JEDNEJ daty. Od tej chwili ta data nie
 * podlega już szablonowi — aż do jawnego przywrócenia.
 */
function masterZapiszDzienGrafiku(token, data, bloki) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  data = String(data || '').trim();
  if (!_dataOk(data)) return { ok: false, msg: 'Nieprawidłowa data.' };

  const dow = new Date(data + 'T12:00:00').getDay();
  if (GRAFIK_DAYS.indexOf(dow) === -1) return { ok: false, msg: 'Klinika jest w tym dniu nieczynna.' };
  const h = GRAFIK_HOURS[dow];

  bloki = Array.isArray(bloki) ? bloki : [];
  const personel = _grafikPersonel();
  const gabinety = _gabinetyAll(false);
  const czyste = [];

  for (let i = 0; i < bloki.length; i++) {
    const b = bloki[i] || {};
    const od = String(b.od || '').trim(), do_ = String(b.do || '').trim();
    const etykieta = (b.od || '?') + '–' + (b.do || '?');

    if (!_naSiatce(od) || !_naSiatce(do_)) {
      return { ok: false, msg: etykieta + ': godziny co ' + GRAFIK_KROK_MIN + ' minut.' };
    }
    if (_t2m(od) >= _t2m(do_)) return { ok: false, msg: etykieta + ': „do" musi być późniejsze.' };
    if (_t2m(od) < h.open || _t2m(do_) > h.close) {
      return { ok: false, msg: etykieta + ': poza godzinami otwarcia (' +
        _hhmm(h.open) + '–' + _hhmm(h.close) + ').' };
    }
    if (!gabinety.some(g => g.id === String(b.gabinetId))) {
      return { ok: false, msg: etykieta + ': nieznany gabinet.' };
    }
    const osoba = personel.find(p => p.id === String(b.osobaId));
    if (!osoba) return { ok: false, msg: etykieta + ': wybierz osobę.' };
    const typ = BLOK_TYPES.indexOf(b.typ) !== -1 ? b.typ : BLOK_LEKARZ;
    if (typ === BLOK_HIGIENA && osoba.grupa !== GRUPA_HIGIENISTKA) {
      return { ok: false, msg: etykieta + ': higienizację prowadzi higienistka.' };
    }
    if (typ === BLOK_LEKARZ && osoba.grupa !== GRUPA_LEKARZ) {
      return { ok: false, msg: etykieta + ': blok lekarski obsadza lekarz.' };
    }

    // Kolizje wewnątrz tego samego dnia.
    for (let j = 0; j < czyste.length; j++) {
      const c = czyste[j];
      if (c.gabinetId === String(b.gabinetId) && _zakresyNachodza(od, do_, c.od, c.do)) {
        return { ok: false, msg: etykieta + ': ten gabinet jest już zajęty w tych godzinach.' };
      }
      if (c.osobaId === String(b.osobaId) && _zakresyNachodza(od, do_, c.od, c.do)) {
        return { ok: false, msg: osoba.imie + ' ' + osoba.nazwisko + ' jest w tym czasie w innym gabinecie.' };
      }
    }

    const asysta = (Array.isArray(b.asysta) ? b.asysta : [])
      .map(a => ({ osobaId: String(a.osobaId || a), od: a.od || od, do: a.do || do_ }))
      .filter(a => a.osobaId && (_czyAsystaZew(a.osobaId) ||
        [GRUPA_ASYSTENTKA, GRUPA_HIGIENISTKA].indexOf(
          (personel.find(p => p.id === a.osobaId) || {}).grupa) !== -1));

    czyste.push({
      gabinetId: String(b.gabinetId), typ, osobaId: String(b.osobaId), od, do: do_,
      asystaWymagana: (b.asystaWymagana === '' || b.asystaWymagana == null)
        ? (typ === BLOK_LEKARZ ? 1 : 0) : parseInt(b.asystaWymagana, 10),
      asystaUwaga: String(b.asystaUwaga || '').trim().slice(0, 300),
      asysta
    });
  }

  _usunDzienGrafiku(data);

  const sh = _shGrafikDni();
  const teraz = new Date().toISOString();
  let seed = [];
  czyste.forEach(b => {
    const id = _nextId(seed, 'D');
    seed = seed.concat([{ id }]);
    sh.appendRow([id, data, b.gabinetId, b.typ, b.osobaId, b.od, b.do,
                  b.asystaWymagana, b.asystaUwaga, JSON.stringify(b.asysta), teraz]);
  });

  // Świadomie pusty dzień też jest decyzją — musimy ją zapamiętać,
  // inaczej szablon wróciłby przy najbliższym odświeżeniu.
  const puste = _dniPusteAll().filter(d => d !== data);
  if (!czyste.length) puste.push(data);
  _zapiszDniPuste(puste);

  _logAdmin('EdycjaDniaGrafiku', data, czyste.length + ' bloków');
  return { ok: true, bloki: czyste.length };
}

function _usunDzienGrafiku(data) {
  const sh = _shGrafikDni();
  if (sh.getLastRow() < 2) return;
  const rows = sh.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    if (_sheetDate(rows[i][1]) === data) sh.deleteRow(i + 1);
  }
}

/** Przywraca dzień do szablonu tygodniowego. */
function masterResetDzienGrafiku(token, data) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  data = String(data || '').trim();
  if (!_dataOk(data)) return { ok: false, msg: 'Nieprawidłowa data.' };
  _usunDzienGrafiku(data);
  _zapiszDniPuste(_dniPusteAll().filter(d => d !== data));
  _logAdmin('ResetDniaGrafiku', data, 'przywrócono szablon');
  return { ok: true };
}

/** Kopiuje obsadę z jednej daty na wskazane inne daty. */
function masterKopiujDzienGrafiku(token, zData, naDaty) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  if (!_dataOk(zData)) return { ok: false, msg: 'Nieprawidłowa data źródłowa.' };
  naDaty = Array.isArray(naDaty) ? naDaty.filter(_dataOk) : [];
  if (!naDaty.length) return { ok: false, msg: 'Nie wskazano dat docelowych.' };

  const y = parseInt(zData.slice(0, 4), 10), m = parseInt(zData.slice(5, 7), 10);
  const mies = masterGrafikMiesiac(token, y, m);
  if (!mies.ok) return mies;
  const zrodlo = (mies.dni.find(d => d.data === zData) || {}).bloki || [];

  let ok = 0;
  const bledy = [];
  naDaty.forEach(d => {
    const r = masterZapiszDzienGrafiku(token, d, zrodlo);
    if (r && r.ok) ok++; else bledy.push(d + ': ' + ((r && r.msg) || 'błąd'));
  });
  return { ok: true, skopiowano: ok, bledy: bledy.slice(0, 15) };
}

/**
 * Kopiuje wzorzec obsady JEDNEGO lekarza z dnia źródłowego na wskazane dni
 * docelowe — bez ruszania bloków pozostałych osób w te dni. To odpowiednik
 * masterKopiujDzienGrafiku, ale skoped do jednego lekarza: używa edytor
 * miesięczny "Grafik lekarza" do rozsiania ustawień jednego dnia na te same
 * dni tygodnia w całym miesiącu.
 *
 * Jeśli asysta z dnia źródłowego jest w danym dniu docelowym zajęta gdzie
 * indziej, blok lekarza i tak powstaje (bez tej osoby) — całe kopiowanie nie
 * ma się wywalać przez jeden zajęty termin asystentki.
 */
function masterKopiujBlokLekarzaNaDaty(token, osobaId, zData, naDaty) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  osobaId = String(osobaId || '');
  if (!_dataOk(zData)) return { ok: false, msg: 'Nieprawidłowa data źródłowa.' };
  naDaty = Array.isArray(naDaty) ? naDaty.filter(_dataOk) : [];
  if (!naDaty.length) return { ok: false, msg: 'Nie wskazano dat docelowych.' };

  const personel = _grafikPersonel();
  const osoba = personel.find(p => p.id === osobaId);
  if (!osoba || osoba.grupa !== GRUPA_LEKARZ) return { ok: false, msg: 'Wybierz lekarza.' };

  const ctx = _grafikKontekstDni();
  const zrodloStan = _grafikDzienStan(zData, ctx);
  const wzorzec = (zrodloStan.bloki || []).find(b => b.osobaId === osobaId && b.typ === BLOK_LEKARZ);
  if (!wzorzec) return { ok: false, msg: 'Brak bloku tego lekarza w dniu źródłowym.' };

  const wyniki = [];
  naDaty.forEach(data => {
    if (data === zData) { wyniki.push({ data, ok: true, msg: '', asystaPominieta: 0 }); return; }

    const stan = _grafikDzienStan(data, ctx);
    const inne = (stan.bloki || []).filter(b => b.osobaId !== osobaId);

    let pominieta = 0;
    const asysta = (wzorzec.asysta || []).filter(a => {
      const zajeta = inne.some(b =>
        (b.osobaId === a.osobaId && _zakresyNachodza(a.od, a.do, b.od, b.do)) ||
        (b.asysta || []).some(x => x.osobaId === a.osobaId && _zakresyNachodza(a.od, a.do, x.od, x.do)));
      if (zajeta) pominieta++;
      return !zajeta;
    });

    const nowyBlok = {
      gabinetId: wzorzec.gabinetId, typ: BLOK_LEKARZ, osobaId: osobaId,
      od: wzorzec.od, do: wzorzec.do,
      asystaWymagana: wzorzec.asystaWymagana, asystaUwaga: wzorzec.asystaUwaga,
      asysta: asysta
    };

    const r = masterZapiszDzienGrafiku(token, data, inne.concat([nowyBlok]));
    wyniki.push({
      data, ok: !!(r && r.ok), msg: (r && !r.ok && r.msg) || '',
      asystaPominieta: pominieta
    });
  });

  return { ok: true, wyniki };
}

// ── Rezerwacja pokrycia urlopu (sugestia zastępcy) ────────────
// Zakres dat urlopu pokazujemy jako listę dni, w których osoba miała
// bloki w grafiku — dla każdego bloku podpowiadamy, kto z tej samej
// grupy zawodowej jest w tym terminie wolny (nie ma tam już bloku ani
// nieobecności). To wyłącznie sugestia: administrator sam decyduje,
// czy i kogo przypisać — nic nie dzieje się automatycznie.
const POKRYCIE_URLOPU_MAX_DNI = 62;

function masterGetPokrycieUrlopu(token, empId, dataOd, dataDo) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  empId = String(empId || '').trim();
  dataOd = String(dataOd || '').trim();
  dataDo = String(dataDo || '').trim();
  if (!empId) return { ok: false, msg: 'Wybierz pracownika.' };
  if (!_dataOk(dataOd) || !_dataOk(dataDo)) return { ok: false, msg: 'Nieprawidłowy zakres dat.' };
  if (dataOd > dataDo) return { ok: false, msg: '"Do" musi być późniejsze niż "Od".' };

  const rozpietosc = Math.round(
    (new Date(dataDo + 'T12:00:00') - new Date(dataOd + 'T12:00:00')) / 86400000) + 1;
  if (rozpietosc > POKRYCIE_URLOPU_MAX_DNI) {
    return { ok: false, msg: 'Zakres zbyt długi na podgląd pokrycia (maks. ' + POKRYCIE_URLOPU_MAX_DNI + ' dni).' };
  }

  const personel = _grafikPersonel();
  const osoba = personel.find(p => p.id === empId);
  if (!osoba) return { ok: false, msg: 'Pracownik nie istnieje.' };

  const gabinety = _gabinetyAll(false);
  const ctx = _grafikKontekstDni();
  const absencje = _absenceMapAll();

  const dni = [];
  let kursor = new Date(dataOd + 'T12:00:00');
  const koniec = new Date(dataDo + 'T12:00:00');

  while (kursor <= koniec) {
    const ds = kursor.getFullYear() + '-' + String(kursor.getMonth() + 1).padStart(2, '0') +
      '-' + String(kursor.getDate()).padStart(2, '0');
    const stan = _grafikDzienStan(ds, ctx);
    const dotkniete = [];

    stan.bloki.forEach(b => {
      const wObsadzie = b.osobaId === empId;
      const wAsyscie = (b.asysta || []).some(a => a.osobaId === empId);
      if (!wObsadzie && !wAsyscie) return;

      const rola = wObsadzie ? 'obsada' : 'asysta';
      const rolaWymagana = wObsadzie ? [osoba.grupa] : [GRUPA_ASYSTENTKA, GRUPA_HIGIENISTKA];
      const oknoOd = wObsadzie ? b.od : ((b.asysta.find(a => a.osobaId === empId) || {}).od || b.od);
      const oknoDo = wObsadzie ? b.do : ((b.asysta.find(a => a.osobaId === empId) || {}).do || b.do);

      const kandydaci = personel.filter(p => {
        if (p.id === empId || rolaWymagana.indexOf(p.grupa) === -1) return false;
        if (absencje[p.id + '_' + ds]) return false;
        const zajety = stan.bloki.some(bb =>
          (bb.osobaId === p.id && _zakresyNachodza(oknoOd, oknoDo, bb.od, bb.do)) ||
          (bb.asysta || []).some(a => a.osobaId === p.id && _zakresyNachodza(oknoOd, oknoDo, a.od, a.do)));
        return !zajety;
      }).map(p => ({ id: p.id, imie: p.imie, nazwisko: p.nazwisko }));

      dotkniete.push({
        blokId: b.id,
        gabinet: (gabinety.find(g => g.id === b.gabinetId) || {}).nazwa || b.gabinetId,
        typ: b.typ, od: b.od, do: b.do, rola: rola,
        kandydaci: kandydaci
      });
    });

    if (dotkniete.length) dni.push({ data: ds, nazwaDnia: stan.nazwaDnia, bloki: dotkniete });
    kursor.setDate(kursor.getDate() + 1);
  }

  return { ok: true, empId, imieNazwisko: osoba.imie + ' ' + osoba.nazwisko, dni };
}

/**
 * Przypisuje zastępcę do JEDNEGO bloku w JEDNYM dniu — zamiast osoby na
 * urlopie (rola „obsada") albo w miejscu jej wpisu w asyście (rola „asysta").
 * Materializuje cały dzień przez masterZapiszDzienGrafiku, więc korzysta
 * z tej samej walidacji (siatka, kolizje, godziny otwarcia), co ręczna
 * edycja — bez osobnej ścieżki zapisu.
 */
function masterPrzypiszZastepceBloku(token, data, blokId, rola, empId, zastepcaId) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  data = String(data || '').trim();
  blokId = String(blokId || '').trim();
  rola = String(rola || '').trim();
  empId = String(empId || '').trim();
  zastepcaId = String(zastepcaId || '').trim();

  if (!_dataOk(data)) return { ok: false, msg: 'Nieprawidłowa data.' };
  if (rola !== 'obsada' && rola !== 'asysta') return { ok: false, msg: 'Nieprawidłowa rola.' };
  if (!zastepcaId) return { ok: false, msg: 'Wybierz zastępcę.' };
  if (zastepcaId === empId) return { ok: false, msg: 'Zastępca musi być inną osobą.' };

  const personel = _grafikPersonel();
  if (!personel.some(p => p.id === zastepcaId)) return { ok: false, msg: 'Zastępca nie istnieje.' };

  const ctx = _grafikKontekstDni();
  const stan = _grafikDzienStan(data, ctx);
  if (!stan.bloki.some(b => b.id === blokId)) {
    return { ok: false, msg: 'Nie znaleziono bloku w tym dniu (mógł się zmienić w międzyczasie).' };
  }

  const bloki = stan.bloki.map(b => {
    const kopia = {
      gabinetId: b.gabinetId, typ: b.typ, osobaId: b.osobaId, od: b.od, do: b.do,
      asystaWymagana: b.asystaWymagana, asystaUwaga: b.asystaUwaga, asysta: (b.asysta || []).slice()
    };
    if (b.id !== blokId) return kopia;
    if (rola === 'obsada') {
      kopia.osobaId = zastepcaId;
    } else {
      kopia.asysta = kopia.asysta.map(a => a.osobaId === empId ? { osobaId: zastepcaId, od: a.od, do: a.do } : a);
    }
    return kopia;
  });

  const wynik = masterZapiszDzienGrafiku(token, data, bloki);
  if (wynik.ok) _logAdmin('PrzypisanieZastepcyUrlop', empId, data + ': ' + rola + ' → ' + zastepcaId);
  return wynik;
}

// ── Niedostępność → automatyczny wpis do grafiku ──────────────
// Wywoływane z masterSetAbsenceRange (Dashboard.gs) w momencie
// REJESTRACJI nieobecności (nie przy jej czyszczeniu — cofnięcie
// automatycznie usuniętych bloków byłoby zgadywaniem, którego blok
// przywrócić i w jakich godzinach, więc świadomie tego nie robimy;
// właściciel dokłada bloki ręcznie, jeśli nieobecność była pomyłką).
//
// Osobę zdejmujemy z grafiku dwojako: jeśli jest głównym wykonawcą bloku
// (lekarz/higienistka) — blok znika, bo nie ma go kto obsadzić; jeśli
// jest tylko asystą — zostaje usunięta z listy asysty, a sam blok lekarza
// zostaje (silnik rekomendacji i tak go oznaczy jako brakujący asystę).
// Dodatkowo jedna zbiorcza adnotacja (typ "wolne") na cały zakres, żeby
// z samego grafiku było widać PRZYCZYNĘ braku obsady, a nie tylko fakt.

function _zdejmijZGrafikuNaNieobecnosc(token, empId, empImieNazwisko, dateFrom, dateTo, etykietaTypu) {
  const wynik = { dniZmienione: 0, blokowUsunietych: 0, asystZdjetych: 0 };
  let y = parseInt(dateFrom.slice(0, 4), 10), m = parseInt(dateFrom.slice(5, 7), 10);
  const yKoniec = parseInt(dateTo.slice(0, 4), 10), mKoniec = parseInt(dateTo.slice(5, 7), 10);

  while (y < yKoniec || (y === yKoniec && m <= mKoniec)) {
    const mies = masterGrafikMiesiac(token, y, m);
    if (mies.ok) {
      mies.dni.forEach(dz => {
        if (dz.data < dateFrom || dz.data > dateTo) return;
        if (!dz.czynny || !(dz.bloki || []).length) return;

        let zmieniono = false;
        const noweBloki = [];
        dz.bloki.forEach(b => {
          if (String(b.osobaId) === String(empId)) {
            zmieniono = true;
            wynik.blokowUsunietych++;
            return; // blok pomijamy — nie trafia do noweBloki
          }
          const asysta = b.asysta || [];
          if (asysta.some(a => String(a.osobaId) === String(empId))) {
            zmieniono = true;
            wynik.asystZdjetych++;
            noweBloki.push(Object.assign({}, b, {
              asysta: asysta.filter(a => String(a.osobaId) !== String(empId))
            }));
          } else {
            noweBloki.push(b);
          }
        });

        if (zmieniono) {
          const r = masterZapiszDzienGrafiku(token, dz.data, noweBloki);
          if (r && r.ok) wynik.dniZmienione++;
        }
      });
    }
    m++;
    if (m > 12) { m = 1; y++; }
  }

  masterSaveAdnotacja(token, {
    od: dateFrom, do: dateTo, typ: 'wolne',
    tresc: empImieNazwisko + ': ' + etykietaTypu, osobaId: String(empId)
  });

  return wynik;
}

// ── Synchronizacja z Google Calendar ─────────────────────────
// Dwukierunkowa, ale każdy kierunek robi jedną, konkretną rzecz:
//   RCP → Kalendarz: ISTNIENIE bloku (dodanie/usunięcie w RCP tworzy
//                     lub kasuje wydarzenie).
//   Kalendarz → RCP: GODZINY (przesunięcie wydarzenia w telefonie czy
//                     na komputerze wraca do RCP przy kolejnej synchronizacji).
// CalendarApp działa po stronie serwerów Google — właściciel autoryzuje
// dostęp raz (standardowe okno zgody Apps Script), bez żadnej ręcznej
// konfiguracji OAuth.
//
// Każde wydarzenie założone przez RCP niesie w opisie znacznik
// [WeSMILE:data:blokId] — tylko po nim rozpoznajemy „nasze” wydarzenia;
// nic innego w kalendarzu właściciela nigdy nie jest ruszane.
//
// Znane ograniczenie: masterZapiszDzienGrafiku (wywoływany też przez
// krok „pociągnięcia” godzin z Kalendarza) zawsze nadaje NOWE ID blokom
// zapisywanego dnia — to established zachowanie GrafikDni, używane też
// przez kalendarz z przeciąganiem i nie jest tu zmieniane, bo dużo w
// aplikacji na nim polega. Skutek: wydarzenie powiązane z blokiem, który
// tego dnia się zmienił, przy kolejnej synchronizacji zostanie odtworzone
// od nowa (usunięte i założone ponownie) zamiast zaktualizowane w miejscu.
// Sam grafik się nie rozjeżdża — traci się tylko ciągłość wydarzenia
// (np. własne przypomnienie dopięte w Kalendarzu do tego konkretnego wpisu).

const GCAL_PROP_KEY = 'grafik_gcal_id';
const GCAL_TAG_RE = /\[WeSMILE:(\d{4}-\d{2}-\d{2}):([A-Za-z0-9]+)\]/;

function masterGcalGetConfig(token) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  const id = PropertiesService.getScriptProperties().getProperty(GCAL_PROP_KEY) || '';
  let nazwa = '';
  if (id) {
    try { const c = CalendarApp.getCalendarById(id); nazwa = c ? c.getName() : ''; }
    catch (e) { nazwa = ''; }
  }
  return { ok: true, calendarId: id, polaczony: !!nazwa, nazwaKalendarza: nazwa };
}

function masterGcalSetConfig(token, calendarId) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  calendarId = String(calendarId || '').trim();
  if (!calendarId) {
    PropertiesService.getScriptProperties().deleteProperty(GCAL_PROP_KEY);
    return { ok: true, calendarId: '' };
  }
  let cal;
  try { cal = CalendarApp.getCalendarById(calendarId); } catch (e) { cal = null; }
  if (!cal) return { ok: false, msg: 'Nie znaleziono kalendarza o tym identyfikatorze (albo brak dostępu).' };
  PropertiesService.getScriptProperties().setProperty(GCAL_PROP_KEY, calendarId);
  _logAdmin('KonfiguracjaGCal', calendarId, cal.getName());
  return { ok: true, calendarId, nazwaKalendarza: cal.getName() };
}

function masterGcalSync(token, rok, mies) {
  if (!_masterOk(token)) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  const calendarId = PropertiesService.getScriptProperties().getProperty(GCAL_PROP_KEY) || '';
  if (!calendarId) return { ok: false, msg: 'Najpierw podłącz kalendarz Google.' };
  let cal;
  try { cal = CalendarApp.getCalendarById(calendarId); } catch (e) { cal = null; }
  if (!cal) return { ok: false, msg: 'Kalendarz niedostępny — sprawdź identyfikator i uprawnienia.' };

  const miesiac = masterGrafikMiesiac(token, rok, mies);
  if (!miesiac.ok) return miesiac;

  const gabMap = {};
  (miesiac.gabinety || []).forEach(g => { gabMap[g.id] = g.nazwa; });
  const nazwaOsobyGcal = id => {
    const p = (miesiac.personel || []).find(x => x.id === id);
    if (p) return p.imie + ' ' + p.nazwisko;
    return _czyAsystaZew(id) ? _labelAsystaZew(id) : id;
  };

  const pierwszy = new Date(rok, mies - 1, 1, 0, 0, 0);
  const ostatniDzienMies = new Date(rok, mies, 0, 23, 59, 59);
  const zdarzenia = cal.getEvents(pierwszy, ostatniDzienMies);
  const naszeWg = {}; // 'data|blokId' -> CalendarEvent
  zdarzenia.forEach(ev => {
    const m = GCAL_TAG_RE.exec(ev.getDescription() || '');
    if (m) naszeWg[m[1] + '|' + m[2]] = ev;
  });

  const blokiRcp = {}; // 'data|blokId' -> { dzien, blok }
  miesiac.dni.forEach(dz => {
    (dz.bloki || []).forEach(b => { blokiRcp[dz.data + '|' + b.id] = { dzien: dz, blok: b }; });
  });

  // 1) Godziny nadpisane ręcznie w Kalendarzu wracają do RCP. Grupujemy
  //    po dniu, bo zapis dnia (masterZapiszDzienGrafiku) zawsze zapisuje
  //    cały dzień naraz, nie pojedynczy blok.
  const zmienioneDni = {};
  Object.keys(naszeWg).forEach(klucz => {
    const wpis = blokiRcp[klucz];
    if (!wpis) return; // blok już nie istnieje w RCP — posprzątamy w kroku 3
    const ev = naszeWg[klucz];
    const evOd = _hhmm(ev.getStartTime().getHours() * 60 + ev.getStartTime().getMinutes());
    const evDo = _hhmm(ev.getEndTime().getHours() * 60 + ev.getEndTime().getMinutes());
    if (evOd !== wpis.blok.od || evDo !== wpis.blok.do) {
      wpis.blok.od = evOd;
      wpis.blok.do = evDo;
      zmienioneDni[wpis.dzien.data] = true;
    }
  });
  let pociagnieteZKalendarza = 0;
  const bledyPull = [];
  Object.keys(zmienioneDni).forEach(data => {
    const dz = miesiac.dni.find(x => x.data === data);
    const r = masterZapiszDzienGrafiku(token, data, dz.bloki);
    if (r.ok) pociagnieteZKalendarza++; else bledyPull.push(data + ': ' + r.msg);
  });

  // 2) RCP → Kalendarz: dodaj brakujące wydarzenia, zaktualizuj istniejące.
  let utworzone = 0, zaktualizowane = 0;
  Object.keys(blokiRcp).forEach(klucz => {
    const wpis = blokiRcp[klucz];
    const dzien = wpis.dzien, blok = wpis.blok;
    const tytul = (gabMap[blok.gabinetId] || blok.gabinetId) + ' — ' + nazwaOsobyGcal(blok.osobaId) +
      (blok.typ === BLOK_HIGIENA ? ' (higienizacja)' : '');
    const asysta = (blok.asysta || []).map(a => nazwaOsobyGcal(a.osobaId)).join(', ');
    const opis = '[WeSMILE:' + dzien.data + ':' + blok.id + ']' +
      (asysta ? '\nAsysta: ' + asysta : (blok.typ === BLOK_LEKARZ ? '\nBRAK ASYSTY' : ''));
    const start = new Date(dzien.data + 'T' + blok.od + ':00');
    const koniec = new Date(dzien.data + 'T' + blok.do + ':00');

    const ev = naszeWg[klucz];
    if (!ev) {
      cal.createEvent(tytul, start, koniec, { description: opis });
      utworzone++;
    } else if (ev.getTitle() !== tytul || ev.getDescription() !== opis ||
               ev.getStartTime().getTime() !== start.getTime() || ev.getEndTime().getTime() !== koniec.getTime()) {
      ev.setTitle(tytul);
      ev.setTime(start, koniec);
      ev.setDescription(opis);
      zaktualizowane++;
    }
  });

  // 3) Sprzątanie: nasze wydarzenia bez odpowiadającego bloku w RCP
  //    (blok usunięty albo — patrz ograniczenie wyżej — dostał nowe ID
  //    przy zapisie dnia).
  let usuniete = 0;
  Object.keys(naszeWg).forEach(klucz => {
    if (!blokiRcp[klucz]) { naszeWg[klucz].deleteEvent(); usuniete++; }
  });

  _logAdmin('SynchronizacjaGCal', rok + '-' + String(mies).padStart(2, '0'),
    'utworzono ' + utworzone + ', zaktualizowano ' + zaktualizowane + ', usunięto ' + usuniete +
    ', pociągnięto godzin z kalendarza ' + pociagnieteZKalendarza);

  return {
    ok: true, utworzono, zaktualizowane, usuniete,
    pociagnieteZKalendarza, bledyPull: bledyPull.slice(0, 10)
  };
}
