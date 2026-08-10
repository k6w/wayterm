import { useEffect, useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useSshStore } from "../../stores/ssh";
import { Button, Dialog, DialogContent, Field, ICON_SM, IconButton, Input, Switch } from "../../ui";
import {
  EMPTY_PORT_FORWARD_FORM,
  forwardRoute,
  toPortForward,
  validatePortForward,
  type PortForwardFormErrors,
  type PortForwardFormState,
} from "./port-forward-form";

interface QuickPortForwardDialogProps {
  isOpen: boolean;
  onClose: () => void;
  connectionId: string;
  sessionId?: string;
}

/**
 * The status bar's port forward manager for the active SSH tab. The body
 * mounts only while open, so the add form starts fresh on every open.
 */
export default function QuickPortForwardDialog({ isOpen, onClose, connectionId, sessionId }: QuickPortForwardDialogProps) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {isOpen && <PortForwardsBody connectionId={connectionId} sessionId={sessionId} />}
    </Dialog>
  );
}

function PortForwardsBody({ connectionId, sessionId }: { connectionId: string; sessionId?: string }) {
  const portForwards = useSshStore((s) => s.portForwards);
  const loadPortForwards = useSshStore((s) => s.loadPortForwards);
  const savePortForward = useSshStore((s) => s.savePortForward);
  const deletePortForward = useSshStore((s) => s.deletePortForward);
  const togglePortForward = useSshStore((s) => s.togglePortForward);

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<PortForwardFormState>(EMPTY_PORT_FORWARD_FORM);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (connectionId) void loadPortForwards(connectionId);
  }, [connectionId, loadPortForwards]);

  const errors: PortForwardFormErrors = submitted ? validatePortForward(form) : {};
  const forwards = [...portForwards].sort((a, b) => Number(b.isActive) - Number(a.isActive));

  const set = (key: keyof PortForwardFormState) => (value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  };

  const handleAdd = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(validatePortForward(form)).length > 0) return;
    try {
      await savePortForward(toPortForward(form, connectionId));
      // Reload so the new row carries the id the backend assigned.
      await loadPortForwards(connectionId);
      setAdding(false);
      setSubmitted(false);
      setForm(EMPTY_PORT_FORWARD_FORM);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add port forward");
    }
  };

  const handleToggle = async (id: string, active: boolean) => {
    try {
      await togglePortForward(id, active, sessionId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to toggle port forward");
    }
  };

  return (
    <DialogContent size="md" title="Port forwards" description="Forward a local port to a host the server can reach.">
      <div className="flex flex-col gap-3">
        {adding ? (
          <form aria-label="New port forward" className="flex flex-col gap-3 rounded-md border border-border bg-raised p-3" onSubmit={handleAdd}>
            <div className="grid grid-cols-[1fr_2fr_1fr] gap-2">
              <Field label="Local port" error={errors.localPort}>
                {(control) => (
                  <Input {...control} inputMode="numeric" autoFocus value={form.localPort} onChange={(e) => set("localPort")(e.target.value)} />
                )}
              </Field>
              <Field label="Remote host" error={errors.remoteHost}>
                {(control) => <Input {...control} value={form.remoteHost} onChange={(e) => set("remoteHost")(e.target.value)} />}
              </Field>
              <Field label="Remote port" error={errors.remotePort}>
                {(control) => (
                  <Input {...control} inputMode="numeric" value={form.remotePort} onChange={(e) => set("remotePort")(e.target.value)} />
                )}
              </Field>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setAdding(false);
                  setSubmitted(false);
                  setError(null);
                }}
              >
                Cancel
              </Button>
              <Button size="sm" variant="primary" type="submit">
                Add
              </Button>
            </div>
          </form>
        ) : (
          <Button leadingIcon={<Plus {...ICON_SM} />} onClick={() => setAdding(true)}>
            Add port forward
          </Button>
        )}

        {error && (
          <p role="alert" className="rounded-md border border-danger bg-danger-subtle px-2 py-1.5 text-label text-danger">
            {error}
          </p>
        )}

        {forwards.length === 0 ? (
          !adding && <p className="py-4 text-center text-label text-fg-muted">No port forwards for this connection yet.</p>
        ) : (
          <ul aria-label="Port forwards for this connection" className="flex flex-col gap-1">
            {forwards.map((forward) => (
              <li key={forward.id} className="flex min-h-row items-center gap-2 rounded-md px-2 hover:bg-hover">
                <span className="min-w-0 flex-1 truncate font-mono text-body text-fg">
                  localhost:{forwardRoute(forward)}
                </span>
                <Switch
                  label={`Forward ${forward.localPort} active`}
                  checked={forward.isActive}
                  onCheckedChange={(checked) => void handleToggle(forward.id, checked)}
                />
                <IconButton
                  size="xs"
                  label={`Remove forward ${forward.localPort}`}
                  icon={<Trash2 {...ICON_SM} />}
                  onClick={() => void deletePortForward(forward.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </DialogContent>
  );
}
