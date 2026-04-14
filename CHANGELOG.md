# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.5.2] — 2026-04-14

### Added

- auto-snapshot on backup nudge with recovery UI
- suggest question import type (add new/skip/update/import
- DB version compatibility guard, backup nudge, and settings improvements

### Fixed

- shrink Select All checkbox to content width
- add postMessage fallback for cross-window communication
- re-send question state when candidate window signals ready
- restrict github-pages deploy to main branch only
- open candidate window synchronously before awaits for Safari compatibility

### Changed

- remove in-browser auto-snapshot system, expand backup nudge triggers

### Chore

- add pre-push hook to enforce version bump before pushing main
- bump version to 0.5.1 and update CHANGELOG
- launch settings for Claude
- release v0.5.1


## [0.5.1] — 2026-04-13

### Added

- auto-snapshot: automatically create a browser-side IndexedDB snapshot when unsaved changes are detected (backup nudge trigger)
- auto-snapshot settings: enable/disable toggle and keep-last count (1–2) in Settings → Auto-Snapshots
- "Create snapshot now" manual button in Settings
- per-snapshot Restore, Export to file, and Delete actions in Settings
- DB error screen now lists available snapshots and offers one-click restore when the database fails to open

### Fixed

- open candidate window synchronously before awaits for Safari compatibility
- remove candidate window status indicator
- decouple presenting from session and window state

### Chore

- launch settings for Claude


## [0.5.0] — 2026-04-11

### Added

- add inline clear button to text inputs
- add ReorderableTable component with keyboard reorder support
- component style
- add skip toggle to exclude questions from Prev/Next navigation
- reuse single window across session switches
- merge add-question modals into tabs, add edit question and catalog sync
- add ad-hoc question creation and save-to-catalog feature
- show selected type names and add difficulty filter to catalog dialog
- extract shared QuestionListView component and improve browser modal
- component for QuestionFilterPanel

### Fixed

- auto-focus Cancel button in confirmation dialogs
- merge reorder buttons into actions column

### Changed

- replace native confirm() with CompactDialog

### Documentation

- add Svelte 5 reactive proxy IndexedDB pitfall

### Chore

- fix 10 security vulnerabilities via npm audit fix


## [0.4.0] — 2026-04-10

### Added

- add full candidate export/import as JSON v2.0.0
- add Clear Session button to reset all session interactions
- move question tags into header meta row
- replace Expected Answer details + Record button with tab bar
- merge candidate and session notes into single Notes modal
- introduce CompactDialog for small/medium modals
- make notes textareas grow to fill modal vertical space

### Fixed

- show full first element in question text, hide See more when no extra content
- expand dialogs to 90vw/90vh, fix button alignment, prevent accidental close on dirty state


## [0.3.6] — 2026-02-19

### Chore

- missing logo for README.md


## [0.3.5] — 2026-02-19

_No changes recorded._


## [0.3.4] — 2026-02-19

### Fixed

- remove auto-push from release script

### Chore

- files locations for build needs


## [0.3.3] — 2026-02-19

### Documentation

- space


## [0.3.2] — 2026-02-19

### Fixed

- auto-push tags and create versioned GitHub releases
- remove File → Save As offline instructions

## [0.3.1] — 2026-02-19

### Fixed

- handle DB version conflict and document migration rules

## [0.3.0] — 2026-02-19

### Added

- improve welcome card and help page offline info
- add per-candidate stats to candidate cards on Candidates page
- add manual session ordering on Interview Sessions page
- add session stats to candidate pages and fix legacy displayName
- RatingSlider component

### Documentation

- Claude instructions

## [0.2.1] — 2026-02-18

### Added

- add QR code for online app to help page
- add patch release script and unify release.js bump logic
- release script

## [0.2.0] — 2026-02-18

### Added

- make sidebar action buttons responsive row on small screens
- add offline download note to welcome card
- replace firstName/lastName with single displayName on Candidate
- add first-run welcome card with getting started guide
- identify candidate window with title and header label
- show app version badge and fix GitHub link opening in new tab
- ignore local settings
- page heading style
- link to online app

### Fixed

- align home page cards to top and simplify welcome card visibility logic
- disable marked breaks and add proseWrap never to prevent unwanted line breaks in help docs
- replace broken in-page anchor links with plain text in help.md
- add make_latest flag to release action
- pass GITHUB_TOKEN explicitly to release action
- match theme toggle button size to font size buttons in candidate view
- open candidate window before await to preserve user gesture on iPad
- fallback to new tab when popup is blocked on iPad/mobile
- resolve pre-existing TypeScript errors
- make show prop required in QuestionBrowserModal type definition
- missing logo

### Performance

- replace full highlight.js bundle with selective language imports

### Changed

- replace inline modal frame in QuestionBrowserModal with SessionModal
- replace inline question-set browser modal with SessionModal
- replace inline Session Notes modal with SessionModal component

### Documentation

- development notes
- add consolidated sample files & import examples section to help.md
- fix grammar, spelling, and wording in README and dev notes
- link for application download

### Style

- replace hardcoded color values with CSS custom properties
- introduce CSS custom properties for colors in app.css
- consolidate shared view-toggle and questions-table CSS into app.css
- remove empty CSS selectors and orphaned comment

### Other

- build application

## [0.1.0] — 2026-02-16

### Added

- **Questions Catalog** — create, edit, and delete reusable interview questions with Markdown support, tags, difficulty
  levels, and question types (`text`, `rating`)
- **Images in questions** — embed images directly into question text via Base64 encoding; works fully offline
- **Question Sets** — group questions (by reference) into named sets for specific interview profiles; import/export as
  Markdown
- **Candidates** — manage a list of candidates with notes and creation timestamps
- **Interview Sessions** — conduct structured interviews with multiple sessions per candidate; add questions from the
  catalog or a question set during a session
- **Dual-window view** — separate interviewer screen and read-only candidate window showing only the current question;
  synchronized via BroadcastChannel
- **Answer rating & notes** — rate candidate answers and add per-question interviewer notes during a session
- **Session merge** — import a colleague's exported session into an existing candidate to combine feedback from multiple
  interviewers
- **Export / Import** — export and import questions, question sets, and full sessions as JSON or Markdown
- **Backup & Restore** — full application data backup to a `.filipa` file and restore via Settings
- **Offline-first** — hash-based routing and relative asset paths; the built `dist/` folder runs directly from `file://`
  without a server
- **Dark mode** — toggleable light/dark theme persisted in localStorage
- **Help page** — in-app documentation loaded from `help.md`; falls back to GitHub if the file is missing
- **Sample files** — `sample-questions.json`, `sample-questions.md`, `sample-question-sets.md` shipped alongside the
  build
