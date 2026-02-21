CREATE TABLE IF NOT EXISTS custom_themes (
    id TEXT PRIMARY KEY,
    theme_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
