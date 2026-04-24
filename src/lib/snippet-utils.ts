export interface SnippetContext {
  hostname?: string;
  username?: string;
  cwd?: string;
  paneId?: string;
}

export function resolveSnippetVars(command: string, ctx: SnippetContext): string {
  const now = new Date();
  const date = now.toISOString().split("T")[0];
  const time = now.toTimeString().split(" ")[0];
  return command
    .replace(/\{\{hostname\}\}/g, ctx.hostname ?? "")
    .replace(/\{\{host\}\}/g, ctx.hostname ?? "")
    .replace(/\{\{user\}\}/g, ctx.username ?? "")
    .replace(/\{\{username\}\}/g, ctx.username ?? "")
    .replace(/\{\{cwd\}\}/g, ctx.cwd ?? "")
    .replace(/\{\{date\}\}/g, date)
    .replace(/\{\{time\}\}/g, time)
    .replace(/\{\{pane_id\}\}/g, ctx.paneId ?? "");
}

export const SNIPPET_VARIABLE_HINTS = [
  { variable: "{{hostname}}", description: "SSH host or localhost" },
  { variable: "{{user}}", description: "SSH username or local user" },
  { variable: "{{cwd}}", description: "Current working directory" },
  { variable: "{{date}}", description: "Today's date (YYYY-MM-DD)" },
  { variable: "{{time}}", description: "Current time (HH:MM:SS)" },
];
