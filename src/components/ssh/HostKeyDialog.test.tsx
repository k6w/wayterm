import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HostKeyDialog, { type HostKeyPrompt } from "./HostKeyDialog";

const UNKNOWN: HostKeyPrompt = {
  kind: "unknown",
  key: {
    host: "example.com",
    port: 2222,
    keyType: "ssh-ed25519",
    keyData: "AAAAC3NzaC1lZDI1NTE5",
    fingerprint: "SHA256:uNiVztksCsDhcc0u9e8BujQXVUpKZIDTMczCvj3tD2s",
  },
};

const CHANGED: HostKeyPrompt = { kind: "changed", host: "example.com", port: 22 };

function renderDialog(prompt: HostKeyPrompt | null, pending = false) {
  const handlers = { onTrust: vi.fn(), onOpenSettings: vi.fn(), onCancel: vi.fn() };
  render(<HostKeyDialog prompt={prompt} pending={pending} {...handlers} />);
  return { user: userEvent.setup(), ...handlers };
}

describe("HostKeyDialog", () => {
  it("stays closed without a prompt", () => {
    renderDialog(null);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  describe("unknown host", () => {
    it("shows the host, key type and the fingerprint in groups", async () => {
      renderDialog(UNKNOWN);
      const dialog = await screen.findByRole("dialog", { name: "Unknown host" });
      expect(dialog).toHaveAccessibleDescription(/first connection to example\.com:2222/);
      expect(screen.getByText("ssh-ed25519")).toBeInTheDocument();
      expect(screen.getByText("SHA256")).toBeInTheDocument();
      const fingerprint = screen.getByTestId("fingerprint");
      expect(fingerprint.children).toHaveLength(11);
      expect(fingerprint.children[0]).toHaveTextContent("uNiV");
      expect(fingerprint).toHaveClass("font-mono");
      expect(fingerprint.textContent).toBe("uNiVztksCsDhcc0u9e8BujQXVUpKZIDTMczCvj3tD2s");
    });

    it("starts on Cancel, so Enter does not trust the host", async () => {
      const { user, onTrust, onCancel } = renderDialog(UNKNOWN);
      await screen.findByRole("dialog");
      expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
      await user.keyboard("{Enter}");
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onTrust).not.toHaveBeenCalled();
    });

    it("trusts the host from its button", async () => {
      const { user, onTrust } = renderDialog(UNKNOWN);
      await user.click(await screen.findByRole("button", { name: "Trust host" }));
      expect(onTrust).toHaveBeenCalledTimes(1);
    });

    it("disables Trust and Cancel and ignores Escape while pending", async () => {
      const { user, onTrust, onCancel } = renderDialog(UNKNOWN, true);
      await screen.findByRole("dialog");
      expect(screen.getByRole("button", { name: "Trust host" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
      await user.keyboard("{Escape}");
      expect(onCancel).not.toHaveBeenCalled();
      expect(onTrust).not.toHaveBeenCalled();
    });

    it("cancels on Escape", async () => {
      const { user, onCancel } = renderDialog(UNKNOWN);
      await screen.findByRole("dialog");
      await user.keyboard("{Escape}");
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe("changed key", () => {
    it("warns about a possible attack, shows the host, and starts on Close", async () => {
      renderDialog(CHANGED);
      const dialog = await screen.findByRole("dialog", { name: "Host key changed" });
      expect(dialog).toHaveAccessibleDescription(/example\.com.*differs from the one saved/);
      expect(screen.getByRole("alert")).toHaveTextContent(/man-in-the-middle|attack/);
      expect(screen.getByRole("alert")).toHaveClass("bg-danger-subtle");
      expect(dialog).toHaveTextContent("example.com");
      expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    });

    it("offers no trust or removal action", async () => {
      renderDialog(CHANGED);
      await screen.findByRole("dialog");
      expect(screen.queryByRole("button", { name: /remove|trust|replace|reconnect/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    });

    it("closes on Escape and on Enter (focused Close)", async () => {
      const { user, onCancel, onOpenSettings } = renderDialog(CHANGED);
      await screen.findByRole("dialog");
      await user.keyboard("{Enter}");
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onOpenSettings).not.toHaveBeenCalled();
    });

    it("closes on Escape", async () => {
      const { user, onCancel } = renderDialog(CHANGED);
      await screen.findByRole("dialog");
      await user.keyboard("{Escape}");
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("opens SSH settings from the secondary button", async () => {
      const { user, onOpenSettings, onCancel } = renderDialog(CHANGED);
      await user.click(await screen.findByRole("button", { name: "Open SSH settings" }));
      expect(onOpenSettings).toHaveBeenCalledTimes(1);
      expect(onCancel).not.toHaveBeenCalled();
    });
  });
});
