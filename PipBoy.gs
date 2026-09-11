// ============================================================
// CEREBRO — PipBoy.gs
// Pip-Boy: system organizacji życia — logika backendowa (Faza 1 — rdzeń)
// Specyfikacja pełna: docs/Pip-Boy-Koncept.md
//
// FAZA 1 (ta implementacja) obejmuje: rytuał miesięczny wgrywania grafiku
// (sekcja 0.7, wersja manualna zgodna z MVP — sekcja 0.4), Szablony Dnia
// (sekcja 3), Moduł 1 (Suplementacja), Moduł 4 (Dieta — remindery),
// Moduł 11 (Mood tracker), podstawowa mechanika HP (sekcja 4.1-4.2, bez
// pełnej listy 208 odznak), GOD_MODE_24H (sekcja 4.1a), Cytat Dnia
// (sekcja 5.4), Marquee sugestywne (sekcja 6.12), Widok Dnia (sekcja 6.1).
//
// ŚWIADOMIE POZA TĄ FAZĄ (patrz sekcja 0.11.2 dokumentu — Faza 2+):
// Moduł 2 (Trening) ze szczegółowym trackingiem, odczyt RCP na żywo,
// dwustronna synchronizacja Google Calendar, offline-first PWA, pełna
// lista 208 odznak, Tryb Regeneracji (4.1b), Dashboard z wykresami,
// Portfolio Figurek. Ich brak tutaj nie jest skrótem — to zgodne z
// fazowaniem uzgodnionym z Arkiem.
// ============================================================

const PIPBOY_FOLDER_NAME = 'Pip-Boy';
const PIPBOY_SPREADSHEET_NAME = 'Pip-Boy — Baza Danych';

// ============================================================
// SETUP — osobny arkusz i osobny folder (prywatność, sekcja 0.9)
// ============================================================

