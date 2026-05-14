# Cerebro — System Zarządzania Organizacją

Kompletna aplikacja webowa do zarządzania organizacją, zbudowana na **Google Apps Script** z bazą danych w **Google Sheets** i magazynem plików w **Google Drive**.

## 🎯 Cechy

- ✅ **100% polskie UI** — bezosobowe, uniwersalne
- ✅ **Zero kosztów** — bez płatnych API, bez subskrypcji
- ✅ **Zero instalacji** — wszystko w przeglądarce
- ✅ **Auto-import z Drive** — nowe pliki → baza wiedzy
- ✅ **iOS Design** — piękny interfejs na desktop i telefonie
- ✅ **7 pełnych modułów** — Pulpit, Zadania, Wiedza, Chat, Terminarz, Personel, Ustawienia
- ✅ **Kanban & Lista** — widoki do zarządzania zadaniami
- ✅ **Markdown** — treści artykułów w Markdown
- ✅ **PWA** — dodaj do ekranu głównego telefonu

## 📦 Zawartość

```
apps-script/
├── Code.gs              — Backend: CRUD, setup, export
├── DriveSync.gs         — Auto-import z Google Drive (trigger co 1h)
├── Index.html           — Shell aplikacji
├── Sidebar.html         — Nawigacja
├── Styles.html          — iOS design system CSS
├── Scripts.html         — Wspólne funkcje JS
├── Pulpit.html          — Dashboard
├── Zadania.html         — Task manager (lista + kanban)
├── Wiedza.html          — Baza wiedzy (3-panel)
├── Chat.html            — Chat saver
├── Terminarz.html       — Kalendarz (miesiąc + lista)
├── Personel.html        — Staff view (artykuły udostępnione)
├── Ustawienia.html      — Setup, import, export
└── README.md            — Ten plik
```

## 🚀 Wdrażanie — Instrukcja krok po kroku

### Krok 1: Utwórz projekt Apps Script

