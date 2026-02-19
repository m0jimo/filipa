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

## Deployment Notes

- Deployed to static hosting - GitHub Pages
- Zipped and shared for offline usage in regulated environments
