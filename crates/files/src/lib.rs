use anyhow::Result;
use conflux_core::{FileEntry, FileSearchQuery};
use fuzzy_matcher::skim::SkimMatcherV2;
use fuzzy_matcher::FuzzyMatcher;
use ignore::WalkBuilder;
use std::fs;

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
}
