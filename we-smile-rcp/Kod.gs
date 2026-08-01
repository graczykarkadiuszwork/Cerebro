// ============================================================
// We SMILE — RCP v7.0
// ============================================================
//
// Schemat arkusza (ID poniżej):
//   Pracownicy    : [ID, Imię, Nazwisko, Rola, Status, PIN, FormaZatrudnienia, TagiSpecjalizacji]
//   Ewidencja     : [Timestamp, EmpID, Imię, Nazwisko, Akcja, Data, Godzina, Źródło]
//   Anomalie      : [Timestamp, EmpID, Opis]
//   Nieobecnosci  : [Timestamp, EmpID, Imię, Nazwisko, Data, Kod, Typ, Adnotacja, Źródło]
//   Przekroczenia : [Timestamp, EmpID, Data, Uzasadnienie, Źródło]
//   Gabinety      : [ID, Nazwa, Kolejnosc, Aktywny]
//   Grafik        : [ID, GabinetID, DzienTygodnia, Typ, OsobaID, Od, Do, AsystaWymagana, AsystaUwaga, Zmodyfikowano]
//   GrafikAsysta  : [ID, BlokID, OsobaID, Od, Do, Zmodyfikowano]
//
// Po wgraniu do GAS uruchom raz ręcznie: setupRCP()
// (bezpieczne do ponownego uruchomienia — dopisuje tylko brakujące
//  kolumny i arkusze, nie rusza istniejących danych)
// ============================================================

const SS_ID          = '1wI3ysrolzGea5nNi7GYBo09t38y8oUgPoqGG3wn-ZsA';
const TOKEN_WIN_SEC  = 30;
const TOKEN_GRACE    = 1;    // ±1 okno tolerancji
const DEDUP_SEC      = 90;
const RATE_MAX       = 5;
const RATE_WIN_SEC   = 300;

// ── Godziny pracy Kliniki ────────────────────────────────────
// Pn–Pt 8:00–21:00, Sb 9:00–16:00, Nd — nieczynne.

function _clinicHoursFor(ds) {
  const dow = new Date(ds + 'T12:00:00').getDay(); // 0=Nd
  if (dow === 0) return null;
  if (dow === 6) return { open: 9 * 60, close: 16 * 60 };
  return { open: 8 * 60, close: 21 * 60 };
}

// Czy dzień (na podstawie pierwszego wejścia / ostatniego wyjścia)
// wykracza poza regularne godziny Kliniki.
function _dayOutsideClinic(ds, wejscie, wyjscie) {
  if (!wejscie && !wyjscie) return false;
  const h = _clinicHoursFor(ds);
  if (!h) return true; // niedziela
  if (wejscie && _t2m(wejscie) < h.open)  return true;
  if (wyjscie && _t2m(wyjscie) > h.close) return true;
  return false;
}

// Ile minut danego dnia wypadło poza godzinami otwarcia Kliniki
// (a nie tylko czy w ogóle — do sumowania miesięcznego w godzinach).
function _overtimeMinutes(ds, wejscie, wyjscie) {
  if (!wejscie && !wyjscie) return 0;
  const h = _clinicHoursFor(ds);
  if (!h) { // niedziela — cały odnotowany czas liczy się jako poza godzinami
    if (wejscie && wyjscie) return Math.max(0, _t2m(wyjscie) - _t2m(wejscie));
    return 0;
  }
  let mins = 0;
  if (wejscie && _t2m(wejscie) < h.open)  mins += h.open - _t2m(wejscie);
  if (wyjscie && _t2m(wyjscie) > h.close) mins += _t2m(wyjscie) - h.close;
  return mins;
}

// ── Grafik obsady gabinetów ──────────────────────────────────
// Godziny OBSADY gabinetów wg szablonu grafiku: Pn–Pt 9:00–20:00,
// Sb 10:00–15:00 (jedna zmiana), Nd — klinika nieczynna.
//
// UWAGA: to celowo NIE są te same wartości co w _clinicHoursFor().
// Tamte (szersze: Pn–Pt 8–21, Sb 9–16) służą do wykrywania pracy poza
// godzinami w RCP i mają zapas na wejście przed otwarciem i wyjście po
// zamknięciu. Tutaj chodzi o okno, w którym gabinet ma mieć obsadę.

const GRAFIK_HOURS = {
  1: { open:  9 * 60, close: 20 * 60 },  // Poniedziałek
  2: { open:  9 * 60, close: 20 * 60 },
  3: { open:  9 * 60, close: 20 * 60 },
  4: { open:  9 * 60, close: 20 * 60 },
  5: { open:  9 * 60, close: 20 * 60 },  // Piątek
  6: { open: 10 * 60, close: 15 * 60 },  // Sobota — jedna zmiana 10:00–15:00
  0: null                                // Niedziela — nieczynne
};

const GRAFIK_DAYS = [1, 2, 3, 4, 5, 6];
const GRAFIK_DAY_NAMES = {
  1: 'Poniedziałek', 2: 'Wtorek', 3: 'Środa',
  4: 'Czwartek', 5: 'Piątek', 6: 'Sobota'
};

// Typy bloków w gabinecie. Higienizacja zajmuje gabinet tak samo jak
// lekarz — ta sama siatka, inny typ obsady.
const BLOK_LEKARZ = 'Lekarz';
const BLOK_HIGIENA = 'Higienizacja';
const BLOK_TYPES = [BLOK_LEKARZ, BLOK_HIGIENA];

