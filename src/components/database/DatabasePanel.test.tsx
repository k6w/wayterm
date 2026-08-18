import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DatabasePanel } from "./DatabasePanel";
import { useDatabaseStore } from "../../stores/database";
import type { DatabaseConnection, QueryResult } from "../../types/database";

const CONN: DatabaseConnection = {
  id: "d1",
  name: "app",
  type: "postgresql",
  host: "localhost",
  port: 5432,
  database: "app",
  username: "me",
  ssl: false,
};

const RESULT: QueryResult = {
  columns: ["id", "name"],
  rows: [
    { id: 1, name: "ada" },
    { id: 2, name: null },
  ],
  rowCount: 2,
  executionTime: 3,
};

const actions = {
  connect: vi.fn(async () => {}),
  disconnect: vi.fn(async () => {}),
  executeQuery: vi.fn(async () => RESULT),
  loadConnections: vi.fn(async () => {}),
  saveConnection: vi.fn(async () => {}),
  deleteConnection: vi.fn(async () => {}),
};

beforeEach(() => {
  for (const fn of Object.values(actions)) fn.mockClear();
  actions.executeQuery.mockImplementation(async () => RESULT);
  useDatabaseStore.setState({
    connections: [CONN],
    activeConnection: null,
    isConnected: false,
    isLoading: false,
    queryHistory: [],
    ...actions,
  });
});

function connected(history: { query: string }[] = []) {
  useDatabaseStore.setState({
    isConnected: true,
    activeConnection: CONN,
    queryHistory: history.map((h, i) => ({
      id: `h${i}`,
      query: h.query,
      timestamp: 0,
      executionTime: 1,
      duration: 1,
      rowCount: 1,
      connectionId: "d1",
      success: true,
    })),
  });
}

describe("DatabasePanel", () => {
  it("lists saved connections and connects on select", async () => {
    const user = userEvent.setup();
    render(<DatabasePanel />);
    await user.click(screen.getByRole("button", { name: /app.*postgresql · localhost:5432 · app/ }));
    expect(actions.connect).toHaveBeenCalledWith("d1");
  });

  it("validates the new connection dialog inline, then saves it with an id", async () => {
    const user = userEvent.setup();
    render(<DatabasePanel />);
    await user.click(screen.getByRole("button", { name: "New connection" }));
    const dialog = screen.getByRole("dialog", { name: "New database connection" });
    await user.click(within(dialog).getByRole("button", { name: "Save connection" }));
    expect(within(dialog).getByRole("textbox", { name: "Name" })).toHaveAccessibleDescription("Enter a name.");
    expect(within(dialog).getByRole("textbox", { name: "Name" })).toHaveFocus();
    expect(actions.saveConnection).not.toHaveBeenCalled();

    await user.type(within(dialog).getByRole("textbox", { name: "Name" }), "reports");
    await user.type(within(dialog).getByRole("textbox", { name: "Database" }), "reports");
    await user.type(within(dialog).getByRole("textbox", { name: "Username" }), "me{Enter}");
    await waitFor(() =>
      expect(actions.saveConnection).toHaveBeenCalledWith(
        expect.objectContaining({ id: expect.stringMatching(/.+/), name: "reports", port: 5432, ssl: false })
      )
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("runs a query with Mod+Enter and shows a zebra-striped mono grid", async () => {
    const user = userEvent.setup();
    connected();
    render(<DatabasePanel />);
    await user.type(screen.getByRole("textbox", { name: "SQL query" }), "select 1{Control>}{Enter}{/Control}");
    expect(actions.executeQuery).toHaveBeenCalledWith("select 1");
    const grid = await screen.findByRole("region", { name: "Query results" });
    expect(within(grid).getByText("2 rows")).toBeInTheDocument();
    expect(within(grid).getByRole("columnheader", { name: "name" })).toBeInTheDocument();
    const rows = within(grid).getAllByRole("row");
    expect(rows[1]).toHaveClass("even:bg-raised");
    expect(within(grid).getByRole("table")).toHaveClass("font-mono");
    expect(within(grid).getByText("ada")).toBeInTheDocument();
  });

  it("lays the results out to fill the panel and scroll both ways under a sticky header", async () => {
    const columns = Array.from({ length: 30 }, (_, i) => `column_${i}`);
    const wide: QueryResult = {
      columns,
      rows: [Object.fromEntries(columns.map((c) => [c, "v"]))],
      rowCount: 1,
      executionTime: 1,
    };
    actions.executeQuery.mockImplementation(async () => wide);
    const user = userEvent.setup();
    connected();
    render(<DatabasePanel />);
    await user.type(screen.getByRole("textbox", { name: "SQL query" }), "select 1{Control>}{Enter}{/Control}");
    const grid = await screen.findByRole("region", { name: "Query results" });
    // The grid takes the free height of the panel instead of a fixed cap, and keeps a floor so rows stay visible.
    expect(grid).toHaveClass("flex-1", "min-h-40");
    expect(grid).not.toHaveClass("max-h-64");
    const table = within(grid).getByRole("table");
    const scroller = table.parentElement as HTMLElement;
    expect(scroller).toHaveClass("min-h-0", "flex-1", "overflow-auto");
    expect(table).toHaveClass("w-max", "min-w-full");
    expect(within(grid).getByRole("columnheader", { name: "column_0" })).toHaveClass("sticky", "top-0");
    // The panel body is a column the grid can grow in.
    expect(grid.parentElement).toHaveClass("flex", "flex-col", "min-h-0", "flex-1");
  });

  it("says why a query failed", async () => {
    const user = userEvent.setup();
    actions.executeQuery.mockImplementation(async () => {
      throw new Error('relation "nope" does not exist');
    });
    connected();
    render(<DatabasePanel />);
    await user.type(screen.getByRole("textbox", { name: "SQL query" }), "select * from nope");
    await user.click(screen.getByRole("button", { name: /Run/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent('relation "nope" does not exist');
  });

  it("recalls earlier queries with the arrow keys", async () => {
    const user = userEvent.setup();
    connected([{ query: "select 2" }, { query: "select 1" }]);
    render(<DatabasePanel />);
    const box = screen.getByRole("textbox", { name: "SQL query" });
    await user.click(box);
    await user.keyboard("{ArrowUp}");
    expect(box).toHaveValue("select 2");
    await user.keyboard("{ArrowUp}");
    expect(box).toHaveValue("select 1");
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(box).toHaveValue("");
  });

  it("disconnects from the toolbar", async () => {
    const user = userEvent.setup();
    connected();
    render(<DatabasePanel />);
    await user.click(screen.getByRole("button", { name: "Disconnect" }));
    expect(actions.disconnect).toHaveBeenCalledTimes(1);
  });

  it("shows the empty state at the top without saved connections", () => {
    useDatabaseStore.setState({ connections: [] });
    render(<DatabasePanel />);
    expect(screen.getByText("No saved connections")).toBeInTheDocument();
  });
});
