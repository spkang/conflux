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
    Editor,
    MarkdownPreview,
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
    Save,
    Back,
    Forward,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaneDescriptor {
    pub id: String,
    pub kind: PaneKind,
    pub title: String,
    pub state: Value,
    pub capabilities: Vec<PaneCapability>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum PaneTreeNode {
    Leaf {
        pane_id: String,
    },
    Split {
        id: String,
        axis: SplitAxis,
        ratio: f32,
        first: Box<PaneTreeNode>,
        second: Box<PaneTreeNode>,
    },
}

impl PaneTreeNode {
    pub fn leaf(pane_id: impl Into<String>) -> Self {
        Self::Leaf {
            pane_id: pane_id.into(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SplitAxis {
    Horizontal,
    Vertical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectDescriptor {
    pub id: String,
    pub name: String,
    pub root: PathBuf,
    pub active_task_id: Option<String>,
    pub updated_at: DateTime<Utc>,
}

impl ProjectDescriptor {
    pub fn from_root(root: PathBuf) -> Self {
        let name = root
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("Project")
            .to_string();

        Self {
            id: Uuid::new_v4().to_string(),
            name,
            root,
            active_task_id: None,
            updated_at: Utc::now(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskDescriptor {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub notes_path: PathBuf,
    pub updated_at: DateTime<Utc>,
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

    pub fn editor(
        title: impl Into<String>,
        path: impl Into<PathBuf>,
        root: Option<PathBuf>,
    ) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            kind: PaneKind::Editor,
            title: title.into(),
            state: serde_json::json!({ "path": path.into(), "root": root }),
            capabilities: vec![
                PaneCapability::Split,
                PaneCapability::Resize,
                PaneCapability::Maximize,
                PaneCapability::Close,
                PaneCapability::Save,
            ],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceLayout {
    pub id: String,
    pub name: String,
    pub project: ProjectDescriptor,
    pub task: TaskDescriptor,
    pub panes: Vec<PaneDescriptor>,
    pub pane_tree: PaneTreeNode,
    pub active_pane_id: Option<String>,
    pub maximized_pane_id: Option<String>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceSaveRequest {
    pub layout: WorkspaceLayout,
}

impl WorkspaceLayout {
    pub fn starter(root: Option<PathBuf>) -> Self {
        let root = root.unwrap_or_else(|| PathBuf::from("."));
        let mut project = ProjectDescriptor::from_root(root.clone());
        let task = TaskDescriptor {
            id: Uuid::new_v4().to_string(),
            project_id: project.id.clone(),
            title: "Default task".to_string(),
            notes_path: root.join(".conflux").join("notes").join("default.md"),
            updated_at: Utc::now(),
        };
        project.active_task_id = Some(task.id.clone());

        let terminal = PaneDescriptor::terminal("AI Terminal", Some(root.clone()));
        let files = PaneDescriptor::files(Some(root.clone()));
        let notes = PaneDescriptor::editor("Task notes", task.notes_path.clone(), Some(root));
        let active_pane_id = Some(terminal.id.clone());
        let pane_tree = PaneTreeNode::Split {
            id: Uuid::new_v4().to_string(),
            axis: SplitAxis::Horizontal,
            ratio: 0.68,
            first: Box::new(PaneTreeNode::Split {
                id: Uuid::new_v4().to_string(),
                axis: SplitAxis::Vertical,
                ratio: 0.56,
                first: Box::new(PaneTreeNode::leaf(terminal.id.clone())),
                second: Box::new(PaneTreeNode::leaf(notes.id.clone())),
            }),
            second: Box::new(PaneTreeNode::leaf(files.id.clone())),
        };

        Self {
            id: Uuid::new_v4().to_string(),
            name: "Default task".to_string(),
            project,
            task,
            panes: vec![terminal, notes, files],
            pane_tree,
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
pub struct FileReadRequest {
    pub root: PathBuf,
    pub path: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileWriteRequest {
    pub root: PathBuf,
    pub path: PathBuf,
    pub contents: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileTextDocument {
    pub path: PathBuf,
    pub contents: String,
    pub modified_at: Option<DateTime<Utc>>,
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

        assert_eq!(layout.panes.len(), 3);
        assert!(matches!(layout.panes[0].kind, PaneKind::Terminal));
        assert!(matches!(layout.panes[1].kind, PaneKind::Editor));
        assert!(matches!(layout.panes[2].kind, PaneKind::Files));
        assert_eq!(layout.active_pane_id, Some(layout.panes[0].id.clone()));
        assert_eq!(layout.project.root, PathBuf::from("/tmp"));
        assert_eq!(
            layout.task.notes_path,
            PathBuf::from("/tmp/.conflux/notes/default.md")
        );
    }

    #[test]
    fn starter_layout_uses_a_split_tree() {
        let layout = WorkspaceLayout::starter(Some(PathBuf::from("/tmp")));

        assert!(matches!(layout.pane_tree, PaneTreeNode::Split { .. }));
    }
}
