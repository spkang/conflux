import type { PaneDescriptor, PaneKind, PaneTreeNode, SplitAxis, WorkspaceLayout } from "../lib/types";

export type WorkspaceAction =
  | { type: "loaded"; layout: WorkspaceLayout }
  | { type: "activate"; paneId: string }
  | { type: "addPane"; pane: PaneDescriptor }
  | { type: "closePane"; paneId: string }
  | { type: "splitPane"; paneId: string; pane: PaneDescriptor; axis: SplitAxis }
  | { type: "swapPanes"; sourcePaneId: string; targetPaneId: string }
  | { type: "resizeSplit"; splitId: string; ratio: number }
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
        pane_tree: splitLeaf(
          state.pane_tree,
          state.active_pane_id ?? firstPaneId(state.pane_tree) ?? action.pane.id,
          action.pane.id,
          "horizontal",
        ),
        active_pane_id: action.pane.id,
        maximized_pane_id: null,
      };
    case "closePane": {
      const panes = state.panes.filter((pane) => pane.id !== action.paneId);
      const activeStillExists = panes.some((pane) => pane.id === state.active_pane_id);
      const collapsedTree = removeLeaf(state.pane_tree, action.paneId);
      const pane_tree = collapsedTree ?? (panes[0] ? { kind: "leaf" as const, pane_id: panes[0].id } : state.pane_tree);
      return {
        ...state,
        panes,
        pane_tree,
        active_pane_id: activeStillExists ? state.active_pane_id : panes[0]?.id ?? null,
        maximized_pane_id:
          state.maximized_pane_id === action.paneId ? null : state.maximized_pane_id,
      };
    }
    case "splitPane":
      return {
        ...state,
        panes: [...state.panes, action.pane],
        pane_tree: splitLeaf(state.pane_tree, action.paneId, action.pane.id, action.axis),
        active_pane_id: action.pane.id,
        maximized_pane_id: null,
      };
    case "swapPanes":
      return {
        ...state,
        pane_tree: swapLeafIds(state.pane_tree, action.sourcePaneId, action.targetPaneId),
        active_pane_id: action.sourcePaneId,
      };
    case "resizeSplit":
      return {
        ...state,
        pane_tree: resizeSplit(state.pane_tree, action.splitId, action.ratio),
      };
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
  kind: PaneKind,
  title: string,
  state: Record<string, unknown> = {},
): PaneDescriptor {
  const common = ["split", "resize", "maximize", "close"] as const;
  const extra =
    kind === "files"
      ? ["search" as const]
      : kind === "web"
        ? ["reload" as const, "back" as const, "forward" as const]
        : kind === "editor"
          ? ["save" as const]
          : [];
  return {
    id: crypto.randomUUID(),
    kind,
    title,
    state,
    capabilities: [...common, ...extra],
  };
}

function splitLeaf(
  node: PaneTreeNode,
  targetPaneId: string,
  newPaneId: string,
  axis: SplitAxis,
): PaneTreeNode {
  if (node.kind === "leaf") {
    if (node.pane_id !== targetPaneId) {
      return node;
    }

    return {
      kind: "split",
      id: crypto.randomUUID(),
      axis,
      ratio: 0.5,
      first: node,
      second: { kind: "leaf", pane_id: newPaneId },
    };
  }

  return {
    ...node,
    first: splitLeaf(node.first, targetPaneId, newPaneId, axis),
    second: splitLeaf(node.second, targetPaneId, newPaneId, axis),
  };
}

function removeLeaf(node: PaneTreeNode, paneId: string): PaneTreeNode | null {
  if (node.kind === "leaf") {
    return node.pane_id === paneId ? null : node;
  }

  const first = removeLeaf(node.first, paneId);
  const second = removeLeaf(node.second, paneId);

  if (!first) {
    return second;
  }
  if (!second) {
    return first;
  }

  return { ...node, first, second };
}

function swapLeafIds(node: PaneTreeNode, sourcePaneId: string, targetPaneId: string): PaneTreeNode {
  if (node.kind === "leaf") {
    if (node.pane_id === sourcePaneId) {
      return { ...node, pane_id: targetPaneId };
    }
    if (node.pane_id === targetPaneId) {
      return { ...node, pane_id: sourcePaneId };
    }
    return node;
  }

  return {
    ...node,
    first: swapLeafIds(node.first, sourcePaneId, targetPaneId),
    second: swapLeafIds(node.second, sourcePaneId, targetPaneId),
  };
}

function resizeSplit(node: PaneTreeNode, splitId: string, ratio: number): PaneTreeNode {
  if (node.kind === "leaf") {
    return node;
  }

  if (node.id === splitId) {
    return { ...node, ratio: Math.min(0.82, Math.max(0.18, ratio)) };
  }

  return {
    ...node,
    first: resizeSplit(node.first, splitId, ratio),
    second: resizeSplit(node.second, splitId, ratio),
  };
}

function firstPaneId(node: PaneTreeNode): string | null {
  return node.kind === "leaf" ? node.pane_id : firstPaneId(node.first) ?? firstPaneId(node.second);
}
