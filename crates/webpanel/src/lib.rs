use conflux_core::WebPanelConfig;
use thiserror::Error;
use url::Url;

#[derive(Debug, Error)]
pub enum WebPanelError {
    #[error("unsupported or invalid URL")]
    InvalidUrl,
}

pub fn normalize_url(input: &str) -> Result<WebPanelConfig, WebPanelError> {
    let trimmed = input.trim();
    let candidate = if trimmed.contains("://") {
        trimmed.to_string()
    } else {
        format!("https://{trimmed}")
    };

    let url = Url::parse(&candidate).map_err(|_| WebPanelError::InvalidUrl)?;
    match url.scheme() {
        "http" | "https" => {
            let title = url
                .host_str()
                .unwrap_or("Web")
                .trim_start_matches("www.")
                .to_string();

            Ok(WebPanelConfig {
                url: url.to_string(),
                title,
            })
        }
        _ => Err(WebPanelError::InvalidUrl),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn adds_https_to_bare_domain() {
        let config = normalize_url("example.com").unwrap();

        assert_eq!(config.url, "https://example.com/");
        assert_eq!(config.title, "example.com");
    }

    #[test]
    fn rejects_file_urls() {
        assert!(normalize_url("file:///etc/passwd").is_err());
    }
}
