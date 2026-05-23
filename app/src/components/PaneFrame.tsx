import { Maximize2, Minimize2, PanelRightClose, SplitSquareHorizontal } from "lucide-react";
import type { PropsWithChildren } from "react";
import type { PaneDescriptor } from "../lib/types";

type PaneFrameProps = PropsWithChildren<{
  pane: PaneDescriptor;
  active: boolean;
  maximized: boolean;
  onActivate: () => void;
  onClose: () => void;
  onMaximize: () => void;
  onSplit: () => void;
}>;

export function PaneFrame({
  pane,
  active,
  maximized,
  onActivate,
  onClose,
  onMaximize,
  onSplit,
  children,
}: PaneFrameProps) {
  return (
    <section className={`pane ${active ? "is-active" : ""}`} onMouseDown={onActivate}>
      <header className="pane__chrome">
        <div className="pane__identity">
          <span className={`pane__kind pane__kind--${pane.kind}`} />
          <span className="pane__title">{pane.title}</span>
        </div>
        <div className="pane__actions">
          <button type="button" className="icon-button" title="Split pane" onClick={onSplit}>
            <SplitSquareHorizontal size={15} />
          </button>
          <button type="button" className="icon-button" title="Maximize pane" onClick={onMaximize}>
            {maximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
          <button type="button" className="icon-button" title="Close pane" onClick={onClose}>
            <PanelRightClose size={15} />
          </button>
        </div>
      </header>
      <div className="pane__body">{children}</div>
    </section>
  );
}
