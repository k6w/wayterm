import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { Icon } from "./icons";
import { cn, focusRing } from "./utils";

/** Props a FormRow hands to its control. Spread them onto an Input, Textarea or Select. */
export interface FormRowControlProps {
  id: string;
  "aria-describedby"?: string;
  invalid: boolean;
}

const CONTROL_WIDTH = {
  /** Port, number, short code. */
  sm: "w-24",
  /** Text inputs and selects. */
  md: "w-[260px]",
  /** Switches, segmented controls and other self-sized controls. */
  auto: "",
} as const;

export interface FormRowProps {
  label: ReactNode;
  /** Muted help text under the label. Hidden while an error shows. */
  hint?: ReactNode;
  /** Inline validation message under the control. A non-empty string marks the control invalid. */
  error?: string | null;
  /** Width of the control column. "full" puts the control on its own line under the label. */
  width?: keyof typeof CONTROL_WIDTH | "full";
  className?: string;
  children: ReactNode | ((control: FormRowControlProps) => ReactNode);
}

/**
 * One row of a FormCard: label (13px) and optional hint on the left, a compact
 * control on the right. Multi-line fields use width="full" and span the card.
 * Pass a function child to wire the label to the control (an element label);
 * a plain child is self-labelled and the row title is a span. Controls get id, aria-describedby and invalid so the label, hint and error
 * stay wired up.
 */
export function FormRow({ label, hint, error, width = "md", className, children }: FormRowProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error || hint;
  const full = width === "full";
  // Self-labelled controls (SegmentedControl, a group of buttons) carry their own aria-label.
  const labelled = typeof children === "function";
  const control: FormRowControlProps = {
    id,
    "aria-describedby": message ? messageId : undefined,
    invalid: Boolean(error),
  };
  return (
    <div className={cn("flex min-h-row gap-4 px-row-x py-row-y", full ? "flex-col gap-2" : "items-center justify-between", className)}>
      <div className="min-w-0">
        {labelled ? (
          <label htmlFor={id} className="block text-body text-fg">
            {label}
          </label>
        ) : (
          <span className="block text-body text-fg">{label}</span>
        )}
        {message && (
          <p id={messageId} className={cn("mt-0.5 text-label", error ? "text-danger" : "text-fg-muted")}>
            {message}
          </p>
        )}
      </div>
      <div className={cn(full ? "w-full" : "flex shrink-0 items-center justify-end gap-2", !full && CONTROL_WIDTH[width])}>
        {typeof children === "function" ? children(control) : children}
      </div>
    </div>
  );
}

/** Rounded card that separates its rows with hairlines. */
export function FormCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("divide-y divide-border overflow-hidden rounded-lg border border-border bg-panel", className)}>
      {children}
    </div>
  );
}

/** A small muted group label above one FormCard. Exposed as a region named by its title. */
export function FormGroup({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={cn("flex flex-col gap-1.5", className)}>
      <h3 id={headingId} className="px-1 text-caption font-semibold uppercase tracking-wide text-fg-muted">
        {title}
      </h3>
      <FormCard>{children}</FormCard>
    </section>
  );
}

export interface FormDisclosureProps {
  /** Row title, e.g. "Advanced". */
  title: string;
  /** Number of non-default values inside; shown as a count while above zero. */
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}

/** Collapsible card section: a chevron row that reveals more FormRows below it. */
export function FormDisclosure({ title, count = 0, defaultOpen = false, children }: FormDisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-panel">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex min-h-row w-full items-center gap-2 px-row-x py-row-y text-left text-body text-fg hover:bg-hover",
          focusRing
        )}
      >
        <Icon name="disclosure"
          size="sm"
          aria-hidden
          className={cn("text-fg-muted transition-transform duration-150 ease-out", open && "rotate-90")}
        />
        {title}
        {count > 0 && (
          <span
            data-testid="disclosure-count"
            aria-label={`${count} changed`}
            className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-subtle px-1 text-caption text-accent-fg"
          >
            {count}
          </span>
        )}
      </button>
      {open && (
        <div id={panelId} className="divide-y divide-border border-t border-border">
          {children}
        </div>
      )}
    </div>
  );
}

export interface PreviewChipProps {
  /** Names the chip for screen readers, e.g. "Connection preview". */
  label: string;
  /** CSS color of a leading dot (a connection color tag). */
  dot?: string | null;
  children: ReactNode;
  className?: string;
}

/** Live mono readout of what the form will produce, shown at the top of the body. */
export function PreviewChip({ label, dot, children, className }: PreviewChipProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "flex h-9 items-center gap-2 rounded-lg border border-border-subtle bg-raised px-3 font-mono text-body text-fg",
        className
      )}
    >
      {dot && <span aria-hidden style={{ "--wt-dyn-dot": dot } as CSSProperties} className="size-2 shrink-0 rounded-full bg-(--wt-dyn-dot)" />}
      <span className="min-w-0 truncate">{children}</span>
    </div>
  );
}
