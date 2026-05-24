use conflux_core::{
    FileEntry, FileReadRequest, FileSearchQuery, FileTextDocument, FileWriteRequest,
    TerminalResizeRequest, TerminalSession, TerminalSpawnRequest, TerminalWriteRequest,
    WebPanelConfig, WorkspaceLayout, WorkspaceSaveRequest,
};
use conflux_terminal::TerminalManager;
use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager, State};
use thiserror::Error;

#[derive(Default)]
struct AppState {
    terminals: TerminalManager,
}

#[derive(Debug, Error)]
enum CommandError {
    #[error("{0}")]
    Message(String),
}

impl Serialize for CommandError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl From<anyhow::Error> for CommandError {
    fn from(value: anyhow::Error) -> Self {
        Self::Message(value.to_string())
    }
}

impl From<conflux_webpanel::WebPanelError> for CommandError {
    fn from(value: conflux_webpanel::WebPanelError) -> Self {
        Self::Message(value.to_string())
    }
}

#[tauri::command]
fn workspace_default_layout(root: Option<PathBuf>) -> WorkspaceLayout {
    let root = root.or_else(|| std::env::current_dir().ok());
    if let Some(root) = root.as_ref() {
        if let Ok(contents) = fs::read_to_string(workspace_layout_path(root)) {
            if let Ok(layout) = serde_json::from_str::<WorkspaceLayout>(&contents) {
                return layout;
            }
        }
    }

    WorkspaceLayout::starter(root)
}

#[tauri::command]
fn workspace_save_layout(request: WorkspaceSaveRequest) -> Result<WorkspaceLayout, CommandError> {
    let path = workspace_layout_path(&request.layout.project.root);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| CommandError::Message(err.to_string()))?;
    }
    let contents = serde_json::to_string_pretty(&request.layout)
        .map_err(|err| CommandError::Message(err.to_string()))?;
    fs::write(path, contents).map_err(|err| CommandError::Message(err.to_string()))?;
    Ok(request.layout)
}

fn workspace_layout_path(root: &std::path::Path) -> PathBuf {
    root.join(".conflux")
        .join("tasks")
        .join("default-layout.json")
}

#[tauri::command]
fn terminal_spawn(
    app: AppHandle,
    state: State<'_, AppState>,
    request: TerminalSpawnRequest,
) -> Result<TerminalSession, CommandError> {
    let output_app = app.clone();
    let exit_app = app;
    let session = state.terminals.spawn(
        request,
        move |event| {
            let _ = output_app.emit("terminal://output", event);
        },
        move |event| {
            let _ = exit_app.emit("terminal://exit", event);
        },
    )?;

    Ok(session)
}

#[tauri::command]
fn terminal_write(
    state: State<'_, AppState>,
    request: TerminalWriteRequest,
) -> Result<(), CommandError> {
    state.terminals.write(request)?;
    Ok(())
}

#[tauri::command]
fn terminal_resize(
    state: State<'_, AppState>,
    request: TerminalResizeRequest,
) -> Result<TerminalSession, CommandError> {
    state.terminals.resize(request).map_err(Into::into)
}

#[tauri::command]
fn terminal_kill(state: State<'_, AppState>, session_id: String) -> Result<(), CommandError> {
    state.terminals.kill(&session_id)?;
    Ok(())
}

#[tauri::command]
fn files_search(query: FileSearchQuery) -> Result<Vec<FileEntry>, CommandError> {
    conflux_files::search_files(query).map_err(Into::into)
}

#[tauri::command]
fn files_read_text(request: FileReadRequest) -> Result<FileTextDocument, CommandError> {
    conflux_files::read_text_file(request).map_err(Into::into)
}

#[tauri::command]
fn files_write_text(request: FileWriteRequest) -> Result<FileTextDocument, CommandError> {
    conflux_files::write_text_file(request).map_err(Into::into)
}

#[tauri::command]
fn webpanel_normalize_url(input: String) -> Result<WebPanelConfig, CommandError> {
    conflux_webpanel::normalize_url(&input).map_err(Into::into)
}

fn main() {
    tauri::Builder::default()
        .manage(AppState::default())
        .setup(|app| {
            let window = app.get_webview_window("main").expect("main window exists");
            window.set_title("Conflux")?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            workspace_default_layout,
            terminal_spawn,
            terminal_write,
            terminal_resize,
            terminal_kill,
            files_search,
            files_read_text,
            files_write_text,
            webpanel_normalize_url,
            workspace_save_layout
        ])
        .run(tauri::generate_context!())
        .expect("error while running Conflux");
}