// Najmniejsza jednostka osi czasu grafiku. Bloki nie muszą pokrywać się
// ze zmianami — mogą zaczynać się i kończyć co 5 minut.
const GRAFIK_KROK_MIN = 5;

// Godzina podziału doby na zmianę poranną i popołudniową. To tylko punkt
// wyjścia dla gotowych wariantów — każdy blok da się potem dowolnie zmienić.
const GRAFIK_PODZIAL = { 1: 14*60, 2: 14*60, 3: 14*60, 4: 14*60, 5: 14*60, 6: 12*60 + 30 };

const ZMIANA_RANO = 'rano', ZMIANA_POPO = 'popo', ZMIANA_CALY = 'caly';

// Gotowe warianty pory pracy dla danego dnia, liczone z godzin otwarcia.
function _zmianaGodziny(dzien, wariant) {
  const h = GRAFIK_HOURS[dzien];
  if (!h) return null;
  const podzial = GRAFIK_PODZIAL[dzien] || Math.round((h.open + h.close) / 2);
  if (wariant === ZMIANA_RANO) return { open: h.open, close: podzial };
  if (wariant === ZMIANA_POPO) return { open: podzial, close: h.close };
  return { open: h.open, close: h.close };
}

// ── Asysta zewnętrzna ────────────────────────────────────────
// Miejsca na osoby spoza zespołu (agencja, zastępstwo). Świadomie NIE są
// pracownikami — nie mają PIN-u, nie liczą się w RCP i na grafiku są
// wyraźnie oznaczone, żeby nikt nie pomylił ich ze stałą obsadą.

const ASYSTA_ZEW = [
  { id: 'ZEW1', label: 'Asysta zewnętrzna 1' },
  { id: 'ZEW2', label: 'Asysta zewnętrzna 2' }
];
function _czyAsystaZew(id) {
  return ASYSTA_ZEW.some(a => a.id === String(id));
}
function _labelAsystaZew(id) {
  const a = ASYSTA_ZEW.find(x => x.id === String(id));
  return a ? a.label : String(id);
}

// Adnotacja wstawiana, gdy właściciel świadomie zatwierdzi blok bez asysty.
const UWAGA_BRAK_ASYSTY = 'BRAK ASYSTY — zatwierdzone świadomie';

// ── Grupy zawodowe ───────────────────────────────────────────
// Rola w arkuszu Pracownicy jest polem tekstowym (historycznie wpisywana
// swobodnie: „higienistka stomatologiczna", „asystentka stomatologiczna"…).
// Klasyfikujemy ją do grupy, żeby grafik wiedział, kogo gdzie wolno wpisać,
// bez wymuszania migracji istniejących danych.

const GRUPA_LEKARZ = 'lekarz';
const GRUPA_HIGIENISTKA = 'higienistka';
const GRUPA_ASYSTENTKA = 'asystentka';
const GRUPA_INNE = 'inne';

function _grupaZawodowa(rola) {
  const r = String(rola || '').toLowerCase();
  if (r.indexOf('higienist') !== -1) return GRUPA_HIGIENISTKA;
  if (r.indexOf('asystent') !== -1)  return GRUPA_ASYSTENTKA;
  if (r.indexOf('lekarz') !== -1 || r.indexOf('dentyst') !== -1 ||
      r.indexOf('stomatolog') === 0 || r === 'dr' || r.indexOf('doktor') !== -1) {
    return GRUPA_LEKARZ;
  }
  return GRUPA_INNE;
}

// ── Tagi specjalizacji lekarzy ───────────────────────────────
// Przypisywane w panelu Właściciela → Zespół (można wybrać kilka).
// Silnik rekomendacji używa ich do dopasowania sugestii do konkretnego
// lekarza (np. „ten lekarz robi endodoncję — wydłuż mu blok”).

const DOCTOR_SPECIALIZATION_TAGS = [
  'Stomatologia zachowawcza',
  'Endodoncja',
  'Endodoncja mikroskopowa',
  'Protetyka',
  'Protetyka na implantach',
  'Implantologia',
  'Chirurgia stomatologiczna',
  'Ekstrakcje chirurgiczne',
  'Periodontologia',
  'Ortodoncja',
  'Ortodoncja — aparaty stałe',
  'Ortodoncja — nakładkowa',
  'Pedodoncja (dzieci)',
  'Stomatologia estetyczna',
  'Licówki',
  'Wybielanie',
  'Profilaktyka i higienizacja',
  'Korony i mosty',
  'Leczenie w sedacji',
  'Znieczulenie ogólne',
  'Diagnostyka RTG / CBCT',
  'Zaburzenia SSŻ / bruksizm',
  'Gnatologia',
  'Traumatologia stomatologiczna',
  'Leczenie pod mikroskopem',
  'Konsultacje / pierwsza wizyta'
];

// ── Forma zatrudnienia ───────────────────────────────────────
// Ustawiana raz na pracownika (panel Właściciela → Pracownicy).
// Decyduje o: (1) liście typów nieobecności widocznej w samoobsłudze,
// (2) czy dzień urlopu dolicza 8h do miesięcznej sumy (tylko UoP).

const FORMA_UOP = 'UoP', FORMA_ZLC = 'Zlecenie', FORMA_B2B = 'B2B';
const EMPLOYMENT_FORMS = [FORMA_UOP, FORMA_ZLC, FORMA_B2B];

// ── Typy nieobecności ────────────────────────────────────────
// Pokrywają UoP, umowę zlecenie i B2B — `forms` ogranicza widoczność
// w samoobsłudze pracownika do jego formy zatrudnienia.

