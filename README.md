# Conflux

Conflux is a macOS-first desktop workbench built with Rust, Tauri, React, and
TypeScript. It brings terminals, web panels, and local file search into one
composable workspace.

The app follows a small-core architecture:

- Rust owns system capabilities: PTY sessions, file discovery, URL validation,
  and workspace-facing commands.
- React owns composition: split panes, tabs, command actions, and visual state.
- Each tool is a pane with explicit state, so panes can be split, resized,
  maximized, closed, and restored without special-case page logic.

## Current Status

The initial app foundation is implemented:

- Tauri 2 desktop shell with Rust commands for workspace layout, terminal
  sessions, file search, and URL normalization.
- Cargo workspace split into `core`, `terminal`, `files`, and `webpanel`
  crates.
- PTY-backed terminal sessions through `portable-pty`, streamed to the frontend
  with Tauri events.
- React + TypeScript workbench with activity rail, command palette, pane grid,
  terminal pane, file search pane, and web pane.
- xterm.js terminal rendering with resize handling.
- Lightweight local file search that respects git ignore rules.
- CI workflow for frontend build, Rust formatting/lint/test gates, and macOS
  Tauri build verification, with local `actionlint` validation documented.

Verified locally:

```sh
cargo test --workspace
npm --prefix app run build
npm --prefix app run tauri:dev
```

## Development

Prerequisites:

- Rust toolchain with Cargo
- Node.js 22
- npm 10+

Install Rust with rustup if needed:

```sh
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"
```

Install frontend dependencies:

```sh
npm --prefix app install
```

Run the desktop app:

```sh
npm --prefix app run tauri:dev
```

Build frontend only:

```sh
npm --prefix app run build
```

Run Rust tests:

```sh
cargo test --workspace
```

Run the full local verification gate:

```sh
npm --prefix app run build
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
actionlint .github/workflows/ci.yml
```

See [Development Pipeline](docs/development-pipeline.md) for first-run setup,
startup checks, CI behavior, and release-build verification.

## Source Layout

- `src-tauri/` contains the Tauri app shell, command registration, and desktop
  configuration.
- `crates/core/` contains shared domain types for panes, workspace layout,
  terminal sessions, files, and web panels.
- `crates/terminal/` owns PTY process lifecycle, input, output, resize, and
  termination.
- `crates/files/` owns local file discovery and fuzzy search.
- `crates/webpanel/` owns URL normalization and validation.
- `app/` contains the React frontend, pane components, IPC wrapper, and styling.
