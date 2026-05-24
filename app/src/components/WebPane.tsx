import { ArrowLeft, ArrowRight, ExternalLink, RefreshCw } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { PaneDescriptor } from "../lib/types";

type WebPaneProps = {
  pane: PaneDescriptor;
};

export function WebPane({ pane }: WebPaneProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const url = useMemo(() => String(pane.state.url ?? "https://example.com"), [pane.state.url]);
  const [address, setAddress] = useState(url);

  return (
    <div className="web-pane">
      <div className="web-pane__bar">
        <button
          type="button"
          className="icon-button"
          title="Back"
          onClick={() => iframeRef.current?.contentWindow?.history.back()}
        >
          <ArrowLeft size={15} />
        </button>
        <button
          type="button"
          className="icon-button"
          title="Forward"
          onClick={() => iframeRef.current?.contentWindow?.history.forward()}
        >
          <ArrowRight size={15} />
        </button>
        <input
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && iframeRef.current) {
              iframeRef.current.src = normalizeAddress(address);
            }
          }}
          spellCheck={false}
        />
        <button
          type="button"
          className="icon-button"
          title="Reload"
          onClick={() => {
            if (iframeRef.current) {
              iframeRef.current.src = normalizeAddress(address);
            }
          }}
        >
          <RefreshCw size={15} />
        </button>
        <a className="icon-button" href={normalizeAddress(address)} target="_blank" rel="noreferrer" title="Open outside">
          <ExternalLink size={15} />
        </a>
      </div>
      <iframe ref={iframeRef} title={pane.title} src={url} />
    </div>
  );
}

function normalizeAddress(input: string): string {
  return input.includes("://") ? input : `https://${input}`;
}