1. Otwórz [script.google.com](https://script.google.com)
2. Zaloguj się kontem Google
3. Kliknij **"Nowy projekt"**
4. Zmień nazwę na **"Cerebro"**

### Krok 2: Dodaj pliki do Apps Script

W edytorze Projects Script (po lewej):

1. Usuń domyślny `Code.gs`
2. Utwórz nowe pliki w kolejności:

**Skrypty (.gs):**
- `Code.gs` — Wklej zawartość z `Code.gs`
- `DriveSync.gs` — Wklej zawartość z `DriveSync.gs`

**Strony HTML (.html):**
- `Index.html` — Wklej zawartość z `Index.html`
- `Sidebar.html` — Wklej zawartość z `Sidebar.html`
- `Styles.html` — Wklej zawartość z `Styles.html`
- `Scripts.html` — Wklej zawartość z `Scripts.html`
- `Pulpit.html` — Wklej zawartość z `Pulpit.html`
- `Zadania.html` — Wklej zawartość z `Zadania.html`
- `Wiedza.html` — Wklej zawartość z `Wiedza.html`
- `Chat.html` — Wklej zawartość z `Chat.html`
- `Terminarz.html` — Wklej zawartość z `Terminarz.html`
- `Personel.html` — Wklej zawartość z `Personel.html`
- `Ustawienia.html` — Wklej zawartość z `Ustawienia.html`

### Krok 3: Uruchom setup

1. W edytorze, na górze po lewej — z listy rozwijanej **"Wybierz funkcję"** zaznacz `setupCerebro`
2. Kliknij przycisk **▶️ Uruchom**
3. Google poprosi o autoryzację:
   - Zaakceptuj dostęp do Google Drive
   - Zaakceptuj dostęp do Sheets
   - ⚠️ Zobaczysz ostrzeżenie "Aplikacja nie jest zweryfikowana" — **to normalne**
     - Kliknij **"Opcje zaawansowane"**
     - Kliknij **"Przejdź do Cerebro (niebezpieczna)"**
     - Potwierdź dostęp

4. W Logach (u dołu) zobaczysz:
   ```json
   { success: true, spreadsheetUrl: "..." }
   ```

### Krok 4: Wdróż aplikację

1. Kliknij menu **"Wdróż"** → **"Nowe wdrożenie"**
2. Kliknij ikonę ⚙️ → wybierz **"Aplikacja internetowa"**
3. Uzupełnij:
   - **Opis**: `Cerebro v1`
   - **Wykonaj jako**: Ja (twój email)
   - **Kto ma dostęp**: **Wszyscy** ← ważne!
4. Kliknij **"Wdróż"**
5. Skopiuj wygenerowany **URL** — wygląda tak:
   ```
   https://script.google.com/macros/s/AKfycby......................./exec
   ```

### Krok 5: Gotowe! 🎉

1. Otwórz skopiowany URL w przeglądarce
2. Powinna się załadować aplikacja Cerebro
3. Na telefonie: otwórz w Chrome, menu (⋮) → **"Dodaj do ekranu głównego"**

## 📖 Struktura Drive

Setup automatycznie tworzy folder na Dysku:

```
Mój dysk
└── Cerebro/
    ├── Procedury/      → importuje jako kategoria "procedury"
    ├── Cenniki/        → importuje jako kategoria "cenniki"
    ├── Szablony/       → importuje jako kategoria "szablony"
    ├── Materiały/      → importuje jako kategoria "materiały"
    ├── Prywatne/       → importuje, ale widoczność "prywatny"
    └── Notatki/        → importuje jako kategoria "notatki"
```

**Auto-import**: Co 1 godzinę trigger sprawdza te foldery i nowe pliki dodaje do Bazy Wiedzy.

## 🔧 Funkcjonalność modułów

### 📊 Pulpit
- Statystyki: razem, do wykonania, w trakcie, ukończone
- Bliskie terminy (7 dni)
- Ostatnio dodane zadania

### ✅ Zadania
- Lista z priorytetami (pilne, wysoki, normalny, niski)
- Widok Kanban (3 kolumny: todo, inprogress, done)
- Dodaj, edytuj, usuń, oznacz jako ukończone
- Filtry po statusie

### 📚 Baza Wiedzy
- 3-panel: Kategorie | Artykuły | Podgląd
- Obsługuje Markdown
- Widoczność: prywatny/udostępniony
- Tagi do organizacji
- Wersjonowanie zmian

### 💬 Chat Saver
- Zapisz rozmowy z ChatGPT, Claude, Gemini
- Wklej JSON z eksportu chatów
- Kategoryzacja po modelu AI
- Przeszukiwanie po tagach

### 📅 Terminarz
- Widok miesięczny — pełny kalendarz
- Widok listy — chronologicznie
- Typy: spotkanie, deadline, wolne, inne
- Dodaj notatki do każdego dnia

### 👥 Personel
- Dostęp do artykułów oznaczonych **"Udostępniony"**
- Wyszukiwanie po tytule, kategorii, tagach
- Widok do udostępniania personelowi
- Użyj URL `?mode=staff` żeby otworzyć dla team

### ⚙️ Ustawienia
- Nazwa organizacji, email kontaktowy
- Konfiguracja Drive (setup struktura folderów)
- Synchronizacja ręczna
- Eksport JSON wszystkich danych
- Instrukcja wdrożenia wbudowana

## 🌐 Tooltips

Na desktopie: **hover 3 sekundy** na przycisku nawigacji → pojawia się angielski tooltip
- "Pulpit" → "Dashboard"
- "Zadania" → "Tasks"
- "Baza Wiedzy" → "Knowledge Base"
- itp.

## 📱 Responsywność

- **Desktop** (≥768px): Sidebar + content
- **Tablet** (≥768px): Sidebar + content
- **Telefon** (<768px): Hamburger menu, fullscreen modals

## 🎨 Design

- **Tailwind CSS** — poprzez CDN
- **Lucide Icons** — poprzez CDN
- **iOS Design Language** — zaokrąglone rogi, shadow, niebieskie akcenty
- **Kolory**: `#007aff` (blue), `#34c759` (green), `#ff3b30` (red), `#ff9500` (orange)

## 🔒 Bezpieczeństwo

- ✅ `google.script.run` zamiast fetch — chroni przed CORS
- ✅ Input validation w backendzie
- ✅ HTML escaping w frontendzie (funkcja `escapeHtml()`)
- ✅ Brak przechowywania haseł — OAuth przez Google

## ⚡ Limity i Wydajność

- **Triggery**: Domyślnie co 1 godz. (zmiana w `DriveSync.gs`)
- **Rozmiar arkusza**: Google Sheets do 10 mln komórek
- **Czas wykonania**: Apps Script max 6 minut
- **Limit plików**: Brak limitu importu z Drive

Jeśli potrzebujesz częstszej synchronizacji:
```javascript
// W setupDriveTrigger(), zmień:
.everyHours(1)      // na
.everyMinutes(15)   // dla co 15 minut
```

## 🛠️ Rozwiązywanie problemów

### "Aplikacja nie jest zweryfikowana" przy setup
→ Normalnie dla własnych skryptów. Kliknij "Zaawansowane" → "Przejdź do Cerebro"

### Pliki z Drive nie importują się
→ Sprawdź:
1. Folder `/Cerebro` istnieje na Dysku
2. Podfoldery (Procedury, Cenniki, etc.) są wewnątrz
3. Pliki są w tych podfolderach
4. Kliknij "Synchronizuj ręcznie" w Ustawieniach

### Bazy danych nie widać
→ Sprawdź:
1. `setupCerebro()` został uruchomiony do końca
2. Google Sheets został utworzony (sprawdź w Dysku)
3. Arkusze `zadania`, `wiedza`, `wydarzenia` istnieją

### Timeout przy `setupCerebro()`
→ Apps Script ma limit 6 minut. Uruchom ponownie.

## 📞 Support

Jeśli coś nie działa:
1. Sprawdź Logi w Apps Script (Ctrl+Enter)
2. Sprawdź konsolę przeglądarki (F12 → Console)
3. Spróbuj odświeżyć (F5)
4. Spróbuj w incognito

## 📄 Licencja

MIT — używaj, modyfikuj, rozdzielaj swobodnie.

---

**Autor**: Cerebro  
**Wersja**: 1.0  
**Ostatnia aktualizacja**: maj 2026

Powodzenia! 🚀
