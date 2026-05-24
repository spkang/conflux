import { Eye, FileText, Save } from "lucide-react";
import { createElement, useEffect, useMemo, useState } from "react";
import { ipc } from "../lib/ipc";
import type { PaneDescriptor } from "../lib/types";

type EditorPaneProps = {
  pane: PaneDescriptor;
  onRename: (title: string) => void;
};

export function EditorPane({ pane, onRename }: EditorPaneProps) {
  const root = useMemo(() => String(pane.state.root ?? ""), [pane.state.root]);
  const path = useMemo(() => String(pane.state.path ?? ""), [pane.state.path]);
  const isMarkdown = path.toLowerCase().endsWith(".md");
  const [contents, setContents] = useState("");
  const [savedContents, setSavedContents] = useState("");
  const [status, setStatus] = useState("loading");
  const [previewOpen, setPreviewOpen] = useState(isMarkdown);

  useEffect(() => {
    if (!root || !path) {
      setStatus("missing file");
      return;
    }

    let canceled = false;
    setStatus("loading");
    ipc
      .readTextFile({ root, path })
      .then((document) => {
        if (canceled) {
          return;
        }
        setContents(document.contents);
        setSavedContents(document.contents);
        setStatus("saved");
        onRename(shortName(document.path));
      })
      .catch((error) => {
        if (!canceled) {
          setContents("");
          setSavedContents("");
          setStatus(String(error));
        }
      });

    return () => {
      canceled = true;
    };
  }, [onRename, path, root]);

  const dirty = contents !== savedContents;

  const save = async () => {
    if (!root || !path) {
      return;
    }
    setStatus("saving");
    try {
      const document = await ipc.writeTextFile({ root, path, contents });
      setContents(document.contents);
      setSavedContents(document.contents);
      setStatus("saved");
      onRename(shortName(document.path));
    } catch (error) {
      setStatus(String(error));
    }
  };

  return (
    <div className="editor-pane">
      <div className="editor-pane__bar">
        <FileText size={15} />
        <span title={path}>{path.replace(root, "") || path}</span>
        <strong>{dirty ? "modified" : status}</strong>
        {isMarkdown ? (
          <button
            type="button"
            className="icon-button"
            title="Toggle preview"
            onClick={() => setPreviewOpen((value) => !value)}
          >
            <Eye size={15} />
          </button>
        ) : null}
        <button type="button" className="icon-button" title="Save" onClick={save}>
          <Save size={15} />
        </button>
      </div>
      <div className={`editor-pane__workspace ${previewOpen ? "has-preview" : ""}`}>
        <textarea
          value={contents}
          onChange={(event) => setContents(event.target.value)}
          spellCheck={false}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
              event.preventDefault();
              void save();
            }
          }}
        />
        {previewOpen ? (
          <article className="markdown-preview">
            {renderMarkdownPreview(contents).map((block, index) => (
              createElement(block.tag, { key: `${block.tag}-${index}` }, block.text)
            ))}
          </article>
        ) : null}
      </div>
    </div>
  );
}

function shortName(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? "Editor";
}

function renderMarkdownPreview(contents: string): Array<{ tag: "h1" | "h2" | "h3" | "p"; text: string }> {
  return contents
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (line.startsWith("# ")) {
        return { tag: "h1", text: line.slice(2) };
      }
      if (line.startsWith("## ")) {
        return { tag: "h2", text: line.slice(3) };
      }
      if (line.startsWith("### ")) {
        return { tag: "h3", text: line.slice(4) };
      }
      return { tag: "p", text: line.replace(/\[\[([^\]]+)\]\]/g, "$1") };
    });
}
