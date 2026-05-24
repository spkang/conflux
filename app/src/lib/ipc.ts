import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { listen as tauriListen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  FileEntry,
  FileReadRequest,
  FileSearchQuery,
  FileTextDocument,
  FileWriteRequest,
  TerminalExitEvent,
  TerminalOutputEvent,
  TerminalSession,
  TerminalSpawnRequest,
  WebPanelConfig,
  WorkspaceLayout,
  WorkspaceSaveRequest,
} from "./types";

const isTauri = "__TAURI_INTERNALS__" in window;

async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri) {
    return mockInvoke<T>(command, args);
  }

  return tauriInvoke<T>(command, args);
}

async function listen<T>(event: string, handler: (payload: T) => void): Promise<UnlistenFn> {
  if (!isTauri) {
    return () => undefined;
  }

  return tauriListen<T>(event, ({ payload }) => handler(payload));
}

export const ipc = {
  defaultLayout(root?: string | null) {
    return invoke<WorkspaceLayout>("workspace_default_layout", { root: root ?? null });
  },
  saveLayout(layout: WorkspaceLayout) {
    const request: WorkspaceSaveRequest = { layout };
    return invoke<WorkspaceLayout>("workspace_save_layout", { request });
  },
  spawnTerminal(request: TerminalSpawnRequest) {
    return invoke<TerminalSession>("terminal_spawn", { request });
  },
  writeTerminal(sessionId: string, bytes: string) {
    return invoke<void>("terminal_write", {
      request: { session_id: sessionId, bytes },
    });
  },
  resizeTerminal(sessionId: string, cols: number, rows: number) {
    return invoke<TerminalSession>("terminal_resize", {
      request: { session_id: sessionId, cols, rows },
    });
  },
  killTerminal(sessionId: string) {
    return invoke<void>("terminal_kill", { sessionId });
  },
  searchFiles(query: FileSearchQuery) {
    return invoke<FileEntry[]>("files_search", { query });
  },
  readTextFile(request: FileReadRequest) {
    return invoke<FileTextDocument>("files_read_text", { request });
  },
  writeTextFile(request: FileWriteRequest) {
    return invoke<FileTextDocument>("files_write_text", { request });
  },
  normalizeUrl(input: string) {
    return invoke<WebPanelConfig>("webpanel_normalize_url", { input });
  },
  onTerminalOutput(handler: (event: TerminalOutputEvent) => void) {
    return listen<TerminalOutputEvent>("terminal://output", handler);
  },
  onTerminalExit(handler: (event: TerminalExitEvent) => void) {
    return listen<TerminalExitEvent>("terminal://exit", handler);
  },
};

let mockWorkspace: WorkspaceLayout | null = null;

async function mockInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (command === "workspace_default_layout") {
    if (mockWorkspace) {
      return mockWorkspace as T;
    }

    const layout: WorkspaceLayout = {
      id: "mock-workspace",
      name: "Default task",
      project: {
        id: "mock-project",
        name: "conflux",
        root: "/Users/spkang/dev/agents/conflux",
        active_task_id: "mock-task",
        updated_at: new Date().toISOString(),
      },
      task: {
        id: "mock-task",
        project_id: "mock-project",
        title: "Default task",
        notes_path: "/Users/spkang/dev/agents/conflux/.conflux/notes/default.md",
        updated_at: new Date().toISOString(),
      },
      panes: [
        {
          id: "terminal-1",
          kind: "terminal",
          title: "AI Terminal",
          state: { cwd: "/Users/spkang/dev/agents/conflux" },
          capabilities: ["split", "resize", "maximize", "close"],
        },
        {
          id: "notes-1",
          kind: "editor",
          title: "Task notes",
          state: {
            root: "/Users/spkang/dev/agents/conflux",
            path: "/Users/spkang/dev/agents/conflux/.conflux/notes/default.md",
          },
          capabilities: ["split", "resize", "maximize", "close", "save"],
        },
        {
          id: "files-1",
          kind: "files",
          title: "Files",
          state: { root: "/Users/spkang/dev/agents/conflux" },
          capabilities: ["split", "resize", "maximize", "close", "search"],
        },
      ],
      pane_tree: {
        kind: "split",
        id: "mock-split-root",
        axis: "horizontal",
        ratio: 0.68,
        first: {
          kind: "split",
          id: "mock-split-left",
          axis: "vertical",
          ratio: 0.56,
          first: { kind: "leaf", pane_id: "terminal-1" },
          second: { kind: "leaf", pane_id: "notes-1" },
        },
        second: { kind: "leaf", pane_id: "files-1" },
      },
      active_pane_id: "terminal-1",
      maximized_pane_id: null,
      updated_at: new Date().toISOString(),
    };
    mockWorkspace = layout;
    return layout as T;
  }

  if (command === "workspace_save_layout") {
    const request = (args?.request ?? {}) as WorkspaceSaveRequest;
    mockWorkspace = request.layout;
    return request.layout as T;
  }

  if (command === "terminal_spawn") {
    const request = (args?.request ?? {}) as TerminalSpawnRequest;
    const session: TerminalSession = {
      id: `mock-terminal-${Math.random().toString(16).slice(2)}`,
      cwd: request.cwd ?? "/Users/spkang/dev/agents/conflux",
      shell: request.shell ?? "/bin/zsh",
      cols: request.cols,
      rows: request.rows,
      started_at: new Date().toISOString(),
    };
    return session as T;
  }

  if (command === "files_search") {
    const entries: FileEntry[] = [
      {
        path: "/Users/spkang/dev/agents/conflux/src-tauri/src/main.rs",
        name: "main.rs",
        is_dir: false,
        size: 3200,
        score: 10,
      },
      {
        path: "/Users/spkang/dev/agents/conflux/app/src/App.tsx",
        name: "App.tsx",
        is_dir: false,
        size: 8800,
        score: 7,
      },
    ];
    return entries as T;
  }

  if (command === "files_read_text") {
    const request = (args?.request ?? {}) as FileReadRequest;
    const contents = request.path.endsWith(".md")
      ? "# Default task\n\n- Capture useful context here.\n"
      : "";
    return {
      path: request.path,
      contents,
      modified_at: new Date().toISOString(),
    } as T;
  }

  if (command === "files_write_text") {
    const request = (args?.request ?? {}) as FileWriteRequest;
    return {
      path: request.path,
      contents: request.contents,
      modified_at: new Date().toISOString(),
    } as T;
  }

  if (command === "webpanel_normalize_url") {
    const input = String(args?.input ?? "example.com");
    const url = input.includes("://") ? input : `https://${input}`;
    const config: WebPanelConfig = { url, title: new URL(url).hostname.replace(/^www\./, "") };
    return config as T;
  }

  return undefined as T;
}
