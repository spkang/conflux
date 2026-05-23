export type PaneKind = "terminal" | "web" | "files" | "preview";

export type PaneCapability =
  | "split"
  | "resize"
  | "maximize"
  | "close"
  | "reload"
  | "search";

export type PaneDescriptor = {
  id: string;
  kind: PaneKind;
  title: string;
  state: Record<string, unknown>;
  capabilities: PaneCapability[];
};

export type WorkspaceLayout = {
  id: string;
  name: string;
  panes: PaneDescriptor[];
  active_pane_id: string | null;
  maximized_pane_id: string | null;
  updated_at: string;
};

export type TerminalSpawnRequest = {
  cwd?: string | null;
  shell?: string | null;
  cols: number;
  rows: number;
};

export type TerminalSession = {
  id: string;
  cwd: string;
  shell: string;
  cols: number;
  rows: number;
  started_at: string;
};

export type TerminalOutputEvent = {
  session_id: string;
  chunk: string;
};

export type TerminalExitEvent = {
  session_id: string;
  exit_code?: number | null;
};

export type FileSearchQuery = {
  root: string;
  query: string;
  limit: number;
  include_hidden: boolean;
};

export type FileEntry = {
  path: string;
  name: string;
  is_dir: boolean;
  size?: number | null;
  score: number;
};

export type WebPanelConfig = {
  url: string;
  title: string;
};

