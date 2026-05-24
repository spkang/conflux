# Conflux

Conflux is a macOS-first desktop workbench built with Rust, Tauri, React, and
TypeScript. It brings terminals, web panels, file navigation, text editing, and
task notes into one composable workspace for AI-assisted development.

The app follows a small-core architecture:

- Rust owns system capabilities: PTY sessions, file discovery, URL validation,
  and workspace-facing commands.
- React owns composition: tiled panes, command actions, editor state, and visual
  interaction.
- Each tool is a pane with explicit state, so panes can be split, resized,
  maximized, closed, and restored without special-case page logic.

## Current Status

The initial app foundation is implemented:

- Tauri 2 desktop shell with Rust commands for workspace layout, terminal
  sessions, file search, text file read/write, and URL normalization.
- Cargo workspace split into `core`, `terminal`, `files`, and `webpanel`
  crates.
- PTY-backed terminal sessions through `portable-pty`, streamed to the frontend
  with Tauri events.
- React + TypeScript workbench with activity rail, command palette, persisted
  tiled pane tree, terminal pane, file pane, editor pane, and web pane.
- xterm.js terminal rendering with resize handling.
- Lightweight local file search that respects git ignore rules and opens files
  into editor panes.
- Project/task metadata with task notes stored under `.conflux/`.
- Local workspace restore through `.conflux/tasks/default-layout.json`.
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
startup checks, CI behavior, and release-build verification. See
[Workbench Design](docs/workbench-design.md) for the current product and
architecture shape.

## Source Layout

- `src-tauri/` contains the Tauri app shell, command registration, and desktop
  configuration.
- `crates/core/` contains shared domain types for projects, tasks, pane trees,
  workspace layout, terminal sessions, files, and web panels.
- `crates/terminal/` owns PTY process lifecycle, input, output, resize, and
  termination.
- `crates/files/` owns local file discovery, fuzzy search, and project-root
  constrained text file read/write.
- `crates/webpanel/` owns URL normalization and validation.
- `app/` contains the React frontend, pane components, IPC wrapper, and styling.
