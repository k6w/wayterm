import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadTextFile } from "./download-file";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("downloadTextFile", () => {
  it("clicks a download link for a blob of the text, then frees the blob url", () => {
    const created: Blob[] = [];
    const revoke = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL: (blob: Blob) => {
        created.push(blob);
        return "blob:nexterm/1";
      },
      revokeObjectURL: revoke,
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe("rows.csv");
      expect(this.getAttribute("href")).toBe("blob:nexterm/1");
    });

    downloadTextFile("rows.csv", "a,b\n1,2", "text/csv");

    expect(click).toHaveBeenCalledTimes(1);
    expect(created[0].type).toBe("text/csv");
    expect(created[0].size).toBe(7);
    expect(revoke).toHaveBeenCalledWith("blob:nexterm/1");
  });
});
