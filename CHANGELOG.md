# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

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
