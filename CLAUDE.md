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
- Build output in `dist/` can be zipped and shared or opened directly in browser

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
4. **New stores/indexes**: always guard with `if (!db.objectStoreNames.contains(...))` so fresh installs and upgrades follow the same path.
5. **Field renames/type changes**: use a cursor over the affected store and call `cursor.update(record)` within the upgrade transaction.
6. **Backfilling new fields**: iterate with a cursor and set sensible defaults for existing records.
7. **Test both paths**: fresh install (oldVersion === 0) and upgrade from each prior version.

### Current migration history

| Version | Change |
|---------|--------|
| 1 → 2  | Added `hash` index to `questions` store |
| 2 → 3  | Renamed `rating` → `difficulty` on all questions |
| 3 → 4  | *(unknown — document here when identified)* |
| 4 → 5  | Added `sortOrder` index to `sessions` store; backfilled existing sessions |

## Deployment Notes

- Deployed to static hosting - GitHub Pages
- Zipped and shared for offline usage in regulated environments
