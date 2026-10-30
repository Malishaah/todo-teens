# Todo-Teens

A small responsive web planner based on the editable My Space Figma design. The interface is Swedish.

## Open the app

Open `index.html` in a modern browser. There is no build step or package installation.

For a local server, run `python3 -m http.server 8000` inside this folder, then visit `http://localhost:8000`.

## Files

- `index.html`: semantic page structure and accessible dialogs
- `styles.css`: responsive layout, colours and typography
- `app.js`: navigation, task/checklist editing, notes, calendar, progress and browser storage

The colours follow the Figma design: pink actions, violet progress, warm paper, pistachio, butter yellow and a pink Moodi mascot. Icons use Lucide SVG paths (ISC licence; see `LICENSE-ICONS.txt`). Space Grotesk and Inter are loaded from Google Fonts; system fonts are used offline.

## What works

Create and edit tasks, complete tasks and checklist items, delete tasks, navigate months, view a date's agenda, create/edit/search notes, view weekly completion counts, change your name and reduced-motion setting, and follow the three-step introduction.

Data stays in localStorage for this browser and origin. Clearing browser data removes it. There is no account, cloud sync or server. File URLs may handle storage differently across browsers; use a local server for consistent persistence. Push notifications are not implemented and the settings screen says so.

Repository: https://github.com/Malishaah/todo-teens (private).

## Personalisation and first use

New visitors start with empty task and note lists. The optional name field starts blank. Without a name, the greeting is “Hej! Lite i taget.” and the profile reads “Min profil”. Clearing the name in Settings restores this neutral greeting. Existing names and user data are preserved; the unchosen “Alex” default from version 1 is removed. The untouched legacy seed set is marked as examples and can be removed using the visible “Ta bort exemplen” action, without deleting other tasks. This is a single browser profile, not separate user accounts.

## Validation

Run `node --test tests/state.test.cjs` for 12 checks covering first use, optional names, legacy migration, preserving real content, task/checklist editing, note editing, completion state, safe text rendering, storage failure and leap-year calendars. Browser checks cover the neutral profile and onboarding name field.
