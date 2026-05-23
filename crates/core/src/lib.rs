use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PaneKind {
    Terminal,
    Web,
    Files,
    Preview,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PaneCapability {
    Split,
    Resize,
    Maximize,
    Close,
    Reload,
    Search,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaneDescriptor {
    pub id: String,
    pub kind: PaneKind,
    pub title: String,
    pub state: Value,
    pub capabilities: Vec<PaneCapability>,
}

impl PaneDescriptor {
    pub fn terminal(title: impl Into<String>, cwd: Option<PathBuf>) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            kind: PaneKind::Terminal,
            title: title.into(),
            state: serde_json::json!({ "cwd": cwd }),
            capabilities: vec![
                PaneCapability::Split,
                PaneCapability::Resize,
                PaneCapability::Maximize,
                PaneCapability::Close,
            ],
        }
    }

    pub fn web(title: impl Into<String>, url: impl Into<String>) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            kind: PaneKind::Web,
            title: title.into(),
            state: serde_json::json!({ "url": url.into() }),
            capabilities: vec![
                PaneCapability::Split,
                PaneCapability::Resize,
                PaneCapability::Maximize,
                PaneCapability::Close,
                PaneCapability::Reload,
            ],
        }
    }

    pub fn files(root: Option<PathBuf>) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            kind: PaneKind::Files,
            title: "Files".to_string(),
            state: serde_json::json!({ "root": root }),
            capabilities: vec![
                PaneCapability::Split,
                PaneCapability::Resize,
                PaneCapability::Maximize,
                PaneCapability::Close,
                PaneCapability::Search,
            ],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceLayout {
    pub id: String,
    pub name: String,
    pub panes: Vec<PaneDescriptor>,
    pub active_pane_id: Option<String>,
    pub maximized_pane_id: Option<String>,
    pub updated_at: DateTime<Utc>,
}

impl WorkspaceLayout {
    pub fn starter(root: Option<PathBuf>) -> Self {
        let terminal = PaneDescriptor::terminal("Terminal", root.clone());
        let files = PaneDescriptor::files(root);
        let active_pane_id = Some(terminal.id.clone());

        Self {
            id: Uuid::new_v4().to_string(),
            name: "Default".to_string(),
            panes: vec![terminal, files],
            active_pane_id,
            maximized_pane_id: None,
            updated_at: Utc::now(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalSpawnRequest {
    pub cwd: Option<PathBuf>,
    pub shell: Option<String>,
    pub cols: u16,
    pub rows: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalSession {
    pub id: String,
    pub cwd: PathBuf,
    pub shell: String,
    pub cols: u16,
    pub rows: u16,
    pub started_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalOutputEvent {
    pub session_id: String,
    pub chunk: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalExitEvent {
    pub session_id: String,
    pub exit_code: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalWriteRequest {
    pub session_id: String,
    pub bytes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalResizeRequest {
    pub session_id: String,
    pub cols: u16,
    pub rows: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileSearchQuery {
    pub root: PathBuf,
    pub query: String,
    pub limit: usize,
    pub include_hidden: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    pub path: PathBuf,
    pub name: String,
    pub is_dir: bool,
    pub size: Option<u64>,
    pub score: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebPanelConfig {
    pub url: String,
    pub title: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn starter_layout_has_terminal_and_files() {
        let layout = WorkspaceLayout::starter(Some(PathBuf::from("/tmp")));

        assert_eq!(layout.panes.len(), 2);
        assert!(matches!(layout.panes[0].kind, PaneKind::Terminal));
        assert!(matches!(layout.panes[1].kind, PaneKind::Files));
        assert_eq!(layout.active_pane_id, Some(layout.panes[0].id.clone()));
    }
}
