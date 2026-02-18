# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

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

- **Questions Catalog** — create, edit, and delete reusable interview questions with Markdown support, tags, difficulty levels, and question types (`text`, `rating`)
- **Images in questions** — embed images directly into question text via Base64 encoding; works fully offline
- **Question Sets** — group questions (by reference) into named sets for specific interview profiles; import/export as Markdown
- **Candidates** — manage a list of candidates with notes and creation timestamps
- **Interview Sessions** — conduct structured interviews with multiple sessions per candidate; add questions from the catalog or a question set during a session
- **Dual-window view** — separate interviewer screen and read-only candidate window showing only the current question; synchronized via BroadcastChannel
- **Answer rating & notes** — rate candidate answers and add per-question interviewer notes during a session
- **Session merge** — import a colleague's exported session into an existing candidate to combine feedback from multiple interviewers
- **Export / Import** — export and import questions, question sets, and full sessions as JSON or Markdown
- **Backup & Restore** — full application data backup to a `.filipa` file and restore via Settings
- **Offline-first** — hash-based routing and relative asset paths; the built `dist/` folder runs directly from `file://` without a server
- **Dark mode** — toggleable light/dark theme persisted in localStorage
- **Help page** — in-app documentation loaded from `help.md`; falls back to GitHub if the file is missing
- **Sample files** — `sample-questions.json`, `sample-questions.md`, `sample-question-sets.md` shipped alongside the build