function setupPipBoy() {
  try {
    const ss = SpreadsheetApp.create(PIPBOY_SPREADSHEET_NAME);
    const id = ss.getId();
    PropertiesService.getScriptProperties().setProperty('PIPBOY_SPREADSHEET_ID', id);

    const sheets = [
      { name: 'grafik_pracy', headers: ['data', 'dzien_tygodnia', 'start', 'koniec', 'typ_dnia'] },
      { name: 'log_dzienny', headers: ['data', 'modul', 'wykonano'] },
      { name: 'suplementy_log', headers: ['data', 'klucz', 'wykonano', 'godzina', 'notatka'] },
      { name: 'posilki_log', headers: ['data', 'numer', 'wykonano', 'godzina'] },
      { name: 'mood_log', headers: ['data', 'pora', 'nastroj', 'energia', 'sen', 'skupienie', 'gi', 'notatka_gi_followup'] },
      // UWAGA (poprawka w tej turze): 'punkty_historia' było zdefiniowane tu
      // DWA razy z różnymi nagłówkami — druga definicja (data/atrybut/punkty,
      // zgodna z pipboyAwardPoints/getAtrybutySumy) nadpisywała pierwszą przy
      // zakładaniu arkusza, więc pierwsza (hp_procent/xp_dzienny/streak/...)
      // była martwym kodem. Usunięta. Historia HP w czasie ma teraz własny,
      // faktycznie zapisywany arkusz: hp_historia (patrz niżej + upsertHpHistoria).
      { name: 'tokeny_god_mode', headers: ['data_aktywacji', 'typ', 'aktywny', 'notatka'] },
      { name: 'punkty_historia', headers: ['data', 'atrybut', 'punkty'] },
      { name: 'hp_historia', headers: ['data', 'hp_procent'] },
      { name: 'plan_treningowy', headers: ['trening_typ', 'kolejnosc', 'cwiczenie', 'serie_docelowe', 'powtorzenia_zakres', 'przerwa_sek'] },
      { name: 'log_treningowy', headers: ['data', 'trening_typ', 'zrodlo_sesji', 'powod_modyfikacji', 'cwiczenie', 'seria_nr', 'powtorzenia', 'ciezar_kg', 'ocena_sesji_1_10', 'notatka', 'nowy_rekord'] },
      { name: 'odznaki_log', headers: ['id_odznaki', 'data_zdobycia'] },
      { name: 'pielegnacja_log', headers: ['data', 'produkt', 'wykonano'] },
      { name: 'sprzatanie_log', headers: ['data', 'strefa', 'minuty'] },
      { name: 'czytelnictwo_log', headers: ['data', 'minuty', 'tytul', 'ukonczono'] },
      { name: 'spacer_log', headers: ['data', 'numer'] },
      { name: 'natura_log', headers: ['data', 'zrodlo'] },
      { name: 'zakupy_log', headers: ['data', 'kategoria', 'produkt', 'kupione'] },
      { name: 'czas_wolny_log', headers: ['data', 'dlugosc_min', 'forma'] },
      { name: 'przypomnienia_cykliczne', headers: ['klucz', 'nazwa', 'data_ostatniego_wykonania', 'cykl_dni', 'notatka'] },
      { name: 'suplementy_definicje', headers: ['klucz', 'nazwa', 'typ'] },
      { name: 'pielegnacja_definicje', headers: ['klucz', 'nazwa', 'pora'] },
      { name: 'sprzatanie_rotacja_definicje', headers: ['dow', 'strefa'] },
      { name: 'przypomnienia_log', headers: ['klucz', 'data'] },
      { name: 'kardio_mobilnosc_log', headers: ['data', 'minuty', 'intensywnosc_1_10', 'rodzaj'] },
      { name: 'portfolio_projekty', headers: ['id', 'nazwa', 'kategoria', 'typ_pracy', 'data_rozpoczecia', 'zdjecie_zrobione', 'opis_napisany', 'opublikowane', 'kanaly', 'status'] },
      { name: 'portfolio_czas_log', headers: ['data', 'projekt_id', 'minuty'] },
      { name: 'smierci_log', headers: ['data'] },
      { name: 'rolling_average_cele', headers: ['modul', 'data', 'wartosc_dnia', 'srednia_7dni'] },
      { name: 'cytaty_motywacyjne', headers: ['tresc', 'autor', 'zrodlo', 'data_ostatniego_wyswietlenia'] },
      { name: 'marquee_komunikaty', headers: ['tresc', 'kategoria', 'warunek', 'priorytet'] },
    ];

    sheets.forEach(cfg => {
      let sheet = ss.getSheetByName(cfg.name);
      if (!sheet) sheet = ss.insertSheet(cfg.name);
      else sheet.clearContents();
      sheet.getRange(1, 1, 1, cfg.headers.length)
        .setValues([cfg.headers])
        .setFontWeight('bold')
        .setBackground('#0d1f0d')
        .setFontColor('#3dff3d');
    });

    const defaultSheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('Arkusz1');
    if (defaultSheet) ss.deleteSheet(defaultSheet);

    // Zasiew biblioteki cytatów i komunikatów Marquee (z PipBoyData.gs)
    seedPipBoyContentTables(ss);

    // Osobny, restrykcyjny folder Drive (sekcja 0.9 — nikt oprócz Arka)
    // Świadomie NIE zagnieżdżony we współdzielonych folderach Cerebro —
    // nowy folder na Drive domyślnie widoczny tylko dla właściciela konta.
    const folder = DriveApp.createFolder(PIPBOY_FOLDER_NAME);
    const file = DriveApp.getFileById(id);
    folder.addFile(file);
    DriveApp.getRootFolder().removeFile(file);
    PropertiesService.getScriptProperties().setProperty('PIPBOY_FOLDER_ID', folder.getId());

    // Backup/eksport automatyczny, cotygodniowy (sekcja 0.9) — trigger
    // instalowany od razu przy konfiguracji, niezależnie od tego, czy Arek
    // wskazał już osobny folder backupu (patrz pipboySetBackupFolder) — do
    // czasu wskazania eksport ląduje w tym samym folderze Pip-Boy.
    pipboyInstalujTriggerBackupu();

    return {
      success: true,
      spreadsheetUrl: ss.getUrl(),
      message: 'Pip-Boy zainicjowany pomyślnie — ' + PIPBOY_QUOTES.length + ' cytatów i ' + PIPBOY_MARQUEE.length + ' komunikatów Marquee wgranych.'
    };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function seedPipBoyContentTables(ss) {
  const cytatySheet = ss.getSheetByName('cytaty_motywacyjne');
  const cytatyRows = PIPBOY_QUOTES.map(q => [q.tresc, q.autor, q.zrodlo, '']);
  if (cytatyRows.length > 0) {
    cytatySheet.getRange(2, 1, cytatyRows.length, 4).setValues(cytatyRows);
  }
  const marqueeSheet = ss.getSheetByName('marquee_komunikaty');
  const marqueeRows = PIPBOY_MARQUEE.map(m => [m.tresc, m.kategoria, m.warunek, m.priorytet]);
  if (marqueeRows.length > 0) {
    marqueeSheet.getRange(2, 1, marqueeRows.length, 4).setValues(marqueeRows);
  }

  const planSheet = ss.getSheetByName('plan_treningowy');
  const planRows = [];
  ['A', 'B'].forEach(typ => {
    PIPBOY_TRENING_PLAN_STARTOWY[typ].forEach((cw, idx) => {
      planRows.push([typ, idx + 1, cw.cwiczenie, cw.serie, cw.powtorzenia, cw.przerwa_sek]);
    });
  });
  planSheet.getRange(2, 1, planRows.length, 6).setValues(planRows);

  const przypSheet = ss.getSheetByName('przypomnienia_cykliczne');
  const przypRows = Object.keys(PIPBOY_PRZYPOMNIENIA_DEFINICJE).map(klucz => {
    const def = PIPBOY_PRZYPOMNIENIA_DEFINICJE[klucz];
    return [klucz, def.nazwa, '', def.cykl_dni, ''];
  });
  przypSheet.getRange(2, 1, przypRows.length, 5).setValues(przypRows);

  // Suplementy rdzenne — zasiew startowy z PipBoyData.gs, ale odtąd
  // edytowalny w arkuszu (Onboarding krok 3 / Ustawienia), nie na sztywno
  // w kodzie. Patrz getSuplementyRdzenneDefinicje().
  const suplSheet = ss.getSheetByName('suplementy_definicje');
  const suplRows = PIPBOY_SUPLEMENTY_RDZENNE.map(s => [s.klucz, s.nazwa, 'rdzenny']);
  suplSheet.getRange(2, 1, suplRows.length, 3).setValues(suplRows);

  // Pielęgnacja (Moduł 7) — zasiew startowy z PipBoyData.gs, odtąd edytowalny.
  const pielSheet = ss.getSheetByName('pielegnacja_definicje');
  const pielRows = [];
  Object.keys(PIPBOY_PIELEGNACJA_PRODUKTY).forEach(pora => {
    PIPBOY_PIELEGNACJA_PRODUKTY[pora].forEach(p => pielRows.push([p.klucz, p.nazwa, pora]));
  });
  pielSheet.getRange(2, 1, pielRows.length, 3).setValues(pielRows);

  // Rotacja sprzątania (Moduł 8) — zasiew startowy z PipBoyData.gs, odtąd edytowalny.
  const rotSheet = ss.getSheetByName('sprzatanie_rotacja_definicje');
  const rotRows = PIPBOY_SPRZATANIE_ROTACJA.map(r => [r.dow, r.strefa]);
  rotSheet.getRange(2, 1, rotRows.length, 2).setValues(rotRows);
}

function getPipBoySpreadsheet() {
  const id = PropertiesService.getScriptProperties().getProperty('PIPBOY_SPREADSHEET_ID');
  if (!id) throw new Error('Pip-Boy nie jest zainicjowany. Kliknij "Skonfiguruj Pip-Boy" w Ustawieniach.');
  return SpreadsheetApp.openById(id);
}

function pipboySheet(name) {
  return getPipBoySpreadsheet().getSheetByName(name);
}

function todayIso() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Europe/Warsaw', 'yyyy-MM-dd');
}

// ============================================================
// SEKCJA 0.9 — BACKUP/EKSPORT AUTOMATYCZNY (cotygodniowy, Faza 3)
// Wymóg dosłowny z dokumentu: eksport "wyzwalany przy okazji niedzielnego
// review" (sekcja 6.5), do OSOBNEGO folderu Drive wskazanego przez Arka
// (nie hardkodowanego w tym repozytorium — link nie jest publikowany w
// dokumentacji, zgodnie z Rundą #17). Dopóki Arek nie wskaże folderu przez
// pipboySetBackupFolder(), eksport ląduje w głównym folderze Pip-Boy jako
// jawnie oznaczony fallback (patrz uzytoFallbacku w wyniku).
// ============================================================

function pipboySetBackupFolder(link) {
  try {
    const m = String(link || '').match(/[-\w]{25,}/); // wyciąga ID z typowego URL folderu Drive
    if (!m) return { success: false, error: 'Nie rozpoznano ID folderu w podanym linku.' };
    const folderId = m[0];
    DriveApp.getFolderById(folderId).getName(); // rzuci wyjątkiem, jeśli nieprawidłowy/niedostępny
    PropertiesService.getScriptProperties().setProperty('PIPBOY_BACKUP_FOLDER_ID', folderId);
    return { success: true };
  } catch (e) {
    return { success: false, error: 'Nieprawidłowy lub niedostępny folder: ' + e.toString() };
  }
}

function pipboyGetBackupFolderStatus() {
  try {
    const id = PropertiesService.getScriptProperties().getProperty('PIPBOY_BACKUP_FOLDER_ID');
    return { success: true, data: { skonfigurowany: !!id } };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// Zapisuje pełny zrzut wszystkich arkuszy Pip-Boy jako plik JSON. Wołane
// automatycznie przez trigger czasowy (niedziela wieczorem) i ręcznie z
// Ustawień ("Eksportuj teraz" — patrz ustawienia.html).
function pipboyEksportTygodniowy() {
  try {
    const ss = getPipBoySpreadsheet();
    const dane = {};
    ss.getSheets().forEach(function(sheet) { dane[sheet.getName()] = sheetToObjects(sheet); });
    const json = JSON.stringify(dane, null, 2);
    const nazwaPliku = 'Pip-Boy-Backup-' + todayIso() + '.json';

    let folderId = PropertiesService.getScriptProperties().getProperty('PIPBOY_BACKUP_FOLDER_ID');
    let uzytoFallbacku = false;
    if (!folderId) {
      folderId = PropertiesService.getScriptProperties().getProperty('PIPBOY_FOLDER_ID');
      uzytoFallbacku = true;
    }
    const folder = DriveApp.getFolderById(folderId);
    folder.createFile(nazwaPliku, json, 'application/json');
    return { success: true, uzytoFallbacku: uzytoFallbacku, nazwaPliku: nazwaPliku };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// Instaluje/odnawia cotygodniowy trigger czasowy — idempotentne (usuwa
// poprzedni trigger tej samej funkcji przed dodaniem nowego), więc bezpieczne
// do wywołania wielokrotnie (np. przy ponownym uruchomieniu setupPipBoy()).
function pipboyInstalujTriggerBackupu() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'pipboyEksportTygodniowy') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('pipboyEksportTygodniowy')
    .timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(20).create();
}

// ============================================================
// SEKCJA 0.7 — RYTUAŁ MIESIĘCZNY (wersja MVP: wejście manualne, zgodnie
// z sekcją 0.4 — automatyzacja odczytu grafiku to zadanie przyszłe)
// ============================================================

function getGrafikMiesiaca(rokMiesiac) { // 'YYYY-MM'
  try {
    const rows = sheetToObjects(pipboySheet('grafik_pracy'));
    const data = rows.filter(r => String(r.data).startsWith(rokMiesiac));
    return { success: true, data };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function setGrafikDzien(data, start, koniec, typDnia) {
  try {
    const sheet = pipboySheet('grafik_pracy');
    const dzienTygodnia = new Date(data).getDay(); // 0=niedziela..6=sobota
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === data) {
        sheet.getRange(i + 1, 1, 1, 5).setValues([[data, dzienTygodnia, start || '', koniec || '', typDnia]]);
        return { success: true };
      }
    }
    sheet.appendRow([data, dzienTygodnia, start || '', koniec || '', typDnia]);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// Stałe dni treningowe (Wt/Czw/Sob), niezależnie od typu zmiany — sekcja 0.5.B
// ============================================================
// SEKCJA 6.11 — ONBOARDING (pierwsze uruchomienie)
// Kroki 1-2 i 9 w pełni funkcjonalne (grafik miesięczny, dni treningowe,
// podsumowanie startowe). Kroki 3-6 (suplementy/pielęgnacja/sprzątanie/
// pojazdy) są na razie WYŁĄCZNIE prezentacją domyślnych wartości z
// PipBoyData.gs, bez edycji per-pozycja — pełna edytowalność katalogów
// to osobne zadanie (wymagałoby przeniesienia tych stałych do arkusza).
// Kroki 7-8 (RCP, Kalendarz) wymagają danych dostępowych Arka do Google —
// onboarding pokazuje je jako informacyjne, z opcją "skonfiguruj później".
// ============================================================

function getOnboardingStatus() {
  try {
    const done = PropertiesService.getUserProperties().getProperty('pipboyOnboardingDone') === 'true';
    return { success: true, data: { done: done } };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function getOnboardingDefaults() {
  try {
    return {
      success: true,
      data: {
        suplementyRdzenne: getSuplementyRdzenneDefinicje(),
        melatonina: PIPBOY_MELATONINA,
        gainer: PIPBOY_GAINER,
        pielegnacjaProdukty: getPielegnacjaDefinicje(),
        sprzatanieRotacja: getSprzatanieRotacjaDefinicje(),
        floorMin: PIPBOY_SPRZATANIE_FLOOR_MIN,
        ceilingMin: PIPBOY_SPRZATANIE_CEILING_MIN
      }
    };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// Zbiorczy zapis grafiku miesięcznego — jedno wywołanie zamiast N zapisów
// dzień-po-dniu (setGrafikDzien zostaje, używane też poza onboardingiem).
function setGrafikMiesiac(dni) {
  try {
    const sheet = pipboySheet('grafik_pracy');
    const dane = sheet.getDataRange().getValues();
    const indexMap = {};
    for (let i = 1; i < dane.length; i++) indexMap[dane[i][0]] = i;

    const doDopisania = [];
    (dni || []).forEach(function(wpis) {
      const dzienTygodnia = new Date(wpis.data).getDay();
      const wiersz = [wpis.data, dzienTygodnia, wpis.start || '', wpis.koniec || '', wpis.typDnia];
      if (indexMap.hasOwnProperty(wpis.data)) {
        sheet.getRange(indexMap[wpis.data] + 1, 1, 1, 5).setValues([wiersz]);
      } else {
        doDopisania.push(wiersz);
      }
    });
    if (doDopisania.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, doDopisania.length, 5).setValues(doDopisania);
    }
    return { success: true, zapisano: (dni || []).length };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function completeOnboarding(treningoweDni) {
  try {
    PropertiesService.getUserProperties().setProperties({
      pipboyOnboardingDone: 'true',
      pipboyTreningoweDni: (treningoweDni && treningoweDni.length ? treningoweDni : [2, 4, 6]).join(',')
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function jestDniemTreningowym(dataStr) {
  const dow = new Date(dataStr).getDay(); // domyślnie: 2=wtorek, 4=czwartek, 6=sobota
  const wlasne = PropertiesService.getUserProperties().getProperty('pipboyTreningoweDni');
  if (wlasne) {
    const dni = wlasne.split(',').map(Number);
    return dni.indexOf(dow) !== -1;
  }
  return dow === 2 || dow === 4 || dow === 6;
}

function jestNiedziela(dataStr) {
  return new Date(dataStr).getDay() === 0;
}

// Rozwiązuje typ dnia (A/B/C/D) na podstawie Grafik_Pracy + kalendarza
// treningowego. Niedziela zawsze = D (Szablon D, sekcja 3), niezależnie
// od wpisu w grafiku pracy (nigdy nie jest dniem pracującym w tym systemie).
function resolveTypSzablonu(dataStr) {
  if (jestNiedziela(dataStr)) return 'D';
  const rows = sheetToObjects(pipboySheet('grafik_pracy'));
  const wpis = rows.find(r => r.data === dataStr);
  const treningowy = jestDniemTreningowym(dataStr);
  if (!wpis || !wpis.typ_dnia) {
    // Brak wpisu w grafiku — domyślnie traktowane jako dzień wolny (Szablon C)
    return 'C';
  }
  if (wpis.typ_dnia === 'Wolny') return 'C';
  // wpis.typ_dnia === 'A' lub 'B'
  return treningowy ? (wpis.typ_dnia + '-TRENING') : wpis.typ_dnia;
}

// ============================================================
// SEKCJA 3 — SZABLONY DNIA: generowanie listy bloków dla Widoku Dnia
// Zgodnie z zasadą Rundy #17 punkt P: pełna, logiczna struktura dnia
// widoczna od razu, nie okrojony szkielet.
// ============================================================

function generateDayBlocks(dataStr) {
  const typSzablonu = resolveTypSzablonu(dataStr);
  const bazowyTyp = typSzablonu.replace('-TRENING', '');
  const treningowy = typSzablonu.indexOf('TRENING') !== -1;
  const niedziela = bazowyTyp === 'D';
  const posilkiGodz = PIPBOY_POSILKI_SZABLONY[bazowyTyp] || PIPBOY_POSILKI_SZABLONY.C;

  const dow = new Date(dataStr).getDay();
  const jestSrodaLubNiedziela = dow === 0 || dow === 3;
  const strefaSprzatania = getSprzatanieRotacjaDefinicje().find(s => s.dow === dow);
  const pielegnacjaDef = getPielegnacjaDefinicje();

  const blocks = [];
  blocks.push({ klucz: 'pobudka', nazwa: 'Pobudka', obligatoryjne: false, modul: 'ogolne' });
  blocks.push({
    klucz: 'pielegnacja_poranna', nazwa: 'Pielęgnacja poranna (max 15 min)', obligatoryjne: false, modul: 'pielegnacja',
    dzieci: pielegnacjaDef.poranny.concat(jestSrodaLubNiedziela ? pielegnacjaDef.poranny_sr_nd : []).map(p => p.klucz)
  });
  blocks.push({ klucz: 'rozciaganie', nazwa: 'Rozciąganie/joga (10-15 min)', obligatoryjne: true, modul: 'rozciaganie' });
  blocks.push({ klucz: 'suplementy_rdzenne', nazwa: 'Suplementy poranne', obligatoryjne: true, modul: 'suplementy', dzieci: getSuplementyRdzenneDefinicje().map(s => s.klucz) });
  blocks.push({ klucz: 'posilek_1', nazwa: 'Posiłek 1 (białko na starcie) — ok. ' + posilkiGodz[0], obligatoryjne: true, modul: 'dieta', numer: 1 });
  blocks.push({ klucz: 'mood_rano', nazwa: 'Mood check poranny', obligatoryjne: true, modul: 'mood', pora: 'rano' });

  if (!niedziela) {
    blocks.push({ klucz: 'praca', nazwa: bazowyTyp === 'C' ? 'Dzień wolny' : 'Praca (realny koniec wg RCP — Faza 2)', obligatoryjne: false, modul: 'ogolne' });
  }

  blocks.push({ klucz: 'posilek_2', nazwa: 'Posiłek 2 — ok. ' + posilkiGodz[1], obligatoryjne: true, modul: 'dieta', numer: 2 });

  if (treningowy) {
    blocks.push({ klucz: 'trening', nazwa: 'Trening (1h + 15 min pielęgnacja potreningowa)', obligatoryjne: true, modul: 'trening' });
    blocks.push({ klucz: 'gainer', nazwa: 'Gainer (zaraz po treningu)', obligatoryjne: true, modul: 'suplementy', dzieci: ['gainer'] });
  }

  blocks.push({ klucz: 'posilek_3', nazwa: 'Posiłek 3 — ok. ' + posilkiGodz[2], obligatoryjne: true, modul: 'dieta', numer: 3 });

  // Sprzątanie: floor 15 min OBLIGATORYJNY każdego dnia OPRÓCZ niedzieli
  // (sekcja 2.0 — poprawione: wcześniej ograniczone błędnie tylko do Szablonu C)
  blocks.push({
    klucz: 'sprzatanie', nazwa: 'Sprzątanie — strefa: ' + (strefaSprzatania ? strefaSprzatania.strefa : '—') + ' (floor 15 min, #sprzątanie)',
    obligatoryjne: !niedziela, modul: 'sprzatanie', strefa: strefaSprzatania ? strefaSprzatania.strefa : ''
  });

  blocks.push({ klucz: 'posilek_4', nazwa: 'Posiłek 4 — ok. ' + posilkiGodz[3], obligatoryjne: true, modul: 'dieta', numer: 4 });
  blocks.push({ klucz: 'czytelnictwo', nazwa: 'Czytelnictwo (cel 60 min)', obligatoryjne: true, modul: 'czytelnictwo' });
  blocks.push({ klucz: 'spacer', nazwa: 'Spacer z psem (2-3x, bez przypomnienia)', obligatoryjne: false, modul: 'spacer' });
  blocks.push({ klucz: 'natura', nazwa: 'Kontakt z naturą / wyciszenie', obligatoryjne: false, modul: 'natura' });
  blocks.push({ klucz: 'zakupy', nazwa: 'Zakupy 70/30 (elastyczny slot tygodniowy)', obligatoryjne: false, modul: 'zakupy' });
  blocks.push({ klucz: 'czas_wolny_1', nazwa: 'Czas wolny (Portfolio / czytanie / spacer)', obligatoryjne: false, modul: 'czas_wolny' });
  blocks.push({ klucz: 'posilek_5', nazwa: 'Posiłek 5 — ok. ' + posilkiGodz[4], obligatoryjne: true, modul: 'dieta', numer: 5 });
  blocks.push({ klucz: 'melatonina', nazwa: 'Melatonina (w razie potrzeby, max 5)', obligatoryjne: false, modul: 'suplementy', dzieci: ['melatonina'] });
  blocks.push({
    klucz: 'pielegnacja_wieczorna', nazwa: 'Pielęgnacja wieczorna (max 15 min)', obligatoryjne: false, modul: 'pielegnacja',
    dzieci: pielegnacjaDef.wieczorny.map(p => p.klucz)
  });
  blocks.push({ klucz: 'higiena_swiatla', nazwa: 'Higiena światła wieczorem', obligatoryjne: true, modul: 'sen' });
  blocks.push({ klucz: 'mood_wieczor', nazwa: 'Mood check wieczorny (w tym GI)', obligatoryjne: true, modul: 'mood', pora: 'wieczor' });
  blocks.push({ klucz: 'czas_wolny_2', nazwa: 'Czas wolny / Nicnierobienie — do snu, bez limitu', obligatoryjne: false, modul: 'czas_wolny' });

  return { typSzablonu, treningowy, niedziela, blocks };
}

function getPipBoyDzien(dataStr) {
  try {
    dataStr = dataStr || todayIso();
    const struktura = generateDayBlocks(dataStr);
    const suplementyLog = sheetToObjects(pipboySheet('suplementy_log')).filter(r => r.data === dataStr);
    const posilkiLog = sheetToObjects(pipboySheet('posilki_log')).filter(r => r.data === dataStr);
    const moodLog = sheetToObjects(pipboySheet('mood_log')).filter(r => r.data === dataStr);
    const dziennyLog = sheetToObjects(pipboySheet('log_dzienny')).filter(r => r.data === dataStr);
    const pielegnacjaLog = sheetToObjects(pipboySheet('pielegnacja_log')).filter(r => r.data === dataStr);
    const sprzatanieLog = sheetToObjects(pipboySheet('sprzatanie_log')).filter(r => r.data === dataStr);
    const czytelnictwoLog = sheetToObjects(pipboySheet('czytelnictwo_log')).filter(r => r.data === dataStr);
    const spacerLog = sheetToObjects(pipboySheet('spacer_log')).filter(r => r.data === dataStr);
    const naturaLog = sheetToObjects(pipboySheet('natura_log')).filter(r => r.data === dataStr);
    const zakupyLog = sheetToObjects(pipboySheet('zakupy_log')).filter(r => r.data === dataStr);
    const czasWolnyLog = sheetToObjects(pipboySheet('czas_wolny_log')).filter(r => r.data === dataStr);
    const treningLog = sheetToObjects(pipboySheet('log_treningowy')).filter(r => r.data === dataStr);
    const godModeAktywny = isGodModeActive(dataStr);
    const hp = computePipBoyHP(dataStr, struktura, {
      suplementyLog, posilkiLog, moodLog, sprzatanieLog, czytelnictwoLog, treningLog
    }, godModeAktywny);
    upsertHpHistoria(dataStr, hp.procent);
    // Śmierć postaci wyzwalana WYŁĄCZNIE dla dzisiejszego dnia ("w trakcie dnia",
    // sekcja 4.1) — przeglądanie dawnych dni z HP=0 nie zabija retroaktywnie.
    const smiercWynik = (dataStr === todayIso()) ? pipboySprawdzSmierc(dataStr, hp.procent) : { smierc: false, nowaSmierc: false };

    return {
      success: true,
      data: {
        data: dataStr,
        typSzablonu: struktura.typSzablonu,
        bloki: struktura.blocks,
        suplementyLog, posilkiLog, moodLog, dziennyLog, pielegnacjaLog, sprzatanieLog,
        czytelnictwoLog, spacerLog, naturaLog, zakupyLog, czasWolnyLog, treningLog,
        godModeAktywny,
        hp: hp.procent,
        hpBrakujace: hp.brakujace,
        smiercPostaci: smiercWynik.smierc, nowaSmiercPostaci: !!smiercWynik.nowaSmierc,
        cytatDnia: getCytatDnia(),
        zakupyRekomendacje: getZakupyRekomendacje(dataStr),
        przypomnieniaAktywne: getAktywnePrzypomnienia(),
      }
    };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// Generyczny log dla prostych, obligatoryjnych checkboxów bez własnej tabeli
// (Rozciąganie/joga, Higiena światła — Moduł 10, 10A). UWAGA: żadne z nich
// nie ma jeszcze wartości kary HP w tabeli kalibracji (sekcja 4.2 dokumentu
// nie definiuje kary dla tych dwóch modułów, mimo statusu OBLIGATORYJNE w
// sekcji 2.0 — to luka w samej specyfikacji, nie skrót w tej implementacji).
// Tracking działa; naliczanie HP czeka na kalibrację od Arka.
function toggleLogDzienny(dataStr, modul, wykonano) {
  try {
    const sheet = pipboySheet('log_dzienny');
    const rows = sheet.getDataRange().getValues();
    const punktyWpis = modul === 'rozciaganie'
      ? { atrybut: 'cialo', punkty: PIPBOY_PUNKTY_ZDOBYTE.rozciaganie.punkty }
      : { atrybut: 'umysl', punkty: PIPBOY_PUNKTY_ZDOBYTE.higiena_swiatla.punkty };
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === dataStr && rows[i][1] === modul) {
        const bylWykonany = rows[i][2] === true || rows[i][2] === 'true' || rows[i][2] === 'TRUE';
        sheet.getRange(i + 1, 3).setValue(wykonano);
        if (wykonano && !bylWykonany) pipboyAwardPoints(dataStr, punktyWpis.atrybut, punktyWpis.punkty);
        return { success: true };
      }
    }
    sheet.appendRow([dataStr, modul, wykonano]);
    if (wykonano) pipboyAwardPoints(dataStr, punktyWpis.atrybut, punktyWpis.punkty);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ============================================================
// MODUŁ 7 — PIELĘGNACJA (rozbita per-produkt, dwa stałe sloty, bez kary HP)
// ============================================================

function togglePielegnacja(dataStr, produkt, wykonano) {
  try {
    const sheet = pipboySheet('pielegnacja_log');
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === dataStr && rows[i][1] === produkt) {
        sheet.getRange(i + 1, 3).setValue(wykonano);
        if (wykonano) pipboyAwardPoints(dataStr, 'dyscyplina', PIPBOY_PUNKTY_ZDOBYTE.pielegnacja_pozycja.punkty);
        return { success: true };
      }
    }
    sheet.appendRow([dataStr, produkt, wykonano]);
    if (wykonano) pipboyAwardPoints(dataStr, 'dyscyplina', PIPBOY_PUNKTY_ZDOBYTE.pielegnacja_pozycja.punkty);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ============================================================
// MODUŁ 8 — SPRZĄTANIE (rotacja 7-strefowa, floor/ceiling #sprzątanie)
// ============================================================

function saveSprzatanie(dataStr, strefa, minuty) {
  try {
    const sheet = pipboySheet('sprzatanie_log');
    sheet.appendRow([dataStr, strefa, minuty]);
    pipboyAwardPoints(dataStr, 'otoczenie', 8); // sekcja 4.2: +8 pkt za zadanie sprzątania
    evaluateStarterBadges(dataStr);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ============================================================
// MODUŁ 5 — CZYTELNICTWO (minuty + tytuł, rolling average, obligatoryjne)
// ============================================================

function saveCzytelnictwo(dataStr, minuty, tytul, ukonczono) {
  try {
    pipboySheet('czytelnictwo_log').appendRow([dataStr, minuty, tytul || '', !!ukonczono]);
    const pktBazowe = Math.min(12, Math.floor(Number(minuty) / 10) * 2); // +2/10min, max 12/dzień (sekcja 4.2)
    if (pktBazowe > 0) pipboyAwardPoints(dataStr, 'umysl', pktBazowe);
    if (ukonczono) pipboyAwardPoints(dataStr, 'umysl', 25); // bonus ukończonej pozycji
    updateRollingAverage('czytelnictwo', dataStr, Number(minuty));
    evaluateStarterBadges(dataStr);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ============================================================
// MODUŁ 6/9 — SPACER Z PSEM / KONTAKT Z NATURĄ (oba OPCJONALNE, bez kary)
// ============================================================

function toggleSpacer(dataStr, numer) {
  try {
    pipboySheet('spacer_log').appendRow([dataStr, numer]);
    pipboyAwardPoints(dataStr, 'cialo', 3);
    // Spacer automatycznie zalicza kontakt z naturą tego dnia (sekcja Moduł 9)
    const naturaJuz = sheetToObjects(pipboySheet('natura_log')).some(r => r.data === dataStr);
    if (!naturaJuz) pipboySheet('natura_log').appendRow([dataStr, 'spacer_auto']);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function toggleNatura(dataStr) {
  try {
    const juz = sheetToObjects(pipboySheet('natura_log')).some(r => r.data === dataStr);
    if (juz) return { success: true };
    pipboySheet('natura_log').appendRow([dataStr, 'reczny']);
    pipboyAwardPoints(dataStr, 'otoczenie', 5);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ============================================================
// MODUŁ 17 — ZAKUPY 70/30 (rekomendacje, bez sztywnej listy)
// ============================================================

function getZakupyRekomendacje(dataStr) {
  const wynik = {};
  Object.keys(PIPBOY_ZAKUPY_KATEGORIE).forEach(kat => {
    const def = PIPBOY_ZAKUPY_KATEGORIE[kat];
    // 70/30: wszystkie pozycje core + jedna rotacyjna, wybierana wg dnia miesiąca (deterministyczne, bez losowości między odświeżeniami)
    const dzienMiesiaca = new Date(dataStr).getDate();
    const rotacyjna = def.rotacyjne[dzienMiesiaca % def.rotacyjne.length];
    wynik[kat] = { core: def.core, rotacyjna };
  });
  return wynik;
}

function saveZakupy(dataStr, pozycje) { // pozycje: [{kategoria, produkt, kupione}]
  try {
    const sheet = pipboySheet('zakupy_log');
    pozycje.forEach(p => sheet.appendRow([dataStr, p.kategoria, p.produkt, p.kupione]));
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ============================================================
// MODUŁ 19 — CZAS WOLNY / NICNIEROBIENIE (log minimalistyczny, bez presji)
// ============================================================

function saveCzasWolny(dataStr, dlugoscMin, forma) {
  try {
    pipboySheet('czas_wolny_log').appendRow([dataStr, dlugoscMin, forma || '']);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ============================================================
// MODUŁ 20 — ROLLING AVERAGE (średnia krocząca 7-dniowa dla celów miękkich)
// ============================================================

function updateRollingAverage(modul, dataStr, wartoscDnia) {
  try {
    const sheet = pipboySheet('rolling_average_cele');
    const rows = sheetToObjects(sheet).filter(r => r.modul === modul);
    const posortowane = rows.filter(r => r.data < dataStr).sort((a, b) => a.data < b.data ? 1 : -1).slice(0, 6);
    const wszystkie = posortowane.map(r => Number(r.wartosc_dnia)).concat([wartoscDnia]);
    const srednia = wszystkie.reduce((a, b) => a + b, 0) / wszystkie.length;
    sheet.appendRow([modul, dataStr, wartoscDnia, Math.round(srednia * 10) / 10]);
    return srednia;
  } catch (e) {
    return null;
  }
}

// ============================================================
// PRZYPOMNIENIA CYKLICZNE (fryzjer, badania, auto, motocykl, robot)
// ============================================================

// Sezon motocyklowy potwierdzony w dokumencie: kwiecień-październik (Moduł 16).
function pipboyWSezonieMotocyklowym(miesiac) { return miesiac >= 4 && miesiac <= 10; }

function getAktywnePrzypomnienia() {
  try {
    const rows = sheetToObjects(pipboySheet('przypomnienia_cykliczne'));
    const dzis = todayIso();
    const dzisDate = new Date(dzis + 'T00:00:00');
    const miesiac = dzisDate.getMonth() + 1; // 1-12

    return rows.filter(r => {
      // Kontrola bieżąca motocykla — aktywna WYŁĄCZNIE w sezonie, nie tylko
      // "jeszcze nie czas wg cyklu" — poza sezonem w ogóle niewidoczna
      // (Moduł 16, wcześniej brakująca logika sezonowości).
      if (r.klucz === 'motocykl_kontrola' && !pipboyWSezonieMotocyklowym(miesiac)) return false;

      // Przypomnienia sezonowe 2x/rok (Moduł 16) — aktywne tylko w konkretnym
      // oknie kalendarzowym, raz na dany rok (nie co N dni jak reszta).
      if (r.klucz === 'motocykl_wiosna' || r.klucz === 'motocykl_jesien') {
        const wOknie = r.klucz === 'motocykl_wiosna' ? (miesiac === 3 || miesiac === 4) : (miesiac === 10 || miesiac === 11);
        if (!wOknie) return false;
        if (!r.data_ostatniego_wykonania) return true;
        const rokWykonania = Number(String(r.data_ostatniego_wykonania).slice(0, 4));
        return rokWykonania < dzisDate.getFullYear();
      }

      if (!r.data_ostatniego_wykonania) return true; // nigdy niewykonane — pokaż
      return dataMinus(dzis, Number(r.cykl_dni)) >= r.data_ostatniego_wykonania;
    }).map(r => ({ klucz: r.klucz, nazwa: r.nazwa, cyklDni: r.cykl_dni }));
  } catch (e) {
    return [];
  }
}

function oznaczPrzypomnienieWykonane(klucz, dataStr) {
  try {
    const sheet = pipboySheet('przypomnienia_cykliczne');
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === klucz) {
        sheet.getRange(i + 1, 3).setValue(dataStr);
        // Log historyczny KAŻDEGO wykonania (nie tylko ostatniej daty) — bez
        // tego odznaki liczące wielokrotne wykonania (Moduł 15/16, kategoria L)
        // byłyby nieobliczalne, bo przypomnienia_cykliczne trzyma tylko 1 datę.
        pipboySheet('przypomnienia_log').appendRow([klucz, dataStr]);
        return { success: true };
      }
    }
    return { success: false, error: 'Nieznany klucz przypomnienia.' };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// Dodanie nowego przypomnienia cyklicznego spoza startowego katalogu
// (Onboarding krok 6 / Ustawienia) — np. drugi pojazd, coś specyficznego
// dla Arka. Sezonowe klucze motocykl_wiosna/motocykl_jesien są zarezerwowane
// (mają dedykowaną logikę okna kalendarzowego w getAktywnePrzypomnienia) —
// nowy klucz zawsze podlega zwykłej logice "co N dni".
function dodajPrzypomnienieCykliczne(klucz, nazwa, cyklDni) {
  try {
    if (!klucz || !nazwa || !cyklDni) return { success: false, error: 'Podaj klucz, nazwę i cykl w dniach.' };
    const sheet = pipboySheet('przypomnienia_cykliczne');
    const rows = sheetToObjects(sheet);
    if (rows.some(r => r.klucz === klucz)) return { success: false, error: 'Taki klucz już istnieje.' };
    sheet.appendRow([klucz, nazwa, '', cyklDni, '']);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function usunPrzypomnienieCykliczne(klucz) {
  try {
    const sheet = pipboySheet('przypomnienia_cykliczne');
    const dane = sheet.getDataRange().getValues();
    for (let i = 1; i < dane.length; i++) {
      if (dane[i][0] === klucz) { sheet.deleteRow(i + 1); return { success: true }; }
    }
    return { success: false, error: 'Nie znaleziono.' };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function pipboyUstawNotatkaPrzypomnienia(klucz, notatka) {
  try {
    const sheet = pipboySheet('przypomnienia_cykliczne');
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === klucz) {
        sheet.getRange(i + 1, 5).setValue(notatka || '');
        return { success: true };
      }
    }
    return { success: false, error: 'Nieznany klucz przypomnienia.' };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// Pełna lista WSZYSTKICH przypomnień cyklicznych (nie tylko aktualnie
// "aktywnych") — do dedykowanego ekranu SERWIS (Moduł 12/15/16), żeby Arek
// widział status każdego z nich, nie tylko te akurat przeterminowane.
function getWszystkiePrzypomnienia() {
  try {
    const rows = sheetToObjects(pipboySheet('przypomnienia_cykliczne'));
    const dzis = todayIso();
    const dzisDate = new Date(dzis + 'T00:00:00');
    const miesiac = dzisDate.getMonth() + 1;
    return {
      success: true,
      data: rows.map(function(r) {
        let sezonowyStatus = null;
        if (r.klucz === 'motocykl_kontrola') {
          sezonowyStatus = pipboyWSezonieMotocyklowym(miesiac) ? 'w sezonie (kwiecień-październik)' : 'POZA SEZONEM — ukryte z Widoku Dnia';
        } else if (r.klucz === 'motocykl_wiosna' || r.klucz === 'motocykl_jesien') {
          sezonowyStatus = r.klucz === 'motocykl_wiosna' ? 'okno: marzec-kwiecień' : 'okno: październik-listopad';
        }
        return {
          klucz: r.klucz, nazwa: r.nazwa, cyklDni: r.cykl_dni,
          dataOstatniegoWykonania: r.data_ostatniego_wykonania || '', notatka: r.notatka || '',
          sezonowyStatus: sezonowyStatus
        };
      })
    };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ============================================================
// SUPLEMENTY RDZENNE — definicja edytowalna (Moduł 1 / Onboarding krok 3),
// zamiast sztywnej listy w kodzie. Fallback do stałej PIPBOY_SUPLEMENTY_RDZENNE
// (PipBoyData.gs) dopóki arkusz jest pusty — np. tuż po setupPipBoy(), zanim
// zasiew zdąży się wykonać, albo w bardzo starych, ręcznie tworzonych arkuszach.
// ============================================================

function getSuplementyRdzenneDefinicje() {
  try {
    const rows = sheetToObjects(pipboySheet('suplementy_definicje')).filter(r => r.typ === 'rdzenny');
    if (rows.length === 0) return PIPBOY_SUPLEMENTY_RDZENNE.slice();
    return rows.map(r => ({ klucz: r.klucz, nazwa: r.nazwa }));
  } catch (e) {
    return PIPBOY_SUPLEMENTY_RDZENNE.slice();
  }
}

function dodajSuplementRdzenny(klucz, nazwa) {
  try {
    if (!klucz || !nazwa) return { success: false, error: 'Podaj klucz i nazwę.' };
    const sheet = pipboySheet('suplementy_definicje');
    const rows = sheetToObjects(sheet);
    if (rows.some(r => r.klucz === klucz)) return { success: false, error: 'Taki klucz już istnieje.' };
    sheet.appendRow([klucz, nazwa, 'rdzenny']);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function usunSuplementRdzenny(klucz) {
  try {
    const sheet = pipboySheet('suplementy_definicje');
    const dane = sheet.getDataRange().getValues();
    for (let i = 1; i < dane.length; i++) {
      if (dane[i][0] === klucz) { sheet.deleteRow(i + 1); return { success: true }; }
    }
    return { success: false, error: 'Nie znaleziono.' };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ============================================================
// PIELĘGNACJA — definicja edytowalna (Moduł 7 / Onboarding krok 4), zamiast
// sztywnej listy w kodzie. Fallback do PIPBOY_PIELEGNACJA_PRODUKTY, tak samo
// jak przy suplementach rdzennych.
// ============================================================

function getPielegnacjaDefinicje() {
  try {
    const rows = sheetToObjects(pipboySheet('pielegnacja_definicje'));
    if (rows.length === 0) return PIPBOY_PIELEGNACJA_PRODUKTY;
    const wynik = { poranny: [], wieczorny: [], poranny_sr_nd: [] };
    rows.forEach(r => {
      if (!wynik[r.pora]) wynik[r.pora] = [];
      wynik[r.pora].push({ klucz: r.klucz, nazwa: r.nazwa });
    });
    return wynik;
  } catch (e) {
    return PIPBOY_PIELEGNACJA_PRODUKTY;
  }
}

function dodajProduktPielegnacyjny(pora, klucz, nazwa) {
  try {
    if (!klucz || !nazwa) return { success: false, error: 'Podaj klucz i nazwę.' };
    if (['poranny', 'wieczorny', 'poranny_sr_nd'].indexOf(pora) === -1) return { success: false, error: 'Nieznana pora.' };
    const sheet = pipboySheet('pielegnacja_definicje');
    const rows = sheetToObjects(sheet);
    if (rows.some(r => r.klucz === klucz)) return { success: false, error: 'Taki klucz już istnieje.' };
    sheet.appendRow([klucz, nazwa, pora]);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function usunProduktPielegnacyjny(klucz) {
  try {
    const sheet = pipboySheet('pielegnacja_definicje');
    const dane = sheet.getDataRange().getValues();
    for (let i = 1; i < dane.length; i++) {
      if (dane[i][0] === klucz) { sheet.deleteRow(i + 1); return { success: true }; }
    }
    return { success: false, error: 'Nie znaleziono.' };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ============================================================
// ROTACJA SPRZĄTANIA — definicja edytowalna (Moduł 8 / Onboarding krok 5),
// zamiast sztywnej listy w kodzie. 7 stałych dni tygodnia (dow 0-6) — edycja
// to zmiana NAZWY strefy per dzień, nie dodawanie/usuwanie wierszy.
// ============================================================

function getSprzatanieRotacjaDefinicje() {
  try {
    const rows = sheetToObjects(pipboySheet('sprzatanie_rotacja_definicje'));
    if (rows.length === 0) return PIPBOY_SPRZATANIE_ROTACJA.slice();
    return rows.map(r => ({ dow: Number(r.dow), strefa: r.strefa }));
  } catch (e) {
    return PIPBOY_SPRZATANIE_ROTACJA.slice();
  }
}

function ustawStrefeSprzatania(dow, strefa) {
  try {
    const sheet = pipboySheet('sprzatanie_rotacja_definicje');
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (Number(rows[i][0]) === Number(dow)) {
        sheet.getRange(i + 1, 2).setValue(strefa);
        return { success: true };
      }
    }
    return { success: false, error: 'Nieznany dzień tygodnia.' };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ============================================================
// MODUŁ 1 — SUPLEMENTACJA
// ============================================================

function toggleSuplement(dataStr, klucz, wykonano) {
  try {
    const sheet = pipboySheet('suplementy_log');
    const rows = sheet.getDataRange().getValues();
    const godzina = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Europe/Warsaw', 'HH:mm');
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === dataStr && rows[i][1] === klucz) {
        sheet.getRange(i + 1, 3, 1, 2).setValues([[wykonano, godzina]]);
        if (wykonano && klucz !== 'melatonina') pipboyAwardPoints(dataStr, 'dyscyplina', PIPBOY_PUNKTY_ZDOBYTE.suplement_rdzenny.punkty);
        evaluateStarterBadges(dataStr);
        return { success: true };
      }
    }
    sheet.appendRow([dataStr, klucz, wykonano, godzina, '']);
    if (wykonano && klucz !== 'melatonina') pipboyAwardPoints(dataStr, 'dyscyplina', PIPBOY_PUNKTY_ZDOBYTE.suplement_rdzenny.punkty);
    evaluateStarterBadges(dataStr);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ============================================================
// MODUŁ 4 — DIETA (checklist realizacji, bez sugestii dań)
// ============================================================

function toggleMeal(dataStr, numer, wykonano) {
  try {
    const sheet = pipboySheet('posilki_log');
    const rows = sheet.getDataRange().getValues();
    const godzina = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Europe/Warsaw', 'HH:mm');
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === dataStr && Number(rows[i][1]) === Number(numer)) {
        sheet.getRange(i + 1, 3, 1, 2).setValues([[wykonano, godzina]]);
        if (wykonano) pipboyAwardPoints(dataStr, 'dyscyplina', PIPBOY_PUNKTY_ZDOBYTE.posilek.punkty);
        evaluateStarterBadges(dataStr);
        return { success: true };
      }
    }
    sheet.appendRow([dataStr, numer, wykonano, godzina]);
    if (wykonano) pipboyAwardPoints(dataStr, 'dyscyplina', PIPBOY_PUNKTY_ZDOBYTE.posilek.punkty);
    evaluateStarterBadges(dataStr);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ============================================================
// MODUŁ 11 — MOOD TRACKER
// ============================================================

function saveMood(dataStr, pora, wartosci) {
  // wartosci: { nastroj, energia, sen, skupienie, gi, notatka_gi_followup }
  try {
    const sheet = pipboySheet('mood_log');
    const rows = sheet.getDataRange().getValues();
    const row = [
      dataStr, pora,
      wartosci.nastroj || '', wartosci.energia || '', wartosci.sen || '',
      wartosci.skupienie || '', wartosci.gi || '', wartosci.notatka_gi_followup || ''
    ];
    let bylWpisJuz = false;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === dataStr && rows[i][1] === pora) {
        sheet.getRange(i + 1, 1, 1, 8).setValues([row]);
        bylWpisJuz = true;
        break;
      }
    }
    if (!bylWpisJuz) sheet.appendRow(row);
    if (!bylWpisJuz) pipboyAwardPoints(dataStr, 'umysl', PIPBOY_PUNKTY_ZDOBYTE.mood_wpis.punkty);
    evaluateStarterBadges(dataStr);
    return { success: true, followUpGI: Number(wartosci.gi) > 0 && Number(wartosci.gi) <= 4 };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ============================================================
// SEKCJA 4.1a — GOD_MODE_24H (dawny Token Dnia Ochronnego)
// Ręczna aktywacja, w tym tego samego dnia (Runda #17), limit 4/miesiąc.
// ============================================================

// Aktywny GOD_MODE_24H na dany dzień (typ='dzien', dopasowanie po dacie) LUB
// Tryb Regeneracji obejmujący ten dzień (typ='tryb-regeneracji', aktywny=true,
// data_aktywacji <= dataStr — trwa aż do ręcznej dezaktywacji, sekcja 4.1b).
function isGodModeActive(dataStr) {
  const rows = sheetToObjects(pipboySheet('tokeny_god_mode'));
  return rows.some(r => r.data_aktywacji === dataStr && r.typ === 'dzien')
      || isTrybRegeneracjiActive(dataStr);
}

function countGodModeWMiesiacu(rokMiesiac) {
  const rows = sheetToObjects(pipboySheet('tokeny_god_mode'));
  return rows.filter(r => String(r.data_aktywacji).startsWith(rokMiesiac) && r.typ === 'dzien').length;
}

function activateGodMode(dataStr) {
  try {
    const rokMiesiac = dataStr.substring(0, 7);
    const uzyte = countGodModeWMiesiacu(rokMiesiac);
    if (uzyte >= PIPBOY_GOD_MODE_LIMIT_MIESIECZNY) {
      return { success: false, error: 'Limit ' + PIPBOY_GOD_MODE_LIMIT_MIESIECZNY + ' aktywacji w tym miesiącu wykorzystany.' };
    }
    if (isGodModeActive(dataStr)) {
      return { success: false, error: 'Ochrona jest już aktywna na ten dzień.' };
    }
    pipboySheet('tokeny_god_mode').appendRow([dataStr, 'dzien', true, '']);
    const sugestiaTrybu = sprawdzSugestieTrybuRegeneracji(dataStr);
    return { success: true, pozostaleWMiesiacu: PIPBOY_GOD_MODE_LIMIT_MIESIECZNY - uzyte - 1, sugestiaTrybu };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ============================================================
// SEKCJA 4.1b — TRYB REGENERACJI (Runda #17)
// Wyzwalacz: 2 dni z rzędu z aktywnym GOD_MODE_24H → propozycja (nie wymus).
// ============================================================

function dataMinus(dataStr, dni) {
  const d = new Date(dataStr + 'T00:00:00');
  d.setDate(d.getDate() - dni);
  return Utilities.formatDate(d, Session.getScriptTimeZone() || 'Europe/Warsaw', 'yyyy-MM-dd');
}

function sprawdzSugestieTrybuRegeneracji(dataStr) {
  const rows = sheetToObjects(pipboySheet('tokeny_god_mode'));
  const wczoraj = dataMinus(dataStr, 1);
  const dzisAktywny = rows.some(r => r.data_aktywacji === dataStr && r.typ === 'dzien');
  const wczorajAktywny = rows.some(r => r.data_aktywacji === wczoraj && r.typ === 'dzien');
  return dzisAktywny && wczorajAktywny;
}

function isTrybRegeneracjiActive(dataStr) {
  const rows = sheetToObjects(pipboySheet('tokeny_god_mode'));
  return rows.some(r => r.typ === 'tryb-regeneracji' && (r.aktywny === true || r.aktywny === 'true' || r.aktywny === 'TRUE') && r.data_aktywacji <= dataStr);
}

function activateTrybRegeneracji(dataStr) {
  try {
    if (isTrybRegeneracjiActive(dataStr)) return { success: false, error: 'Tryb Regeneracji jest już aktywny.' };
    pipboySheet('tokeny_god_mode').appendRow([dataStr, 'tryb-regeneracji', true, '']);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function deactivateTrybRegeneracji() {
  try {
    const sheet = pipboySheet('tokeny_god_mode');
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][1] === 'tryb-regeneracji' && (rows[i][2] === true || rows[i][2] === 'true' || rows[i][2] === 'TRUE')) {
        sheet.getRange(i + 1, 3).setValue(false);
      }
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ============================================================
// SEKCJA 4.2 — MECHANIKA HP (podstawowa, bez pełnej listy odznak)
// ============================================================

function computePipBoyHP(dataStr, struktura, logi, godModeAktywny) {
  const { suplementyLog, posilkiLog, moodLog, sprzatanieLog, czytelnictwoLog, treningLog } = logi;
  let hp = 100;
  const brakujace = [];

  const rdzenneKlucze = getSuplementyRdzenneDefinicje().map(s => s.klucz);
  if (struktura.treningowy) rdzenneKlucze.push('gainer');
  rdzenneKlucze.forEach(klucz => {
    const wpis = suplementyLog.find(r => r.klucz === klucz);
    const wykonano = wpis && (wpis.wykonano === true || wpis.wykonano === 'true' || wpis.wykonano === 'TRUE');
    if (!wykonano) {
      // suplementy rdzenne NIE podlegają wyłączeniu GOD_MODE (4.1a)
      hp -= PIPBOY_HP_KARY.suplement_rdzenny_lub_gainer;
      brakujace.push('Suplement: ' + klucz);
    }
  });
  // Melatonina: bez kary (Runda #17) — celowo pominięta w pętli kar

  if (!godModeAktywny) {
    [1, 2, 3, 4, 5].forEach(numer => {
      const wpis = posilkiLog.find(r => Number(r.numer) === numer);
      const wykonano = wpis && (wpis.wykonano === true || wpis.wykonano === 'true' || wpis.wykonano === 'TRUE');
      if (!wykonano) {
        hp -= PIPBOY_HP_KARY.posilek;
        brakujace.push('Posiłek ' + numer);
      }
    });

    if (struktura.treningowy && treningLog.length === 0) {
      hp -= PIPBOY_HP_KARY.trening_w_dniu_treningowym;
      brakujace.push('Trening (żaden status niezalogowany)');
    }

    if (!struktura.niedziela) {
      const minutySprzatania = sprzatanieLog.reduce((s, r) => s + (Number(r.minuty) || 0), 0);
      if (minutySprzatania < PIPBOY_SPRZATANIE_FLOOR_MIN) {
        hp -= PIPBOY_HP_KARY.sprzatanie_ponizej_floora;
        brakujace.push('Sprzątanie (poniżej ' + PIPBOY_SPRZATANIE_FLOOR_MIN + ' min floora)');
      }
    }

    const minutyCzytania = czytelnictwoLog.reduce((s, r) => s + (Number(r.minuty) || 0), 0);
    if (minutyCzytania === 0) {
      hp -= PIPBOY_HP_KARY.czytelnictwo_zero_dnia;
      brakujace.push('Czytelnictwo (zero minut dziś)');
    }

    ['rano', 'wieczor'].forEach(pora => {
      const wpis = moodLog.find(r => r.pora === pora);
      if (!wpis) {
        hp -= PIPBOY_HP_KARY.mood_wpis;
        brakujace.push('Mood check (' + pora + ')');
      }
    });
  }

  hp = Math.max(0, hp);
  return { procent: hp, brakujace };
}

// Zapisuje/aktualizuje dzienny wynik HP w arkuszu historii (do wykresu
// trendu na Dashboardzie, sekcja 6.13). Upsert po dacie — bezpieczne przy
// wielokrotnym przeliczaniu tego samego dnia.
function upsertHpHistoria(dataStr, hpProcent) {
  try {
    const sheet = pipboySheet('hp_historia');
    const dane = sheet.getDataRange().getValues();
    for (let i = 1; i < dane.length; i++) {
      if (dane[i][0] === dataStr) {
        sheet.getRange(i + 1, 2).setValue(hpProcent);
        return;
      }
    }
    sheet.appendRow([dataStr, hpProcent]);
  } catch (e) {
    // nieblokujące — brak historii nie może wywalić Widoku Dnia
  }
}

// ============================================================
// SEKCJA 4.1 — PUNKTY (XP) I ATRYBUTY
// ============================================================

function pipboyAwardPoints(dataStr, atrybutKey, punkty) {
  try {
    pipboySheet('punkty_historia').appendRow([dataStr, atrybutKey, punkty]);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// XP(poziom) = 3*poziom^2 + 47*poziom (sekcja 4.1) — odwrócenie: poziom z sumy XP
function pipboyPoziomZXP(sumaXP) {
  let poziom = 1;
  let suma = 0;
  while (poziom < 20) {
    const potrzebne = pipboyXpDoNastepnegoPoziomu(poziom);
    if (suma + potrzebne > sumaXP) break;
    suma += potrzebne;
    poziom++;
  }
  return { poziom, xpWPoziomie: sumaXP - suma, xpDoNastepnego: pipboyXpDoNastepnegoPoziomu(poziom) };
}

function getAtrybutySumy() {
  const rows = sheetToObjects(pipboySheet('punkty_historia'));
  const sumy = {};
  PIPBOY_ATRYBUTY.forEach(a => sumy[a] = 0);
  rows.forEach(r => {
    if (sumy.hasOwnProperty(r.atrybut)) sumy[r.atrybut] += Number(r.punkty) || 0;
  });
  return sumy;
}

// ============================================================
// LOGIKA "ŚMIERCI POSTACI" — FINALNA (Runda #17, sekcja 4.1)
// Wyzwalana WYŁĄCZNIE dla dzisiejszego dnia (patrz getPipBoyDzien), przy
// HP=0. Kroki dosłownie z dokumentu:
// 1. Popup "GAME OVER" — obsłużony we frontendzie (PipBoy.html), na
//    podstawie flagi nowaSmiercPostaci zwróconej stąd.
// 2. Odznaki JUŻ zdobyte typu [S] Stała — zostają (nic tu ich nie rusza).
// 3. Odznaki [Z] Sezonowe — TRACONE (usuwane z odznaki_log).
// 4. Postęp w trakcie zdobywania kolejnego progu/streaka — zeruje się
//    SAM, bez dodatkowej akcji: streaki są liczone na żywo z hp_historia/
//    logów (pipboyStreak), więc dzień z HP=0 naturalnie przerywa każdy
//    licznik, który przez niego przechodzi.
// 5. Poziom postaci traci 1 — realizowane jako ujemny wpis punktowy,
//    rozłożony po 5 Atrybutach (bo poziom ogólny to suma wszystkich).
// ============================================================

function pipboySprawdzSmierc(dataStr, hpProcent) {
  try {
    if (hpProcent > 0) return { smierc: false, nowaSmierc: false };
    const smierciRows = sheetToObjects(pipboySheet('smierci_log'));
    if (smierciRows.some(r => r.data === dataStr)) return { smierc: true, nowaSmierc: false };

    // 3. Odznaki [Z] sezonowe — tracone
    const odznakiSheet = pipboySheet('odznaki_log');
    const dane = odznakiSheet.getDataRange().getValues();
    const wierszeDoUsuniecia = [];
    for (let i = 1; i < dane.length; i++) {
      const odznaka = PIPBOY_ODZNAKI.find(o => o.id === Number(dane[i][0]));
      if (odznaka && odznaka.typ === 'Z') wierszeDoUsuniecia.push(i + 1);
    }
    wierszeDoUsuniecia.sort((a, b) => b - a).forEach(row => odznakiSheet.deleteRow(row));

    // 5. Poziom postaci -1 (jeśli już powyżej 1) — XP tego poziomu odjęte
    // równo po 5 Atrybutach, żeby suma (poziom ogólny) spadła o dokładnie 1.
    const sumy = getAtrybutySumy();
    const sumaCalkowita = PIPBOY_ATRYBUTY.reduce((s, a) => s + sumy[a], 0);
    const poziomInfo = pipboyPoziomZXP(sumaCalkowita);
    if (poziomInfo.poziom > 1) {
      const xpPoziomu = pipboyXpDoNastepnegoPoziomu(poziomInfo.poziom - 1);
      const naAtrybut = Math.round(xpPoziomu / PIPBOY_ATRYBUTY.length);
      PIPBOY_ATRYBUTY.forEach(a => pipboyAwardPoints(dataStr, a, -naAtrybut));
    }

    // Zapis faktu śmierci — idempotentność powyżej + zasila odznaki 195/196
    // ("Dolina cienia"/"Trzy doliny", kategoria O).
    pipboySheet('smierci_log').appendRow([dataStr]);

    return { smierc: true, nowaSmierc: true };
  } catch (e) {
    return { smierc: false, nowaSmierc: false, error: e.toString() };
  }
}

// ============================================================
// KARTA POSTACI (sekcja 6.6) — agregat do Fazy 1: atrybuty, poziom ogólny,
// HP dzisiejsze, zdobyte odznaki. Pełen streak/historia śmierci — Faza 2+.
// ============================================================

function getKartaPostaci() {
  try {
    const sumy = getAtrybutySumy();
    const sumaCalkowita = PIPBOY_ATRYBUTY.reduce((s, a) => s + sumy[a], 0);
    const poziomOgolny = pipboyPoziomZXP(sumaCalkowita);
    const atrybutyZPoziomem = {};
    PIPBOY_ATRYBUTY.forEach(a => { atrybutyZPoziomem[a] = Object.assign({ xpCalkowite: sumy[a] }, pipboyPoziomZXP(sumy[a])); });

    const odznakiLog = sheetToObjects(pipboySheet('odznaki_log'));
    const zdobyteIds = odznakiLog.map(r => Number(r.id_odznaki));
    const zdobyte = PIPBOY_ODZNAKI.filter(o => zdobyteIds.indexOf(o.id) !== -1);

    return {
      success: true,
      data: {
        poziomOgolny, sumaXP: sumaCalkowita, atrybuty: atrybutyZPoziomem,
        odznakiZdobyte: zdobyte, odznakiLacznie: PIPBOY_ODZNAKI.length,
      }
    };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ============================================================
// EWALUATOR ODZNAK — obejmuje wszystkie odznaki, dla których warunek jest
// jednoznaczny i obliczalny wyłącznie z danych już logowanych (streaki
// dzienne, progi łączne, liczniki serii/sesji/godzin). NIE obejmuje
// (świadomie, bez zgadywania logiki): odznak sekretnych, odznak zależnych
// od subiektywnej oceny Arka (np. "bez nadużycia", "pełny zakres ruchu"),
// odznak wymagających danych z modułów jeszcze niezbudowanych (Portfolio
// Figurek, BJJ, Moduł 15/16 sezonowość) i odznak per-ćwiczenie, gdzie
// dopasowanie nazwy ćwiczenia do planu byłoby kruche zgadywaniem. Pełne
// pokrycie 208/208 to zadanie wieloetapowe — patrz docs/Pip-Boy-Wdrozenie.md.
// ============================================================

// Licznik dni z rzędu (wstecz od dataStr), dopóki dzienOkFn(data) zwraca true.
function pipboyStreak(dzienOkFn, dataStr) {
  let streak = 0;
  let d = dataStr;
  let iteracje = 0;
  while (dzienOkFn(d) && iteracje < 2000) {
    streak++;
    d = dataMinus(d, 1);
    iteracje++;
  }
  return streak;
}

function pipboyGrupujPoDacie(rows) {
  const map = {};
  rows.forEach(r => { (map[r.data] = map[r.data] || []).push(r); });
  return map;
}

function pipboyPrawda(v) {
  return v === true || v === 'true' || v === 'TRUE';
}

function evaluateStarterBadges(dataStr) {
  try {
    const juzZdobyte = sheetToObjects(pipboySheet('odznaki_log')).map(r => Number(r.id_odznaki));
    const nowoZdobyte = [];
    const przyznaj = (id) => {
      if (juzZdobyte.indexOf(id) === -1) {
        pipboySheet('odznaki_log').appendRow([id, dataStr]);
        juzZdobyte.push(id);
        nowoZdobyte.push(PIPBOY_ODZNAKI.find(o => o.id === id));
      }
    };

    // --- A. SUPLEMENTACJA / DYSCYPLINA (1,2,3,4,5,6,7,8) ---
    const suplByDate = pipboyGrupujPoDacie(sheetToObjects(pipboySheet('suplementy_log')));
    const rdzenneKlucze = getSuplementyRdzenneDefinicje().map(s => s.klucz);
    const dzienRdzenneOk = (d) => {
      const wpisy = suplByDate[d];
      if (!wpisy) return false;
      return rdzenneKlucze.every(k => {
        const w = wpisy.find(r => r.klucz === k);
        return w && pipboyPrawda(w.wykonano);
      });
    };
    if (dzienRdzenneOk(dataStr)) przyznaj(1); // [S] Pierwszy krok
    const streakSuplementy = pipboyStreak(dzienRdzenneOk, dataStr);
    if (streakSuplementy >= 7) przyznaj(2);    // [Z] Tydzień rutyny
    if (streakSuplementy >= 30) przyznaj(3);   // [S] Miesiąc dyscypliny
    if (streakSuplementy >= 90) przyznaj(4);   // [S] Kwartał żelaznej woli
    if (streakSuplementy >= 180) przyznaj(5);  // [S] Pół roku nawyku
    if (streakSuplementy >= 365) przyznaj(6);  // [S] Rok konsekwencji
    const dniLacznieSuplementy = Object.keys(suplByDate).filter(dzienRdzenneOk).length;
    if (dniLacznieSuplementy >= 100) przyznaj(7); // [S] Setka
    if (dniLacznieSuplementy >= 500) przyznaj(8); // [S] Pięćsetka
    if (streakSuplementy >= 7) przyznaj(13); // [S] Perfekcyjny tydzień suplementów — ten sam warunek co 2, dokument powtarza go pod dwiema nazwami
    { // 9 [Z] Odzyskany rytm — dziś OK, 3 poprzednie dni NIE, i był wcześniej choć jeden dzień OK (to "powrót", nie pierwszy raz)
      if (dzienRdzenneOk(dataStr)) {
        const d1 = dataMinus(dataStr, 1), d2 = dataMinus(dataStr, 2), d3 = dataMinus(dataStr, 3);
        const bylaPrzerwa = !dzienRdzenneOk(d1) && !dzienRdzenneOk(d2) && !dzienRdzenneOk(d3);
        const bylKiedysOk = Object.keys(suplByDate).some(d => d < d3 && dzienRdzenneOk(d));
        if (bylaPrzerwa && bylKiedysOk) przyznaj(9);
      }
    }
    { // 10 [S] Świadomy wybór — Melatonina użyta świadomie, bez przekroczenia limitu w ostatnich 30 dniach
      let melatoninaW30 = 0;
      let d = dataStr;
      for (let i = 0; i < 30; i++) { const w = (suplByDate[d] || []).find(r => r.klucz === 'melatonina'); if (w && pipboyPrawda(w.wykonano)) melatoninaW30++; d = dataMinus(d, 1); }
      if (melatoninaW30 >= 1 && melatoninaW30 <= PIPBOY_MELATONINA.limit_max) przyznaj(10);
    }
    { // 14 [S] Gainer na czas — 20 dni treningowych z gainerem przyjętym tego samego dnia
      const treningRowsA = sheetToObjects(pipboySheet('log_treningowy'));
      const dniTreningoweZGainerem = new Set();
      treningRowsA.filter(r => r.zrodlo_sesji === 'pelna').forEach(r => {
        const w = (suplByDate[r.data] || []).find(x => x.klucz === 'gainer');
        if (w && pipboyPrawda(w.wykonano)) dniTreningoweZGainerem.add(r.data);
      });
      if (dniTreningoweZGainerem.size >= 20) przyznaj(14);
    }
    { // 15 [S] Sekretna: Fundament — 6 miesięcy z systemem, niezależnie od streaków
      const wszystkieDatyHpA = sheetToObjects(pipboySheet('hp_historia')).map(r => r.data).sort();
      if (wszystkieDatyHpA.length > 0) {
        const dniOdStartuA = Math.floor((new Date(dataStr + 'T00:00:00') - new Date(wszystkieDatyHpA[0] + 'T00:00:00')) / 86400000);
        if (dniOdStartuA >= 180) przyznaj(15);
      }
    }

    // --- B. TRENING / CIAŁO (16,17,18,19,20,21,22,23,24,25,27,28,29,30,32,34,35,41,44,45) ---
    const treningRows = sheetToObjects(pipboySheet('log_treningowy'));
    const sesjePelneByDate = {};
    treningRows.filter(r => r.zrodlo_sesji === 'pelna').forEach(r => { sesjePelneByDate[r.data] = true; });
    const liczbaSesjiPelnych = Object.keys(sesjePelneByDate).length;
    if (liczbaSesjiPelnych >= 1) przyznaj(16);   // [S] Powrót na matę
    if (liczbaSesjiPelnych >= 100) przyznaj(21); // [S] Setka treningów
    if (liczbaSesjiPelnych >= 200) przyznaj(22); // [S] Dwieście treningów
    { // 17 [Z] Tydzień w rytmie, 18-20 progi liczbowe w oknie dni
      const liczSesjeWOknie = (dniOkno) => {
        let n = 0, d = dataStr;
        for (let i = 0; i < dniOkno; i++) { if (sesjePelneByDate[d]) n++; d = dataMinus(d, 1); }
        return n;
      };
      if (liczSesjeWOknie(7) >= 3) przyznaj(17);    // [Z] Tydzień w rytmie
      if (liczSesjeWOknie(30) >= 12) przyznaj(18);  // [S] Miesiąc w budowie
      if (liczSesjeWOknie(90) >= 36) przyznaj(19);  // [S] Kwartał regularności
      if (liczSesjeWOknie(180) >= 78) przyznaj(20); // [S] Pół roku w budowie
    }
    const liczbaRekordow = treningRows.filter(r => pipboyPrawda(r.nowy_rekord)).length;
    if (liczbaRekordow >= 1) przyznaj(23);  // [S] Pierwszy rekord
    if (liczbaRekordow >= 10) przyznaj(24); // [S] Dziesięć rekordów
    if (liczbaRekordow >= 50) przyznaj(25); // [S] Pięćdziesiąt rekordów
    if (treningRows.length >= 100) przyznaj(44);  // [S] Sto serii
    if (treningRows.length >= 1000) przyznaj(45); // [S] Tysiąc serii
    // 27-30 — dopasowanie DOKŁADNEJ nazwy ćwiczenia z planu startowego (sekcja
    // Moduł 2); jeśli Arek zmieni nazwę w swoim planie, te 4 odznaki przestaną
    // się liczyć (nie ukryta wada — świadomy kompromis, bo nazwy ćwiczeń są
    // swobodnym tekstem, nie identyfikatorem).
    const liczbaRekordowCwiczenia = (nazwy) => treningRows.filter(r => pipboyPrawda(r.nowy_rekord) && nazwy.indexOf(r.cwiczenie) !== -1).length;
    if (liczbaRekordowCwiczenia(['Przysiad ze sztangą']) >= 10) przyznaj(27); // [S] Mistrz przysiadu
    if (liczbaRekordowCwiczenia(['Wyciskanie sztangi na ławce płaskiej', 'Wyciskanie hantli na ławce skośnej']) >= 10) przyznaj(28); // [S] Mistrz wyciskania
    if (liczbaRekordowCwiczenia(['Martwy ciąg rumuński']) >= 10) przyznaj(29); // [S] Mistrz martwego ciągu
    if (liczbaRekordowCwiczenia(['Wyciskanie hantli nad głowę (stojąc)', 'Wyciskanie sztangi nad głowę (OHP)']) >= 10) przyznaj(30); // [S] Żelazne barki
    { // 32 [Z] Perfekcyjny tydzień treningowy — dziś, jeśli dzień treningowy: sesja + kardio + rozciąganie tego dnia
      const dziennySenRozc = sheetToObjects(pipboySheet('log_dzienny')).filter(r => r.modul === 'rozciaganie' && r.data === dataStr);
      const mialRozciaganie = dziennySenRozc.some(r => pipboyPrawda(r.wykonano));
      const mialKardioDzis = !!(pipboyGrupujPoDacie(sheetToObjects(pipboySheet('kardio_mobilnosc_log')))[dataStr]);
      if (jestDniemTreningowym(dataStr) && sesjePelneByDate[dataStr] && mialKardioDzis && mialRozciaganie) przyznaj(32);
    }
    { // 34/35 — czas od PIERWSZEJ sesji treningowej (powrót na matę), nie od
      // pierwszego dnia systemu w ogóle — inny punkt odniesienia niż 15/194/208.
      const datySesjiPelnych = Object.keys(sesjePelneByDate).sort();
      if (datySesjiPelnych.length > 0) {
        const dniOdPierwszejSesji = Math.floor((new Date(dataStr + 'T00:00:00') - new Date(datySesjiPelnych[0] + 'T00:00:00')) / 86400000);
        if (dniOdPierwszejSesji >= 180) przyznaj(34); // [S] Weteran FBW
        if (dniOdPierwszejSesji >= 365) przyznaj(35); // [S] Rocznik
      }
    }
    { // 41 [Z] Dzień mocy — sesja z co najmniej 2 progresjami ciężaru naraz (tego samego dnia)
      const rekordyDzis = treningRows.filter(r => r.data === dataStr && pipboyPrawda(r.nowy_rekord)).length;
      if (rekordyDzis >= 2) przyznaj(41);
    }

    // --- C. KARDIO + MOBILNOŚĆ (46,47,48,54) ---
    // Dawny Moduł 3, scalony z Modułem 2 (Runda #14) — "kardio z kettlami,
    // zawsze na koniec treningu". Pozostałe odznaki tej kategorii (49-57)
    // wymagają subiektywnych notatek tekstowych lub biblioteki CrossFit —
    // świadomie pominięte, nie zgadywane.
    const kardioRows = sheetToObjects(pipboySheet('kardio_mobilnosc_log'));
    if (kardioRows.length >= 1) przyznaj(46);   // [S] Pierwszy krok mobilności
    if (kardioRows.length >= 100) przyznaj(54); // [S] Sto sesji kardio
    const kardioByDate = pipboyGrupujPoDacie(kardioRows);
    let dniKardioW30 = 0;
    { let d = dataStr; for (let i = 0; i < 30; i++) { if (kardioByDate[d]) dniKardioW30++; d = dataMinus(d, 1); } }
    if (dniKardioW30 >= 12) przyznaj(48); // [S] Miesiąc mobilności (12 sesji w 30 dni)
    { // 47 [Z] Tydzień mobilności — kardio po KAŻDYM z 3 treningów w tygodniu
      const dniTreningoweOstatnie7 = [];
      let d = dataStr;
      for (let i = 0; i < 7; i++) { if (jestDniemTreningowym(d)) dniTreningoweOstatnie7.push(d); d = dataMinus(d, 1); }
      if (dniTreningoweOstatnie7.length > 0 && dniTreningoweOstatnie7.every(dd => kardioByDate[dd])) przyznaj(47);
    }

    // --- D. DIETA (58,59,60) ---
    const posilkiByDate = pipboyGrupujPoDacie(sheetToObjects(pipboySheet('posilki_log')));
    const dzienPelnyPosilki = (d) => {
      const wpisy = posilkiByDate[d];
      if (!wpisy) return false;
      return [1, 2, 3, 4, 5].every(n => wpisy.some(r => Number(r.numer) === n && pipboyPrawda(r.wykonano)));
    };
    if (dzienPelnyPosilki(dataStr)) przyznaj(58); // [S] Pierwszy pełny dzień
    const streakPosilki = pipboyStreak(dzienPelnyPosilki, dataStr);
    if (streakPosilki >= 7) przyznaj(59); // [Z] Tydzień pełnych posiłków
    let dniPelnychW30 = 0;
    { let d = dataStr; for (let i = 0; i < 30; i++) { if (dzienPelnyPosilki(d)) dniPelnychW30++; d = dataMinus(d, 1); } }
    if (dniPelnychW30 >= 25) przyznaj(60); // [S] Miesiąc regularności żywieniowej
    // 61 — "3 miesiące konsekwentnego wzorca" interpretowane spójnie z resztą
    // dokumentu (gdzie "Kwartał X" = streak 90 dni z rzędu, np. odznaki 4, 19).
    if (streakPosilki >= 90) przyznaj(61); // [S] Kwartał nawyku
    const posilkiWszystkie = sheetToObjects(pipboySheet('posilki_log')).filter(r => pipboyPrawda(r.wykonano));
    if (posilkiWszystkie.length >= 100) przyznaj(66);  // [S] Setka posiłków
    if (posilkiWszystkie.length >= 500) przyznaj(67);  // [S] Pięćset posiłków
    if (posilkiWszystkie.length >= 1000) przyznaj(68); // [S] Tysiąc posiłków
    { // 69 — ten sam wzorzec metryki co odznaka 14 (kategoria A), wyższy próg,
      // dokument dosłownie powtarza tę metrykę pod inną nazwą w innej kategorii.
      const treningRowsD = sheetToObjects(pipboySheet('log_treningowy'));
      const suplByDateD = pipboyGrupujPoDacie(sheetToObjects(pipboySheet('suplementy_log')));
      const dniTreningoweZGaineremD = new Set();
      treningRowsD.filter(r => r.zrodlo_sesji === 'pelna').forEach(r => {
        const w = (suplByDateD[r.data] || []).find(x => x.klucz === 'gainer');
        if (w && pipboyPrawda(w.wykonano)) dniTreningoweZGaineremD.add(r.data);
      });
      if (dniTreningoweZGaineremD.size >= 50) przyznaj(69); // [S] Gainer konsekwentny
    }
    { // 71 [S] Sekretna — 6 miesięcy bez ani jednego dnia z ZERO posiłków (nie 5/5, tylko nie-zero)
      const dzienNieZerowyPosilki = (d) => (posilkiByDate[d] || []).some(r => pipboyPrawda(r.wykonano));
      if (pipboyStreak(dzienNieZerowyPosilki, dataStr) >= 180) przyznaj(71);
    }
    const dataPosilkiWszystkie = Object.keys(posilkiByDate).sort();
    if (dataPosilkiWszystkie.length > 0) {
      const dniPosilkow = Math.floor((new Date(dataStr + 'T00:00:00') - new Date(dataPosilkiWszystkie[0] + 'T00:00:00')) / 86400000);
      if (dniPosilkow >= 365) przyznaj(72); // [S] Rok przy stole
    }

    // --- E. CZYTELNICTWO / UMYSŁ (73,74,75,76,77,78,79,80,81,82,83,85,88,90) ---
    const czytRows = sheetToObjects(pipboySheet('czytelnictwo_log'));
    const czytByDate = pipboyGrupujPoDacie(czytRows);
    const minutyCzytDnia = (d) => (czytByDate[d] || []).reduce((s, r) => s + (Number(r.minuty) || 0), 0);
    if (minutyCzytDnia(dataStr) >= 60) przyznaj(73);  // [S] Pierwsza godzina
    if (minutyCzytDnia(dataStr) >= 180) przyznaj(85); // [Z] Maraton wiedzy
    const rollingDzis = sheetToObjects(pipboySheet('rolling_average_cele'))
      .filter(r => r.modul === 'czytelnictwo' && r.data === dataStr);
    if (rollingDzis.length && Number(rollingDzis[0].srednia_7dni) >= 55) przyznaj(74); // [Z] Tydzień czytelnika (śr. 7-dniowa modułu 20)
    let suma30Czyt = 0;
    { let d = dataStr; for (let i = 0; i < 30; i++) { suma30Czyt += minutyCzytDnia(d); d = dataMinus(d, 1); } }
    if (suma30Czyt / 30 >= 55) przyznaj(75); // [S] Miesiąc w książkach (śr. 30-dniowa liczona bezpośrednio)
    const ukonczonePozycje = czytRows.filter(r => pipboyPrawda(r.ukonczono));
    if (ukonczonePozycje.length >= 1) przyznaj(76);  // [S] Pierwsza ukończona pozycja
    if (ukonczonePozycje.length >= 5) przyznaj(77);  // [S] Piątka
    if (ukonczonePozycje.length >= 10) przyznaj(78); // [S] Dziesiątka
    if (ukonczonePozycje.length >= 25) przyznaj(79); // [S] Dwudziestka pięć
    if (ukonczonePozycje.length >= 50) przyznaj(80); // [S] Pięćdziesiątka
    const godzinyCzytaniaLacznie = czytRows.reduce((s, r) => s + (Number(r.minuty) || 0), 0) / 60;
    if (godzinyCzytaniaLacznie >= 100) przyznaj(81);  // [S] Setka godzin
    if (godzinyCzytaniaLacznie >= 500) przyznaj(82);  // [S] Pięćset godzin
    if (godzinyCzytaniaLacznie >= 1000) przyznaj(83); // [S] Tysiąc godzin
    const dataCzytRows = czytRows.map(r => r.data).sort();
    if (dataCzytRows.length > 0) {
      const dniCzytania = Math.floor((new Date(dataStr + 'T00:00:00') - new Date(dataCzytRows[0] + 'T00:00:00')) / 86400000);
      if (dniCzytania >= 365) przyznaj(88); // [S] Rok czytelnika
    }
    { // 90 — "rolling-average w normie" interpretowane jako śr. 7-dniowa ≥55
      // (norma z odznaki 74), bez ani jednego dnia zerowego, przez 90 dni z rzędu.
      const rollingCzytByDate = {};
      sheetToObjects(pipboySheet('rolling_average_cele')).filter(r => r.modul === 'czytelnictwo').forEach(r => { rollingCzytByDate[r.data] = Number(r.srednia_7dni); });
      const dzienZrownowazony = (d) => minutyCzytDnia(d) > 0 && rollingCzytByDate.hasOwnProperty(d) && rollingCzytByDate[d] >= 55;
      if (pipboyStreak(dzienZrownowazony, dataStr) >= 90) przyznaj(90);
    }

    // --- G. SPACER Z PSEM (101,102,103,104,105,106,107,108) ---
    const spacerRowsG = sheetToObjects(pipboySheet('spacer_log'));
    const spacerLiczba = spacerRowsG.length;
    if (spacerLiczba >= 1) przyznaj(101);    // [S] Pierwszy spacer w systemie
    if (spacerLiczba >= 100) przyznaj(103);  // [S] Setka spacerów
    if (spacerLiczba >= 500) przyznaj(104);  // [S] Pięćset spacerów
    if (spacerLiczba >= 1000) przyznaj(105); // [S] Tysiąc spacerów
    const spacerByDate = pipboyGrupujPoDacie(spacerRowsG);
    const dzien2SpaceryOk = (d) => (spacerByDate[d] || []).length >= 2;
    if (pipboyStreak(dzien2SpaceryOk, dataStr) >= 7) przyznaj(102); // [Z] Tydzień ruchu z psem
    const dzien1SpacerOk = (d) => (spacerByDate[d] || []).length >= 1;
    if (pipboyStreak(dzien1SpacerOk, dataStr) >= 180) przyznaj(106); // [S] Bez przypomnień (6 miesięcy)
    if (pipboyStreak(dzien1SpacerOk, dataStr) >= 365) przyznaj(108); // [S] Sekretna: Więź (rok konsekwentnych spacerów)
    const dataSpacerRows = Object.keys(spacerByDate).sort();
    if (dataSpacerRows.length > 0) {
      const dniSpacerow = Math.floor((new Date(dataStr + 'T00:00:00') - new Date(dataSpacerRows[0] + 'T00:00:00')) / 86400000);
      if (dniSpacerow >= 365) przyznaj(107); // [S] Towarzysz w każdą pogodę (12 mies. trackingu)
    }

    // --- H. SPRZĄTANIE / OTOCZENIE (109,110,113,114,115,116,117,118,119,120,122) ---
    const sprzRows = sheetToObjects(pipboySheet('sprzatanie_log'));
    if (sprzRows.length >= 1) przyznaj(109);   // [S] Pierwsza strefa
    if (sprzRows.length >= 100) przyznaj(113); // [S] Setka zadań
    const sprzByDate = pipboyGrupujPoDacie(sprzRows);
    const dzienFloorOk = (d) => {
      // Niedziela zwolniona z floora sprzątania (sekcja 2.0) — nie przerywa streaku
      if (new Date(d + 'T00:00:00').getDay() === 0) return true;
      const minuty = (sprzByDate[d] || []).reduce((s, r) => s + (Number(r.minuty) || 0), 0);
      return minuty >= PIPBOY_SPRZATANIE_FLOOR_MIN;
    };
    if (pipboyStreak(dzienFloorOk, dataStr) >= 60) przyznaj(117); // [S] Floor zawsze spełniony
    { // 118 — analogicznie, ale sufit (ceiling) zamiast floora — dyscyplina, nie tylko wykonanie
      const dzienCeilingOk = (d) => {
        const minuty = (sprzByDate[d] || []).reduce((s, r) => s + (Number(r.minuty) || 0), 0);
        return minuty <= PIPBOY_SPRZATANIE_CEILING_MIN;
      };
      if (pipboyStreak(dzienCeilingOk, dataStr) >= 60) przyznaj(118); // [S] W granicach ceiling
    }
    { // 110 — wszystkie 7 stref (wg AKTUALNEJ, edytowalnej rotacji) odhaczone w oknie 7 dni
      const strefyWymagane = getSprzatanieRotacjaDefinicje().map(r => r.strefa);
      const strefyOstatnie7 = new Set();
      { let d = dataStr; for (let i = 0; i < 7; i++) { (sprzByDate[d] || []).forEach(r => strefyOstatnie7.add(r.strefa)); d = dataMinus(d, 1); } }
      if (strefyWymagane.length > 0 && strefyWymagane.every(s => strefyOstatnie7.has(s))) przyznaj(110); // [Z] Pełny tydzień rotacji
    }
    // 114/115/122 — dopasowanie DOKŁADNEJ nazwy strefy ze startowej rotacji
    // (PipBoyData.gs); jeśli Arek zmieni nazwę w Ustawieniach, te 3 odznaki
    // przestaną się liczyć — świadomy kompromis, jak przy ćwiczeniach (27-30).
    const liczbaZadanStrefy = (nazwa) => sprzRows.filter(r => r.strefa === nazwa).length;
    if (liczbaZadanStrefy('Łazienka') >= 20) przyznaj(114); // [S] Mistrz łazienki
    if (liczbaZadanStrefy('Kuchnia') >= 20) przyznaj(115);  // [S] Mistrz kuchni
    if (liczbaZadanStrefy('Pomieszczenie gospodarcze + przedsionek/klatka') >= 20) przyznaj(122); // [S] Przedsionek i klatka
    { // 116 — niedzielne sprzątania globalne: dowolny wpis sprzątania w niedzielę
      const niedzieleZSprzataniem = new Set(sprzRows.filter(r => new Date(r.data + 'T00:00:00').getDay() === 0).map(r => r.data));
      if (niedzieleZSprzataniem.size >= 20) przyznaj(116); // [S] Porządek globalny
    }
    { // 119 [Z] Dzień generalny — dziś sprzątanie (≥floor) I auto tego samego dnia (wg przypomnienia_log)
      const minutyDzis = (sprzByDate[dataStr] || []).reduce((s, r) => s + (Number(r.minuty) || 0), 0);
      const autoDzis = sheetToObjects(pipboySheet('przypomnienia_log')).some(r => r.klucz === 'auto_przeglad' && r.data === dataStr);
      if (minutyDzis >= PIPBOY_SPRZATANIE_FLOOR_MIN && autoDzis) przyznaj(119);
    }
    { // 120 — "Rok w porządku": dni od pierwszego wpisu sprzątania (spójne z
      // wzorcem "Rok X" reszty kategorii — pełna, 52-tygodniowa rotacja bez
      // przerwy byłaby zgadywaniem dokładnej definicji "konsekwentnej rotacji")
      const dataSprzRows = Object.keys(sprzByDate).sort();
      if (dataSprzRows.length > 0) {
        const dniSprzatania = Math.floor((new Date(dataStr + 'T00:00:00') - new Date(dataSprzRows[0] + 'T00:00:00')) / 86400000);
        if (dniSprzatania >= 365) przyznaj(120);
      }
    }

    // --- F. PIELĘGNACJA (91,92,93,98,99) ---
    const pielegnacjaDefB = getPielegnacjaDefinicje();
    const pielByDate = pipboyGrupujPoDacie(sheetToObjects(pipboySheet('pielegnacja_log')));
    const dzienPielegnacjaOk = (d) => {
      const dow = new Date(d + 'T00:00:00').getDay();
      const jestSrodaLubNiedziela = dow === 0 || dow === 3;
      const wymagane = pielegnacjaDefB.poranny.concat(pielegnacjaDefB.wieczorny)
        .concat(jestSrodaLubNiedziela ? pielegnacjaDefB.poranny_sr_nd : []).map(p => p.klucz);
      if (wymagane.length === 0) return false;
      const wpisy = pielByDate[d] || [];
      return wymagane.every(k => { const w = wpisy.find(r => r.produkt === k); return w && pipboyPrawda(w.wykonano); });
    };
    if (dzienPielegnacjaOk(dataStr)) przyznaj(91); // [S] Pierwszy rytuał
    const streakPielegnacja = pipboyStreak(dzienPielegnacjaOk, dataStr);
    if (streakPielegnacja >= 7) przyznaj(92);   // [Z] Tydzień w formie
    if (streakPielegnacja >= 365) przyznaj(98); // [S] Rok pielęgnacji
    let dniPielW30 = 0;
    { let d = dataStr; for (let i = 0; i < 30; i++) { if (dzienPielegnacjaOk(d)) dniPielW30++; d = dataMinus(d, 1); } }
    if (dniPielW30 >= 25) przyznaj(93); // [S] Miesiąc dbałości
    if (Object.keys(pielByDate).filter(dzienPielegnacjaOk).length >= 100) przyznaj(99); // [S] Setka rytuałów
    { // 96/97 — oba sloty (rano+wieczór) tego konkretnego produktu, 90 dni z rzędu
      const dzienProduktOk = (kluczRano, kluczWieczor) => (d) => {
        const wpisy = pielByDate[d] || [];
        const r = wpisy.find(x => x.produkt === kluczRano);
        const w = wpisy.find(x => x.produkt === kluczWieczor);
        return !!(r && pipboyPrawda(r.wykonano) && w && pipboyPrawda(w.wykonano));
      };
      if (pipboyStreak(dzienProduktOk('krem_twarzy_rano', 'krem_twarzy_wieczor'), dataStr) >= 90) przyznaj(96); // [S] Skóra w formie
      if (pipboyStreak(dzienProduktOk('krem_rak_1', 'krem_rak_2'), dataStr) >= 90) przyznaj(97);               // [S] Ręce jak nowe
    }
    { // 100 [S] Sekretna — 6 miesięcy bez ani jednego CAŁKOWICIE pominiętego dnia (≥1 wpis, nie pełny rytuał)
      const dzienNieZerowyPiel = (d) => (pielByDate[d] || []).some(r => pipboyPrawda(r.wykonano));
      if (pipboyStreak(dzienNieZerowyPiel, dataStr) >= 180) przyznaj(100);
    }
    { // 94 — liczba odnotowanych wizyt fryzjera (przypomnienia_log, dodany wcześniej)
      const liczbaFryzjer = sheetToObjects(pipboySheet('przypomnienia_log')).filter(r => r.klucz === 'fryzjer').length;
      if (liczbaFryzjer >= 10) przyznaj(94); // [S] Fryzjer w rytmie
    }

    // --- I. SEN / HIGIENA ŚWIATŁA (123,124,125,126,128,129) ---
    const senByDate = pipboyGrupujPoDacie(sheetToObjects(pipboySheet('log_dzienny')).filter(r => r.modul === 'sen'));
    const dzienSenOk = (d) => { const w = (senByDate[d] || [])[0]; return !!(w && pipboyPrawda(w.wykonano)); };
    if (dzienSenOk(dataStr)) przyznaj(123); // [S] Pierwsza ciemna noc
    const streakSen = pipboyStreak(dzienSenOk, dataStr);
    if (streakSen >= 7) przyznaj(124);   // [Z] Tydzień higieny snu
    if (streakSen >= 60) przyznaj(128);  // [S] Bez ekranu przed snem
    if (streakSen >= 365) przyznaj(129); // [S] Rok higieny snu
    let dniSenW30 = 0;
    { let d = dataStr; for (let i = 0; i < 30; i++) { if (dzienSenOk(d)) dniSenW30++; d = dataMinus(d, 1); } }
    if (dniSenW30 >= 25) przyznaj(125); // [S] Miesiąc dyscypliny świetlnej
    if (Object.keys(senByDate).filter(dzienSenOk).length >= 100) przyznaj(126); // [S] Setka ciemnych wieczorów

    // --- L. AUTO + MOTOCYKL (163,165,166,169) ---
    // Tylko liczniki liczby wykonań — 164/167/168/170/171/172 wymagają grupowania
    // po kolejnych miesiącach/sezonach kalendarzowych (świadomie pominięte,
    // większa złożoność niż prosty licznik/streak, żeby uniknąć zgadywania
    // dokładnej definicji "pełnego sezonu").
    const przypLogRows = sheetToObjects(pipboySheet('przypomnienia_log'));
    const liczbaWpisow = (klucz) => przypLogRows.filter(r => r.klucz === klucz).length;
    if (liczbaWpisow('auto_przeglad') >= 1) przyznaj(163); // [S] Pierwszy przegląd auta
    if (liczbaWpisow('motocykl_wiosna') >= 1) przyznaj(165); // [S] Pierwsza wiosna
    if (liczbaWpisow('motocykl_jesien') >= 1) przyznaj(166); // [S] Pierwsza zima
    if (liczbaWpisow('auto_przeglad') + liczbaWpisow('motocykl_kontrola') >= 20) przyznaj(169); // [S] Mechanik-amator

    // --- M. ZAKUPY (173,178) ---
    const zakupyRows = sheetToObjects(pipboySheet('zakupy_log'));
    if (zakupyRows.some(r => pipboyPrawda(r.kupione))) przyznaj(173); // [S] Pierwsza lista 70/30
    const dataZakupyRows = zakupyRows.map(r => r.data).sort();
    if (dataZakupyRows.length > 0) {
      const dniZakupow = Math.floor((new Date(dataStr + 'T00:00:00') - new Date(dataZakupyRows[0] + 'T00:00:00')) / 86400000);
      if (dniZakupow >= 365) przyznaj(178); // [S] Rok przy wózku
    }
    // 174/175/176/177 świadomie pominięte — wymagają pojęcia "tygodniowej listy"
    // lub trackingu promocji Aldi, których obecny model danych zakupy_log
    // (log dzień/kategoria/produkt/kupione) nie wyraża wprost.

    // --- K. PORTFOLIO FIGUREK / PERSONAL BRAND (141-150,156-160) ---
    // 151-154 (grupowanie tygodni/miesięcy z regułą publikacji), 155
    // (kalibracja szacowany/rzeczywisty — wymaga pola czasu szacowanego,
    // którego portfolio_projekty jeszcze nie zapisuje), 161 (sesje
    // kolorowanek — brak osobnego mechanizmu logowania bez projektu) i 162
    // (sekretna, "zlecenie niezależne" — brak takiej flagi) świadomie
    // pominięte — wymagają rozszerzenia modelu danych, nie zgadywania.
    const projektyK = sheetToObjects(pipboySheet('portfolio_projekty'));
    const ukonczoneK = projektyK.filter(p => p.status === 'ukonczony');
    if (projektyK.length >= 1) przyznaj(141); // [S] Pierwszy projekt
    if (ukonczoneK.length >= 1) przyznaj(142);   // [S] Pierwsza ukończona figurka
    if (ukonczoneK.length >= 5) przyznaj(143);   // [S] Piątka portfolio
    if (ukonczoneK.length >= 10) przyznaj(144);  // [S] Dziesiątka portfolio
    if (ukonczoneK.length >= 25) przyznaj(145);  // [S] Dwudziestka pięć
    if (ukonczoneK.length >= 50) przyznaj(146);  // [S] Pięćdziesiątka
    if (ukonczoneK.length >= 100) przyznaj(147); // [S] Setka
    const publikacjeK = projektyK.filter(p => pipboyPrawda(p.zdjecie_zrobione) && pipboyPrawda(p.opis_napisany) && pipboyPrawda(p.opublikowane));
    if (publikacjeK.length >= 1) przyznaj(148);  // [S] Pierwsza publikacja
    if (publikacjeK.length >= 10) przyznaj(149); // [S] Dziesięć publikacji
    if (publikacjeK.length >= 50) przyznaj(150); // [S] Pięćdziesiąt publikacji
    if (ukonczoneK.filter(p => p.kategoria === 'Mała figurka').length >= 10) przyznaj(156);          // [S] Mała ale wytrwała
    if (ukonczoneK.filter(p => p.kategoria === 'Średnia figurka').length >= 10) przyznaj(157);       // [S] Średniozaawansowany warsztat
    if (ukonczoneK.filter(p => p.kategoria === 'Duża/złożona figurka').length >= 5) przyznaj(158);   // [S] Duże wyzwanie
    if (ukonczoneK.filter(p => p.kategoria === 'Cały zestaw/oddział').length >= 1) przyznaj(159);    // [S] Cały oddział
    { // 160 [Z] Tydzień praktyki — min. 3 sesje (dowolny projekt) w ostatnich 7 dniach
      const dniPraktykiOstatnie7 = {};
      sheetToObjects(pipboySheet('portfolio_czas_log')).forEach(r => {
        const dniOd = Math.floor((new Date(dataStr + 'T00:00:00') - new Date(r.data + 'T00:00:00')) / 86400000);
        if (dniOd >= 0 && dniOd < 7) dniPraktykiOstatnie7[r.data] = true;
      });
      if (Object.keys(dniPraktykiOstatnie7).length >= 3) przyznaj(160);
    }

    // --- J. MOOD TRACKER / SAMOPOCZUCIE (131,132,133,134,135,136,137,138,139) ---
    // UWAGA (poprawka w tej turze): 131 wcześniej przyznawana za JAKIKOLWIEK
    // wpis mood — dokument wymaga wprost "w PEŁNI wypełniony (rano+wieczór)".
    const moodRowsB = sheetToObjects(pipboySheet('mood_log'));
    const moodByDateB = pipboyGrupujPoDacie(moodRowsB);
    const dzienPelnyMood = (d) => {
      const w = moodByDateB[d] || [];
      return w.some(r => r.pora === 'rano') && w.some(r => r.pora === 'wieczor');
    };
    if (dzienPelnyMood(dataStr)) przyznaj(131); // [S] Pierwszy wpis (w pełni wypełniony)
    if (pipboyStreak(dzienPelnyMood, dataStr) >= 7) przyznaj(132); // [Z] Tydzień świadomości (14/14 wpisów)
    let wpisyOstatnie30 = 0;
    { let d = dataStr; for (let i = 0; i < 30; i++) { wpisyOstatnie30 += (moodByDateB[d] || []).length; d = dataMinus(d, 1); } }
    if (wpisyOstatnie30 >= 50) przyznaj(133); // [S] Miesiąc obserwacji (50+/60 wpisów)
    if (moodRowsB.length >= 100) przyznaj(134);  // [S] Setka wpisów
    if (moodRowsB.length >= 500) przyznaj(135);  // [S] Pięćset wpisów
    if (moodRowsB.length >= 1000) przyznaj(136); // [S] Tysiąc wpisów
    const dataMoodRows = moodRowsB.map(r => r.data).sort();
    if (dataMoodRows.length > 0) {
      const dniMood = Math.floor((new Date(dataStr + 'T00:00:00') - new Date(dataMoodRows[0] + 'T00:00:00')) / 86400000);
      if (dniMood >= 365) przyznaj(137); // [S] Rok samoobserwacji
    }
    const liczbaGiFollowup = moodRowsB.filter(r => r.notatka_gi_followup && String(r.notatka_gi_followup).trim() !== '').length;
    if (liczbaGiFollowup >= 10) przyznaj(138); // [S] Detektyw GI
    const dzienBezNiskiegoWyniku = (d) => {
      const w = moodByDateB[d];
      if (!w || w.length === 0) return false;
      const pola = ['nastroj', 'energia', 'sen', 'skupienie', 'gi'];
      return w.every(r => pola.every(p => !r[p] || Number(r[p]) >= 4));
    };
    if (pipboyStreak(dzienBezNiskiegoWyniku, dataStr) >= 30) przyznaj(139); // [S] Stabilny trend
    // 140 [S] Sekretna: Gotowość na AI Coacha — świadomie pominięta: "wystarczające
    // dane do aktywacji Modułu 14" to próg subiektywny/nieokreślony liczbowo w
    // dokumencie, a Moduł 14 sam w sobie jest poza obecnym zakresem budowy.

    // --- O. MILESTONE'Y DŁUGOTERMINOWE / SEKRETNE (194,195,196,197,200-208) ---
    // 198/199/140 świadomie pominięte: wymagają ręcznej aktywacji Modułu 13
    // (BJJ/Boks) albo progu nieokreślonego liczbowo (Moduł 14), których w
    // ogóle nie ma w obecnym zakresie budowy.
    // hp_historia odczytana tu wcześniej (przed kategorią N) — obie kategorie
    // (O i N) potrzebują tego samego mapowania data->HP.
    const hpRowsB = sheetToObjects(pipboySheet('hp_historia'));
    const hpByDateB = {};
    hpRowsB.forEach(r => { hpByDateB[r.data] = Number(r.hp_procent); });
    const wszystkieDatyHpO = Object.keys(hpByDateB).sort();
    if (wszystkieDatyHpO.length > 0) {
      const dniOdStartuO = Math.floor((new Date(dataStr + 'T00:00:00') - new Date(wszystkieDatyHpO[0] + 'T00:00:00')) / 86400000);
      if (dniOdStartuO >= 30) przyznaj(194); // [S] Sekretna: Pierwszy miesiąc
    }
    { // 195/196 — logika "śmierci postaci" (sekcja 4.1) jest teraz zaimplementowana
      const smierciDaty = sheetToObjects(pipboySheet('smierci_log')).map(r => r.data);
      const kontynuowanoPoSmierci = smierciDaty.some(d => hpByDateB.hasOwnProperty(dataMinus(d, -1))); // dzień po śmierci ma wpis HP = system użyty dalej
      if (smierciDaty.length >= 1 && kontynuowanoPoSmierci) przyznaj(195); // [S] Sekretna: Dolina cienia
      if (smierciDaty.length >= 3) przyznaj(196); // [S] Sekretna: Trzy doliny
    }
    { // 197 [S] Sekretna: Wiosna wojownika — pierwszy tydzień kwietnia
      const dz = new Date(dataStr + 'T00:00:00');
      if (dz.getMonth() + 1 === 4 && dz.getDate() <= 7) przyznaj(197);
    }
    const sumyO = getAtrybutySumy();
    const poziomOgolnyO = pipboyPoziomZXP(PIPBOY_ATRYBUTY.reduce((s, a) => s + sumyO[a], 0)).poziom;
    if (poziomOgolnyO >= 10) przyznaj(200); // [S] Poziom 10 postaci
    if (poziomOgolnyO >= 20) przyznaj(201); // [S] Poziom 20 postaci (maksymalny)
    const poziomyAtrybutowO = {};
    PIPBOY_ATRYBUTY.forEach(a => { poziomyAtrybutowO[a] = pipboyPoziomZXP(sumyO[a]).poziom; });
    if (poziomyAtrybutowO.cialo >= 20) przyznaj(202);          // [S] Mistrz Ciała
    if (poziomyAtrybutowO.umysl >= 20) przyznaj(203);          // [S] Mistrz Umysłu
    if (poziomyAtrybutowO.dyscyplina >= 20) przyznaj(204);     // [S] Mistrz Dyscypliny
    if (poziomyAtrybutowO.otoczenie >= 20) przyznaj(205);      // [S] Mistrz Otoczenia
    if (poziomyAtrybutowO.personal_brand >= 20) przyznaj(206); // [S] Mistrz Marki Osobistej
    if (PIPBOY_ATRYBUTY.every(a => poziomyAtrybutowO[a] >= 20)) przyznaj(207); // [S] Pięć Mistrzostw
    if (wszystkieDatyHpO.length > 0) {
      const dniOdStartuRok = Math.floor((new Date(dataStr + 'T00:00:00') - new Date(wszystkieDatyHpO[0] + 'T00:00:00')) / 86400000);
      // 208 przyznaje samą odznakę; "osobiste podsumowanie roku" jako specjalny
      // widok UI (dosłowny wymóg opisu 208) NIE jest zbudowane w tej turze.
      if (dniOdStartuRok >= 365) przyznaj(208); // [S] Sekretna: Rocznica
    }

    // --- N. STREAKI OGÓLNE / PERFECT DAY (179-190,192,193) ---
    // "Perfect Day" = dzień z HP 100% (HP już JEST % ukończenia wg sekcji 4.2,
    // więc nie liczymy tego osobno); "≥80% ukończenia" = HP >= 80. Wykorzystuje
    // hp_historia (upsertHpHistoria, odczytana wyżej w kategorii O), już
    // zbieraną dla Dashboardu (6.13).
    const dzienPerfect = (d) => hpByDateB.hasOwnProperty(d) && hpByDateB[d] === 100;
    const dzien80 = (d) => hpByDateB.hasOwnProperty(d) && hpByDateB[d] >= 80;

    if (dzienPerfect(dataStr)) przyznaj(179); // [Z] Pierwszy Perfect Day
    const streakPerfect = pipboyStreak(dzienPerfect, dataStr);
    if (streakPerfect >= 7) przyznaj(180); // [Z] Tydzień doskonałości (7 Perfect Days z rzędu)
    const liczbaPerfectLacznie = Object.keys(hpByDateB).filter(dzienPerfect).length;
    if (liczbaPerfectLacznie >= 10) przyznaj(181);
    if (liczbaPerfectLacznie >= 50) przyznaj(182);
    if (liczbaPerfectLacznie >= 100) przyznaj(183);

    const streak80 = pipboyStreak(dzien80, dataStr);
    if (streak80 >= 7) przyznaj(184);
    if (streak80 >= 14) przyznaj(185);
    if (streak80 >= 30) przyznaj(186);
    if (streak80 >= 60) przyznaj(187);
    if (streak80 >= 90) przyznaj(188);
    if (streak80 >= 180) przyznaj(189);
    if (streak80 >= 365) przyznaj(190);
    // 191 [S] Feniks (pierwszy powrót po zerwaniu streaka) świadomie pominięta —
    // wymaga śledzenia historii zerwań (dodatkowy stan), nie samego streaka.

    // 192 — interpretacja robocza (dokument nie precyzuje progu "100% w atrybucie"
    // per dzień): uznaj za spełnione, gdy danego dnia zdobyto choć 1 punkt w
    // KAŻDYM z 5 Atrybutów naraz — jednoznacznie obliczalne, nie zgadywanie progu.
    const punktyDzisiaj = sheetToObjects(pipboySheet('punkty_historia')).filter(r => r.data === dataStr);
    if (PIPBOY_ATRYBUTY.every(a => punktyDzisiaj.some(r => r.atrybut === a))) przyznaj(192);

    // 193 [S] Sekretna — "365 dni od pierwszego uruchomienia systemu": proxy =
    // najwcześniejsza data w hp_historia (pierwszy dzień, w którym Widok Dnia
    // w ogóle policzył HP), nie dokładna data setupPipBoy() (nie logowana osobno).
    const wszystkieDatyHp = Object.keys(hpByDateB).sort();
    if (wszystkieDatyHp.length > 0) {
      const dniOdStartu = Math.floor((new Date(dataStr + 'T00:00:00') - new Date(wszystkieDatyHp[0] + 'T00:00:00')) / 86400000);
      if (dniOdStartu >= 365) przyznaj(193);
    }

    return { success: true, nowoZdobyte };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ============================================================
// SEKCJA 6.13 — DASHBOARD GRAFICZNY
// Agreguje dane już logowane w innych modułach do wykresów. Wybór biblioteki
// (Chart.js, ładowany z CDN w index.html) to decyzja projektowa UI, zgodnie
// z sekcją 6.13 dokumentu ("zadanie projektowe, nie decyzyjne").
// ============================================================

function getDashboardData() {
  try {
    const dzis = todayIso();

    // Trend HP w czasie (widok ogólny) — z hp_historia, zapisywane przy
    // każdym przeliczeniu Widoku Dnia (patrz upsertHpHistoria).
    const hpRows = sheetToObjects(pipboySheet('hp_historia'))
      .sort((a, b) => a.data < b.data ? -1 : a.data > b.data ? 1 : 0);
    const trendHp = hpRows.slice(-60);

    // Streak = kolejne dni wstecz od dziś z HP > 0% ("postać żyje") — dzień
    // ze śmiercią (pipboySprawdzSmierc, sekcja 4.1 punkt I) naturalnie
    // przerywa ten streak, bo jego HP to 0.
    const hpMap = {};
    hpRows.forEach(r => { hpMap[r.data] = Number(r.hp_procent); });
    let streak = 0, d = dzis, iteracje = 0;
    while (hpMap.hasOwnProperty(d) && hpMap[d] > 0 && iteracje < 2000) {
      streak++; d = dataMinus(d, 1); iteracje++;
    }

    const sumy = getAtrybutySumy();
    const sumaCalkowita = PIPBOY_ATRYBUTY.reduce((s, a) => s + sumy[a], 0);

    // Podzakładka Trening — historia ciężaru per ćwiczenie (progresja, sekcja 6.3)
    const treningRows = sheetToObjects(pipboySheet('log_treningowy')).filter(r => r.zrodlo_sesji === 'pelna');
    const cwiczenia = {};
    treningRows.forEach(r => {
      (cwiczenia[r.cwiczenie] = cwiczenia[r.cwiczenie] || []).push({ data: r.data, ciezarKg: Number(r.ciezar_kg) || 0 });
    });

    // Podzakładka Sen/Nastrój — trend Modułu 11
    const moodRows = sheetToObjects(pipboySheet('mood_log'))
      .sort((a, b) => a.data < b.data ? -1 : a.data > b.data ? 1 : 0).slice(-60);

    // Podzakładka Dieta/Suplementy — rolling average czytelnictwa jako proxy
    // "umysł" (Moduł 20) + osobno pełne dni suplementacji z ostatnich 30 dni
    const rollingCzyt = sheetToObjects(pipboySheet('rolling_average_cele'))
      .filter(r => r.modul === 'czytelnictwo')
      .sort((a, b) => a.data < b.data ? -1 : a.data > b.data ? 1 : 0).slice(-60);

    // Podzakładka Dom/Pojazdy — minuty sprzątania/dzień, ostatnie 30 dni
    // (floor/ceiling z sekcji 2.0, żeby zobaczyć dyscyplinę w czasie)
    const sprzRows = sheetToObjects(pipboySheet('sprzatanie_log'));
    const sprzByDate = {};
    sprzRows.forEach(r => { sprzByDate[r.data] = (sprzByDate[r.data] || 0) + (Number(r.minuty) || 0); });
    const sprzatanieTrend = [];
    { let dd = dzis; for (let i = 0; i < 30; i++) { sprzatanieTrend.unshift({ data: dd, minuty: sprzByDate[dd] || 0 }); dd = dataMinus(dd, 1); } }

    // Podzakładka Portfolio (Moduł 18) — rolling average 7-dniowa minut
    // tworzenia (sekcja Moduł 18, "wskaźnik rolling-average marki"), bez
    // wpływu na HP, tylko trend widoczny tutaj.
    const rollingPortfolio = sheetToObjects(pipboySheet('rolling_average_cele'))
      .filter(r => r.modul === 'portfolio')
      .sort((a, b) => a.data < b.data ? -1 : a.data > b.data ? 1 : 0).slice(-60);
    const projektyPortfolio = sheetToObjects(pipboySheet('portfolio_projekty'));

    return {
      success: true,
      data: {
        trendHp, streak,
        atrybuty: sumy, sumaXP: sumaCalkowita, poziomOgolny: pipboyPoziomZXP(sumaCalkowita),
        cwiczenia, moodRows, rollingCzyt, sprzatanieTrend, rollingPortfolio,
        portfolioProjektowLacznie: projektyPortfolio.length,
        portfolioUkonczonychLacznie: projektyPortfolio.filter(p => p.status === 'ukonczony').length,
        odznakiZdobyteLiczba: sheetToObjects(pipboySheet('odznaki_log')).length,
        odznakiLacznie: PIPBOY_ODZNAKI.length
      }
    };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ============================================================
// SEKCJA 6.5 — WIDOK TYGODNIOWY (Review, niedziela)
// Per Rundzie #17: treść zostaje jak w 6.5, prezentacja wchodzi jako
// podzakładka Dashboardu (6.13) zamiast osobnego, czysto tekstowego widoku.
// ============================================================

function getTydzienData(dataStr) {
  try {
    const dzis = dataStr || todayIso();
    const dni7 = [];
    { let d = dzis; for (let i = 0; i < 7; i++) { dni7.unshift(d); d = dataMinus(d, 1); } }

    const suplByDate = pipboyGrupujPoDacie(sheetToObjects(pipboySheet('suplementy_log')));
    const rdzenneKlucze = getSuplementyRdzenneDefinicje().map(s => s.klucz);
    const suplOk = (d) => {
      const w = suplByDate[d];
      if (!w) return false;
      return rdzenneKlucze.every(k => { const x = w.find(r => r.klucz === k); return x && pipboyPrawda(x.wykonano); });
    };

    const posilkiByDate = pipboyGrupujPoDacie(sheetToObjects(pipboySheet('posilki_log')));
    const posilkiOk = (d) => {
      const w = posilkiByDate[d];
      if (!w) return false;
      return [1, 2, 3, 4, 5].every(n => w.some(r => Number(r.numer) === n && pipboyPrawda(r.wykonano)));
    };

    const moodByDate = pipboyGrupujPoDacie(sheetToObjects(pipboySheet('mood_log')));
    const moodOk = (d) => {
      const w = moodByDate[d] || [];
      return w.some(r => r.pora === 'rano') && w.some(r => r.pora === 'wieczor');
    };

    const sprzByDate = pipboyGrupujPoDacie(sheetToObjects(pipboySheet('sprzatanie_log')));
    const sprzOk = (d) => {
      if (jestNiedziela(d)) return true; // floor nie obowiązuje w niedzielę (sekcja 2.0)
      const min = (sprzByDate[d] || []).reduce((s, r) => s + (Number(r.minuty) || 0), 0);
      return min >= PIPBOY_SPRZATANIE_FLOOR_MIN;
    };

    const czytByDate = pipboyGrupujPoDacie(sheetToObjects(pipboySheet('czytelnictwo_log')));
    const czytOk = (d) => (czytByDate[d] || []).reduce((s, r) => s + (Number(r.minuty) || 0), 0) > 0;

    const treningByDate = {};
    sheetToObjects(pipboySheet('log_treningowy')).forEach(r => { treningByDate[r.data] = true; });

    const modulOkFns = { suplementy: suplOk, posilki: posilkiOk, mood: moodOk, sprzatanie: sprzOk, czytelnictwo: czytOk };
    const procentTygodniowy = {};
    Object.keys(modulOkFns).forEach(m => {
      const ok = dni7.filter(modulOkFns[m]).length;
      procentTygodniowy[m] = Math.round(100 * ok / dni7.length);
    });
    // Trening liczony tylko względem dni, w które faktycznie powinien się odbyć (Wt/Czw/Sob)
    const dniTreningowe = dni7.filter(jestDniemTreningowym);
    procentTygodniowy.trening = dniTreningowe.length > 0
      ? Math.round(100 * dniTreningowe.filter(d => treningByDate[d]).length / dniTreningowe.length)
      : null;

    // Punkty w tym tygodniu vs poprzednim (motywacyjne porównanie, nie karzące — Runda #2/6.5)
    const punktyRows = sheetToObjects(pipboySheet('punkty_historia'));
    const sumaPunktowOd = (odData, doData) => punktyRows
      .filter(r => r.data >= odData && r.data <= doData)
      .reduce((s, r) => s + (Number(r.punkty) || 0), 0);
    const punktyTenTydzien = sumaPunktowOd(dni7[0], dni7[6]);
    const poprzedniTydzienStart = dataMinus(dni7[0], 7);
    const poprzedniTydzienKoniec = dataMinus(dni7[0], 1);
    const punktyPoprzedniTydzien = sumaPunktowOd(poprzedniTydzienStart, poprzedniTydzienKoniec);

    // Historia ostatnich 4 tygodni (trend długoterminowy, motywacyjny nie karzący)
    const trend4Tyg = [];
    for (let i = 3; i >= 0; i--) {
      const koniec = dataMinus(dzis, i * 7);
      const start = dataMinus(koniec, 6);
      trend4Tyg.push({ start: start, koniec: koniec, punkty: sumaPunktowOd(start, koniec) });
    }

    return {
      success: true,
      data: { dni7: dni7, procentTygodniowy: procentTygodniowy, punktyTenTydzien: punktyTenTydzien, punktyPoprzedniTydzien: punktyPoprzedniTydzien, trend4Tyg: trend4Tyg }
    };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ============================================================
// MODUŁ 2 — TRENING (Faza 2, wdrożone: plan edytowalny, log sesji,
// status "zmodyfikowany — zdrowie" z powodem, reguła plateau)
// ============================================================

const PIPBOY_POWODY_MODYFIKACJI = ['zdrowie', 'zmeczenie', 'zle-samopoczucie', 'inne'];

function getTrainingPlan() {
  try {
    const rows = sheetToObjects(pipboySheet('plan_treningowy'));
    rows.sort((a, b) => a.trening_typ === b.trening_typ ? Number(a.kolejnosc) - Number(b.kolejnosc) : String(a.trening_typ).localeCompare(String(b.trening_typ)));
    return { success: true, data: rows };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// Edycja pojedynczego ćwiczenia w planie (Runda #17 — plan w pełni edytowalny)
function updateTrainingExercise(treningTyp, kolejnosc, dane) {
  try {
    const sheet = pipboySheet('plan_treningowy');
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === treningTyp && Number(rows[i][1]) === Number(kolejnosc)) {
        sheet.getRange(i + 1, 3, 1, 4).setValues([[dane.cwiczenie, dane.serie_docelowe, dane.powtorzenia_zakres, dane.przerwa_sek]]);
        return { success: true };
      }
    }
    sheet.appendRow([treningTyp, kolejnosc, dane.cwiczenie, dane.serie_docelowe, dane.powtorzenia_zakres, dane.przerwa_sek]);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// Zapis jednej serii sesji treningowej. status: 'pelna' | 'zmodyfikowana' | 'ad-hoc'
function logTrainingSet(dataStr, treningTyp, status, powodModyfikacji, cwiczenie, seriaNr, powtorzenia, ciezarKg, ocena, notatka) {
  try {
    if (status === 'zmodyfikowana' && PIPBOY_POWODY_MODYFIKACJI.indexOf(powodModyfikacji) === -1) {
      return { success: false, error: 'Nieznany powód modyfikacji.' };
    }
    const nowyRekord = status === 'pelna' ? sprawdzCzyRekord(cwiczenie, Number(ciezarKg)) : false;
    pipboySheet('log_treningowy').appendRow([
      dataStr, treningTyp, status, status === 'zmodyfikowana' ? powodModyfikacji : '',
      cwiczenie, seriaNr, powtorzenia, ciezarKg, ocena || '', notatka || '', nowyRekord
    ]);
    if (nowyRekord) pipboyAwardPoints(dataStr, 'cialo', PIPBOY_PUNKTY_ZDOBYTE.progresja_ciezaru.punkty);
    return { success: true, nowyRekord };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function sprawdzCzyRekord(cwiczenie, ciezarKg) {
  // UWAGA (poprawka w tej turze): kolumna 'trening_typ' przechowuje plan A/B,
  // status sesji ('pelna'/'zmodyfikowana'/'ad-hoc') jest w 'zrodlo_sesji'.
  // Filtrowanie po trening_typ==='pelna' nigdy nie było prawdziwe — rekordy
  // nigdy się nie zapisywały. Poprawione na zrodlo_sesji.
  const rows = sheetToObjects(pipboySheet('log_treningowy')).filter(r => r.cwiczenie === cwiczenie && r.zrodlo_sesji === 'pelna');
  const maxDotychczas = rows.reduce((m, r) => Math.max(m, Number(r.ciezar_kg) || 0), 0);
  return ciezarKg > maxDotychczas;
}

function zakonczTrening(dataStr, treningTyp, ocenaCalosci) {
  try {
    pipboyAwardPoints(dataStr, 'cialo', PIPBOY_PUNKTY_ZDOBYTE.trening_ukonczony.punkty);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// Kardio z kettlami na mobilność — punkt 3 struktury sesji treningowej
// (sekcja Moduł 2): "zawsze na koniec właściwego treningu, w ramach tej
// samej godziny... czas trwania, subiektywna intensywność (1-10), rodzaj
// ćwiczeń". Do czasu dostarczenia biblioteki CrossFit (sekcja 8) "rodzaj"
// to wolny tekst, nie wybór z katalogu.
function saveKardioMobilnosc(dataStr, minuty, intensywnosc, rodzaj) {
  try {
    if (!minuty) return { success: false, error: 'Podaj czas trwania (min).' };
    pipboySheet('kardio_mobilnosc_log').appendRow([dataStr, minuty, intensywnosc || '', rodzaj || '']);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function getKardioMobilnoscDzien(dataStr) {
  try {
    return { success: true, data: sheetToObjects(pipboySheet('kardio_mobilnosc_log')).filter(r => r.data === dataStr) };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// Reguła plateau (sekcja 0.6.A / Moduł 2): 3+ KOLEJNE WYSTĄPIENIA danego
// ćwiczenia (nie dni kalendarzowe) bez progresji ciężaru/objętości.
function sprawdzPlateau(cwiczenie) {
  try {
    const rows = sheetToObjects(pipboySheet('log_treningowy'))
      .filter(r => r.cwiczenie === cwiczenie && r.zrodlo_sesji === 'pelna');
    // Grupuj po dacie sesji (jedno wystąpienie = jedna data), bierz max ciężar tego dnia
    const poDacie = {};
    rows.forEach(r => {
      const c = Number(r.ciezar_kg) || 0;
      if (!poDacie[r.data] || c > poDacie[r.data]) poDacie[r.data] = c;
    });
    const daty = Object.keys(poDacie).sort();
    if (daty.length < 4) return { plateau: false };
    const ostatnie4 = daty.slice(-4).map(d => poDacie[d]);
    const bezProgresu = ostatnie4[1] <= ostatnie4[0] && ostatnie4[2] <= ostatnie4[1] && ostatnie4[3] <= ostatnie4[2];
    return {
      plateau: bezProgresu,
      sugestia: bezProgresu ? 'Brak progresu na ' + cwiczenie + ' od 3 wystąpień — rozważ: (a) zamianę na ćwiczenie zbliżone na 4-6 tygodni, (b) tydzień redukcji obciążenia (deload), (c) kontynuację bez zmian.' : ''
    };
  } catch (e) {
    return { plateau: false, error: e.toString() };
  }
}

function getTrainingHistory(cwiczenie) {
  try {
    const rows = sheetToObjects(pipboySheet('log_treningowy')).filter(r => r.cwiczenie === cwiczenie);
    return { success: true, data: rows, plateau: sprawdzPlateau(cwiczenie) };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ============================================================
// SEKCJA 5.4 — CYTAT DNIA
// ============================================================

function getCytatDnia() {
  try {
    const sheet = pipboySheet('cytaty_motywacyjne');
    const rows = sheetToObjects(sheet);
    if (rows.length === 0) return null;
    // Losowanie bez powtórzeń w obrębie jednego przejścia przez pulę:
    // wybierz spośród tych z najstarszą (lub pustą) datą ostatniego wyświetlenia
    const posortowane = rows.slice().sort((a, b) => {
      const da = a.data_ostatniego_wyswietlenia || '';
      const db = b.data_ostatniego_wyswietlenia || '';
      return da < db ? -1 : da > db ? 1 : 0;
    });
    const pulaMin = posortowane.filter(r => (r.data_ostatniego_wyswietlenia || '') === (posortowane[0].data_ostatniego_wyswietlenia || ''));
    const wybrany = pulaMin[Math.floor(Math.random() * pulaMin.length)];

    const dataRange = sheet.getDataRange().getValues();
    for (let i = 1; i < dataRange.length; i++) {
      if (dataRange[i][0] === wybrany.tresc && dataRange[i][1] === wybrany.autor) {
        sheet.getRange(i + 1, 4).setValue(todayIso());
        break;
      }
    }
    return { tresc: wybrany.tresc, autor: wybrany.autor };
  } catch (e) {
    return null;
  }
}

// ============================================================
// SEKCJA 6.12 — MARQUEE SUGESTYWNE (dopasowanie kontekstowe, wersja
// podstawowa dla Fazy 1 — pełny silnik warunków to zadanie Fazy 2)
// ============================================================

function getMarqueeKomunikaty(kontekst) {
  try {
    const rows = sheetToObjects(pipboySheet('marquee_komunikaty'));
    kontekst = kontekst || {};
    const pasujace = rows.filter(r => marqueeWarunekPasuje(r.warunek, kontekst));
    pasujace.sort((a, b) => Number(b.priorytet) - Number(a.priorytet));
    return { success: true, data: pasujace.slice(0, 10) };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// Prosty parser warunków w formie "klucz=wartosc AND klucz2=wartosc2".
// Warunek dopasowuje, jeśli WSZYSTKIE pary klucz=wartość zgadzają się z
// przekazanym kontekstem; klucze nieobecne w kontekście nie blokują (żeby
// komunikat nie znikał tylko dlatego, że Faza 1 nie śledzi jeszcze danej flagi).
function marqueeWarunekPasuje(warunek, kontekst) {
  if (!warunek) return true;
  const pary = warunek.split(/\s+AND\s+/i);
  return pary.every(para => {
    const m = para.match(/^([a-z0-9_]+)\s*(=|<=|>=|<|>)\s*(.+)$/i);
    if (!m) return true;
    const [, klucz, op, wartosc] = m;
    if (!(klucz in kontekst)) return true; // nieznana flaga — nie blokuj
    const aktualna = kontekst[klucz];
    const oczekiwana = isNaN(Number(wartosc)) ? wartosc.replace(/['"]/g, '') : Number(wartosc);
    const porownywana = isNaN(Number(aktualna)) ? aktualna : Number(aktualna);
    switch (op) {
      case '=': return String(porownywana) === String(oczekiwana);
      case '<=': return porownywana <= oczekiwana;
      case '>=': return porownywana >= oczekiwana;
      case '<': return porownywana < oczekiwana;
      case '>': return porownywana > oczekiwana;
      default: return true;
    }
  });
}

// ============================================================
// MODUŁ 18 — PORTFOLIO FIGUREK (Personal Brand)
// Hybryda rigid/elastyczny (sekcja Moduł 18): blok TWORZENIA (czas
// sklejania/malowania) jest CELOWO poza mechaniką HP — presja tutaj byłaby
// kontrproduktywna dla procesu twórczego (decyzja Arka, oparta na strategii
// biznesowej sekcja 21.4). Checklist PUBLIKACJI (zdjęcie/opis/opublikowane)
// dokument opisuje jako "RIGID z pełną mechaniką HP" — tracking jest w pełni
// wdrożony, ale NIE podpięty pod computePipBoyHP: dokument nie definiuje
// jednoznacznego triggera (ile dni po ukończeniu projektu zaczyna karać,
// jaka wartość kary) — dopisanie tego byłoby zgadywaniem kalibracji, nie
// odczytaniem specyfikacji, tak samo jak przy Rozciąganiu/Higienie światła
// (patrz analogiczna, udokumentowana luka gdzie indziej w tym pliku).
// ============================================================

function getPortfolioSzacunki() {
  return {
    success: true,
    data: { kategorie: PIPBOY_PORTFOLIO_KATEGORIE, typyPracy: PIPBOY_PORTFOLIO_TYPY_PRACY, szacunki: PIPBOY_PORTFOLIO_SZACUNKI }
  };
}

function utworzProjektPortfolio(nazwa, kategoria, typPracy) {
  try {
    if (!nazwa) return { success: false, error: 'Podaj nazwę projektu.' };
    const id = generateId();
    pipboySheet('portfolio_projekty').appendRow([
      id, nazwa, kategoria, typPracy, todayIso(), false, false, false, '', 'w_trakcie'
    ]);
    return { success: true, id: id };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function getProjektyPortfolio() {
  try {
    const projekty = sheetToObjects(pipboySheet('portfolio_projekty'));
    const czasRows = sheetToObjects(pipboySheet('portfolio_czas_log'));
    const czasPoProjekcie = {};
    czasRows.forEach(r => { czasPoProjekcie[r.projekt_id] = (czasPoProjekcie[r.projekt_id] || 0) + (Number(r.minuty) || 0); });
    return {
      success: true,
      data: projekty.map(p => Object.assign({}, p, { czasRzeczywistyMin: czasPoProjekcie[p.id] || 0 }))
    };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// Log czasu bloku tworzenia — CELOWO bez wpływu na HP (patrz nagłówek
// sekcji). Zasila rolling-average marki (Runda #17, wzorzec Modułu 20) i
// atrybut Personal Brand.
function logCzasPortfolio(projektId, dataStr, minuty) {
  try {
    if (!minuty) return { success: false, error: 'Podaj liczbę minut.' };
    pipboySheet('portfolio_czas_log').appendRow([dataStr, projektId, minuty]);
    const sumaDnia = sheetToObjects(pipboySheet('portfolio_czas_log'))
      .filter(r => r.data === dataStr)
      .reduce((s, r) => s + (Number(r.minuty) || 0), 0);
    updateRollingAverage('portfolio', dataStr, sumaDnia);
    pipboyAwardPoints(dataStr, 'personal_brand', PIPBOY_PUNKTY_ZDOBYTE.blok_portfolio.punkty);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// Checklist publikacji per projekt (patrz zastrzeżenie w nagłówku — trackowany,
// świadomie NIE podpięty pod HP).
function ustawChecklistePublikacji(projektId, pole, wartosc) {
  try {
    const dozwolone = ['zdjecie_zrobione', 'opis_napisany', 'opublikowane'];
    if (dozwolone.indexOf(pole) === -1) return { success: false, error: 'Nieznane pole.' };
    const sheet = pipboySheet('portfolio_projekty');
    const naglowki = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const kolIdx = naglowki.indexOf(pole) + 1;
    const dane = sheet.getDataRange().getValues();
    for (let i = 1; i < dane.length; i++) {
      if (dane[i][0] === projektId) {
        sheet.getRange(i + 1, kolIdx).setValue(wartosc);
        return { success: true };
      }
    }
    return { success: false, error: 'Nie znaleziono projektu.' };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function ustawKanalyPortfolio(projektId, kanaly) {
  try {
    const sheet = pipboySheet('portfolio_projekty');
    const dane = sheet.getDataRange().getValues();
    for (let i = 1; i < dane.length; i++) {
      if (dane[i][0] === projektId) {
        sheet.getRange(i + 1, 9).setValue(kanaly || ''); // kolumna 'kanaly'
        return { success: true };
      }
    }
    return { success: false, error: 'Nie znaleziono projektu.' };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function zakonczProjektPortfolio(projektId) {
  try {
    const sheet = pipboySheet('portfolio_projekty');
    const dane = sheet.getDataRange().getValues();
    for (let i = 1; i < dane.length; i++) {
      if (dane[i][0] === projektId) {
        sheet.getRange(i + 1, 10).setValue('ukonczony'); // kolumna 'status'
        return { success: true };
      }
    }
    return { success: false, error: 'Nie znaleziono projektu.' };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}
