ALTER TABLE connections ADD COLUMN theme_override TEXT;
ALTER TABLE connections ADD COLUMN agent_forwarding INTEGER NOT NULL DEFAULT 0;
ALTER TABLE connections ADD COLUMN env_vars TEXT NOT NULL DEFAULT '{}';
