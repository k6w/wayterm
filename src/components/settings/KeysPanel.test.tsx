import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import KeysPanel from "./KeysPanel";
import { useSshStore } from "../../stores/ssh";
import type { SshKey } from "../../types/ssh";

const KEY: SshKey = {
  id: "k1",
  name: "laptop",
  algorithm: "ed25519",
  publicKey: "ssh-ed25519 AAAA laptop",
  fingerprint: "SHA256:0123456789abcdefghijklmnop",
  createdAt: "2026-01-01",
};

const actions = {
  loadKeys: vi.fn(async () => {}),
  importKey: vi.fn(async () => KEY),
  removeKey: vi.fn(async () => {}),
  updateKey: vi.fn(async () => {}),
};

beforeEach(() => {
  useSshStore.setState({ keys: [], ...actions });
});

describe("KeysPanel", () => {
  it("loads keys and offers an import from the empty state", async () => {
    const user = userEvent.setup();
    render(<KeysPanel />);
    expect(actions.loadKeys).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Import your first key" }));
    expect(screen.getByRole("textbox", { name: "Key name" })).toHaveFocus();
  });

  it("imports a pasted key once name and private key are filled", async () => {
    const user = userEvent.setup();
    render(<KeysPanel />);
    await user.click(screen.getByRole("button", { name: "Import key" }));
    const submit = screen.getByRole("button", { name: "Import" });
    expect(submit).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: "Key name" }), " work ");
    await user.click(screen.getByRole("radio", { name: "RSA" }));
    await user.type(screen.getByRole("textbox", { name: "Private key (PEM)" }), "-----BEGIN KEY-----");
    expect(screen.getByRole("textbox", { name: "Private key (PEM)" })).toHaveAccessibleDescription("Stored encrypted locally");
    await user.click(submit);
    expect(actions.importKey).toHaveBeenCalledWith({
      name: "work",
      publicKey: "",
      privateKeyPem: "-----BEGIN KEY-----",
      algorithm: "rsa",
    });
    expect(screen.queryByRole("textbox", { name: "Key name" })).not.toBeInTheDocument();
  });

  it("edits a key's name and public key", async () => {
    const user = userEvent.setup();
    useSshStore.setState({ keys: [KEY] });
    render(<KeysPanel />);
    expect(screen.getByText("ed25519 · SHA256:0123456789abcdef…")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit laptop" }));
    const name = screen.getByRole("textbox", { name: "Key name" });
    await user.clear(name);
    await user.type(name, "desktop");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(actions.updateKey).toHaveBeenCalledWith("k1", "desktop", KEY.publicKey);
  });

  it("copies the public key", async () => {
    const user = userEvent.setup();
    useSshStore.setState({ keys: [KEY] });
    render(<KeysPanel />);
    await user.click(screen.getByRole("button", { name: "Copy public key of laptop" }));
    await expect(navigator.clipboard.readText()).resolves.toBe(KEY.publicKey);
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
  });

  it("deletes a key after confirming", async () => {
    const user = userEvent.setup();
    useSshStore.setState({ keys: [KEY] });
    render(<KeysPanel />);
    await user.click(screen.getByRole("button", { name: "Delete laptop" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete SSH key" });
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(actions.removeKey).toHaveBeenCalledWith("k1");
  });
});
