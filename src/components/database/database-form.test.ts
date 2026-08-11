import { describe, expect, it } from "vitest";
import {
  EMPTY_DATABASE_FORM,
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