const ABSENCE_TYPES = [
  { code: 'DW',   label: 'Dzień wolny — Klinika zamknięta',                forms: [] },
  { code: 'L4',   label: 'L4 — zwolnienie lekarskie',                      forms: EMPLOYMENT_FORMS },
  { code: 'UW',   label: 'Urlop wypoczynkowy',                             forms: [FORMA_UOP] },
  { code: 'UZ',   label: 'Urlop na żądanie',                               forms: [FORMA_UOP] },
  { code: 'UB',   label: 'Urlop bezpłatny',                                forms: [FORMA_UOP] },
  { code: 'UOK',  label: 'Urlop okolicznościowy',                          forms: [FORMA_UOP] },
  { code: 'UMR',  label: 'Urlop macierzyński / rodzicielski',              forms: [FORMA_UOP] },
  { code: 'UOJ',  label: 'Urlop ojcowski',                                 forms: [FORMA_UOP] },
  { code: 'UWY',  label: 'Urlop wychowawczy',                              forms: [FORMA_UOP] },
  { code: 'OPD',  label: 'Opieka nad dzieckiem (art. 188 KP)',             forms: [FORMA_UOP] },
  { code: 'ZOP',  label: 'Zasiłek opiekuńczy — opieka nad chorym',         forms: [FORMA_UOP] },
  { code: 'SW',   label: 'Zwolnienie — siła wyższa (art. 148¹ KP)',        forms: [FORMA_UOP] },
  { code: 'HK',   label: 'Honorowe krwiodawstwo',                         forms: [FORMA_UOP] },
  { code: 'ODB',  label: 'Odbiór nadgodzin / dzień wolny',                 forms: [FORMA_UOP] },
  { code: 'NUN',  label: 'Nieobecność usprawiedliwiona niepłatna',         forms: EMPLOYMENT_FORMS },
  { code: 'NN',   label: 'Nieobecność nieusprawiedliwiona',                forms: EMPLOYMENT_FORMS },
  { code: 'PZL',  label: 'Przerwa w realizacji zlecenia (umowa zlecenie)', forms: [FORMA_ZLC] },
  { code: 'B2B',  label: 'Przerwa w świadczeniu usług (B2B)',              forms: [FORMA_B2B] },
  { code: 'DEL',  label: 'Delegacja / szkolenie',                          forms: EMPLOYMENT_FORMS },
  { code: 'INNE', label: 'Inne (wymagana adnotacja)',                      forms: EMPLOYMENT_FORMS }
];
const ABSENCE_MAX_DAYS = 62;

// Kody urlopu, które dla pracowników na UoP doliczają 8h/dzień do
// miesięcznej sumy godzin (art. odpowiadające płatnym nieobecnościom KP).
const PAID_8H_CODES = ['UW', 'UZ', 'L4', 'UOK', 'UMR', 'UOJ', 'ZOP', 'SW', 'HK', 'ODB'];

function _absType(code) {
  for (let i = 0; i < ABSENCE_TYPES.length; i++) {
    if (ABSENCE_TYPES[i].code === String(code)) return ABSENCE_TYPES[i];
  }
  return null;
}

// Lista typów nieobecności dostępna w samoobsłudze pracownika o danej
// formie zatrudnienia. Brak ustawionej formy → pełna lista (poza DW),
// żeby nigdy nie zablokować zgłoszenia — właściciel uzupełnia formę osobno.
function _absTypesForForma(forma) {
  if (!forma) return ABSENCE_TYPES.filter(t => t.code !== 'DW');
  return ABSENCE_TYPES.filter(t => t.forms.indexOf(forma) !== -1);
}

// pin obecny (samoobsługa pracownika) → lista zawężona do jego formy zatrudnienia.
// pin brak (panel Właściciela) → pełna lista, właściciel ma pełne uprawnienia.
function getAbsenceTypes(pin) {
  if (!pin) return { ok: true, types: ABSENCE_TYPES };
  const worker = _findActiveByPin(pin);
  if (!worker) return { ok: true, types: ABSENCE_TYPES.filter(t => t.code !== 'DW') };
  return { ok: true, types: _absTypesForForma(String(worker[6] || '')) };
}

// ── Współdzielone partiale HTML (style itp.) ──────────────────

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ── Entry point ──────────────────────────────────────────────

