CREATE TABLE IF NOT EXISTS terminal_buffers (
    pane_id TEXT PRIMARY KEY,
    buffer_data TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_terminal_buffers_updated ON terminal_buffers(updated_at);
