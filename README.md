<div align="center">
  <img src="public/filipaLogo.svg" alt="Filipa logo" width="96" height="96" />

# Filipa

**Interview assessment tool for (technical) candidate interviews**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Svelte](https://img.shields.io/badge/Svelte-5-FF3E00?logo=svelte&logoColor=white)](https://svelte.dev)
[![Built with WebStorm](https://img.shields.io/badge/Built%20with-WebStorm-00D2FF?logo=webstorm&logoColor=white)](https://www.jetbrains.com/webstorm/)
[![Built with Claude](https://img.shields.io/badge/Built%20with-Claude-D97757?logo=anthropic&logoColor=white)](https://claude.ai/code)
[![TypeScript](https://img.shields.io/github/languages/top/m0jimo/filipa?color=3178C6&logo=typescript&logoColor=white)](https://github.com/m0jimo/filipa)
</div>

## Application Preview

![Filipa Candidate Window](docs/Filipa-Candidate-Window.png)

## Features

Filipa is designed for conducting interviews, originally focused on IT candidates. The application provides

- **Dual-view interface**: Separate synchronized views for the interviewer and the candidate
- **Question management**: Load and manage interview question sets with expected answers
- **Real-time assessment**: Take notes and rate candidate responses during the interview
- **Markdown-based**: Questions and answers stored in portable markdown or JSON files
- **Offline-capable**: Works without an internet connection, just open `index.html`
- **Import/Export**: Questions, candidates, or individual sessions can be shared with colleagues

I was looking for a simple way to present questions to candidates during an interview. I am a big fan of the markdown
format because it is easily readable in raw form and can also be converted to HTML with custom styles.

The main idea was to keep questions, candidate answers, and notes in a single file without needing a server or other
complex infrastructure, which would be problematic to run in highly controlled environments.

I ended up with the following workflow:

### Questions Catalog

- Questions can be created inside the application.
- Questions can be imported from JSON or markdown files.
- A `config.json` file placed next to `index.html` defines the mapping for importing from `.md` files.
- Duplicate question detection is included.

### Candidates

- Multiple candidates with multiple sessions are supported.
- Each session can represent a different question area. For example, one interviewer can cover backend questions and
  another can cover frontend.
- Each session keeps a copy of the questions selected from the catalog.
- Candidate sessions can be exported or imported, allowing data from two separate Filipa instances to be combined.
- Questions can be added to the current session on the fly.

### Technical Details

- Hash-based routing allows the app to be opened directly in a browser from a local file without running a server.
- IndexedDB is used for sufficient storage space.
- A backup feature keeps all data in one place.
- The Candidate View can be opened in a separate browser window and questions can be shown from your Session page as
  needed.

### Development Background

I had this kind of application in mind for a long time, but never had the time to work on it, even though it served a
real business need. Thanks to Claude Sonnet (CLI), I was able to create a basic functional version in 8 hours.

I use React at work, but I chose Svelte here to keep the built application small and to step outside the React world for
a while.

## Getting Started

**Try it online**: [https://m0jimo.github.io/filipa/](https://m0jimo.github.io/filipa/)

Or download the built application and open `index.html` in your browser.

# Application Development

## Prerequisites

- Node.js (v22 or newer recommended)
- npm, pnpm, or yarn

### 1. Install Dependencies

```bash
npm install
```

### 2. Development Mode

```bash
npm run dev
```

This will start the development server at `http://localhost:5173`.

### 3. Build for Production

```bash
npm run build
```

This creates a `dist/` folder with all compiled files.

## Using the Built Application

After running `npm run build`, you can:

### Option 1: Open Directly in Browser

1. Navigate to the `dist/` folder
2. Double-click `index.html` or open it via File > Open in your browser
3. The app works completely offline using the `file://` protocol

### Option 2: Deploy to a Web Server

- Upload the entire `dist/` folder to any static hosting service
- Compatible with GitHub Pages, Netlify, Vercel, AWS S3, and others

### Option 3: Share as a Zip File

- Zip the `dist/` folder
- Send it to users who can extract and open `index.html` locally
- Ideal for regulated environments where internet access is restricted

## Deployment to GitHub

```bash
# Initialize git repository
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit"

# Add remote repository
git remote add origin https://github.com/m0jimo/filipa.git

# Push to GitHub
git push -u origin main
```

## About the Name

*Filipa* comes from Czech phrase "mit filipa" which is idiom used to describe somebody who is smart, sharp or with good
practical sense.

## License

MIT (c) [Ota Vaclavik](https://github.com/m0jimo) — see [LICENSE](LICENSE) for details.
