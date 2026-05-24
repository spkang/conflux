use anyhow::Result;
use conflux_core::{
    FileEntry, FileReadRequest, FileSearchQuery, FileTextDocument, FileWriteRequest,
};
use fuzzy_matcher::skim::SkimMatcherV2;
use fuzzy_matcher::FuzzyMatcher;
use ignore::WalkBuilder;
use std::fs;
use std::path::{Path, PathBuf};

pub fn search_files(query: FileSearchQuery) -> Result<Vec<FileEntry>> {
    let matcher = SkimMatcherV2::default();
    let needle = query.query.trim();
    let limit = query.limit.clamp(1, 500);

    let mut entries = Vec::new();
    let mut walker = WalkBuilder::new(&query.root);
    walker.hidden(!query.include_hidden);
    walker.git_ignore(true);
    walker.git_exclude(true);
    walker.git_global(true);
    walker.parents(true);

    for result in walker.build() {
        let dent = match result {
            Ok(dent) => dent,
            Err(_) => continue,
        };
        let path = dent.path();

        if path == query.root {
            continue;
        }

        let Some(name) = path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };

        let score = if needle.is_empty() {
            0
        } else if let Some(score) = matcher.fuzzy_match(name, needle) {
            score
        } else if path.to_string_lossy().contains(needle) {
            1
        } else {
            continue;
        };

        let metadata = fs::metadata(path).ok();
        entries.push(FileEntry {
            path: path.to_path_buf(),
            name: name.to_string(),
            is_dir: metadata.as_ref().is_some_and(|meta| meta.is_dir()),
            size: metadata
                .as_ref()
                .filter(|meta| meta.is_file())
                .map(|meta| meta.len()),
            score,
        });

        if entries.len() >= limit.saturating_mul(4) {
            break;
        }
    }

    entries.sort_by(|a, b| {
        b.score
            .cmp(&a.score)
            .then_with(|| a.is_dir.cmp(&b.is_dir))
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    entries.truncate(limit);

    Ok(entries)
}

pub fn read_text_file(request: FileReadRequest) -> Result<FileTextDocument> {
    let path = resolve_project_path(&request.root, &request.path, false)?;
    let contents = fs::read_to_string(&path)?;
    let modified_at = fs::metadata(&path)
        .and_then(|meta| meta.modified())
        .ok()
        .map(chrono::DateTime::from);

    Ok(FileTextDocument {
        path,
        contents,
        modified_at,
    })
}

pub fn write_text_file(request: FileWriteRequest) -> Result<FileTextDocument> {
    let path = resolve_project_path(&request.root, &request.path, true)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(&path, request.contents)?;

    read_text_file(FileReadRequest {
        root: request.root,
        path,
    })
}

fn resolve_project_path(root: &Path, path: &Path, allow_missing_leaf: bool) -> Result<PathBuf> {
    let root = root.canonicalize()?;
    let candidate = if path.is_absolute() {
        path.to_path_buf()
    } else {
        root.join(path)
    };

    let resolved = if allow_missing_leaf {
        let parent = candidate
            .parent()
            .ok_or_else(|| anyhow::anyhow!("file path has no parent"))?;
        let parent = if parent.exists() {
            parent.canonicalize()?
        } else {
            resolve_missing_parent(&root, parent)?
        };
        parent.join(
            candidate
                .file_name()
                .ok_or_else(|| anyhow::anyhow!("file path has no name"))?,
        )
    } else {
        candidate.canonicalize()?
    };

    if !resolved.starts_with(&root) {
        anyhow::bail!("file path is outside project root");
    }

    Ok(resolved)
}

fn resolve_missing_parent(root: &Path, parent: &Path) -> Result<PathBuf> {
    let mut existing = parent;
    let mut missing = Vec::new();

    while !existing.exists() {
        let Some(name) = existing.file_name() else {
            anyhow::bail!("file path is outside project root");
        };
        missing.push(name.to_owned());
        existing = existing
            .parent()
            .ok_or_else(|| anyhow::anyhow!("file path is outside project root"))?;
    }

    let mut resolved = existing.canonicalize()?;
    for name in missing.iter().rev() {
        resolved.push(name);
    }

    if !resolved.starts_with(root) {
        anyhow::bail!("file path is outside project root");
    }

    Ok(resolved)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{create_dir_all, write};

    #[test]
    fn finds_files_by_fuzzy_name() {
        let root = std::env::temp_dir().join(format!("conflux-files-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        create_dir_all(root.join("src")).unwrap();
        write(root.join("src").join("TerminalPane.tsx"), "").unwrap();

        let results = search_files(FileSearchQuery {
            root: root.clone(),
            query: "term".to_string(),
            limit: 10,
            include_hidden: false,
        })
        .unwrap();

        assert_eq!(results[0].name, "TerminalPane.tsx");
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn reads_text_files_under_root() {
        let root = std::env::temp_dir().join(format!("conflux-read-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        create_dir_all(root.join("notes")).unwrap();
        write(root.join("notes").join("task.md"), "hello").unwrap();

        let document = read_text_file(FileReadRequest {
            root: root.clone(),
            path: root.join("notes").join("task.md"),
        })
        .unwrap();

        assert_eq!(document.contents, "hello");
        assert_eq!(
            document.path,
            root.join("notes").join("task.md").canonicalize().unwrap()
        );
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn writes_text_files_under_root_and_creates_parent_dirs() {
        let root = std::env::temp_dir().join(format!("conflux-write-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        create_dir_all(&root).unwrap();

        let path = root.join(".conflux").join("notes").join("task.md");
        let document = write_text_file(FileWriteRequest {
            root: root.clone(),
            path: path.clone(),
            contents: "# Task\n".to_string(),
        })
        .unwrap();

        assert_eq!(document.contents, "# Task\n");
        assert_eq!(std::fs::read_to_string(path).unwrap(), "# Task\n");
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn rejects_paths_outside_root() {
        let root = std::env::temp_dir().join(format!("conflux-safe-root-{}", std::process::id()));
        let outside = std::env::temp_dir().join(format!("conflux-outside-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        create_dir_all(&root).unwrap();

        let err = write_text_file(FileWriteRequest {
            root: root.clone(),
            path: outside,
            contents: "nope".to_string(),
        })
        .unwrap_err();

        assert!(err.to_string().contains("outside project root"));
        let _ = std::fs::remove_dir_all(root);
    }
}
