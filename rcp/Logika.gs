// ============================================================
// Logika.gs — We SMILE RCP „OPOKA” v1.0
// Czyste funkcje logiki biznesowej — ZERO wywołań API Google.
// Ten plik jest testowalny poza Apps Script (Node.js) i został
// przetestowany zestawem testów jednostkowych (patrz INSTRUKCJA.md).
// ============================================================

/** Typy nieobecności dostępne dla danej formy zatrudnienia. */
var TYPY_NIEOBECNOSCI = {
  'Umowa o pracę': [
    'Urlop wypoczynkowy',
    'Urlop na żądanie',
    'Zwolnienie lekarskie (L4)',
    'Opieka nad dzieckiem (art. 188 KP)',
    'Urlop okolicznościowy',
    'Urlop bezpłatny',
    'Delegacja / szkolenie',
    'Inna usprawiedliwiona nieobecność'
  ],
  'Zlecenie': ['Przerwa w świadczeniu usług', 'Choroba', 'Inna nieobecność'],
  'B2B':      ['Przerwa w świadczeniu usług', 'Choroba', 'Inna nieobecność'],
  'Inne':     ['Przerwa w świadczeniu usług', 'Choroba', 'Inna nieobecność']
};

/** Zwraca listę typów nieobecności dla formy zatrudnienia (bezpieczny fallback). */
function typyDlaFormy(forma) {
  return TYPY_NIEOBECNOSCI[String(forma || '')] || TYPY_NIEOBECNOSCI['Inne'];
}

/** 'HH:MM' → minuty od północy, albo null gdy format niepoprawny. */
function czasNaMinuty(t) {
  if (!poprawnyCzas(t)) return null;
  var p = String(t).split(':');
  return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
}

/** Minuty od północy → 'HH:MM'. */
function minutyNaCzas(m) {
  m = Math.max(0, Math.min(1439, parseInt(m, 10) || 0));
  var h = Math.floor(m / 60);
  return (h < 10 ? '0' : '') + h + ':' + (m % 60 < 10 ? '0' : '') + (m % 60);
}

/** Suma minut → 'H:MM' (do wyświetlania). */
function formatujMinuty(m) {
  if (m === null || m === undefined || isNaN(m)) return '';
  m = parseInt(m, 10);
  return Math.floor(m / 60) + ':' + (m % 60 < 10 ? '0' : '') + (m % 60);
}

/** Walidacja godziny 'HH:MM' (00:00–23:59). */
function poprawnyCzas(t) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(t || ''));
}

/** Walidacja daty 'yyyy-MM-dd' — format ORAZ realność (odrzuca 2026-02-30). */
function poprawnaData(d) {
  var s = String(d || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  var y = parseInt(s.slice(0, 4), 10), m = parseInt(s.slice(5, 7), 10), dd = parseInt(s.slice(8, 10), 10);
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || dd < 1) return false;
  var dni = new Date(y, m, 0).getDate();
  return dd <= dni;
}

/** Walidacja 4-cyfrowego PIN-u. */
function poprawnyPin(pin) {
  return /^\d{4}$/.test(String(pin || ''));
}

/** Walidacja uzasadnienia ręcznego wpisu / korekty (5–300 znaków po przycięciu). */
function poprawneUzasadnienie(u) {
  var s = String(u || '').trim();
  return s.length >= 5 && s.length <= 300;
}

