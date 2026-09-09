import { Suspense } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, renderHook, screen } from "@testing-library/react";
import { lazyWithPreload, useEverTrue } from "./lazy";

describe("lazyWithPreload", () => {
  it("shows the fallback, then renders the component once the chunk resolves", async () => {
    const Panel = lazyWithPreload(async () => ({ default: () => <p>loaded panel</p> }));
    render(
      <Suspense fallback={<span role="status">loading</span>}>
        <Panel />
      </Suspense>
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(await screen.findByText("loaded panel")).toBeInTheDocument();
  });

  it("fetches the chunk once across preload and render", async () => {
    const factory = vi.fn(async () => ({ default: () => <p>once</p> }));
    const Panel = lazyWithPreload(factory);
    await Panel.preload();
    await Panel.preload();
    render(
      <Suspense fallback={null}>
        <Panel />
      </Suspense>
    );
    expect(await screen.findByText("once")).toBeInTheDocument();
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("allows a retry after a failed preload", async () => {
    const factory = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ default: () => <p>x</p> });
    const Panel = lazyWithPreload(factory);
    await Panel.preload();
    await Panel.preload();
    expect(factory).toHaveBeenCalledTimes(2);
  });
});

describe("useEverTrue", () => {
  it("stays true once the value has been true", () => {
    const { result, rerender } = renderHook(({ v }) => useEverTrue(v), { initialProps: { v: false } });
    expect(result.current).toBe(false);
    rerender({ v: true });
    expect(result.current).toBe(true);
    rerender({ v: false });
    expect(result.current).toBe(true);
  });
});