function doGet(e) {
  const p = e && e.parameter && e.parameter.page;
  if (p === 'dashboard') {
    const tmpl = HtmlService.createTemplateFromFile('DashboardGUI');
    tmpl.BASE_URL = ScriptApp.getService().getUrl();
    return tmpl.evaluate()
      .setTitle('We SMILE — Panel Raportowy')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  // Panel Raportowy w wersji mobilnej — osobny interfejs (patrz owner-mobile).
  if (p === 'dashboard-mobile') {
    const tmpl = HtmlService.createTemplateFromFile('MobileDash');
    tmpl.BASE_URL = ScriptApp.getService().getUrl();
    return tmpl.evaluate()
      .setTitle('We SMILE — Raporty')
      .addMetaTag('viewport', 'width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  if (p === 'owner') {
    const tmpl = HtmlService.createTemplateFromFile('MasterGUI');
    // Adres bieżącego wdrożenia — potrzebny do linków "otwórz osobno"
    // (pełnoekranowy kiosk/ekran odbić poza chrome panelu Właściciela).
    tmpl.BASE_URL = ScriptApp.getService().getUrl();
    return tmpl.evaluate()
      .setTitle('We SMILE')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  // Interfejs Cerebro Hub — ukryty wariant panelu Właściciela.
  // Te same dane i te same akcje, inny system projektowy.
  if (p === 'cerebro') {
    const tmpl = HtmlService.createTemplateFromFile('CerebroGUI');
    tmpl.BASE_URL = ScriptApp.getService().getUrl();
    return tmpl.evaluate()
      .setTitle('Cerebro · We SMILE')
      .addMetaTag('viewport', 'width=device-width,initial-scale=1,viewport-fit=cover')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  // Panel Właściciela w wersji mobilnej — osobny interfejs, nie responsywna
  // wersja desktopu. Apps Script nie udostępnia nagłówka User-Agent w doGet,
  // więc wyboru wersji dokonuje klient (przekierowanie + zapamiętany wybór).
  if (p === 'owner-mobile') {
    const tmpl = HtmlService.createTemplateFromFile('MobileGUI');
    tmpl.BASE_URL = ScriptApp.getService().getUrl();
    return tmpl.evaluate()
      .setTitle('We SMILE')
      .addMetaTag('viewport', 'width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  const page = (p === 'admin') ? 'admin' : 'worker';
  const tmpl = HtmlService.createTemplateFromFile('Index');
  tmpl.PAGE  = page;
  return tmpl.evaluate()
    .setTitle('We SMILE — RCP')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ── Dispatcher ───────────────────────────────────────────────

function callRCP(action, argsJson) {
  try {
    const args = JSON.parse(argsJson || '[]');
    switch (action) {
      case 'getToken':        return _getTokenResponse(!!args[0]);
      case 'checkPin':        return checkPin(args[0]);
      case 'clockIn':         return clock(args[0], args[1], 'WEJSCIE');
      case 'clockOut':        return clock(args[0], args[1], 'WYJSCIE');
      case 'getAbsenceTypes': return getAbsenceTypes(args[0]);
      case 'reportAbsence':   return reportAbsence(args[0], args[1], args[2], args[3], args[4]);
      case 'setOvertimeNote': return setOvertimeNote(args[0], args[1]);
      // Dashboard
      case 'dashLogin':      return dashLogin(args[0]);
      case 'getDashboard':   return getDashboard(args[0], args[1], args[2]);
      case 'setEtat':        return setEtat(args[0], args[1], args[2], args[3]);
      case 'setNote':        return setNote(args[0], args[1], args[2], args[3], args[4]);
      case 'getExportMeta':  return getExportMeta(args[0]);
      case 'dashExportXlsx': return dashExportXlsx(args[0], args[1]);
      case 'getActive':      return getActiveNow(args[0]);
      // Owner (edycja czasu / nieobecności / uzasadnień)
      case 'masterLogin':           return masterLogin(args[0]);
      case 'masterGetEmployees':    return masterGetEmployees(args[0]);
      case 'masterGetDay':          return masterGetDay(args[0], args[1], args[2]);
      case 'masterSetDay':          return masterSetDay(args[0], args[1], args[2], args[3], args[4]);
      case 'masterGetMonth':        return masterGetMonth(args[0], args[1], args[2], args[3]);
      case 'masterGetNotatkiDnia':   return masterGetNotatkiDnia(args[0], args[1], args[2]);
      case 'masterAddNotatkaDnia':   return masterAddNotatkaDnia(args[0], args[1], args[2], args[3]);
      case 'masterDeleteNotatkaDnia': return masterDeleteNotatkaDnia(args[0], args[1]);
      case 'masterGetTimelineDnia':  return masterGetTimelineDnia(args[0], args[1], args[2]);
      case 'masterSetAbsence':      return masterSetAbsence(args[0], args[1], args[2], args[3], args[4]);
      case 'masterSetOvertimeNote': return masterSetOvertimeNote(args[0], args[1], args[2], args[3]);
      case 'masterSetClinicDayOff': return masterSetClinicDayOff(args[0], args[1], args[2], args[3], args[4]);
      case 'masterSetAbsenceRange': return masterSetAbsenceRange(args[0], args[1], args[2], args[3], args[4], args[5]);
      case 'masterSetEmploymentForm': return masterSetEmploymentForm(args[0], args[1], args[2]);
      case 'masterGetArchivedEmployees': return masterGetArchivedEmployees(args[0]);
      case 'masterSetDoctorTags':   return masterSetDoctorTags(args[0], args[1], args[2]);
      case 'masterGetHistoriaPracownika': return masterGetHistoriaPracownika(args[0], args[1]);
      // Grafik obsady gabinetów + rekomendacje
      case 'masterGetGrafik':       return masterGetGrafik(args[0]);
      case 'masterSaveGabinet':     return masterSaveGabinet(args[0], args[1], args[2], args[3]);
      case 'masterRemoveGabinet':   return masterRemoveGabinet(args[0], args[1]);
      case 'masterSaveGrafikBlok':  return masterSaveGrafikBlok(args[0], args[1]);
      case 'masterDeleteGrafikBlok': return masterDeleteGrafikBlok(args[0], args[1]);
      case 'masterSetGrafikAsysta': return masterSetGrafikAsysta(args[0], args[1], args[2]);
      case 'masterGrafikWolneAsysty': return masterGrafikWolneAsysty(args[0], args[1], args[2], args[3], args[4]);
      case 'masterGrafikKreatorZapisz': return masterGrafikKreatorZapisz(args[0], args[1], args[2]);
      case 'masterGetAdnotacje':    return masterGetAdnotacje(args[0]);
      case 'masterSaveAdnotacja':   return masterSaveAdnotacja(args[0], args[1]);
      case 'masterSaveAdnotacjaSeria': return masterSaveAdnotacjaSeria(args[0], args[1], args[2]);
      case 'masterDeleteAdnotacja': return masterDeleteAdnotacja(args[0], args[1]);
      case 'masterGrafikWydruk':    return masterGrafikWydruk(args[0], args[1]);
      case 'masterGrafikMiesiac':      return masterGrafikMiesiac(args[0], args[1], args[2]);
      case 'masterZapiszDzienGrafiku': return masterZapiszDzienGrafiku(args[0], args[1], args[2]);
      case 'masterResetDzienGrafiku':  return masterResetDzienGrafiku(args[0], args[1]);
      case 'masterKopiujDzienGrafiku': return masterKopiujDzienGrafiku(args[0], args[1], args[2]);
      case 'masterGetPokrycieUrlopu': return masterGetPokrycieUrlopu(args[0], args[1], args[2], args[3]);
      case 'masterPrzypiszZastepceBloku':
        return masterPrzypiszZastepceBloku(args[0], args[1], args[2], args[3], args[4], args[5]);
      case 'masterGrafikImportPodglad': return masterGrafikImportPodglad(args[0], args[1]);
      case 'masterGrafikImportZastosuj': return masterGrafikImportZastosuj(args[0], args[1], args[2]);
      case 'masterGetSzablonyZmian':   return masterGetSzablonyZmian(args[0]);
      case 'masterSaveSzablonZmiany':  return masterSaveSzablonZmiany(args[0], args[1]);
      case 'masterDeleteSzablonZmiany': return masterDeleteSzablonZmiany(args[0], args[1]);
      case 'masterGcalGetConfig':   return masterGcalGetConfig(args[0]);
      case 'masterGcalSetConfig':   return masterGcalSetConfig(args[0], args[1]);
      case 'masterGcalSync':        return masterGcalSync(args[0], args[1], args[2]);
      case 'masterRemoveEmployee':  return masterRemoveEmployee(args[0], args[1]);
      case 'masterRestoreEmployee': return masterRestoreEmployee(args[0], args[1]);
      case 'masterAddEmployee':     return masterAddEmployee(args[0], args[1], args[2], args[3], args[4]);
      // Owner — funkcje Panelu Raportowego, ekranu odbić i kodu, osadzone
      // w panelu Właściciela (współdzielą jego sesję masterLogin, bez
      // osobnego logowania).
      case 'masterGetActive':      return masterGetActive(args[0]);
      case 'masterGetDashboard':   return masterGetDashboard(args[0], args[1], args[2]);
      case 'masterGetRaportObecnosci': return masterGetRaportObecnosci(args[0], args[1], args[2]);
      case 'masterSetEtat':        return masterSetEtat(args[0], args[1], args[2], args[3]);
      case 'masterSetNote':        return masterSetNote(args[0], args[1], args[2], args[3], args[4]);
      case 'masterGetExportMeta':  return masterGetExportMeta(args[0]);
      case 'masterDashExportXlsx': return masterDashExportXlsx(args[0], args[1]);
      default:               return { ok: false, msg: 'Nieznana akcja.' };
    }
  } catch (err) {
    Logger.log('RCP error [' + action + ']: ' + err);
    return { ok: false, msg: 'Błąd serwera.' };
  }
}

// ── Token HMAC-SHA256 ────────────────────────────────────────

function _tokenForWindow(w) {
  const secret = PropertiesService.getScriptProperties().getProperty('RCP_SECRET') || 'wesmile_rcp_default_v1';
  const bytes  = Utilities.computeHmacSha256Signature('RCP:' + w, secret);
  const n      = Math.abs(bytes.reduce((a, b) => (a * 256 + (b < 0 ? b + 256 : b)) % 10000, 0));
  return String(n).padStart(4, '0');
}

function _currentToken() {
  return _tokenForWindow(Math.floor(Date.now() / 1000 / TOKEN_WIN_SEC));
}

// Ile sekund pozostało do zmiany bieżącego kodu.
function _tokenSecLeft() {
  const s = Math.floor(Date.now() / 1000);
  return TOKEN_WIN_SEC - (s % TOKEN_WIN_SEC);
}

// next=true → kod kolejnego okna, pokazany z wyprzedzeniem (przycisk "Odśwież").
// Bezpieczne: _verifyToken akceptuje okno ±1 (TOKEN_GRACE), więc kod jest
// ważny już w momencie wyświetlenia, mimo że bieżące okno jeszcze trwa.
function _getTokenResponse(next) {
  const base    = Math.floor(Date.now() / 1000 / TOKEN_WIN_SEC) + (next ? 1 : 0);
  const secLeft = _tokenSecLeft() + (next ? TOKEN_WIN_SEC : 0);
  return { ok: true, token: _tokenForWindow(base), secLeft, winSec: TOKEN_WIN_SEC };
}

function _verifyToken(code) {
  if (!code || String(code).length !== 4) return false;
  const base = Math.floor(Date.now() / 1000 / TOKEN_WIN_SEC);
  for (let d = -TOKEN_GRACE; d <= TOKEN_GRACE; d++) {
    if (_tokenForWindow(base + d) === String(code)) return true;
  }
  return false;
}

// ── Helpers ──────────────────────────────────────────────────

function _ss()     { return SpreadsheetApp.openById(SS_ID); }
function _cache()  { return CacheService.getScriptCache(); }
function _nowPL()  { return Utilities.formatDate(new Date(), 'Europe/Warsaw', 'HH:mm'); }
function _todayPL(){ return Utilities.formatDate(new Date(), 'Europe/Warsaw', 'yyyy-MM-dd'); }

// Pobiera arkusz, tworząc go z nagłówkami, jeśli nie istnieje.
// Bez tego każde odwołanie do brakującego arkusza kończyło się wyjątkiem
// i gołym „Błąd serwera." w interfejsie — użytkownik nie miał szans
// zgadnąć, że trzeba uruchomić setupRCP().
function _arkusz(nazwa, naglowki) {
  const ss = _ss();
  let sh = ss.getSheetByName(nazwa);
  if (!sh) {
    sh = ss.insertSheet(nazwa);
    if (naglowki && naglowki.length) sh.appendRow(naglowki);
  } else if (sh.getLastRow() === 0 && naglowki && naglowki.length) {
    sh.appendRow(naglowki);
  }
  return sh;
}

const NAGLOWKI_PRACOWNICY = ['ID','Imię','Nazwisko','Rola','Status','PIN','FormaZatrudnienia','TagiSpecjalizacji'];

function _getWorkers() {
  const sh = _ss().getSheetByName('Pracownicy');
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getDataRange().getValues().slice(1);
  // cols: 0=ID, 1=Imię, 2=Nazwisko, 3=Rola, 4=Status, 5=PIN,
  //       6=FormaZatrudnienia (może być puste), 7=TagiSpecjalizacji (CSV, może być puste)
}

// Pracownicy objęci RCP (odbicia, raporty miesięczne, eksport, pasek obecności).
// Lekarze siedzą w tej samej tabeli, żeby cała kadra miała spójną strukturę,
// ale nie odbijają się na kiosku — pokazywanie ich w raportach dawałoby stałe
// 0 h i fałszowało obraz. W Zespole i w Grafiku są widoczni normalnie.
function _isRcpWorker(w) {
  return String(w[4]).toLowerCase() === 'aktywny' &&
         _grupaZawodowa(w[3]) !== GRUPA_LEKARZ;
}

function _findActiveByPin(pin) {
  return _getWorkers().find(r =>
    _pinMatch(r[5], pin) && String(r[4]).toLowerCase() === 'aktywny'
  ) || null;
}

// Porównuje PINy z uwzględnieniem wiodących zer
// (Sheets może zapisać "0371" jako liczbę 371)
function _pinMatch(stored, entered) {
  // Pracownik bez PIN-u (np. lekarz, który nie odbija się w RCP) NIGDY nie może
  // zostać dopasowany — inaczej padStart('') dałoby '0000' i wpisanie 0000
  // logowałoby na jego konto. Pusty PIN = konto bez dostępu do kiosku.
  const rawStored = String(stored == null ? '' : stored).trim();
  if (!rawStored) return false;
  const a = rawStored.padStart(4, '0');
  const b = String(entered == null ? '' : entered).trim().padStart(4, '0');
  return a === b;
}

// ── Rate limiter ─────────────────────────────────────────────

function _checkRate(key) {
  const k = 'rl_' + key;
  const v = parseInt(_cache().get(k) || '0', 10);
  if (v >= RATE_MAX) return false;
  _cache().put(k, String(v + 1), RATE_WIN_SEC);
  return true;
}

function _resetRate(key) {
  _cache().remove('rl_' + key);
}

// ── checkPin — weryfikacja PIN (krok 1) ──────────────────────

function checkPin(pin) {
  if (!pin || String(pin).length !== 4 || !/^\d{4}$/.test(String(pin))) {
    return { ok: false, msg: 'PIN musi mieć dokładnie 4 cyfry.' };
  }
  if (!_checkRate('pin')) {
    return { ok: false, msg: 'Zbyt wiele prób. Odczekaj 5 minut.' };
  }

  const worker = _findActiveByPin(pin);
  if (!worker) {
    return { ok: false, msg: 'Nieprawidłowy PIN lub konto nieaktywne.' };
  }

  _resetRate('pin');
  return {
    ok:       true,
    id:       String(worker[0]),
    imie:     String(worker[1]),
    nazwisko: String(worker[2]),
    rola:     String(worker[3])
  };
}

// ── clock — rejestracja zdarzenia (krok 2) ───────────────────

function clock(pin, tokenCode, action) {
  if (!pin || !tokenCode) {
    return { ok: false, msg: 'Brak wymaganych danych.' };
  }

  const worker = _findActiveByPin(pin);
  if (!worker) return { ok: false, msg: 'Pracownik nie istnieje.' };

  const empId = String(worker[0]);

  if (!_checkRate('clk_' + empId)) {
    return { ok: false, msg: 'Zbyt wiele prób. Odczekaj 5 minut.' };
  }

  if (!_verifyToken(String(tokenCode))) {
    return { ok: false, msg: 'Nieprawidłowy kod autoryzacyjny lub wygasł.' };
  }

  const dedupKey = 'dup_' + empId;
  if (_cache().get(dedupKey)) {
    return { ok: false, msg: 'Zdarzenie już zarejestrowane. Chwilę odczekaj.' };
  }
  _cache().put(dedupKey, '1', DEDUP_SEC);

  const today   = _todayPL();
  const ewidSh  = _ss().getSheetByName('Ewidencja');
  const allRows = (ewidSh && ewidSh.getLastRow() >= 2)
    ? ewidSh.getDataRange().getValues().slice(1) : [];
  const todayEmp = allRows.filter(r => String(r[1]) === empId && String(r[5]) === today);

  if (todayEmp.length > 0) {
    const lastAction = String(todayEmp[todayEmp.length - 1][4]);
    if (lastAction === action) {
      _arkusz('Anomalie', ['Timestamp', 'EmpID', 'Opis']).appendRow([
        new Date().toISOString(), empId,
        'Duplikacja ' + action + ': ' + worker[1] + ' ' + worker[2]
      ]);
      const label = action === 'WEJSCIE' ? 'WEJŚCIE' : 'WYJŚCIE';
      return { ok: false, msg: 'Błąd sekwencji: ostatnie zdarzenie to już ' + label + '.' };
    }
  }

  const godzina = _nowPL();
  ewidSh.appendRow([
    new Date().toISOString(), empId,
    String(worker[1]), String(worker[2]),
    action, today, godzina, 'worker'
  ]);

  _resetRate('clk_' + empId);

  // Wykrycie pracy poza regularnymi godzinami Kliniki:
  // wejście przed otwarciem lub wyjście po zamknięciu (Nd — zawsze).
  const h = _clinicHoursFor(today);
  let overtime = false;
  if (!h) overtime = true;
  else if (action === 'WEJSCIE' && _t2m(godzina) < h.open)  overtime = true;
  else if (action === 'WYJSCIE' && _t2m(godzina) > h.close) overtime = true;

  return { ok: true, imie: String(worker[1]), godzina, overtime };
}

// ── reportAbsence — zgłoszenie nieobecności przez pracownika ─
// Nie wymaga kodu z tabletu (pracownik zgłasza zdalnie, np. L4).

function reportAbsence(pin, dateFrom, dateTo, typeCode, note) {
  if (!pin) return { ok: false, msg: 'Brak danych.' };
  if (!_checkRate('pin')) {
    return { ok: false, msg: 'Zbyt wiele prób. Odczekaj 5 minut.' };
  }

  const worker = _findActiveByPin(pin);
  if (!worker) return { ok: false, msg: 'Nieprawidłowy PIN lub konto nieaktywne.' };
  _resetRate('pin');

  const re = /^\d{4}-\d{2}-\d{2}$/;
  dateFrom = String(dateFrom || '');
  dateTo   = String(dateTo || dateFrom);
  if (!re.test(dateFrom) || !re.test(dateTo) || dateFrom > dateTo) {
    return { ok: false, msg: 'Nieprawidłowy zakres dat.' };
  }

  const type = _absType(typeCode);
  if (!type) return { ok: false, msg: 'Wybierz typ nieobecności.' };

  note = String(note || '').trim().slice(0, 500);
  if (type.code === 'INNE' && !note) {
    return { ok: false, msg: 'Dla typu „Inne” adnotacja jest wymagana.' };
  }

  const from = new Date(dateFrom + 'T12:00:00');
  const to   = new Date(dateTo + 'T12:00:00');
  const days = Math.round((to - from) / 86400000) + 1;
  if (days > ABSENCE_MAX_DAYS) {
    return { ok: false, msg: 'Maksymalny zakres to ' + ABSENCE_MAX_DAYS + ' dni.' };
  }

  _upsertAbsence(String(worker[0]), String(worker[1]), String(worker[2]),
                 dateFrom, dateTo, type, note, 'worker');

  return { ok: true, imie: String(worker[1]), typ: type.label, dni: days };
}

// Nadpisuje nieobecności pracownika w zakresie dat (jeden wiersz na dzień).
function _upsertAbsence(empId, imie, nazwisko, dateFrom, dateTo, type, note, source) {
  const ss = _ss();
  let sh = ss.getSheetByName('Nieobecnosci');
  if (!sh) {
    sh = ss.insertSheet('Nieobecnosci');
    sh.appendRow(['Timestamp', 'EmpID', 'Imię', 'Nazwisko', 'Data', 'Kod', 'Typ', 'Adnotacja', 'Źródło']);
  }
  const rows = (sh.getLastRow() >= 2) ? sh.getDataRange().getValues().slice(1) : [];
  for (let i = rows.length - 1; i >= 0; i--) {
    const ds = _sheetDate(rows[i][4]);
    if (String(rows[i][1]) === empId && ds >= dateFrom && ds <= dateTo) {
      sh.deleteRow(i + 2);
    }
  }
  if (!type) return; // samo usunięcie
  const ts = new Date().toISOString();
  const cursor = new Date(dateFrom + 'T12:00:00');
  const end    = new Date(dateTo + 'T12:00:00');
  while (cursor <= end) {
    const ds = Utilities.formatDate(cursor, 'Europe/Warsaw', 'yyyy-MM-dd');
    sh.appendRow([ts, empId, imie, nazwisko, ds, type.code, type.label, note, source]);
    cursor.setDate(cursor.getDate() + 1);
  }
}

// ── setOvertimeNote — uzasadnienie pracy poza godzinami ──────
// Wpisywane przez pracownika zaraz po odbiciu poza godzinami Kliniki.
// Adnotacja przypisana do dnia (dzisiejszego).

function setOvertimeNote(pin, note) {
  if (!pin) return { ok: false, msg: 'Brak danych.' };
  if (!_checkRate('pin')) {
    return { ok: false, msg: 'Zbyt wiele prób. Odczekaj 5 minut.' };
  }
  const worker = _findActiveByPin(pin);
  if (!worker) return { ok: false, msg: 'Nieprawidłowy PIN.' };
  _resetRate('pin');

  note = String(note || '').trim().slice(0, 500);
  if (!note) return { ok: false, msg: 'Wpisz uzasadnienie.' };

  _saveOvertimeNote(String(worker[0]), _todayPL(), note, 'worker');
  return { ok: true };
}

// Zapis uzasadnienia dnia (puste note = usunięcie).
function _saveOvertimeNote(empId, ds, note, source) {
  const ss = _ss();
  let sh = ss.getSheetByName('Przekroczenia');
  if (!sh) {
    sh = ss.insertSheet('Przekroczenia');
    sh.appendRow(['Timestamp', 'EmpID', 'Data', 'Uzasadnienie', 'Źródło']);
  }
  const rows = (sh.getLastRow() >= 2) ? sh.getDataRange().getValues().slice(1) : [];
  for (let i = rows.length - 1; i >= 0; i--) {
    if (String(rows[i][1]) === empId && _sheetDate(rows[i][2]) === ds) {
      sh.deleteRow(i + 2);
    }
  }
  if (note) {
    sh.appendRow([new Date().toISOString(), empId, ds, note, source]);
  }
}

// ── setupRCP — uruchom raz po wgraniu ────────────────────────

function setupRCP() {
  const spreadsheet = _ss();

  [
    { name: 'Pracownicy',    h: ['ID', 'Imię', 'Nazwisko', 'Rola', 'Status', 'PIN', 'FormaZatrudnienia', 'TagiSpecjalizacji'] },
    { name: 'Ewidencja',     h: ['Timestamp', 'EmpID', 'Imię', 'Nazwisko', 'Akcja', 'Data', 'Godzina', 'Źródło'] },
    { name: 'Anomalie',      h: ['Timestamp', 'EmpID', 'Opis'] },
    { name: 'Statusy',       h: ['Date', 'EmpID', 'Status', 'Notes', 'Modified'] },
    { name: 'Nieobecnosci',  h: ['Timestamp', 'EmpID', 'Imię', 'Nazwisko', 'Data', 'Kod', 'Typ', 'Adnotacja', 'Źródło'] },
    { name: 'Przekroczenia', h: ['Timestamp', 'EmpID', 'Data', 'Uzasadnienie', 'Źródło'] },
    // ── Grafik obsady gabinetów ──
    { name: 'Gabinety',      h: ['ID', 'Nazwa', 'Kolejnosc', 'Aktywny'] },
    { name: 'Grafik',        h: ['ID', 'GabinetID', 'DzienTygodnia', 'Typ', 'OsobaID', 'Od', 'Do', 'AsystaWymagana', 'AsystaUwaga', 'Zmodyfikowano'] },
    { name: 'GrafikAsysta',  h: ['ID', 'BlokID', 'OsobaID', 'Od', 'Do', 'Zmodyfikowano'] },
    { name: 'GrafikSzablony', h: ['ID', 'Nazwa', 'Typ', 'Od', 'Do', 'AsystaWymagana', 'AsystaUwaga', 'Zmodyfikowano'] },
    { name: 'NotatkiDnia',   h: ['ID', 'EmpID', 'Data', 'Tresc', 'Utworzono'] }
  ].forEach(def => {
    let sh = spreadsheet.getSheetByName(def.name);
    if (!sh) sh = spreadsheet.insertSheet(def.name);
    if (sh.getLastRow() === 0) {
      sh.appendRow(def.h);
      return;
    }
    // Arkusz już istnieje (np. produkcyjny) — dopisz tylko brakujące nagłówki
    // na końcu (np. nową kolumnę FormaZatrudnienia), nie ruszając danych.
    const curCols = sh.getLastColumn();
    if (curCols < def.h.length) {
      sh.getRange(1, curCols + 1, 1, def.h.length - curCols).setValues([def.h.slice(curCols)]);
    }
  });

  const pSh = spreadsheet.getSheetByName('Pracownicy');

  if (pSh.getLastRow() <= 1) {
    const employees = [
      ['WS01', 'Arkadiusz',  'Graczyk',      'Admin',                           'Aktywny', '0371', 'UoP'],
      ['WS02', 'Kaja',       'Węglarek',     'rejestratorka medyczna',          'Aktywny', '1826', 'UoP'],
      ['WS03', 'Julia',      'Polishchuk',    'higienistka stomatologiczna',     'Aktywny', '0316', 'UoP'],
      ['WS04', 'Oksana',     'Revutska',      'asystentka stomatologiczna',      'Aktywny', '0484', 'UoP'],
      ['WS05', 'Kamila',     'Pruszczyńska', 'higienistka stomatologiczna',     'Aktywny', '4731', 'UoP'],
      ['WS06', 'Katarzyna',  'Graczyk',       'higienistka stomatologiczna',     'Aktywny', '9010', 'UoP']
    ];
    employees.forEach(row => pSh.appendRow(row));
    Logger.log('Dodano ' + employees.length + ' pracowników.');
  } else {
    Logger.log('Pracownicy już istnieją — pominięto import.');
  }

  // Gabinety — startowo 3 (jak w szablonie grafiku), ale lista jest w pełni
  // edytowalna w panelu Właściciela: można dodać, zmienić nazwę i wycofać.
  const gSh = spreadsheet.getSheetByName('Gabinety');
  if (gSh.getLastRow() <= 1) {
    [
      ['G1', 'Gabinet 1', 1, 'TAK'],
      ['G2', 'Gabinet 2', 2, 'TAK'],
      ['G3', 'Gabinet 3', 3, 'TAK']
    ].forEach(row => gSh.appendRow(row));
    Logger.log('Dodano 3 startowe gabinety.');
  } else {
    Logger.log('Gabinety już istnieją — pominięto import.');
  }

  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('RCP_SECRET')) {
    props.setProperty('RCP_SECRET', Utilities.getUuid() + '-' + Utilities.getUuid());
    Logger.log('Wygenerowano nowy RCP_SECRET.');
  }

  Logger.log('setupRCP zakończony pomyślnie.');
}
