import { ExternalLink, RefreshCw } from "lucide-react";
import { useMemo, useRef } from "react";
import type { PaneDescriptor } from "../lib/types";

type WebPaneProps = {
  pane: PaneDescriptor;
};

export function WebPane({ pane }: WebPaneProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const url = useMemo(() => String(pane.state.url ?? "https://example.com"), [pane.state.url]);

  return (
    <div className="web-pane">
      <div className="web-pane__bar">
        <span>{url}</span>
        <button
          type="button"
          className="icon-button"
          title="Reload"
          onClick={() => {
            if (iframeRef.current) {
              iframeRef.current.src = url;
            }
          }}
        >
          <RefreshCw size={15} />
        </button>
        <a className="icon-button" href={url} target="_blank" rel="noreferrer" title="Open outside">
          <ExternalLink size={15} />
        </a>
      </div>
      <iframe ref={iframeRef} title={pane.title} src={url} />
    </div>
  );
}
