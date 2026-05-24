import {
  Edit3,
  Files,
  Globe2,
  LayoutGrid,
  NotebookTabs,
  PanelLeft,
  Search,
  SquareTerminal,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { CommandPalette, type Command } from "./components/CommandPalette";
import { EditorPane } from "./components/EditorPane";
import { FilesPane } from "./components/FilesPane";
import { PaneFrame } from "./components/PaneFrame";
import { TerminalPane } from "./components/TerminalPane";
import { WebPane } from "./components/WebPane";
import { ipc } from "./lib/ipc";
import type { PaneDescriptor, PaneTreeNode, SplitAxis, WorkspaceLayout } from "./lib/types";
import { createPane, workspaceReducer } from "./state/workspace";

export function App() {
  const [workspace, dispatch] = useReducer(workspaceReducer, null as WorkspaceLayout | null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [railCompact, setRailCompact] = useState(false);
  const [draggedPaneId, setDraggedPaneId] = useState<string | null>(null);
  const root = useMemo(() => getWorkspaceRoot(workspace), [workspace]);

  useEffect(() => {
    void ipc.defaultLayout(null).then((layout) => dispatch({ type: "loaded", layout }));
  }, []);

  useEffect(() => {
    if (!workspace) {
      return;
    }

    const timer = window.setTimeout(() => {
      void ipc.saveLayout({
        ...workspace,
        updated_at: new Date().toISOString(),
      });
    }, 350);

    return () => window.clearTimeout(timer);
  }, [workspace]);

  const addTerminal = useCallback((cwd = root) => {
    dispatch({
      type: "addPane",
      pane: createPane("terminal", "Terminal", { cwd }),
    });
  }, [root]);

  const addFiles = useCallback(() => {
    dispatch({
      type: "addPane",
      pane: createPane("files", "Files", { root }),
    });
  }, [root]);

  const openFile = useCallback((path: string) => {
    dispatch({
      type: "addPane",
      pane: createPane("editor", basename(path), { root, path }),
    });
  }, [root]);

  const openTaskNotes = useCallback(() => {
    if (!workspace) {
      return;
    }

    dispatch({
      type: "addPane",
      pane: createPane("editor", "Task notes", {
        root: workspace.project.root,
        path: workspace.task.notes_path,
      }),
    });
  }, [workspace]);

  const openEditorPrompt = useCallback(() => {
    const input = window.prompt("Open file path", root);
    if (!input) {
      return;
    }
    openFile(input);
  }, [openFile, root]);

  const addWeb = useCallback(async () => {
    const input = window.prompt("Open URL", "https://docs.rs/");
    if (!input) {
      return;
    }

    const config = await ipc.normalizeUrl(input);
    dispatch({
      type: "addPane",
      pane: createPane("web", config.title, { url: config.url }),
    });
  }, []);

  const splitPane = (pane: PaneDescriptor, axis: SplitAxis) => {
    dispatch({
      type: "splitPane",
      paneId: pane.id,
      pane: createPane(pane.kind, pane.title, pane.state),
      axis,
    });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }
      if (mod && event.key.toLowerCase() === "n") {
        event.preventDefault();
        addTerminal();
      }
      if (mod && event.key === "Enter" && workspace?.active_pane_id) {
        event.preventDefault();
        dispatch({ type: "toggleMaximize", paneId: workspace.active_pane_id });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [addTerminal, workspace]);

  const commands: Command[] = useMemo(
    () => [
      {
        id: "new-terminal",
        label: "New terminal",
        detail: root,
        icon: "terminal",
        run: () => addTerminal(),
      },
      {
        id: "new-web",
        label: "Open web panel",
        detail: "Normalize URL and add a browser pane",
        icon: "web",
        run: addWeb,
      },
      {
        id: "new-files",
        label: "Open file search",
        detail: root,
        icon: "files",
        run: addFiles,
      },
      {
        id: "open-editor",
        label: "Open editor",
        detail: "Open a project file by path",
        icon: "editor",
        run: openEditorPrompt,
      },
      {
        id: "task-notes",
        label: "Open task notes",
        detail: workspace?.task.notes_path ?? ".conflux/notes/default.md",
        icon: "notes",
        run: openTaskNotes,
      },
    ],
    [addFiles, addTerminal, addWeb, openEditorPrompt, openTaskNotes, root, workspace?.task.notes_path],
  );

  if (!workspace) {
    return <div className="boot-screen">Conflux</div>;
  }

  return (
    <main className="app-shell">
      <aside className={`activity-rail ${railCompact ? "is-compact" : ""}`}>
        <button
          type="button"
          className="rail-toggle"
          title="Toggle rail"
          onClick={() => setRailCompact((value) => !value)}
        >
          <PanelLeft size={18} />
        </button>
        <div className="rail-brand">
          <LayoutGrid size={19} />
          <span>Conflux</span>
        </div>
        <nav className="rail-nav">
          <button type="button" title="New terminal" onClick={() => addTerminal()}>
            <SquareTerminal size={18} />
            <span>Terminal</span>
          </button>
          <button type="button" title="Open URL" onClick={addWeb}>
            <Globe2 size={18} />
            <span>Web</span>
          </button>
          <button type="button" title="Find files" onClick={addFiles}>
            <Files size={18} />
            <span>Files</span>
          </button>
          <button type="button" title="Open notes" onClick={openTaskNotes}>
            <NotebookTabs size={18} />
            <span>Notes</span>
          </button>
          <button type="button" title="Open editor" onClick={openEditorPrompt}>
            <Edit3 size={18} />
            <span>Editor</span>
          </button>
          <button type="button" title="Command palette" onClick={() => setPaletteOpen(true)}>
            <Search size={18} />
            <span>Command</span>
          </button>
        </nav>
        <div className="rail-footer">
          <strong>{workspace.panes.length}</strong>
          <span>panes</span>
        </div>
      </aside>

      <section className="workspace">
        <header className="workspace-topbar">
          <div>
            <span className="workspace-kicker">{workspace.project.name}</span>
            <h1>{workspace.task.title}</h1>
          </div>
          <div className="workspace-actions">
            <button type="button" onClick={() => setPaletteOpen(true)}>
              <Search size={16} />
              <span>Command</span>
            </button>
            <button type="button" onClick={() => addTerminal()}>
              <SquareTerminal size={16} />
              <span>Terminal</span>
            </button>
          </div>
        </header>

        <div className={`pane-workspace ${workspace.maximized_pane_id ? "is-maximized" : ""}`}>
          <PaneTreeView
            node={
              workspace.maximized_pane_id
                ? { kind: "leaf", pane_id: workspace.maximized_pane_id }
                : workspace.pane_tree
            }
            panes={workspace.panes}
            activePaneId={workspace.active_pane_id}
            maximizedPaneId={workspace.maximized_pane_id}
            draggedPaneId={draggedPaneId}
            onActivate={(paneId) => dispatch({ type: "activate", paneId })}
            onClose={(paneId) => dispatch({ type: "closePane", paneId })}
            onMaximize={(paneId) => dispatch({ type: "toggleMaximize", paneId })}
            onSplit={splitPane}
            onDragPane={setDraggedPaneId}
            onDropPane={(targetPaneId) => {
              if (draggedPaneId && draggedPaneId !== targetPaneId) {
                dispatch({ type: "swapPanes", sourcePaneId: draggedPaneId, targetPaneId });
              }
              setDraggedPaneId(null);
            }}
            onResizeSplit={(splitId, ratio) => dispatch({ type: "resizeSplit", splitId, ratio })}
            onOpenTerminalHere={addTerminal}
            onOpenFile={openFile}
            onRenamePane={(paneId, title) => dispatch({ type: "renamePane", paneId, title })}
          />
        </div>
      </section>

      <CommandPalette
        open={paletteOpen}
        commands={commands}
        onClose={() => setPaletteOpen(false)}
      />
    </main>
  );
}

type PaneTreeViewProps = {
  node: PaneTreeNode;
  panes: PaneDescriptor[];
  activePaneId: string | null;
  maximizedPaneId: string | null;
  draggedPaneId: string | null;
  onActivate: (paneId: string) => void;
  onClose: (paneId: string) => void;
  onMaximize: (paneId: string) => void;
  onSplit: (pane: PaneDescriptor, axis: SplitAxis) => void;
  onDragPane: (paneId: string) => void;
  onDropPane: (paneId: string) => void;
  onResizeSplit: (splitId: string, ratio: number) => void;
  onOpenTerminalHere: (path: string) => void;
  onOpenFile: (path: string) => void;
  onRenamePane: (paneId: string, title: string) => void;
};

function PaneTreeView(props: PaneTreeViewProps) {
  const { node, panes } = props;

  if (node.kind === "leaf") {
    const pane = panes.find((candidate) => candidate.id === node.pane_id);
    if (!pane) {
      return <div className="empty-state">Missing pane</div>;
    }

    return (
      <PaneFrame
        pane={pane}
        active={props.activePaneId === pane.id}
        maximized={props.maximizedPaneId === pane.id}
        onActivate={() => props.onActivate(pane.id)}
        onClose={() => props.onClose(pane.id)}
        onMaximize={() => props.onMaximize(pane.id)}
        onSplit={(axis) => props.onSplit(pane, axis)}
        onDragPane={props.onDragPane}
        onDropPane={props.onDropPane}
      >
        <PaneContent
          pane={pane}
          onOpenTerminalHere={props.onOpenTerminalHere}
          onOpenFile={props.onOpenFile}
          onRename={(title) => props.onRenamePane(pane.id, title)}
        />
      </PaneFrame>
    );
  }

  const firstSize = `${node.ratio * 100}%`;
  const secondSize = `${(1 - node.ratio) * 100}%`;
  const style =
    node.axis === "horizontal"
      ? { gridTemplateColumns: `${firstSize} 6px ${secondSize}` }
      : { gridTemplateRows: `${firstSize} 6px ${secondSize}` };

  return (
    <div className={`pane-split pane-split--${node.axis}`} style={style}>
      <PaneTreeView {...props} node={node.first} />
      <SplitHandle node={node} onResize={props.onResizeSplit} />
      <PaneTreeView {...props} node={node.second} />
    </div>
  );
}

function SplitHandle({
  node,
  onResize,
}: {
  node: Extract<PaneTreeNode, { kind: "split" }>;
  onResize: (splitId: string, ratio: number) => void;
}) {
  return (
    <div
      className="pane-split__handle"
      role="separator"
      onPointerDown={(event) => {
        const container = event.currentTarget.parentElement;
        if (!container) {
          return;
        }
        const rect = container.getBoundingClientRect();
        const pointerId = event.pointerId;
        event.currentTarget.setPointerCapture(pointerId);

        const onPointerMove = (moveEvent: PointerEvent) => {
          const ratio =
            node.axis === "horizontal"
              ? (moveEvent.clientX - rect.left) / rect.width
              : (moveEvent.clientY - rect.top) / rect.height;
          onResize(node.id, ratio);
        };
        const onPointerUp = () => {
          window.removeEventListener("pointermove", onPointerMove);
          window.removeEventListener("pointerup", onPointerUp);
        };

        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);
      }}
    />
  );
}

function PaneContent({
  pane,
  onOpenTerminalHere,
  onOpenFile,
  onRename,
}: {
  pane: PaneDescriptor;
  onOpenTerminalHere: (path: string) => void;
  onOpenFile: (path: string) => void;
  onRename: (title: string) => void;
}) {
  if (pane.kind === "terminal") {
    return <TerminalPane pane={pane} />;
  }
  if (pane.kind === "files") {
    return <FilesPane pane={pane} onOpenTerminalHere={onOpenTerminalHere} onOpenFile={onOpenFile} />;
  }
  if (pane.kind === "web") {
    return <WebPane pane={pane} />;
  }
  if (pane.kind === "editor") {
    return <EditorPane pane={pane} onRename={onRename} />;
  }

  return <div className="empty-state">Preview pane</div>;
}

function basename(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? "Editor";
}

function getWorkspaceRoot(workspace: WorkspaceLayout | null): string {
  if (!workspace) {
    return "";
  }

  if (workspace.project.root) {
    return workspace.project.root;
  }

  for (const pane of workspace.panes) {
    const root = pane.state.root ?? pane.state.cwd;
    if (typeof root === "string" && root.length > 0) {
      return root;
    }
  }

  return "";
}
