import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SshConfigImportDialog from "./SshConfigImportDialog";
import { sshConfigHosts, sshConfigImport, type SshConfigHost, type SshConfigHosts } from "../../lib/ipc";
import { useSshStore } from "../../stores/ssh";
import { useToastStore } from "../../stores/toast";

vi.mock("../../lib/ipc", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/ipc")>()),
  sshConfigHosts: vi.fn(),
  sshConfigImport: vi.fn(),
  sshListConnections: vi.fn(async () => []),
  sshListKeys: vi.fn(async () => []),
}));

function host(alias: string, extra: Partial<SshConfigHost> = {}): SshConfigHost {
  return {
    alias,
    hostname: `${alias}.example.com`,
    user: "me",
    port: 22,
    identityFiles: [],
    proxyJump: null,
    forwardAgent: false,
    localForwards: [],
    remoteForwards: [],
    dynamicForwards: [],
    alreadyImported: false,
    ...extra,
  };
}

const config = (hosts: SshConfigHost[], extra: Partial<SshConfigHosts> = {}): SshConfigHosts => ({
  found: true,
  path: "/home/me/.ssh/config",
  hosts,
  warnings: [],
  ...extra,
});

beforeEach(() => {
  vi.mocked(sshConfigHosts).mockReset();
  vi.mocked(sshConfigImport).mockReset();
  useToastStore.setState({ toasts: [] });
  useSshStore.setState({ connections: [] });
});

async function open(data: SshConfigHosts) {
  vi.mocked(sshConfigHosts).mockResolvedValue(data);
  const onClose = vi.fn();
  render(<SshConfigImportDialog isOpen onClose={onClose} />);
  const dialog = await screen.findByRole("dialog", { name: "Import from ~/.ssh/config" });
  return { dialog, onClose, user: userEvent.setup() };
}

describe("SshConfigImportDialog", () => {
  it("lists each host with its endpoint, key file and jump host", async () => {
    const { dialog } = await open(
      config([
        host("web", { user: "deploy", port: 2200, identityFiles: ["/home/me/.ssh/id_ed25519"] }),
        host("db", { proxyJump: "bastion" }),
      ])
    );
    const web = await within(dialog).findByRole("checkbox", { name: "web" });
    const row = web.closest("li") as HTMLElement;
    expect(within(row).getByText("deploy@web.example.com:2200")).toHaveClass("font-mono");
    expect(row).toHaveTextContent("id_ed25519");
    const dbRow = within(dialog).getByRole("checkbox", { name: "db" }).closest("li") as HTMLElement;
    expect(within(dbRow).getByText("via bastion")).toBeInTheDocument();
  });

  it("selects everything not saved yet, and leaves saved hosts off and disabled", async () => {
    const { dialog } = await open(config([host("a"), host("b", { alreadyImported: true })]));
    expect(await within(dialog).findByRole("checkbox", { name: "a" })).toBeChecked();
    const saved = within(dialog).getByRole("checkbox", { name: "b" });
    expect(saved).not.toBeChecked();
    expect(saved).toBeDisabled();
    expect(within(dialog).getByText("Saved")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Import 1 host" })).toBeEnabled();
  });

  it("selects all and none", async () => {
    const { dialog, user } = await open(config([host("a"), host("b"), host("c", { alreadyImported: true })]));
    await within(dialog).findByRole("checkbox", { name: "a" });
    await user.click(within(dialog).getByRole("button", { name: "Select none" }));
    expect(within(dialog).getByRole("checkbox", { name: "a" })).not.toBeChecked();
    expect(within(dialog).getByRole("button", { name: "Import" })).toBeDisabled();
    await user.click(within(dialog).getByRole("button", { name: "Select all" }));
    expect(within(dialog).getByRole("checkbox", { name: "b" })).toBeChecked();
    expect(within(dialog).getByRole("checkbox", { name: "c" })).not.toBeChecked();
    expect(within(dialog).getByRole("button", { name: "Import 2 hosts" })).toBeEnabled();
  });

  it("imports the selected aliases, reloads connections, toasts the counts and closes", async () => {
    vi.mocked(sshConfigImport).mockResolvedValue({
      imported: [{ alias: "b", connectionId: "id-b" }],
      skipped: [],
      warnings: ["b: ProxyCommand is not supported"],
    });
    const { dialog, user, onClose } = await open(config([host("a"), host("b")]));
    await user.click(await within(dialog).findByRole("checkbox", { name: "a" }));
    await user.click(within(dialog).getByRole("button", { name: "Import 1 host" }));
    await waitFor(() => expect(sshConfigImport).toHaveBeenCalledWith(["b"]));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(useToastStore.getState().toasts[0]).toMatchObject({ message: "Imported 1 connection, 1 warning", variant: "success" });
  });

  it("keeps the dialog open and says why when the import fails", async () => {
    vi.mocked(sshConfigImport).mockRejectedValue(new Error("database is locked"));
    const { dialog, user, onClose } = await open(config([host("a")]));
    await user.click(await within(dialog).findByRole("button", { name: "Import 1 host" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("database is locked");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("summarises the warnings from the config", async () => {
    const { dialog, user } = await open(config([host("a")], { warnings: ["Match block at config:4 was skipped (not supported)", "x: ProxyCommand is not supported"] }));
    const toggle = await within(dialog).findByRole("button", { name: /2 notes/ });
    expect(within(dialog).queryByText(/Match block/)).not.toBeInTheDocument();
    await user.click(toggle);
    expect(within(dialog).getByText(/Match block/)).toBeInTheDocument();
  });

  it("explains when there is no config file", async () => {
    const { dialog } = await open(config([], { found: false }));
    expect(await within(dialog).findByText("No SSH config found")).toBeInTheDocument();
    expect(within(dialog).getByText(/There is no file at/)).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /^Import/ })).not.toBeInTheDocument();
  });

  it("explains when the config has no named hosts", async () => {
    const { dialog } = await open(config([]));
    expect(await within(dialog).findByText("No hosts to import")).toBeInTheDocument();
  });

  it("shows why the config could not be read", async () => {
    vi.mocked(sshConfigHosts).mockRejectedValue(new Error("permission denied"));
    render(<SshConfigImportDialog isOpen onClose={() => {}} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("permission denied");
  });
});
