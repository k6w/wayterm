import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dialog, DialogContent, FormCard, FormDisclosure, FormGroup, FormRow, Input, PreviewChip } from "./index";

describe("FormRow", () => {
  it("labels the control and describes it with the hint", () => {
    render(
      <FormCard>
        <FormRow label="Host" hint="Hostname or IP">
          {(control) => <Input {...control} />}
        </FormRow>
      </FormCard>
    );
    expect(screen.getByRole("textbox", { name: "Host" })).toHaveAccessibleDescription("Hostname or IP");
  });

  it("marks the control invalid and describes it with the error instead of the hint", () => {
    render(
      <FormRow label="Port" hint="1-65535" error="Port is required">
        {(control) => <Input {...control} />}
      </FormRow>
    );
    const input = screen.getByRole("textbox", { name: "Port" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Port is required");
  });
});

describe("FormGroup", () => {
  it("is a region named by its title", () => {
    render(<FormGroup title="Connection">row</FormGroup>);
    expect(screen.getByRole("region", { name: "Connection" })).toBeInTheDocument();
  });
});

describe("FormDisclosure", () => {
  it("is collapsed by default, toggles with aria-expanded and shows the count", async () => {
    const user = userEvent.setup();
    render(
      <FormDisclosure title="Advanced" count={2}>
        <p>inner</p>
      </FormDisclosure>
    );
    const toggle = screen.getByRole("button", { name: /Advanced/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId("disclosure-count")).toHaveTextContent("2");
    expect(screen.queryByText("inner")).not.toBeInTheDocument();
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("inner")).toBeInTheDocument();
  });

  it("hides the count at zero", () => {
    render(<FormDisclosure title="Advanced">x</FormDisclosure>);
    expect(screen.queryByTestId("disclosure-count")).not.toBeInTheDocument();
  });
});

describe("PreviewChip", () => {
  it("is a named group showing its content", () => {
    render(<PreviewChip label="Connection preview">root@host:22</PreviewChip>);
    expect(screen.getByRole("group", { name: "Connection preview" })).toHaveTextContent("root@host:22");
  });
});

describe("DialogContent chrome", () => {
  it("shows the subtitle, default Esc hint and keeps the close button last in tab order", async () => {
    const user = userEvent.setup();
    render(
      <Dialog open>
        <DialogContent title="Title" description="Subtitle" footer={<button>Go</button>}>
          <input aria-label="field" />
        </DialogContent>
      </Dialog>
    );
    const dialog = await screen.findByRole("dialog", { name: "Title" });
    expect(dialog).toHaveAccessibleDescription("Subtitle");
    expect(screen.getByLabelText("Esc")).toBeInTheDocument();
    expect(screen.getByLabelText("field")).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Go" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
  });
});
