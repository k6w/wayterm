import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { invoke } from "@tauri-apps/api/core";
import SerialDialog from "./SerialDialog";

const PORTS = [
  { portName: "/dev/ttyUSB0", description: "CP2102" },
  { portName: "/dev/ttyUSB1", description: null },
];

beforeEach(() => {
  vi.mocked(invoke).mockImplementation(async () => null);
});

function renderDialog(open = true) {
  const onClose = vi.fn();
  const onConnect = vi.fn();
  const view = render(<SerialDialog open={open} onClose={onClose} onConnect={onConnect} />);
  return { user: userEvent.setup(), onClose, onConnect, ...view };
}

describe("SerialDialog", () => {
  it("lists detected ports and picks the first one", async () => {
    vi.mocked(invoke).mockImplementation(async (cmd) => (cmd === "serial_list_ports" ? PORTS : null));
    const { user } = renderDialog();
    const port = await screen.findByRole("combobox", { name: "Port" });
    await waitFor(() => expect(port).toHaveTextContent("/dev/ttyUSB0 — CP2102"));
    await user.click(port);
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "/dev/ttyUSB0 — CP2102",
      "/dev/ttyUSB1",
    ]);
  });

  it("falls back to a text field when no port is detected", async () => {
    renderDialog();
    const input = await screen.findByRole("textbox", { name: "Port" });
    await waitFor(() => expect(input).toHaveAccessibleDescription("No ports detected. Enter one manually."));
    expect(screen.getByRole("button", { name: "Connect" })).toBeDisabled();
  });

  it("connects with the chosen settings and closes", async () => {
    const { user, onConnect, onClose } = renderDialog();
    await user.type(await screen.findByRole("textbox", { name: "Port" }), "COM3");
    await user.click(screen.getByRole("combobox", { name: "Baud rate" }));
    await user.click(await screen.findByRole("option", { name: "9600" }));
    await user.click(screen.getByRole("combobox", { name: "Parity" }));
    await user.click(await screen.findByRole("option", { name: "even" }));
    await user.click(screen.getByRole("button", { name: "Connect" }));
    expect(onConnect).toHaveBeenCalledWith({
      portName: "COM3",
      baudRate: 9600,
      dataBits: 8,
      stopBits: 1,
      parity: "even",
      flowControl: "none",
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("connects with Enter from the port field", async () => {
    const { user, onConnect } = renderDialog();
    await user.type(await screen.findByRole("textbox", { name: "Port" }), "COM3{Enter}");
    expect(onConnect).toHaveBeenCalledWith(expect.objectContaining({ portName: "COM3", baudRate: 115200 }));
  });

  it("re-reads the ports from the refresh button", async () => {
    const { user } = renderDialog();
    await screen.findByRole("textbox", { name: "Port" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Refresh ports" })).toBeEnabled());
    vi.mocked(invoke).mockImplementation(async (cmd) => (cmd === "serial_list_ports" ? PORTS : null));
    await user.click(screen.getByRole("button", { name: "Refresh ports" }));
    expect(await screen.findByRole("combobox", { name: "Port" })).toHaveTextContent("/dev/ttyUSB0");
  });

  it("keeps its settings when reopened, and loads ports on each open", async () => {
    const { user, rerender, onClose, onConnect } = renderDialog();
    await user.type(await screen.findByRole("textbox", { name: "Port" }), "COM7");
    rerender(<SerialDialog open={false} onClose={onClose} onConnect={onConnect} />);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const listCalls = () => vi.mocked(invoke).mock.calls.filter(([cmd]) => cmd === "serial_list_ports").length;
    const before = listCalls();
    rerender(<SerialDialog open onClose={onClose} onConnect={onConnect} />);
    expect(await screen.findByRole("textbox", { name: "Port" })).toHaveValue("COM7");
    await waitFor(() => expect(listCalls()).toBe(before + 1));
  });

  it("cancels on Escape", async () => {
    const { user, onClose, onConnect } = renderDialog();
    await screen.findByRole("dialog", { name: "New serial connection" });
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConnect).not.toHaveBeenCalled();
  });
});
