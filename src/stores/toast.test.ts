import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast, useToastStore } from "./toast";

beforeEach(() => {
  vi.useFakeTimers();
  useToastStore.setState({ toasts: [] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("toast store", () => {
  it("dismisses info toasts after 3.5s and errors after 6s by default", () => {
    toast.info("hello");
    toast.error("boom");
    vi.advanceTimersByTime(3500);
    expect(useToastStore.getState().toasts.map((t) => t.message)).toEqual(["boom"]);
    vi.advanceTimersByTime(2500);
    expect(useToastStore.getState().toasts).toEqual([]);
  });

  it("honors a custom duration", () => {
    toast.info("notice", { durationMs: 12_000 });
    vi.advanceTimersByTime(11_999);
    expect(useToastStore.getState().toasts).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});
