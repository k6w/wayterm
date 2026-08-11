import { describe, expect, it } from "vitest";
import { baseName, breadcrumbs, joinLocal, joinRemote, parentPath, renamedPath } from "./sftp-paths";

describe("parentPath", () => {
  it("goes up one level and stops at the root", () => {
    expect(parentPath("/srv/app/")).toBe("/srv");
    expect(parentPath("/srv")).toBe("/");
    expect(parentPath("/")).toBe("/");
    expect(parentPath("C:/Users/me")).toBe("C:/Users");
    expect(parentPath("C:/Users")).toBe("C:/");
    expect(parentPath("C:/")).toBe("C:/");
  });
});

describe("joining and naming", () => {
  it("joins remote and local paths with the right separator", () => {
    expect(joinRemote("/srv/", "a.txt")).toBe("/srv/a.txt");
    expect(joinRemote("/", "a.txt")).toBe("/a.txt");
    expect(joinLocal("/home/me/", "a.txt")).toBe("/home/me/a.txt");
    expect(joinLocal("C:\\Users\\me\\", "a.txt")).toBe("C:\\Users\\me\\a.txt");
  });

  it("takes the last segment of either kind of path", () => {
    expect(baseName("/srv/app/a.txt")).toBe("a.txt");
    expect(baseName("C:\\Users\\me\\b.log")).toBe("b.log");
  });

  it("renames within the same directory", () => {
    expect(renamedPath("/srv/app/a.txt", "b.txt")).toBe("/srv/app/b.txt");
    expect(renamedPath("/a.txt", "b.txt")).toBe("/b.txt");
  });
});

describe("breadcrumbs", () => {
  it("splits POSIX paths under the root", () => {
    expect(breadcrumbs("/srv/app")).toEqual([
      { name: "/", path: "/" },
      { name: "srv", path: "/srv" },
      { name: "app", path: "/srv/app" },
    ]);
    expect(breadcrumbs("/")).toEqual([{ name: "/", path: "/" }]);
  });

  it("splits Windows paths under the drive", () => {
    expect(breadcrumbs("C:\\Users\\me")).toEqual([
      { name: "C:/", path: "C:/" },
      { name: "Users", path: "C:/Users" },
      { name: "me", path: "C:/Users/me" },
    ]);
  });
});
