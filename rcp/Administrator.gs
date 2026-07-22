// ============================================================
// Administrator.gs — We SMILE RCP „OPOKA” v1.0
// Widok Admina-Edytora: konta, PIN-y, logi.
// setupOpoka(): jednorazowa, IDEMPOTENTNA migracja — wyłącznie
// dodaje kolumny/arkusze i hashuje PIN-y. Żaden istniejący wiersz
// Ewidencji nie jest modyfikowany ani usuwany.
// ============================================================

function _sesjaAd(token) {
  var empId = _sesjaEmp('sa_', token, TTL_SESJA_PANEL);
  if (!empId) return null;
  var p = _pracownikPoId(empId);
  return (p && p.aktywny && p.admin) ? p : null;
}

function adLogin(pin) {
  if (!poprawnyPin(pin)) return { ok: false, msg: 'PIN musi mieć 4 cyfry.' };
  if (!_ogrRate('ad')) return { ok: false, msg: 'Zbyt wiele prób. Odczekaj 5 minut.' };
  var p = _pracownikPoPinie(pin);
  if (!p || !p.admin) {
    _anomalia('—', 'Nieudana próba logowania do panelu admina.');
    return { ok: false, msg: 'Brak dostępu.' };
  }
  _resetRate('ad');
  var token = _sesjaNowa('sa_', p.id, TTL_SESJA_PANEL);
  _log('LogowanieAdmin', p.id, p.imie + ' ' + p.nazwisko);
  return { ok: true, token: token, imie: p.imie };
}

function adPracownicy(token) {
  var ad = _sesjaAd(token);
  if (!ad) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  var lista = _pracownicy().map(function (p) {
    return {
      id: p.id, imie: p.imie, nazwisko: p.nazwisko, stanowisko: p.stanowisko,
      aktywny: p.aktywny, wlasciciel: p.wlasciciel, admin: p.admin, forma: p.forma,
      maPin: !!(p.pinHash && p.pinSol)
    };
  });
  return { ok: true, lista: lista, formy: Object.keys(TYPY_NIEOBECNOSCI) };
}

function adDodaj(token, imie, nazwisko, stanowisko, forma, czyWlasciciel, czyAdmin) {
  var ad = _sesjaAd(token);
  if (!ad) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };

  imie = String(imie || '').trim();
  nazwisko = String(nazwisko || '').trim();
  stanowisko = String(stanowisko || '').trim();
  forma = String(forma || '').trim();
  if (imie.length < 2 || imie.length > 60) return { ok: false, msg: 'Podaj imię (2–60 znaków).' };
  if (nazwisko.length < 2 || nazwisko.length > 60) return { ok: false, msg: 'Podaj nazwisko (2–60 znaków).' };
  if (!TYPY_NIEOBECNOSCI[forma]) return { ok: false, msg: 'Wybierz formę zatrudnienia.' };

  return _zLockiem(function () {
    var sh = _ark('Pracownicy');
    var maks = 0;
    _pracownicy().forEach(function (p) {
      var m = /^WS(\d+)$/.exec(p.id);
      if (m) maks = Math.max(maks, parseInt(m[1], 10));
    });
    var nowyNr = maks + 1;
    var id = 'WS' + (nowyNr < 10 ? '0' : '') + nowyNr;
    var pin = _losowyPin();
    var sol = _uuid();

    var wiersz = new Array(PR_KOLUMN).fill('');
    wiersz[PR.ID] = id; wiersz[PR.IMIE] = imie; wiersz[PR.NAZ] = nazwisko;
    wiersz[PR.STANOWISKO] = stanowisko || '—'; wiersz[PR.STATUS] = 'Aktywny'; wiersz[PR.PIN] = '';
    wiersz[PR.HASH] = _hashPin(pin, sol); wiersz[PR.SOL] = sol;
    wiersz[PR.WLASCICIEL] = czyWlasciciel ? 'TAK' : '';
    wiersz[PR.ADMIN] = czyAdmin ? 'TAK' : '';
    wiersz[PR.FORMA] = forma;
    sh.appendRow(wiersz);

    _log('DodaniePracownika', ad.id, id + ' ' + imie + ' ' + nazwisko + ' (' + forma + ')');
    return { ok: true, id: id, pin: pin }; // PIN pokazany JEDEN raz — nigdzie nie jest zapisany jawnie
  });
}

