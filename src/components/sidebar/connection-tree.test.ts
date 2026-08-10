import { describe, expect, it } from "vitest";
import { buildTreeRows, folderOf, treeKeyAction } from "./connection-tree";
import type { SshConnection } from "../../types/ssh";

function conn(id: string, folderPath: string, sortOrder: number): SshConnection {
  return {
    id,
    name: id,
    host: `${id}.example.com`,
    port: 22,
    username: "deploy",
    authMethod: "agent",
    privateKeyId: null,
    jumpHostId: null,
    startupCommands: null,
    colorTag: null,
    folderPath,
    sortOrder,
    createdAt: "",
    updatedAt: "",
  };
}

const CONNS = [conn("web", "prod", 2), conn("db", "prod", 1), conn("laptop", "/", 0), conn("ci", " ", 3), conn("stage", "staging", 4)];

describe("folderOf", () => {
  it("treats blank and root folder paths as no folder and trims the rest", () => {
    expect(folderOf(conn("a", "/", 0))).toBeNull();
    expect(folderOf(conn("a", "  ", 0))).toBeNull();
    expect(folderOf(conn("a", " prod ", 0))).toBe("prod");
  });
});

describe("buildTreeRows", () => {
  it("lists folders with their sorted connections first, then loose connections", () => {
    const rows = buildTreeRows(CONNS, new Set());
    expect(rows.map((r) => r.id)).toEqual([
      "folder:prod",
      "conn:db",
      "conn:web",
      "folder:staging",
      "conn:stage",
      "conn:laptop",
      "conn:ci",
    ]);
  });

  it("hides the connections of a collapsed folder but keeps its row", () => {
    const rows = buildTreeRows(CONNS, new Set(["prod"]));
    expect(rows.map((r) => r.id)).toEqual(["folder:prod", "folder:staging", "conn:stage", "conn:laptop", "conn:ci"]);
    expect(rows[0]).toMatchObject({ kind: "folder", expanded: false });
    expect(rows[0].kind === "folder" && rows[0].connections.map((c) => c.id)).toEqual(["db", "web"]);
  });

  it("is empty without connections", () => {
    expect(buildTreeRows([], new Set())).toEqual([]);
  });
});

describe("treeKeyAction", () => {
  const open = buildTreeRows(CONNS, new Set());
  const closed = buildTreeRows(CONNS, new Set(["prod"]));

  it("moves with Up/Down without wrapping, and jumps with Home/End", () => {
    expect(treeKeyAction(open, "conn:db", "ArrowDown")).toEqual({ focus: "conn:web" });
    expect(treeKeyAction(open, "conn:ci", "ArrowDown")).toEqual({ focus: "conn:ci" });
    expect(treeKeyAction(open, "folder:prod", "ArrowUp")).toEqual({ focus: "folder:prod" });
    expect(treeKeyAction(open, "conn:web", "Home")).toEqual({ focus: "folder:prod" });
    expect(treeKeyAction(open, "conn:web", "End")).toEqual({ focus: "conn:ci" });
  });

  it("expands a closed folder on Right, then steps into it", () => {
    expect(treeKeyAction(closed, "folder:prod", "ArrowRight")).toEqual({ toggleFolder: "prod" });
    expect(treeKeyAction(open, "folder:prod", "ArrowRight")).toEqual({ focus: "conn:db" });
  });

  it("collapses an open folder on Left, and steps from a child to its folder", () => {
    expect(treeKeyAction(open, "folder:prod", "ArrowLeft")).toEqual({ toggleFolder: "prod" });
    expect(treeKeyAction(closed, "folder:prod", "ArrowLeft")).toEqual({});
    expect(treeKeyAction(open, "conn:web", "ArrowLeft")).toEqual({ focus: "folder:prod" });
    expect(treeKeyAction(open, "conn:laptop", "ArrowLeft")).toEqual({});
  });

  it("ignores other keys and unknown rows", () => {
    expect(treeKeyAction(open, "conn:db", "Enter")).toBeNull();
    expect(treeKeyAction(open, "conn:gone", "ArrowDown")).toBeNull();
  });
});