/** Różnica dni między datami 'yyyy-MM-dd' (b - a). Zakłada poprawne daty. */
function rozniceDni(a, b) {
  var da = new Date(a + 'T12:00:00'), db = new Date(b + 'T12:00:00');
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

/**
 * Paruje zdarzenia jednego dnia w odcinki pracy.
 * Wejście: [{akcja:'WEJSCIE'|'WYJSCIE', godzina:'HH:MM', kolejnosc:int}, ...]
 * (kolejnosc = numer wiersza w arkuszu — rozstrzyga remisy tej samej godziny).
 * Wynik: {
 *   odcinki:   [{od,do,minuty}] — tylko odcinki KOMPLETNE (od i do),
 *   otwarteOd: 'HH:MM' | null  — WEJŚCIE bez późniejszego WYJŚCIA,
 *   minuty:    suma minut kompletnych, poprawnych odcinków,
 *   bledy:     [opisy naruszeń sekwencji] — np. dwa WEJŚCIA pod rząd
 * }
 */
function parujOdcinki(zdarzenia) {
  var lista = (zdarzenia || []).slice().filter(function (z) {
    return z && (z.akcja === 'WEJSCIE' || z.akcja === 'WYJSCIE') && czasNaMinuty(z.godzina) !== null;
  });
  lista.sort(function (a, b) {
    var d = czasNaMinuty(a.godzina) - czasNaMinuty(b.godzina);
    return d !== 0 ? d : ((a.kolejnosc || 0) - (b.kolejnosc || 0));
  });

  var odcinki = [], bledy = [], otwarte = null, minuty = 0;
  for (var i = 0; i < lista.length; i++) {
    var z = lista[i];
    if (z.akcja === 'WEJSCIE') {
      if (otwarte !== null) {
        bledy.push('WEJŚCIE ' + z.godzina + ' bez wcześniejszego WYJŚCIA (poprzednie WEJŚCIE ' + otwarte + ')');
      }
      otwarte = z.godzina;
    } else { // WYJSCIE
      if (otwarte === null) {
        bledy.push('WYJŚCIE ' + z.godzina + ' bez wcześniejszego WEJŚCIA');
      } else {
        var d = czasNaMinuty(z.godzina) - czasNaMinuty(otwarte);
        if (d < 0) {
          bledy.push('WYJŚCIE ' + z.godzina + ' wcześniejsze niż WEJŚCIE ' + otwarte);
          odcinki.push({ od: otwarte, do: z.godzina, minuty: 0 });
        } else {
          odcinki.push({ od: otwarte, do: z.godzina, minuty: d });
          minuty += d;
        }
        otwarte = null;
      }
    }
  }
  return { odcinki: odcinki, otwarteOd: otwarte, minuty: minuty, bledy: bledy };
}

/** Kolejna dozwolona akcja na podstawie zdarzeń dnia. */
function nastepnaAkcja(zdarzenia) {
  return parujOdcinki(zdarzenia).otwarteOd !== null ? 'WYJSCIE' : 'WEJSCIE';
}

/**
 * Sprawdza, czy ręcznie wpisywany odcinek koliduje z istniejącym stanem dnia.
 * parowanie — wynik parujOdcinki() dla dnia; od/do — 'HH:MM' lub '' (puste).
 * Dozwolone kombinacje: (od+do) pełny odcinek, (samo do) domknięcie otwartego
 * WEJŚCIA, (samo od) otwarcie odcinka PO wszystkich istniejących.
 * Zwraca null gdy OK, albo tekst błędu.
 */
function kolizjaOdcinka(parowanie, od, do_) {
  var maOd = !!od, maDo = !!do_;
  if (!maOd && !maDo) return 'Podaj godzinę wejścia, wyjścia lub obie.';
  if (maOd && !poprawnyCzas(od)) return 'Nieprawidłowa godzina wejścia (format HH:MM).';
  if (maDo && !poprawnyCzas(do_)) return 'Nieprawidłowa godzina wyjścia (format HH:MM).';
  if (maOd && maDo && czasNaMinuty(do_) <= czasNaMinuty(od)) {
    return 'Godzina wyjścia musi być późniejsza niż wejścia. Odcinek przez północ wpisz jako dwa dni.';
  }

  var i, ex;

  if (maOd && maDo) {
    if (parowanie.otwarteOd !== null) {
      return 'Ten dzień ma niedokończone WEJŚCIE o ' + parowanie.otwarteOd + ' — najpierw uzupełnij samo wyjście.';
    }
    for (i = 0; i < parowanie.odcinki.length; i++) {
      ex = parowanie.odcinki[i];
      if (czasNaMinuty(od) < czasNaMinuty(ex.do) && czasNaMinuty(do_) > czasNaMinuty(ex.od)) {
        return 'Odcinek ' + od + '–' + do_ + ' nakłada się na istniejący ' + ex.od + '–' + ex.do + '.';
      }
    }
    return null;
  }

  if (maDo) { // samo wyjście — domyka otwarte wejście
    if (parowanie.otwarteOd === null) return 'Brak niedokończonego WEJŚCIA do domknięcia — wpisz też godzinę wejścia.';
    if (czasNaMinuty(do_) <= czasNaMinuty(parowanie.otwarteOd)) {
      return 'Wyjście musi być późniejsze niż otwarte WEJŚCIE o ' + parowanie.otwarteOd + '.';
    }
    return null;
  }

  // samo wejście — otwiera odcinek po wszystkim, co już jest
  if (parowanie.otwarteOd !== null) return 'Ten dzień ma już niedokończone WEJŚCIE o ' + parowanie.otwarteOd + '.';
  for (i = 0; i < parowanie.odcinki.length; i++) {
    ex = parowanie.odcinki[i];
    if (czasNaMinuty(od) < czasNaMinuty(ex.do)) {
      return 'WEJŚCIE ' + od + ' musi być późniejsze niż koniec ostatniego odcinka (' + ex.do + ').';
    }
  }
  return null;
}

/**
 * Walidacja pełnego zestawu odcinków dnia (edytor Właściciela).
 * odcinki: [{od,do}] — maks. 8, każdy poprawny, do>od, bez nakładania.
 * Zwraca null gdy OK, albo tekst błędu.
 */
function walidujOdcinkiDnia(odcinki) {
  if (!Array.isArray(odcinki)) return 'Nieprawidłowe dane odcinków.';
  if (odcinki.length > 8) return 'Maksymalnie 8 odcinków w jednym dniu.';
  var czyste = [];
  for (var i = 0; i < odcinki.length; i++) {
    var o = odcinki[i] || {};
    var od = String(o.od || '').trim(), do_ = String(o.do || '').trim();
    if (!od && !do_) continue; // pusty wiersz formularza — pomijamy
    if (!poprawnyCzas(od)) return 'Odcinek ' + (i + 1) + ': nieprawidłowa godzina wejścia.';
    if (!poprawnyCzas(do_)) return 'Odcinek ' + (i + 1) + ': nieprawidłowa godzina wyjścia.';
    if (czasNaMinuty(do_) <= czasNaMinuty(od)) return 'Odcinek ' + (i + 1) + ': wyjście musi być późniejsze niż wejście.';
    czyste.push({ od: od, do: do_ });
  }
  czyste.sort(function (a, b) { return czasNaMinuty(a.od) - czasNaMinuty(b.od); });
  for (var j = 1; j < czyste.length; j++) {
    if (czasNaMinuty(czyste[j].od) < czasNaMinuty(czyste[j - 1].do)) {
      return 'Odcinki ' + czyste[j - 1].od + '–' + czyste[j - 1].do + ' i ' + czyste[j].od + '–' + czyste[j].do + ' nakładają się.';
    }
  }
  return null;
}

/** Znormalizowane, posortowane odcinki dnia (po przejściu walidacji). */
function czysteOdcinkiDnia(odcinki) {
  var czyste = [];
  (odcinki || []).forEach(function (o) {
    o = o || {};
    var od = String(o.od || '').trim(), do_ = String(o.do || '').trim();
    if (od && do_) czyste.push({ od: od, do: do_ });
  });
  czyste.sort(function (a, b) { return czasNaMinuty(a.od) - czasNaMinuty(b.od); });
  return czyste;
}

/** Etykieta odcinków do wyświetlenia, np. "09:00–10:00, 15:00–20:00 (+ otwarte 21:00)". */
function opiszOdcinki(parowanie) {
  var czesci = parowanie.odcinki.map(function (o) { return o.od + '–' + o.do; });
  var s = czesci.join(', ');
  if (parowanie.otwarteOd !== null) s += (s ? ', ' : '') + parowanie.otwarteOd + '–…';
  return s || '—';
}

// Eksport dla środowiska testowego Node.js (w Apps Script ten blok jest neutralny).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TYPY_NIEOBECNOSCI: TYPY_NIEOBECNOSCI, typyDlaFormy: typyDlaFormy,
    czasNaMinuty: czasNaMinuty, minutyNaCzas: minutyNaCzas, formatujMinuty: formatujMinuty,
    poprawnyCzas: poprawnyCzas, poprawnaData: poprawnaData, poprawnyPin: poprawnyPin,
    poprawneUzasadnienie: poprawneUzasadnienie, rozniceDni: rozniceDni,
    parujOdcinki: parujOdcinki, nastepnaAkcja: nastepnaAkcja,
    kolizjaOdcinka: kolizjaOdcinka, walidujOdcinkiDnia: walidujOdcinkiDnia,
    czysteOdcinkiDnia: czysteOdcinkiDnia, opiszOdcinki: opiszOdcinki
  };
}
