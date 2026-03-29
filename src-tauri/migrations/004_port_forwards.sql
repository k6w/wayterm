-- Port forwarding rules table
CREATE TABLE IF NOT EXISTS port_forwards (
    id TEXT PRIMARY KEY NOT NULL,
    connection_id TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'local',
    local_port INTEGER NOT NULL,
    remote_host TEXT NOT NULL DEFAULT 'localhost',
    remote_port INTEGER NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_port_forwards_connection_id ON port_forwards(connection_id);