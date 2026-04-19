# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Filipa** is an interview assessment tool for IT developer candidates. The name comes from Czech expression meaning "
someone who is smart and knows how to handle situations". This is a Svelte 5 + TypeScript application designed to run in
offline/regulated environments with dual-view interface for interviewer and candidate.

## Key Architecture Decisions

### Offline-First Design

- **Hash-based routing** (`svelte-spa-router`) instead of standard routing to work with `file://` protocol
- **Relative paths**: `vite.config.ts` uses `base: "./"` so the built app can run from any location
- Must work without internet connection after build
- Build output in `dist/` can be zipped and shared or opened directly in browser via `dist/index.html`

### Technology Stack

- **Svelte 5** with TypeScript
- **svelte-spa-router** for hash-based routing (enables offline usage)
- **Vite** as build tool
- No CSS framework in dependencies
- always use double quotes
- prefer arrow functions
- do not use any for TypeScript interfaces/types
- use pure functions
- markdown structure for import, export is defined in `src/public/config.json` - must be updated with each object
  structure change

### Routing Architecture

- Routes defined in `src/App.svelte` as object mapping paths to components
- Hash-based navigation (`#/about`) using `svelte-spa-router`
- Navigation uses `use:link` directive from `svelte-spa-router` in `<a>` tags
- All route paths must start with `/` (e.g., `/`, `/about`)

## Development Commands

- Develop `npm run dev` on http://localhost:5173
- Build for production (outputs to dist/) `npm run build`
- Type checking and validation `npm run check`

## Adding New Pages/Routes/Components

1. Create new Svelte pages in `src/pages/`
2. Import it in `src/App.svelte`
3. Components in `src/components`
4. Add to `routes` object: `'/route-path': ComponentName`
5. Use hash links with `use:link` directive: `<a href="#/route-path" use:link>`
6. Common classes in `src/app.css`

## Important Constraints

- Cannot use standard routing patterns that require server-side handling
- Must maintain `base: "./"` in `vite.config.ts` for compatibility
- All navigation must use hash-based URLs (`#/path`)
- Consider file:// protocol compatibility when adding external resources
- Common design style should be kept
- Classes should be re-used from one place
- Components should be re-used to eliminate duplicated code
- If the task requires complex changes, ask first if I'm sure to do that. e.g.: DB structure change, multiple files
  change

## Database Migration Rules

**User data must never be lost during upgrades.** Every DB schema change requires a migration script.

### Rules for changing `DB_VERSION` in `src/lib/db.ts`

1. **Increment `DB_VERSION`** by exactly 1.
2. **Add a migration block** inside `onupgradeneeded` guarded by `oldVersion`:
   ```ts
   if (oldVersion < NEW_VERSION) {
     // transform existing data here using the upgrade transaction
   }
   ```
3. **Never use `resetDatabase()` or `deleteDatabase()` as a migration strategy** — this destroys user data.
4. **New stores/indexes**: always guard with `if (!db.objectStoreNames.contains(...))` so fresh installs and upgrades
   follow the same path.
5. **Field renames/type changes**: use a cursor over the affected store and call `cursor.update(record)` within the
   upgrade transaction.
6. **Backfilling new fields**: iterate with a cursor and set sensible defaults for existing records.
7. **Test both paths**: fresh install (oldVersion === 0) and upgrade from each prior version.

### Current migration history
- three DB Index versions must be possible to upgrade. If not possible, inform user to download older version for loading the DB data.

| Version | Change                                                                    |
|---------|---------------------------------------------------------------------------|
| 1 → 2   | Added `hash` index to `questions` store                                   |
| 2 → 3   | Renamed `rating` → `difficulty` on all questions                          |
| 3 → 4   | *(unknown — document here when identified)*                               |
| 4 → 5   | Added `sortOrder` index to `sessions` store; backfilled existing sessions |

## IndexedDB and Svelte 5 Reactive Proxies

**Never write Svelte reactive state objects directly to IndexedDB.** Svelte 5 wraps `$state` values in reactive proxies.
IndexedDB's structured clone algorithm cannot serialize these proxies and throws:
`Failed to execute 'put' on 'IDBObjectStore': [object Array] could not be cloned.`

This affects array fields (`tags`, `difficulty`, `interviewers`) and `Date` fields inside nested objects.

**Rule:** Always pass data through a `clean*` helper before any `create`/`update` DB call. Use explicit field-by-field
construction with `[...array]` spreads and `new Date(...)` copies — never spread a reactive object directly into a DB
call.

Existing helpers: `cleanSessionQuestion()`, `cleanSession()`, `cleanQuestionObj()` in `SessionInterview.svelte`.

## Cross-Window Communication (Interviewer ↔ Candidate)

The interviewer (`SessionInterview.svelte`) and candidate (`CandidateView.svelte`) run in separate browser windows. Communication must work on `file://` (built `index.html` opened directly), where most cross-window APIs are restricted.

### The only reliable channel on `file://`: `localStorage` + `storage` event

| Channel                       | `file://` | `http://` | Notes                                        |
|-------------------------------|-----------|-----------|----------------------------------------------|
| `localStorage` storage event  | ✅        | ✅        | Primary channel — always use this            |
| `BroadcastChannel`            | ❌        | ✅        | Null-origin scoping breaks it on `file://`   |
| `window.postMessage`          | ❌        | ✅        | SecurityError on `file://` (null origin)     |

**Rule: all cross-window signals must go through `localStorage.setItem()`.** `BroadcastChannel` is wired up as a secondary channel for `http://` only and must never be the sole signal path.

### localStorage keys in use

| Key                        | Written by           | Read by                             | Value                                           |
|----------------------------|----------------------|-------------------------------------|-------------------------------------------------|
| `filipa-active-question`   | Interviewer          | Candidate                           | `questionId` or `questionId:timestamp` or `""` |
| `filipa-candidate-ready`   | Candidate (on mount) | Interviewer                         | `Date.now()` timestamp                          |
| `filipa-rating-visibility` | Interviewer          | Candidate (on each question update) | JSON `{ questionId, show }`                     |

### The timestamp trick

`localStorage` storage events **only fire when the value changes**. If the same `questionId` needs to be re-sent (e.g. to push a rating update for the already-active question), append `:Date.now()` to make the value unique:
```ts
localStorage.setItem("filipa-active-question", `${questionId}:${Date.now()}`);
```
`CandidateView` strips the suffix with `.split(":")[0]` before using the ID.

### Adding new cross-window signals

1. **Always piggyback on `filipa-active-question`** for signals that relate to the current question — re-set it with a timestamp to force the storage event.
2. **Store side-channel state** (like visibility flags) in a separate key and read it inside `handleQuestionUpdate` — not in a separate storage listener.
3. **Never add a new localStorage key as the sole trigger** — it may not fire reliably on `file://` if it wasn't set before in that session.
4. **Never use `BroadcastChannel` or `postMessage` as the primary signal** — only as an optional enhancement for `http://`.

## Deployment Notes

- Deployed to static hosting - GitHub Pages
- Zipped and shared for offline usage in regulated environments
- **Offline entry point**: users open `dist/index.html` directly in the browser (`file://` protocol) — no server needed
