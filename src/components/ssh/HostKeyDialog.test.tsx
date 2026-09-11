import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
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

const OLD_FP = "SHA256:ANn8TSkGESlxtfcNBritd0+eASn7b4Qk2d2wkUd9m+8";
const NEW_FP = "SHA256:LBuyLim8IdHpu2wb2n4XlpdeS449E1PMNZHGyxEusKo";

const CHANGED: HostKeyPrompt = {
  kind: "changed",
  mismatch: {
    host: "example.com",
    port: 22,
    knownHostsPath: "/home/u/.ssh/known_hosts",
    oldKeys: [{ keyType: "ssh-ed25519", fingerprint: OLD_FP, lineNumber: 4 }],
    newKeyType: "ssh-ed25519",
    newFingerprint: NEW_FP,
    newKeyB64: "AAAAC3NzaC1lZDI1NTE5AAAAICNbsieyVJqvXuKZPxUkHI3LEHkelfGm1+sUEaCQ9gax",
  },
};

function renderDialog(prompt: HostKeyPrompt | null, pending = false, replaceError: string | null = null) {
  const handlers = { onTrust: vi.fn(), onReplace: vi.fn(), onOpenSettings: vi.fn(), onCancel: vi.fn() };
  render(<HostKeyDialog prompt={prompt} pending={pending} replaceError={replaceError} {...handlers} />);
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
    const confirmInput = () => screen.getByRole("textbox", { name: /last 4 characters/i });
    const replaceButton = () => screen.getByRole("button", { name: "Replace key and connect" });

    it("warns about a possible attack and shows saved and presented keys side by side", async () => {
      renderDialog(CHANGED);
      const dialog = await screen.findByRole("dialog", { name: "Host key changed" });
      expect(dialog).toHaveAccessibleDescription(/example\.com/);
      expect(screen.getByText(/man-in-the-middle/)).toBeInTheDocument();
      expect(dialog.querySelector(".bg-danger-subtle")).not.toBeNull();

      const saved = screen.getByRole("group", { name: "Saved key" });
      const presented = screen.getByRole("group", { name: "Server now presents" });
      expect(within(saved).getByTestId("fingerprint").textContent).toBe(OLD_FP.slice("SHA256:".length));
      expect(within(presented).getByTestId("fingerprint").textContent).toBe(NEW_FP.slice("SHA256:".length));
      expect(within(presented).getByTestId("fingerprint").children[0]).toHaveTextContent("LBuy");
      expect(within(presented).getByTestId("fingerprint")).toHaveClass("font-mono");
      expect(within(saved).getByText("ssh-ed25519")).toBeInTheDocument();
      expect(within(presented).getByText("ssh-ed25519")).toBeInTheDocument();
      expect(within(saved).getByText(/line 4/)).toBeInTheDocument();
    });

    it("explains how to verify the fingerprint", async () => {
      renderDialog(CHANGED);
      await screen.findByRole("dialog");
      expect(screen.getByText("ssh-keygen -lf /etc/ssh/ssh_host_*_key.pub")).toBeInTheDocument();
      expect(screen.getByText(/server administrator/)).toBeInTheDocument();
    });

    it("starts on Cancel; Enter there cancels and does not replace", async () => {
      const { user, onCancel, onReplace } = renderDialog(CHANGED);
      await screen.findByRole("dialog");
      expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
      await user.keyboard("{Enter}");
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onReplace).not.toHaveBeenCalled();
    });

    it("cancels on Escape without replacing", async () => {
      const { user, onCancel, onReplace } = renderDialog(CHANGED);
      await screen.findByRole("dialog");
      await user.keyboard("{Escape}");
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onReplace).not.toHaveBeenCalled();
    });

    it("keeps Replace disabled until the last 4 characters of the new fingerprint are typed exactly", async () => {
      const { user, onReplace } = renderDialog(CHANGED);
      await screen.findByRole("dialog");
      expect(replaceButton()).toBeDisabled();
      expect(confirmInput()).toHaveClass("font-mono");

      await user.type(confirmInput(), "usko");
      expect(replaceButton()).toBeDisabled();
      await user.clear(confirmInput());
      // The saved key's suffix does not unlock it.
      await user.type(confirmInput(), "m+8");
      expect(replaceButton()).toBeDisabled();
      await user.clear(confirmInput());
      await user.type(confirmInput(), "usKo");
      expect(replaceButton()).toBeEnabled();
      expect(replaceButton()).toHaveClass("bg-danger");

      await user.click(replaceButton());
      expect(onReplace).toHaveBeenCalledTimes(1);
    });

    it("does not replace on Enter in the confirmation field", async () => {
      const { user, onReplace } = renderDialog(CHANGED);
      await screen.findByRole("dialog");
      await user.type(confirmInput(), "usKo{Enter}");
      expect(onReplace).not.toHaveBeenCalled();
    });

    it("shows a replace error inline and keeps the dialog open", async () => {
      renderDialog(CHANGED, false, "The saved key for example.com no longer matches");
      const dialog = await screen.findByRole("dialog", { name: "Host key changed" });
      expect(within(dialog).getByText(/no longer matches/)).toBeInTheDocument();
    });

    it("disables both actions and ignores Escape while replacing", async () => {
      const { user, onCancel } = renderDialog(CHANGED, true);
      await screen.findByRole("dialog");
      expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
      expect(replaceButton()).toBeDisabled();
      await user.keyboard("{Escape}");
      expect(onCancel).not.toHaveBeenCalled();
    });

    it("keeps SSH settings as a secondary link", async () => {
      const { user, onOpenSettings, onCancel, onReplace } = renderDialog(CHANGED);
      await user.click(await screen.findByRole("button", { name: "Open SSH settings" }));
      expect(onOpenSettings).toHaveBeenCalledTimes(1);
      expect(onCancel).not.toHaveBeenCalled();
      expect(onReplace).not.toHaveBeenCalled();
    });
  });
});
