import { describe, expect, it } from "vitest";
import {
  EMPTY_DATABASE_FORM,
  changeDatabaseType,
  connectionString,
  DEFAULT_PORTS,
  cellText,
  historyStep,
  resultsToCsv,
  toDatabaseConnection,
  validateDatabaseForm,
} from "./database-form";

describe("validateDatabaseForm", () => {
  it("requires name, host, database and username, and a real port", () => {
    expect(validateDatabaseForm({ ...EMPTY_DATABASE_FORM, host: " ", port: "54x" })).toEqual({
      name: "Enter a name.",
      host: "Enter a host.",
      port: "Use a port from 1 to 65535.",
      database: "Enter a database.",
      username: "Enter a username.",
    });
    expect(
      validateDatabaseForm({ ...EMPTY_DATABASE_FORM, name: "app", database: "app", username: "me" })
    ).toEqual({});
  });
});

describe("toDatabaseConnection", () => {
  it("gives a new connection an id and a numeric port", () => {
    expect(
      toDatabaseConnection(
        { ...EMPTY_DATABASE_FORM, name: " app ", database: "app", username: "me", port: "6543", ssl: true },
        () => "id-1"
      )
    ).toEqual({
      id: "id-1",
      name: "app",
      type: "postgresql",
      host: "localhost",
      port: 6543,
      database: "app",
      username: "me",
      password: "",
      ssl: true,
    });
  });
});

describe("resultsToCsv", () => {
  it("writes a header and quotes fields that need it", () => {
    expect(
      resultsToCsv(["id", "note"], [
        { id: 1, note: 'say "hi", ok' },
        { id: 2, note: null },
        { id: 3, note: "two\nlines" },
      ])
    ).toBe('id,note\n1,"say ""hi"", ok"\n2,\n3,"two\nlines"');
  });

  it("renders null and undefined as empty cells", () => {
    expect(cellText(null)).toBe("");
    expect(cellText(undefined)).toBe("");
    expect(cellText(0)).toBe("0");
    expect(cellText(false)).toBe("false");
  });
});

describe("historyStep", () => {
  it("walks to older queries and back to the draft", () => {
    expect(historyStep(-1, "ArrowUp", 3)).toBe(0);
    expect(historyStep(2, "ArrowUp", 3)).toBe(2);
    expect(historyStep(1, "ArrowDown", 3)).toBe(0);
    expect(historyStep(0, "ArrowDown", 3)).toBe(-1);
  });
});

describe("per-driver form", () => {
  it("has the standard default port for each networked driver", () => {
    expect(DEFAULT_PORTS).toEqual({ postgresql: 5432, mysql: 3306, mongodb: 27017 });
  });

  it("switches the port with the driver while it is still the default", () => {
    expect(changeDatabaseType(EMPTY_DATABASE_FORM, "mysql")).toMatchObject({ type: "mysql", port: "3306" });
    expect(changeDatabaseType({ ...EMPTY_DATABASE_FORM, type: "mysql", port: "3306" }, "mongodb").port).toBe("27017");
  });

  it("keeps a port the user typed", () => {
    expect(changeDatabaseType({ ...EMPTY_DATABASE_FORM, port: "6543" }, "mysql").port).toBe("6543");
  });

  it("SQLite needs only a name and a file path", () => {
    const sqlite = { ...EMPTY_DATABASE_FORM, type: "sqlite" as const, host: "", port: "", username: "" };
    expect(validateDatabaseForm(sqlite)).toEqual({ name: "Enter a name.", database: "Enter a file path." });
    expect(validateDatabaseForm({ ...sqlite, name: "local", database: "/tmp/app.db" })).toEqual({});
  });

  it.each(["postgresql", "mysql", "mongodb"] as const)("%s still requires host, port, database and user", (type) => {
    const errors = validateDatabaseForm({ ...EMPTY_DATABASE_FORM, type, name: "x", host: "", port: "", username: "" });
    expect(Object.keys(errors).sort()).toEqual(["database", "host", "port", "username"]);
  });

  it("saves a SQLite connection with no network fields", () => {
    expect(
      toDatabaseConnection(
        { ...EMPTY_DATABASE_FORM, type: "sqlite", name: "local", database: " /tmp/app.db ", username: "x", ssl: true },
        () => "id-2"
      )
    ).toEqual({
      id: "id-2",
      name: "local",
      type: "sqlite",
      host: "",
      port: 0,
      database: "/tmp/app.db",
      username: "",
      password: "",
      ssl: false,
    });
  });
});

describe("connectionString", () => {
  it("builds a server URL without the password", () => {
    const form = { ...EMPTY_DATABASE_FORM, username: "me", password: "secret", database: "app" };
    expect(connectionString(form)).toBe("postgresql://me@localhost:5432/app");
    expect(connectionString({ ...form, ssl: true })).toBe("postgresql://me@localhost:5432/app?ssl=true");
    expect(connectionString(form)).not.toContain("secret");
  });

  it("leaves out the parts that are still empty", () => {
    expect(connectionString(EMPTY_DATABASE_FORM)).toBe("postgresql://localhost:5432");
  });

  it("shows a file for SQLite", () => {
    expect(connectionString({ ...EMPTY_DATABASE_FORM, type: "sqlite", database: "/tmp/app.db" })).toBe("sqlite:/tmp/app.db");
  });
});
