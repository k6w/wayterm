/// <reference types="vite/client" />
import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import pkg from "../../package.json?raw";
import { Icon, IconWeightProvider, Icons, type IconName } from "./icons";
import { IconButton } from "./IconButton";

describe("icon registry", () => {
  const names = Object.keys(Icons) as IconName[];

  it("has entries", () => {
    expect(names.length).toBeGreaterThan(0);
  });

  it.each(names)("renders %s as an svg", (name) => {
    const { container } = render(<Icon name={name} size="sm" />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("maps sm/md to 14/16", () => {
    const sm = render(<Icon name="close" size="sm" />).container.querySelector(
      "svg",
    );
    const md = render(<Icon name="close" size="md" />).container.querySelector(
      "svg",
    );
    expect(sm?.getAttribute("width")).toBe("14");
    expect(md?.getAttribute("width")).toBe("16");
  });

  it("defaults to regular weight; weight prop and IconWeightProvider switch to fill", () => {
    const glyph = (el: ReactElement) =>
      render(el).container.querySelector("svg")?.innerHTML;
    const regular = glyph(<Icon name="server" />);
    expect(glyph(<Icon name="server" weight="regular" />)).toBe(regular);
    const fill = glyph(<Icon name="server" weight="fill" />);
    expect(fill).not.toBe(regular);
    expect(
      glyph(
        <IconWeightProvider weight="fill">
          <Icon name="server" />
        </IconWeightProvider>,
      ),
    ).toBe(fill);
    expect(
      glyph(
        <IconWeightProvider weight="fill">
          <Icons.server size={16} />
        </IconWeightProvider>,
      ),
    ).toBe(fill);
  });
});

describe("icon library confinement", () => {
  const sources = import.meta.glob<string>("../**/*.{ts,tsx}", {
    query: "?raw",
    import: "default",
    eager: true,
  });

  it("only src/ui/icons.tsx imports the icon library; lucide-react is gone", () => {
    const offenders = Object.entries(sources)
      .filter(([file]) => !/(^|\/)icons(\.test)?\.tsx$/.test(file))
      .filter(([, code]) =>
        /from\s+["'](lucide-react|@phosphor-icons\/react)["']|require\(["'](lucide-react|@phosphor-icons\/react)["']\)/.test(
          code,
        ),
      )
      .map(([file]) => file);
    expect(Object.keys(sources).length).toBeGreaterThan(50);
    expect(offenders).toEqual([]);
  });
});

describe("pressed state uses fill weight", () => {
  it("IconButton fills its icon only while aria-pressed", () => {
    const glyph = (pressed: boolean) =>
      render(
        <IconButton
          label="t"
          pressed={pressed}
          icon={<Icon name="search" />}
        />,
      ).container.querySelector("svg")?.innerHTML;
    expect(glyph(true)).not.toBe(glyph(false));
  });

  it("package.json no longer depends on lucide-react", () => {
    expect(pkg).not.toMatch(/lucide-react/);
  });
});