function adStatus(token, empId, aktywny) {
  var ad = _sesjaAd(token);
  if (!ad) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };

  return _zLockiem(function () {
    var p = _pracownikPoId(empId);
    if (!p) return { ok: false, msg: 'Nie znaleziono pracownika.' };
    if (!aktywny && p.id === ad.id) return { ok: false, msg: 'Nie można dezaktywować własnego konta.' };
    if (!aktywny && p.admin) {
      var inniAdmini = _pracownicy().filter(function (x) { return x.admin && x.aktywny && x.id !== p.id; });
      if (!inniAdmini.length) return { ok: false, msg: 'Nie można dezaktywować ostatniego aktywnego admina.' };
    }
    _ark('Pracownicy').getRange(p.wiersz, PR.STATUS + 1).setValue(aktywny ? 'Aktywny' : 'Nieaktywny');
    _log('ZmianaStatusu', ad.id, p.id + ' → ' + (aktywny ? 'Aktywny' : 'Nieaktywny'));
    return { ok: true };
  });
}

function adResetPin(token, empId) {
  var ad = _sesjaAd(token);
  if (!ad) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };

  return _zLockiem(function () {
    var p = _pracownikPoId(empId);
    if (!p) return { ok: false, msg: 'Nie znaleziono pracownika.' };
    var pin = _losowyPin();
    var sol = _uuid();
    var sh = _ark('Pracownicy');
    sh.getRange(p.wiersz, PR.HASH + 1).setValue(_hashPin(pin, sol));
    sh.getRange(p.wiersz, PR.SOL + 1).setValue(sol);
    sh.getRange(p.wiersz, PR.PIN + 1).setValue(''); // jawny PIN nigdy nie wraca do arkusza
    _log('ResetPIN', ad.id, p.id);
    return { ok: true, id: p.id, kto: p.imie + ' ' + p.nazwisko, pin: pin };
  });
}

function adLogi(token) {
  var ad = _sesjaAd(token);
  if (!ad) return { ok: false, errorType: 'UNAUTHORIZED', msg: 'Sesja wygasła.' };
  var sh = _ark('Logi_Admin');
  var n = sh.getLastRow();
  if (n < 2) return { ok: true, logi: [] };
  var od = Math.max(2, n - 49);
  var logi = sh.getRange(od, 1, n - od + 1, 4).getValues().map(function (r) {
    return { ts: String(r[0]), akcja: String(r[1]), empId: String(r[2]), szczegoly: String(r[3]) };
  }).reverse();
  return { ok: true, logi: logi };
}

// ============================================================
// setupOpoka() — uruchom RĘCZNIE JEDEN RAZ z edytora Apps Script
// po wgraniu plików. Bezpieczna do wielokrotnego uruchomienia.
// ============================================================

