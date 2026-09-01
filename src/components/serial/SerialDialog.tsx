import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Cable, RefreshCw } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  FormGroup,
  FormRow,
  IconButton,
  Input,
  PreviewChip,
  Select,
  ICON_MD,
  ICON_SM,
  cn,
} from "../../ui";
import { serialListPorts, type SerialPortInfo } from "../../lib/ipc";
import type { SerialConfig } from "../../types/terminal";

interface SerialDialogProps {
  open: boolean;
  onClose: () => void;
  onConnect: (config: SerialConfig) => void;
}

const BAUD_RATES = [300, 1200, 2400, 4800, 9600, 14400, 19200, 38400, 57600, 115200, 230400, 460800, 921600];

const numberOptions = (values: readonly number[]) => values.map((v) => ({ value: String(v), label: String(v) }));

const BAUD_OPTIONS = numberOptions(BAUD_RATES);
const DATA_BITS_OPTIONS = numberOptions([5, 6, 7, 8]);
const STOP_BITS_OPTIONS = numberOptions([1, 2]);
/** "115200 8N1" style frame summary. */
export function serialSummary(baudRate: number, dataBits: number, parity: string, stopBits: number): string {
  return `${baudRate} ${dataBits}${parity.charAt(0).toUpperCase()}${stopBits}`;
}

const PARITY_OPTIONS = [
  { value: "none", label: "None" },
  { value: "even", label: "Even" },
  { value: "odd", label: "Odd" },
];
const FLOW_OPTIONS = [
  { value: "none", label: "None" },
  { value: "hardware", label: "Hardware (RTS/CTS)" },
  { value: "software", label: "Software (XON/XOFF)" },
];

/**
 * New serial connection. The settings live here (not in the dialog body), so
 * they are kept between opens like before; the port list is re-read on every
 * open and by the refresh button.
 */
export default function SerialDialog({ open, onClose, onConnect }: SerialDialogProps) {
  const [ports, setPorts] = useState<SerialPortInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [portName, setPortName] = useState("");
  const [baudRate, setBaudRate] = useState(115200);
  const [dataBits, setDataBits] = useState(8);
  const [stopBits, setStopBits] = useState(1);
  const [parity, setParity] = useState("none");
  const [flowControl, setFlowControl] = useState("none");
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);

  // Only setters are used, so this never changes and the effect below runs once per open.
  const loadPorts = useCallback(async () => {
    setLoading(true);
    try {
      const list = (await serialListPorts()) ?? [];
      setPorts(list);
      if (list.length > 0) setPortName((current) => current || list[0].portName);
    } catch {
      setPorts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void loadPorts();
  }, [open, loadPorts]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!portName) return;
    onConnect({ portName, baudRate, dataBits, stopBits, parity, flowControl });
    onClose();
  };

  const portOptions = ports.map((p) => ({
    value: p.portName,
    label: p.description ? `${p.portName} — ${p.description}` : p.portName,
  }));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        size="md"
        title="New serial connection"
        description="Open a terminal on a serial port."
        icon={<Cable {...ICON_MD} />}
        hints={[
          { shortcut: "Escape", label: "Cancel" },
          { shortcut: "Enter", label: "Connect" },
        ]}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          formRef.current?.querySelector<HTMLElement>("input, button")?.focus();
        }}
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" form={formId} variant="primary" disabled={!portName}>
              Connect
            </Button>
          </>
        }
      >
        <form ref={formRef} id={formId} onSubmit={handleSubmit} className="flex flex-col gap-4">
          <PreviewChip label="Serial preview">
            {portName || "no port"} {serialSummary(baudRate, dataBits, parity, stopBits)}
          </PreviewChip>
          <FormGroup title="Port">
            <FormRow
              label="Port"
              hint={ports.length === 0 && !loading ? "No ports detected. Enter one manually." : undefined}
            >
              {(control) => (
                <div className="flex w-full items-center gap-2">
                  {ports.length > 0 ? (
                    <Select
                      id={control.id}
                      value={portName || undefined}
                      onValueChange={setPortName}
                      options={portOptions}
                      placeholder="Choose a port"
                    />
                  ) : (
                    <Input
                      {...control}
                      code
                      value={portName}
                      onChange={(e) => setPortName(e.target.value)}
                      placeholder="e.g. COM3 or /dev/ttyUSB0"
                    />
                  )}
                  <IconButton
                    size="md"
                    label="Refresh ports"
                    icon={
                      <RefreshCw
                        {...ICON_SM}
                        className={cn(loading && "animate-spin motion-reduce:animate-none")}
                      />
                    }
                    disabled={loading}
                    aria-busy={loading || undefined}
                    onClick={() => void loadPorts()}
                  />
                </div>
              )}
            </FormRow>
            <FormRow label="Baud rate">
              {({ id }) => (
                <Select
                  id={id}
                  value={String(baudRate)}
                  onValueChange={(v) => setBaudRate(Number(v))}
                  options={BAUD_OPTIONS}
                />
              )}
            </FormRow>
          </FormGroup>
          <FormGroup title="Frame format">
            <FormRow label="Data bits">
              {({ id }) => (
                <Select
                  id={id}
                  value={String(dataBits)}
                  onValueChange={(v) => setDataBits(Number(v))}
                  options={DATA_BITS_OPTIONS}
                />
              )}
            </FormRow>
            <FormRow label="Stop bits">
              {({ id }) => (
                <Select
                  id={id}
                  value={String(stopBits)}
                  onValueChange={(v) => setStopBits(Number(v))}
                  options={STOP_BITS_OPTIONS}
                />
              )}
            </FormRow>
            <FormRow label="Parity">
              {({ id }) => <Select id={id} value={parity} onValueChange={setParity} options={PARITY_OPTIONS} />}
            </FormRow>
            <FormRow label="Flow control">
              {({ id }) => <Select id={id} value={flowControl} onValueChange={setFlowControl} options={FLOW_OPTIONS} />}
            </FormRow>
          </FormGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
