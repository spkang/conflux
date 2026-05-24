import { File, Folder, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ipc } from "../lib/ipc";
import type { FileEntry, PaneDescriptor } from "../lib/types";

type FilesPaneProps = {
  pane: PaneDescriptor;
  onOpenTerminalHere: (path: string) => void;
  onOpenFile: (path: string) => void;
};

export function FilesPane({ pane, onOpenTerminalHere, onOpenFile }: FilesPaneProps) {
  const root = useMemo(() => String(pane.state.root ?? pane.state.cwd ?? ""), [pane.state]);
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [includeHidden, setIncludeHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!root) {
      return;
    }

    let canceled = false;
    const timer = window.setTimeout(async () => {
      try {
        const results = await ipc.searchFiles({
          root,
          query,
          limit: 80,
          include_hidden: includeHidden,
        });
        if (!canceled) {
          setEntries(results);
          setError(null);
        }
      } catch (err) {
        if (!canceled) {
          setError(String(err));
        }
      }
    }, 120);

    return () => {
      canceled = true;
      window.clearTimeout(timer);
    };
  }, [root, query, includeHidden]);

  return (
    <div className="files-pane">
      <div className="files-pane__search">
        <Search size={16} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find files"
          spellCheck={false}
        />
        <label className="toggle">
          <input
            type="checkbox"
            checked={includeHidden}
            onChange={(event) => setIncludeHidden(event.target.checked)}
          />
          <span>hidden</span>
        </label>
      </div>
      <div className="files-pane__root">{root || "No root selected"}</div>
      {error ? <div className="empty-state">{error}</div> : null}
      <div className="file-list">
        {entries.map((entry) => (
          <button
            type="button"
            className="file-row"
            key={entry.path}
            title={entry.path}
            onDoubleClick={() => {
              if (entry.is_dir) {
                onOpenTerminalHere(entry.path);
              } else {
                onOpenFile(entry.path);
              }
            }}
          >
            {entry.is_dir ? <Folder size={16} /> : <File size={16} />}
            <span className="file-row__name">{entry.name}</span>
            <span className="file-row__path">{entry.path.replace(root, "")}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