function setupOpoka() {
  var ss = SpreadsheetApp.openById(SS_ID);

  // 1) Sekret PEPPER (do hashowania PIN-ów) — poza arkuszem.
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('PEPPER')) {
    props.setProperty('PEPPER', Utilities.getUuid() + '-' + Utilities.getUuid());
    Logger.log('Wygenerowano PEPPER.');
  }

  // 2) Wymagane arkusze.
  [
    { nazwa: 'Pracownicy',   nagl: ['ID', 'Imię', 'Nazwisko', 'Rola', 'Status', 'PIN'] },
    { nazwa: 'Ewidencja',    nagl: ['Timestamp', 'EmpID', 'Imię', 'Nazwisko', 'Akcja', 'Data', 'Godzina', 'Źródło'] },
    { nazwa: 'Anomalie',     nagl: ['Timestamp', 'EmpID', 'Opis'] },
    { nazwa: 'Logi_Admin',   nagl: ['Timestamp', 'Akcja', 'EmpID', 'Szczegoly'] },
    { nazwa: 'Nieobecnosci', nagl: ['WpisID', 'EmpID', 'Data', 'Typ', 'Opis', 'OznaczylID', 'Timestamp', 'Status', 'Zatwierdzil'] }
  ].forEach(function (def) {
    var sh = ss.getSheetByName(def.nazwa);
    if (!sh) sh = ss.insertSheet(def.nazwa);
    if (sh.getLastRow() === 0) sh.appendRow(def.nagl);
  });

  // 3) Ewidencja: dopisz nagłówki nowych kolumn (I–M). Istniejące wiersze NIETKNIĘTE.
  var ew = ss.getSheetByName('Ewidencja');
  if (ew.getMaxColumns() < 13) ew.insertColumnsAfter(ew.getMaxColumns(), 13 - ew.getMaxColumns());
  var ewNagl = ['ZdarzenieID', 'Uzasadnienie', 'Status', 'Meta', 'Zatwierdzil'];
  for (var c = 0; c < 5; c++) {
    var kom = ew.getRange(1, 9 + c);
    if (String(kom.getValue()) === '') kom.setValue(ewNagl[c]);
  }
  // Kolumny Data/Godzina jako tekst dla nowych wpisów (stare wartości bez zmian).
  ew.getRange(1, 6, ew.getMaxRows(), 2).setNumberFormat('@');

  // 4) Pracownicy: nowe kolumny + hashowanie istniejących PIN-ów + role.
  var pr = ss.getSheetByName('Pracownicy');
  if (pr.getMaxColumns() < 11) pr.insertColumnsAfter(pr.getMaxColumns(), 11 - pr.getMaxColumns());
  var prNagl = ['PIN_Hash', 'PIN_Sol', 'Czy_Wlasciciel', 'Czy_Admin', 'Forma_Zatrudnienia'];
  for (var c2 = 0; c2 < 5; c2++) {
    var kom2 = pr.getRange(1, 7 + c2);
    if (String(kom2.getValue()) === '') kom2.setValue(prNagl[c2]);
  }

  var pepper = props.getProperty('PEPPER');
  var n = pr.getLastRow();
  if (n >= 2) {
    var dane = pr.getRange(2, 1, n - 1, 11).getValues();
    for (var i = 0; i < dane.length; i++) {
      var r = dane[i], w = i + 2, zmiana = false;
      var jawnyPin = String(r[5] || '').trim();
      var maHash = String(r[6] || '') !== '';
      if (jawnyPin !== '' && !maHash) {
        if (!/^\d{1,4}$/.test(jawnyPin)) { Logger.log('Wiersz ' + w + ': PIN w złym formacie — pomijam.'); }
        else {
          var pin4 = ('000' + jawnyPin).slice(-4); // zgodność z _pinMatch v6.0 (zera wiodące)
          var sol = Utilities.getUuid();
          r[6] = _hex(Utilities.computeHmacSha256Signature(sol + ':' + pin4, pepper));
          r[7] = sol; r[5] = ''; zmiana = true;
        }
      } else if (jawnyPin !== '' && maHash) { r[5] = ''; zmiana = true; } // sprzątamy jawny PIN
      if (String(r[8]) === '' && String(r[3]).trim().toLowerCase() === 'admin') { r[8] = 'TAK'; r[9] = 'TAK'; zmiana = true; }
      if (String(r[10]) === '') { r[10] = 'Umowa o pracę'; zmiana = true; }
      if (zmiana) pr.getRange(w, 1, 1, 11).setValues([r]);
    }
  }

  Logger.log('setupOpoka zakończony. Sprawdź arkusz Pracownicy: kolumna PIN powinna być pusta, PIN_Hash wypełniony.');
  Logger.log('WAŻNE: ustaw strefę czasową PLIKU arkusza na Warszawę (Plik → Ustawienia) — musi zgadzać się z manifestem.');
}
