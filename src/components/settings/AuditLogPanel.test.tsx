import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AuditLogPanel, { historyCsv } from "./AuditLogPanel";
import { historyRecent } from "../../lib/ipc";

vi.mock("../../lib/ipc", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/ipc")>()),
  historyRecent: vi.fn(async () => []),
}));

afterEach(() => {
  vi.mocked(historyRecent).mockReset().mockResolvedValue([]);
});

const ENTRIES = [
  { id: 2, command: 'git commit -m "x"', cwd: "/repo" },
  { id: 1, command: "ls", cwd: null },
];

describe("historyCsv", () => {
  it("quotes text fields and doubles quotes", () => {
    expect(historyCsv(ENTRIES)).toBe('ID,Command,Working Directory\n2,"git commit -m ""x""","/repo"\n1,"ls",');
  });
});

describe("AuditLogPanel", () => {
  it("loads the last 500 commands and filters them", async () => {
    const user = userEvent.setup();
    vi.mocked(historyRecent).mockResolvedValue(ENTRIES);
    render(<AuditLogPanel />);
    expect(await screen.findByText("ls")).toBeInTheDocument();
    expect(historyRecent).toHaveBeenCalledWith(500);
    expect(screen.getByText("2 entries")).toBeInTheDocument();
    await user.type(screen.getByRole("searchbox", { name: "Filter commands" }), "repo");
    expect(screen.queryByText("ls")).not.toBeInTheDocument();
    expect(screen.getByText("1 entry (filtered from 2)")).toBeInTheDocument();
    await user.clear(screen.getByRole("searchbox", { name: "Filter commands" }));
    await user.type(screen.getByRole("searchbox", { name: "Filter commands" }), "zzz");
    expect(screen.getByText("No matching commands")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export CSV" })).toBeDisabled();
  });

  it("shows an empty state and a load error", async () => {
    vi.mocked(historyRecent).mockRejectedValueOnce(new Error("database locked"));
    render(<AuditLogPanel />);
    expect(await screen.findByRole("alert")).toHaveTextContent("database locked");
    expect(screen.getByText("No history entries")).toBeInTheDocument();
  });

  it("reloads on Refresh", async () => {
    const user = userEvent.setup();
    render(<AuditLogPanel />);
    await screen.findByText("No history entries");
    vi.mocked(historyRecent).mockResolvedValueOnce(ENTRIES);
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByText("ls")).toBeInTheDocument();
  });
});
