import type { PaneDescriptor, WorkspaceLayout } from "../lib/types";

export type WorkspaceAction =
  | { type: "loaded"; layout: WorkspaceLayout }
  | { type: "activate"; paneId: string }
  | { type: "addPane"; pane: PaneDescriptor }
  | { type: "closePane"; paneId: string }
  | { type: "toggleMaximize"; paneId: string }
  | { type: "renamePane"; paneId: string; title: string };

export function workspaceReducer(
  state: WorkspaceLayout | null,
  action: WorkspaceAction,
): WorkspaceLayout | null {
  if (action.type === "loaded") {
    return action.layout;
  }

  if (!state) {
    return state;
  }

  switch (action.type) {
    case "activate":
      return { ...state, active_pane_id: action.paneId };
    case "addPane":
      return {
        ...state,
        panes: [...state.panes, action.pane],
        active_pane_id: action.pane.id,
        maximized_pane_id: null,
      };
    case "closePane": {
      const panes = state.panes.filter((pane) => pane.id !== action.paneId);
      const activeStillExists = panes.some((pane) => pane.id === state.active_pane_id);
      return {
        ...state,
        panes,
        active_pane_id: activeStillExists ? state.active_pane_id : panes[0]?.id ?? null,
        maximized_pane_id:
          state.maximized_pane_id === action.paneId ? null : state.maximized_pane_id,
      };
    }
    case "toggleMaximize":
      return {
        ...state,
        active_pane_id: action.paneId,
        maximized_pane_id: state.maximized_pane_id === action.paneId ? null : action.paneId,
      };
    case "renamePane":
      return {
        ...state,
        panes: state.panes.map((pane) =>
          pane.id === action.paneId ? { ...pane, title: action.title } : pane,
        ),
      };
  }
}

export function createPane(
  kind: PaneDescriptor["kind"],
  title: string,
  state: Record<string, unknown> = {},
): PaneDescriptor {
  const common = ["split", "resize", "maximize", "close"] as const;
  return {
    id: crypto.randomUUID(),
    kind,
    title,
    state,
    capabilities: kind === "files" ? [...common, "search"] : common.slice(),
  };
}
