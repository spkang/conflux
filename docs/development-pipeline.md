# Development Pipeline

This document describes how to start Conflux locally, verify changes before a
push, and understand the GitHub Actions workflow.

## First-Run Setup

Conflux is a macOS-first Tauri desktop app with a Rust capability layer and a
React/TypeScript frontend.

Required tools:

- Rust stable with Cargo
- Node.js 22
- npm 10+
- actionlint 1.7+ for GitHub Actions validation

Install frontend dependencies:

```sh
npm --prefix app install
```

Install `actionlint` on macOS if it is missing:

```sh
brew install actionlint
```

## Start The App

Run the desktop app in development mode:

```sh
npm --prefix app run tauri:dev
```

The Tauri shell starts the Vite frontend through `beforeDevCommand` and opens
the Conflux workbench. The first screen should be the dense workspace UI, not a
marketing or onboarding page.

Expected startup checks:

- The app window opens as `Conflux`.
- The workbench renders panes for terminal/files/web workflows.
- The command palette can be opened from the UI.
- Creating or focusing terminal panes does not resize the surrounding layout
  unexpectedly.

## Local Verification

Run the smallest relevant command while iterating. Before pushing a change that
touches CI, Rust, frontend, or Tauri configuration, run the full local gate:

```sh
npm --prefix app run build
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
actionlint .github/workflows/ci.yml
```

Use the Tauri release build when changing native configuration, bundling, or
the app shell:

```sh
npm --prefix app run tauri:build
```

In this workspace, Tauri release output is written under `target/release/`.

## GitHub Actions

The CI workflow lives in `.github/workflows/ci.yml`.

Pull requests run:

- `frontend`: install app dependencies with `npm ci` and run the frontend
  production build.
- `rust`: run `cargo fmt --check`, `cargo clippy -D warnings`, and
  `cargo test --workspace`.

Pushes to `main` and manual `workflow_dispatch` runs also run:

- `tauri-build`: build the unsigned macOS Tauri release binary after the
  frontend and Rust gates pass.
- Upload the unsigned build artifact as `conflux-macos-unsigned`.

This pipeline does not sign, notarize, publish GitHub Releases, or upload DMG
installers. Add those only when Apple Developer credentials and release
secrets are ready.
