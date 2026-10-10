import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemePicker } from "./ThemePicker";
import { BUILTIN_THEMES } from "../../themes";

function Harness({ onChange = vi.fn(), onPreview }: { onChange?: (id: string) => void; onPreview?: (id: string | null) => void }) {
  const [value, setValue] = useState("graphite");
  return (
    <ThemePicker
      aria-label="Theme"
      themes={BUILTIN_THEMES}
      value={value}
      onValueChange={(id) => {
        setValue(id);
        onChange(id);
      }}
      onPreview={onPreview}
    />
  );
}

describe("ThemePicker", () => {
  it("shows the four built-in themes as radio cards with the active one checked", () => {
    render(<Harness />);
    const group = screen.getByRole("radiogroup", { name: "Theme" });
    const cards = screen.getAllByRole("radio");
    expect(group).toContainElement(cards[0]);
    expect(cards.map((card) => card.textContent)).toEqual(["Graphitedark", "Frostdark", "Emberdark", "Paperlight"]);
    expect(screen.getByRole("radio", { name: /Graphite/ })).toBeChecked();
  });

  it("paints each swatch from the theme's own colors", () => {
    render(<Harness />);
    const swatch = screen.getByRole("radio", { name: /Paper/ }).firstElementChild as HTMLElement;
    const paper = BUILTIN_THEMES.find((t) => t.id === "paper")!;
    expect(swatch.style.getPropertyValue("--wt-dyn-term-bg")).toBe(paper.terminal.background);
    expect(swatch.style.getPropertyValue("--wt-dyn-accent")).toBe(paper.chrome.accent);
  });

  it("picks with a click and with the arrow keys", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.click(screen.getByRole("radio", { name: /Ember/ }));
    expect(onChange).toHaveBeenLastCalledWith("ember");
    // Radix moves focus on a timer and checks the card only while the arrow is
    // still down (a real key press), so hold it until the change lands.
    await user.keyboard("{ArrowRight>}");
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith("paper"));
    await user.keyboard("{/ArrowRight}");
    expect(screen.getByRole("radio", { name: /Paper/ })).toHaveFocus();
    expect(screen.getByRole("radio", { name: /Paper/ })).toBeChecked();
  });

  it("previews on hover and clears the preview on leave", async () => {
    const user = userEvent.setup();
    const onPreview = vi.fn();
    render(<Harness onPreview={onPreview} />);
    await user.hover(screen.getByRole("radio", { name: /Frost/ }));
    expect(onPreview).toHaveBeenLastCalledWith("frost");
    await user.unhover(screen.getByRole("radio", { name: /Frost/ }));
    expect(onPreview).toHaveBeenLastCalledWith(null);
  });

  it("checks nothing when the active theme is a custom one", () => {
    render(<ThemePicker aria-label="Theme" themes={BUILTIN_THEMES} value="my-custom" onValueChange={vi.fn()} />);
    for (const card of screen.getAllByRole("radio")) expect(card).not.toBeChecked();
  });
});
