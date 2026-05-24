import { Edit3, Files, Globe2, NotebookTabs, Search, SquareTerminal } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export type Command = {
  id: string;
  label: string;
  detail: string;
  icon: "terminal" | "web" | "search" | "files" | "editor" | "notes";
  run: () => void | Promise<void>;
};

type CommandPaletteProps = {
  open: boolean;
  commands: Command[];
  onClose: () => void;
};

const icons = {
  terminal: SquareTerminal,
  web: Globe2,
  search: Search,
  files: Files,
  editor: Edit3,
  notes: NotebookTabs,
};

export function CommandPalette({ open, commands, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const needle = query.toLowerCase();
    return commands.filter((command) =>
      `${command.label} ${command.detail}`.toLowerCase().includes(needle),
    );
  }, [commands, query]);

  if (!open) {
    return null;
  }

  return (
    <div className="palette" role="dialog" aria-modal="true">
      <div className="palette__panel">
        <div className="palette__search">
          <Search size={17} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                onClose();
              }
              if (event.key === "Enter" && filtered[0]) {
                void filtered[0].run();
                onClose();
              }
            }}
            placeholder="Command or URL"
          />
        </div>
        <div className="palette__items">
          {filtered.map((command) => {
            const Icon = icons[command.icon];
            return (
              <button
                type="button"
                key={command.id}
                className="palette__item"
                onClick={() => {
                  void command.run();
                  onClose();
                }}
              >
                <Icon size={18} />
                <span>{command.label}</span>
                <small>{command.detail}</small>
              </button>
            );
          })}
        </div>
      </div>
      <button type="button" className="palette__scrim" aria-label="Close" onClick={onClose} />
    </div>
  );
}
