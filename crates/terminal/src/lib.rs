use anyhow::{anyhow, Result};
use chrono::Utc;
use conflux_core::{
    TerminalExitEvent, TerminalOutputEvent, TerminalResizeRequest, TerminalSession,
    TerminalSpawnRequest, TerminalWriteRequest,
};
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::thread;
use uuid::Uuid;

type SharedChild = Arc<Mutex<Box<dyn Child + Send + Sync>>>;

struct RunningTerminal {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: SharedChild,
    session: TerminalSession,
}

#[derive(Default)]
pub struct TerminalManager {
    sessions: Mutex<HashMap<String, RunningTerminal>>,
}

impl TerminalManager {
    pub fn spawn(
        &self,
        request: TerminalSpawnRequest,
        on_output: impl Fn(TerminalOutputEvent) + Send + 'static,
        on_exit: impl Fn(TerminalExitEvent) + Send + 'static,
    ) -> Result<TerminalSession> {
        let id = Uuid::new_v4().to_string();
        let cwd = resolve_cwd(request.cwd)?;
        let shell = request
            .shell
            .or_else(|| std::env::var("SHELL").ok())
            .unwrap_or_else(|| "/bin/zsh".to_string());
        let cols = request.cols.max(20);
        let rows = request.rows.max(5);

        let pty_system = native_pty_system();
        let pair = pty_system.openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })?;

        let mut command = CommandBuilder::new(&shell);
        command.cwd(&cwd);

        let child = pair.slave.spawn_command(command)?;
        let child = Arc::new(Mutex::new(child));
        let mut reader = pair.master.try_clone_reader()?;
        let writer = pair.master.take_writer()?;
        let session = TerminalSession {
            id: id.clone(),
            cwd,
            shell,
            cols,
            rows,
            started_at: Utc::now(),
        };

        let reader_session_id = id.clone();
        let reader_child = child.clone();
        thread::spawn(move || {
            let mut buffer = [0_u8; 8192];
            loop {
                match reader.read(&mut buffer) {
                    Ok(0) => break,
                    Ok(count) => {
                        let chunk = String::from_utf8_lossy(&buffer[..count]).to_string();
                        on_output(TerminalOutputEvent {
                            session_id: reader_session_id.clone(),
                            chunk,
                        });
                    }
                    Err(_) => break,
                }
            }

            let exit_code = reader_child
                .lock()
                .ok()
                .and_then(|mut child| child.try_wait().ok().flatten())
                .map(|status| status.exit_code() as i32);

            on_exit(TerminalExitEvent {
                session_id: reader_session_id,
                exit_code,
            });
        });

        let running = RunningTerminal {
            master: pair.master,
            writer,
            child,
            session: session.clone(),
        };

        self.sessions
            .lock()
            .map_err(|_| anyhow!("terminal manager lock poisoned"))?
            .insert(id, running);

        Ok(session)
    }

    pub fn write(&self, request: TerminalWriteRequest) -> Result<()> {
        let mut sessions = self
            .sessions
            .lock()
            .map_err(|_| anyhow!("terminal manager lock poisoned"))?;
        let terminal = sessions
            .get_mut(&request.session_id)
            .ok_or_else(|| anyhow!("terminal session not found"))?;

        terminal.writer.write_all(request.bytes.as_bytes())?;
        terminal.writer.flush()?;
        Ok(())
    }

    pub fn resize(&self, request: TerminalResizeRequest) -> Result<TerminalSession> {
        let mut sessions = self
            .sessions
            .lock()
            .map_err(|_| anyhow!("terminal manager lock poisoned"))?;
        let terminal = sessions
            .get_mut(&request.session_id)
            .ok_or_else(|| anyhow!("terminal session not found"))?;

        terminal.master.resize(PtySize {
            rows: request.rows.max(5),
            cols: request.cols.max(20),
            pixel_width: 0,
            pixel_height: 0,
        })?;
        terminal.session.cols = request.cols.max(20);
        terminal.session.rows = request.rows.max(5);

        Ok(terminal.session.clone())
    }

    pub fn kill(&self, session_id: &str) -> Result<()> {
        let mut sessions = self
            .sessions
            .lock()
            .map_err(|_| anyhow!("terminal manager lock poisoned"))?;
        let terminal = sessions
            .remove(session_id)
            .ok_or_else(|| anyhow!("terminal session not found"))?;

        terminal
            .child
            .lock()
            .map_err(|_| anyhow!("terminal child lock poisoned"))?
            .kill()?;
        Ok(())
    }
}

fn resolve_cwd(cwd: Option<PathBuf>) -> Result<PathBuf> {
    match cwd {
        Some(cwd) if cwd.is_dir() => Ok(cwd),
        Some(cwd) => Err(anyhow!("cwd does not exist or is not a directory: {cwd:?}")),
        None => std::env::current_dir().map_err(Into::into),
    }
}
