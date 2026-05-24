# Workbench Design

Conflux is a dense macOS-first workbench for AI-assisted development. The app
is organized around project task context rather than standalone tools: terminals,
files, web panels, and notes all live inside one restorable workspace.

## Product Model

The primary hierarchy is:

- `Project`: a local root path, usually a repository.
- `Task`: a saved work context inside a project.
- `Pane`: a tool instance inside the task workspace.

The current implementation creates a default project from the current directory
and a default task with notes at:

```text
.conflux/notes/default.md
```

Workspace layout is saved locally at:

```text
.conflux/tasks/default-layout.json
```

This keeps task context close to the repository while leaving git tracking to
the project policy.

## Pane System

Every tool is represented as a pane with typed shared state from
`conflux-core`. The frontend renders panes through a tiled `PaneTreeNode`
layout:

- Leaf nodes point to pane ids.
- Split nodes store axis and ratio.
- Panes can be split horizontally or vertically.
- Split handles resize the pane tree.
- Pane title bars can be dragged onto another pane to swap locations.
- Active panes can be maximized and restored.

This keeps the workbench stable and keyboard-friendly while still supporting
custom task layouts.

## Current Panes

### Terminal

Terminal panes are embedded PTY sessions rendered with xterm.js. Rust owns PTY
spawn, resize, input, output, and termination. Terminal output is streamed to
the frontend through Tauri events.

### Files

Files panes provide project-root navigation through fuzzy search. File discovery
respects git ignore rules. Double-clicking a directory opens a terminal at that
path; double-clicking a file opens an editor pane.

### Editor

Editor panes read and write text files through explicit Tauri commands. Rust
validates that file paths remain inside the project root before reading or
writing. Markdown files support a lightweight preview column.

The current editor is intentionally minimal and dependency-light. A future
CodeMirror or Monaco integration can replace the text area without changing the
pane model or Rust file boundary.

### Web

Web panes are workflow browser panels, not a full browser replacement. They
support address entry, back, forward, reload, and opening the current URL
externally. The intended use cases are docs, dashboards, and local services.

## Command Flow

The command palette is the primary action router. Current commands include:

- New terminal.
- Open web panel.
- Open file search.
- Open editor by path.
- Open task notes.

Rail buttons expose the same core actions for mouse-driven workflows.

## Architecture Boundaries

Rust remains the system capability layer:

- Terminal process lifecycle.
- File search and project-root file read/write.
- URL normalization and validation.
- Workspace layout persistence.

React remains the composition layer:

- Pane tree rendering and resizing.
- Pane activation, split, swap, close, and maximize behavior.
- Editor dirty state and Markdown preview.
- Command palette and rail actions.

Shared serializable types live in `conflux-core` before they are exposed through
Tauri commands.

## Verification

Use the same local gates described in the development pipeline:

```sh
cargo fmt --all -- --check
cargo test --workspace
npm --prefix app run build
```

For UI iteration, run:

```sh
npm --prefix app run dev -- --port 5174
```
