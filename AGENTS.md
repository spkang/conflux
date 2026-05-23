# AGENTS.md

This repository builds Conflux, a macOS-first desktop workbench using Rust,
Tauri, React, and TypeScript.

## Build Goal

Build a fast, composable desktop workspace for developer and operator workflows.
The first product target is a single app that can host and arrange:

- Embedded terminal sessions.
- Web panels for docs, dashboards, and local services.
- Local file search and file-oriented actions.
- A command palette that routes all primary actions.

The main user experience is the workbench itself. Do not add a marketing
landing page or onboarding shell as the first screen.

## Architecture Constraints

- Keep Rust as the system capability layer: PTY, filesystem, URL validation,
  persistence, and native integration belong behind explicit Tauri commands or
  events.
- Keep React as the composition layer: layout, pane state, command palette, and
  visual interaction belong in the frontend.
- Preserve Unix-style boundaries: each crate should do one job and communicate
  through small, serializable types from `conflux-core`.
- Treat every tool as a pane. New capabilities should implement the pane model
  instead of creating one-off full-page flows.
- Keep IPC explicit. Add typed request/response structs in `conflux-core` before
  adding new commands.
- Prefer streaming events for long-running or incremental system output, such as
  terminal output and future indexing progress.
- Keep macOS behavior first, but avoid unnecessary platform lock-in inside core
  crates.

## UI Constraints

- The app should feel like a dense, quiet workbench, not a SaaS landing page.
- Use stable pane dimensions and controls that do not shift layout.
- Use icon buttons for tool actions, with titles/tooltips for clarity.
- Avoid card-in-card layouts and decorative visual clutter.
- Preserve fast keyboard workflows: command palette, new terminal, pane focus,
  split, maximize, and close should remain first-class.

## Development Commands

Install dependencies:

```sh
npm --prefix app install
```

Run the desktop app:

```sh
npm --prefix app run tauri:dev
```

Build frontend:

```sh
npm --prefix app run build
```

Run Rust tests:

```sh
cargo test --workspace
```

## Repository Hygiene

- Do not commit `target/`, `node_modules/`, or `app/dist/`.
- Keep generated lockfiles that define reproducible builds, including
  `Cargo.lock` and `app/package-lock.json`.
- For code edits, run the smallest relevant verification command before
  committing.
- Do not broaden dependencies or introduce global state unless the workbench
  architecture requires it.
