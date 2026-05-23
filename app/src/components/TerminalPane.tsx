import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { useEffect, useMemo, useRef, useState } from "react";
import { ipc } from "../lib/ipc";
import type { PaneDescriptor, TerminalExitEvent, TerminalOutputEvent, TerminalSession } from "../lib/types";

type TerminalPaneProps = {
  pane: PaneDescriptor;
};

export function TerminalPane({ pane }: TerminalPaneProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const sessionRef = useRef<TerminalSession | null>(null);
  const [status, setStatus] = useState("starting");
  const cwd = useMemo(() => String(pane.state.cwd ?? ""), [pane.state.cwd]);

  useEffect(() => {
    if (!hostRef.current) {
      return;
    }

    const terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: "bar",
      fontFamily:
        '"Berkeley Mono", "SFMono-Regular", "JetBrains Mono", ui-monospace, monospace',
      fontSize: 13,
      lineHeight: 1.25,
      macOptionIsMeta: true,
      scrollback: 5000,
      theme: {
        background: "#101111",
        foreground: "#d7d0c3",
        cursor: "#f2b35e",
        selectionBackground: "#3c4a46",
        black: "#101111",
        red: "#d86d66",
        green: "#8fb573",
        yellow: "#d7a84f",
        blue: "#7b9aa6",
        magenta: "#b487a3",
        cyan: "#6da6a0",
        white: "#d7d0c3",
        brightBlack: "#5e625f",
        brightRed: "#ef8a81",
        brightGreen: "#a8c789",
        brightYellow: "#edc56d",
        brightBlue: "#97b4bf",
        brightMagenta: "#d1a0bd",
        brightCyan: "#88c4be",
        brightWhite: "#f3eadc",
      },
    });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(hostRef.current);
    fit.fit();
    terminal.writeln("\x1b[38;5;180mConflux terminal\x1b[0m");

    terminalRef.current = terminal;
    fitRef.current = fit;

    let disposed = false;
    let unlistenOutput: (() => void) | undefined;
    let unlistenExit: (() => void) | undefined;

    const boot = async () => {
      try {
        unlistenOutput = await ipc.onTerminalOutput((event: TerminalOutputEvent) => {
          if (event.session_id === sessionRef.current?.id) {
            terminal.write(event.chunk);
          }
        });
        unlistenExit = await ipc.onTerminalExit((event: TerminalExitEvent) => {
          if (event.session_id === sessionRef.current?.id) {
            setStatus(event.exit_code == null ? "exited" : `exited ${event.exit_code}`);
            terminal.writeln("");
            terminal.writeln(`\x1b[38;5;167mprocess ${event.exit_code ?? "ended"}\x1b[0m`);
          }
        });

        const session = await ipc.spawnTerminal({
          cwd: cwd || null,
          shell: null,
          cols: terminal.cols,
          rows: terminal.rows,
        });
        if (disposed) {
          return;
        }

        sessionRef.current = session;
        setStatus("running");
      } catch (error) {
        setStatus("failed");
        terminal.writeln(`\x1b[38;5;167m${String(error)}\x1b[0m`);
      }
    };

    const dataDisposable = terminal.onData((bytes) => {
      const session = sessionRef.current;
      if (session) {
        void ipc.writeTerminal(session.id, bytes);
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      fit.fit();
      const session = sessionRef.current;
      if (session) {
        void ipc.resizeTerminal(session.id, terminal.cols, terminal.rows);
      }
    });
    resizeObserver.observe(hostRef.current);

    void boot();

    return () => {
      disposed = true;
      dataDisposable.dispose();
      resizeObserver.disconnect();
      unlistenOutput?.();
      unlistenExit?.();
      const session = sessionRef.current;
      if (session) {
        void ipc.killTerminal(session.id);
      }
      terminal.dispose();
    };
  }, [cwd]);

  return (
    <div className="terminal-pane">
      <div className="terminal-pane__meta">
        <span>{cwd || "current directory"}</span>
        <span className={`status-dot status-dot--${status.replace(/\s+/g, "-")}`} />
        <span>{status}</span>
      </div>
      <div className="terminal-pane__host" ref={hostRef} />
    </div>
  );
}
