import { afterEach, describe, expect, it, vi } from "vitest";
import { pickFile } from "./pick-file";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("pickFile", () => {
  it("resolves with the chosen file", async () => {
    const file = new File(["{}"], "theme.json");
    vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(function (this: HTMLInputElement) {
      expect(this.type).toBe("file");
      expect(this.accept).toBe(".json");
      Object.defineProperty(this, "files", { value: [file] });
      this.onchange?.(new Event("change"));
    });
    await expect(pickFile(".json")).resolves.toBe(file);
  });

  it("resolves with null when the picker is cancelled", async () => {
    vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(function (this: HTMLInputElement) {
      this.oncancel?.(new Event("cancel"));
    });
    await expect(pickFile(".json")).resolves.toBeNull();
  });
});
