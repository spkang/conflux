import {
  Files,
  Globe2,
  LayoutGrid,
  PanelLeft,
  Search,
  SquareTerminal,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { CommandPalette, type Command } from "./components/CommandPalette";
import { FilesPane } from "./components/FilesPane";
import { PaneFrame } from "./components/PaneFrame";
import { TerminalPane } from "./components/TerminalPane";
import { WebPane } from "./components/WebPane";
import { ipc } from "./lib/ipc";
import type { PaneDescriptor, WorkspaceLayout } from "./lib/types";
import { createPane, workspaceReducer } from "./state/workspace";

export function App() {
  const [workspace, dispatch] = useReducer(workspaceReducer, null as WorkspaceLayout | null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [railCompact, setRailCompact] = useState(false);
  const root = useMemo(() => getWorkspaceRoot(workspace), [workspace]);

  useEffect(() => {
    void ipc.defaultLayout(null).then((layout) => dispatch({ type: "loaded", layout }));
  }, []);

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

  const duplicatePane = (pane: PaneDescriptor) => {
    dispatch({
      type: "addPane",
      pane: createPane(pane.kind, pane.title, pane.state),
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

  const visiblePanes = useMemo(() => {
    if (!workspace?.maximized_pane_id) {
      return workspace?.panes ?? [];
    }

    return workspace.panes.filter((pane) => pane.id === workspace.maximized_pane_id);
  }, [workspace]);

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
        icon: "search",
        run: addFiles,
      },
    ],
    [addFiles, addTerminal, addWeb, root],
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
            <span className="workspace-kicker">Workspace</span>
            <h1>{workspace.name}</h1>
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

        <div
          className={`pane-grid pane-grid--${visiblePanes.length} ${
            workspace.maximized_pane_id ? "is-maximized" : ""
          }`}
        >
          {visiblePanes.map((pane) => (
            <PaneFrame
              key={pane.id}
              pane={pane}
              active={workspace.active_pane_id === pane.id}
              maximized={workspace.maximized_pane_id === pane.id}
              onActivate={() => dispatch({ type: "activate", paneId: pane.id })}
              onClose={() => dispatch({ type: "closePane", paneId: pane.id })}
              onMaximize={() => dispatch({ type: "toggleMaximize", paneId: pane.id })}
              onSplit={() => duplicatePane(pane)}
            >
              <PaneContent pane={pane} onOpenTerminalHere={addTerminal} />
            </PaneFrame>
          ))}
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

function PaneContent({
  pane,
  onOpenTerminalHere,
}: {
  pane: PaneDescriptor;
  onOpenTerminalHere: (path: string) => void;
}) {
  if (pane.kind === "terminal") {
    return <TerminalPane pane={pane} />;
  }
  if (pane.kind === "files") {
    return <FilesPane pane={pane} onOpenTerminalHere={onOpenTerminalHere} />;
  }
  if (pane.kind === "web") {
    return <WebPane pane={pane} />;
  }

  return <div className="empty-state">Preview pane</div>;
}

function getWorkspaceRoot(workspace: WorkspaceLayout | null): string {
  if (!workspace) {
    return "";
  }

  for (const pane of workspace.panes) {
    const root = pane.state.root ?? pane.state.cwd;
    if (typeof root === "string" && root.length > 0) {
      return root;
    }
  }

  return "";
}
