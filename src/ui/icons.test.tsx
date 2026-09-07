/// <reference types="vite/client" />
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Icon, Icons, type IconName } from "./icons";

describe("icon registry", () => {
  const names = Object.keys(Icons) as IconName[];

  it("has entries", () => {
    expect(names.length).toBeGreaterThan(0);
  });

  it.each(names)("renders %s as an svg", (name) => {
    const { container } = render(<Icon name={name} size="sm" />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("maps sm/md to 14/16 and keeps stroke width", () => {
    const sm = render(<Icon name="close" size="sm" />).container.querySelector("svg");
    const md = render(<Icon name="close" size="md" />).container.querySelector("svg");
    expect(sm?.getAttribute("width")).toBe("14");
    expect(md?.getAttribute("width")).toBe("16");
    expect(md?.getAttribute("stroke-width")).toBe("1.5");
  });
});

describe("icon library confinement", () => {
  const sources = import.meta.glob<string>("../**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true });

  it("only src/ui/icons.tsx imports lucide-react", () => {
    const offenders = Object.entries(sources)
      .filter(([file]) => !/(^|\/)icons(\.test)?\.tsx$/.test(file))
      .filter(([, code]) => /from\s+["']lucide-react["']|require\(["']lucide-react["']\)/.test(code))
      .map(([file]) => file);
    expect(Object.keys(sources).length).toBeGreaterThan(50);
    expect(offenders).toEqual([]);
  });
});
