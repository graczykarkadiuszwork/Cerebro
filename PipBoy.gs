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
      { name: 'punkty_historia', headers: ['data', 'hp_procent', 'xp_dzienny', 'streak_aktualny', 'poziom_postaci', 'smierc_postaci_bool'] },
      { name: 'tokeny_god_mode', headers: ['data_aktywacji', 'typ', 'notatka'] },
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
function jestDniemTreningowym(dataStr) {
  const dow = new Date(dataStr).getDay(); // 2=wtorek, 4=czwartek, 6=sobota
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

  const blocks = [];
  blocks.push({ klucz: 'pobudka', nazwa: 'Pobudka', obligatoryjne: false, modul: 'ogolne' });
  blocks.push({ klucz: 'pielegnacja_poranna', nazwa: 'Pielęgnacja poranna (max 15 min)', obligatoryjne: false, modul: 'pielegnacja' });
  blocks.push({ klucz: 'rozciaganie', nazwa: 'Rozciąganie/joga (10-15 min)', obligatoryjne: true, modul: 'rozciaganie' });
  blocks.push({ klucz: 'suplementy_rdzenne', nazwa: 'Suplementy poranne', obligatoryjne: true, modul: 'suplementy', dzieci: PIPBOY_SUPLEMENTY_RDZENNE.map(s => s.klucz) });
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

  if (!niedziela) {
    blocks.push({
      klucz: 'sprzatanie', nazwa: 'Sprzątanie (min. 15 min floor, #sprzątanie)',
      obligatoryjne: bazowyTyp === 'C', modul: 'sprzatanie'
    });
  }

  blocks.push({ klucz: 'posilek_4', nazwa: 'Posiłek 4 — ok. ' + posilkiGodz[3], obligatoryjne: true, modul: 'dieta', numer: 4 });
  blocks.push({ klucz: 'czas_wolny_1', nazwa: 'Czas wolny (Portfolio / czytanie / spacer)', obligatoryjne: false, modul: 'czas_wolny' });
  blocks.push({ klucz: 'posilek_5', nazwa: 'Posiłek 5 — ok. ' + posilkiGodz[4], obligatoryjne: true, modul: 'dieta', numer: 5 });
  blocks.push({ klucz: 'melatonina', nazwa: 'Melatonina (w razie potrzeby, max 5)', obligatoryjne: false, modul: 'suplementy', dzieci: ['melatonina'] });
  blocks.push({ klucz: 'pielegnacja_wieczorna', nazwa: 'Pielęgnacja wieczorna (max 15 min)', obligatoryjne: false, modul: 'pielegnacja' });
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
    const godModeAktywny = isGodModeActive(dataStr);
    const hp = computePipBoyHP(dataStr, struktura, suplementyLog, posilkiLog, moodLog, godModeAktywny);

    return {
      success: true,
      data: {
        data: dataStr,
        typSzablonu: struktura.typSzablonu,
        bloki: struktura.blocks,
        suplementyLog, posilkiLog, moodLog, dziennyLog,
        godModeAktywny,
        hp: hp.procent,
        hpBrakujace: hp.brakujace,
        cytatDnia: getCytatDnia(),
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
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === dataStr && rows[i][1] === modul) {
        sheet.getRange(i + 1, 3).setValue(wykonano);
        return { success: true };
      }
    }
    sheet.appendRow([dataStr, modul, wykonano]);
    return { success: true };
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
        return { success: true };
      }
    }
    sheet.appendRow([dataStr, klucz, wykonano, godzina, '']);
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
        return { success: true };
      }
    }
    sheet.appendRow([dataStr, numer, wykonano, godzina]);
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
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === dataStr && rows[i][1] === pora) {
        sheet.getRange(i + 1, 1, 1, 8).setValues([row]);
        return { success: true, followUpGI: Number(wartosci.gi) > 0 && Number(wartosci.gi) <= 4 };
      }
    }
    sheet.appendRow(row);
    return { success: true, followUpGI: Number(wartosci.gi) > 0 && Number(wartosci.gi) <= 4 };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ============================================================
// SEKCJA 4.1a — GOD_MODE_24H (dawny Token Dnia Ochronnego)
// Ręczna aktywacja, w tym tego samego dnia (Runda #17), limit 4/miesiąc.
// ============================================================

function isGodModeActive(dataStr) {
  const rows = sheetToObjects(pipboySheet('tokeny_god_mode'));
  return rows.some(r => r.data_aktywacji === dataStr);
}

function countGodModeWMiesiacu(rokMiesiac) {
  const rows = sheetToObjects(pipboySheet('tokeny_god_mode'));
  return rows.filter(r => String(r.data_aktywacji).startsWith(rokMiesiac) && r.typ !== 'tryb-regeneracji').length;
}

function activateGodMode(dataStr) {
  try {
    const rokMiesiac = dataStr.substring(0, 7);
    const uzyte = countGodModeWMiesiacu(rokMiesiac);
    if (uzyte >= PIPBOY_GOD_MODE_LIMIT_MIESIECZNY) {
      return { success: false, error: 'Limit ' + PIPBOY_GOD_MODE_LIMIT_MIESIECZNY + ' aktywacji w tym miesiącu wykorzystany.' };
    }
    if (isGodModeActive(dataStr)) {
      return { success: false, error: 'GOD_MODE_24H jest już aktywny na ten dzień.' };
    }
    pipboySheet('tokeny_god_mode').appendRow([dataStr, 'dzien', '']);
    return { success: true, pozostaleWMiesiacu: PIPBOY_GOD_MODE_LIMIT_MIESIECZNY - uzyte - 1 };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ============================================================
// SEKCJA 4.2 — MECHANIKA HP (podstawowa, bez pełnej listy odznak)
// ============================================================

function computePipBoyHP(dataStr, struktura, suplementyLog, posilkiLog, moodLog, godModeAktywny) {
  if (godModeAktywny) {
    // GOD_MODE_24H: HP nie spada za pominięcia poza suplementami rdzennymi (4.1a)
  }
  let hp = 100;
  const brakujace = [];

  const rdzenneKlucze = PIPBOY_SUPLEMENTY_RDZENNE.map(s => s.klucz);
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

    if (struktura.treningowy) {
      // Faza 1: brak jeszcze osobnego logu treningowego (Moduł 2 = Faza 2) —
      // trening liczony jako wykonany wyłącznie ręcznym potwierdzeniem w
      // Punkty_Historia; tu placeholder nie nalicza kary automatycznie,
      // żeby nie karać za funkcję, która jeszcze nie istnieje w UI.
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
