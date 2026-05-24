export type PaneKind = "terminal" | "web" | "files" | "editor" | "markdown_preview" | "preview";

export type PaneCapability =
  | "split"
  | "resize"
  | "maximize"
  | "close"
  | "reload"
  | "search"
  | "save"
  | "back"
  | "forward";

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
  project: ProjectDescriptor;
  task: TaskDescriptor;
  panes: PaneDescriptor[];
  pane_tree: PaneTreeNode;
  active_pane_id: string | null;
  maximized_pane_id: string | null;
  updated_at: string;
};

export type WorkspaceSaveRequest = {
  layout: WorkspaceLayout;
};

export type ProjectDescriptor = {
  id: string;
  name: string;
  root: string;
  active_task_id: string | null;
  updated_at: string;
};

export type TaskDescriptor = {
  id: string;
  project_id: string;
  title: string;
  notes_path: string;
  updated_at: string;
};

export type SplitAxis = "horizontal" | "vertical";

export type PaneTreeNode =
  | { kind: "leaf"; pane_id: string }
  | {
      kind: "split";
      id: string;
      axis: SplitAxis;
      ratio: number;
      first: PaneTreeNode;
      second: PaneTreeNode;
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

export type FileReadRequest = {
  root: string;
  path: string;
};

export type FileWriteRequest = {
  root: string;
  path: string;
  contents: string;
};

export type FileTextDocument = {
  path: string;
  contents: string;
  modified_at?: string | null;
};

export type WebPanelConfig = {
  url: string;
  title: string;
};
