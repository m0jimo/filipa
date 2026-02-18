# Filipa — Help & Documentation

Filipa is an interview assessment tool for IT developer candidates. All data is stored in your browser's IndexedDB.

## Want to use Filipa offline?

Download the [latest build](https://github.com/m0jimo/filipa/releases/download/latest/filipa.zip) —
unzip and open `dist/index.html` directly in your browser, no server needed.

---

## Features Overview

- **Questions Catalog** — create and manage a reusable library of interview questions
- **Question Sets** — group questions into themed sets (e.g. "Senior Backend", "JavaScript Basics")
- **Candidates** — track candidates across multiple interview sessions
- **Interview Session** — conduct a live interview with a dual-window view (interviewer + candidate screens)
- **Export / Import** — share questions, sets, and session results as JSON or Markdown files
- **Settings** — back up and restore all application data

---

## Questions Catalog

The Questions Catalog is your reusable question library.

Each question has:

- **Question text** — supports Markdown and inline images (see below)
- **Expected answer** — shown only to the interviewer
- **Tags** — for filtering (e.g. `java`, `backend`, `soft-skills`)
- **Difficulty** — one or more levels from 1 (beginner) to 10 (expert)
- **Type** — `text` or `rating` (see below)

### Question Types

**`rating`** — Asks the candidate to self-assess their skill level on a numeric scale (1–10). Useful for quickly gauging
familiarity with specific technologies or topics.

**`text`** — An open-ended question where the candidate gives a verbal answer. The interviewer takes notes and
optionally rates the response.

### Images in Questions

Images can be inserted directly into the question text using the image file selector in the editor toolbar. The image is
embedded as a Base64 data URI — no external hosting needed, and it works fully offline. The image will be visible in
both the interviewer view and the candidate window during the session.

**Import questions** using the import button — accepts `.json` or `.md` files. See
the **Sample Files & Import Examples** section below for downloadable samples.

---

## Question Sets

Question Sets let you bundle related questions together for a specific interview profile.

- Create a set, give it a name and optional notes
- Add questions (reference only) from the Catalog using the question browser
- Reorder questions
- Import/export sets as a Markdown file

See the **Sample Files & Import Examples** section below for a downloadable sample.

---

## Candidates & Sessions

Each **Candidate** can have multiple **Sessions** (e.g. technical interview, final round).

During a session:

1. Open the **Interview Session** view (interviewer screen)
2. Share the **Candidate Window** link — opens a read-only view showing only the current question
3. Rate answers, take notes, and mark questions as presented
4. Export the session as JSON or Markdown when done
5. Add questions from Question Catalog or set of questions from a Question set

You can also **import a colleague's exported session** into an existing candidate — Filipa will merge the questions and
answers into the candidate's record, making it easy to combine feedback from multiple interviewers.

---

## Import / Export Formats

### Markdown Format

Questions and sessions use a structured Markdown format. Headers and labels are parsed by exact pattern matching.

**Single questions file:**

```markdown
## Question 1

Question ID: <uuid>

### Question

Question text here.

### Expected Answer

Expected answer here.

Tags: tag1, tag2
Difficulty: [3, 4, 5]
Type: text
```

**Question sets file:**

```markdown
## Question Set: Set Name

Set ID: <uuid>
Notes: Optional notes

### Question

...
```

**Session export** adds `## Candidate Information` and `## Session Information` sections, plus `Candidate's Answer`,
`Interviewer's Notes`, and `Answer Rating` per question.

---

### JSON Format

The JSON format mirrors the full data model.

```json
{
  "version": "1.0.0",
  "candidate": {
    "firstName": "Jane",
    "lastName": "Doe"
  },
  "session": {
    "name": "Technical Interview",
    "date": "2026-02-16T09:00:00.000Z",
    "interviewers": [
      "Alice",
      "Bob"
    ]
  },
  "questions": [
    {
      "order": 1,
      "note": "Interviewer note",
      "questionRating": 8,
      "answer": "Candidate's answer",
      "question": {
        "question": "What is a closure in JavaScript?",
        "expectedAnswer": "A function that captures its lexical scope.",
        "tags": [
          "javascript",
          "fundamentals"
        ],
        "difficulty": [
          3,
          4,
          5
        ],
        "questionType": "text"
      }
    }
  ]
}
```

Fields marked optional: `id`, `hash`, `createdAt`, `updatedAt` — generated automatically if omitted.

---

## Sample Files & Import Examples

Download any of the sample files below and use the **Import** button in the corresponding section to try it out.

| File                                                   | Import Into       | Format   |
|--------------------------------------------------------|-------------------|----------|
| [`sample-questions.json`](./sample-questions.json)     | Questions Catalog | JSON     |
| [`sample-questions.md`](./sample-questions.md)         | Questions Catalog | Markdown |
| [`sample-question-sets.md`](./sample-question-sets.md) | Question Sets     | Markdown |

### How to import

**Questions Catalog:**

1. Go to **Questions Catalog**
2. Click the **Import** button
3. Select `sample-questions.json` or `sample-questions.md`

**Question Sets:**

1. Go to **Question Sets**
2. Click the **Import** button
3. Select `sample-question-sets.md`

> **Note:** Importing questions does not overwrite existing data — new questions are added alongside existing ones.
> Question sets reference questions by ID, so import the questions first before importing sets.

---

## Settings & Backup

The **Settings** page lets you:

- View storage statistics (question count, sessions, etc.)
- **Export Backup** — downloads a `.filipa` file with all data
- **Import Backup** — restores from a `.filipa` file
- **Clear User Preferences** — resets theme and other local settings
- **Danger Zone** — permanently deletes all application data

---

## Offline Usage

After building, the `dist/` folder is self-contained. You can:

- Open `index.html` directly in your browser (no server needed)
- Zip and share the folder for regulated environments
- Deploy to GitHub Pages or any static host

All `help.md`, `sample-*.json`, and `sample-*.md` files are included in `dist/` alongside `index.html`.
