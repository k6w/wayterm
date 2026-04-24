import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, RefreshCw } from "lucide-react";
import { useThemeStore } from "../../stores/theme";
import { useSettingsStore } from "../../stores/settings";
import { hexToRgba } from "../../lib/color";
import { vibrancyAlpha } from "../../lib/platform";
import { serialListPorts, type SerialPortInfo } from "../../lib/ipc";
import type { SerialConfig } from "../../types/terminal";

interface SerialDialogProps {
  open: boolean;
  onClose: () => void;
  onConnect: (config: SerialConfig) => void;
}

const BAUD_RATES = [300, 1200, 2400, 4800, 9600, 14400, 19200, 38400, 57600, 115200, 230400, 460800, 921600];

export default function SerialDialog({ open, onClose, onConnect }: SerialDialogProps) {
  const theme = useThemeStore((s) => s.active);
  const vibrancy = useSettingsStore((s) => s.settings.appearance.vibrancyEnabled);
  const opacity = useSettingsStore((s) => s.settings.appearance.windowOpacity);

  const [ports, setPorts] = useState<SerialPortInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [portName, setPortName] = useState("");
  const [baudRate, setBaudRate] = useState(115200);
  const [dataBits, setDataBits] = useState(8);
  const [stopBits, setStopBits] = useState(1);
  const [parity, setParity] = useState("none");
  const [flowControl, setFlowControl] = useState("none");

  const cardBg = vibrancy
    ? hexToRgba(theme.ui.bgPrimary, vibrancyAlpha(opacity) * 0.95)
    : theme.ui.bgPrimary;
  const inputBg = hexToRgba(theme.ui.bgTertiary, 0.8);

  const loadPorts = async () => {
    setLoading(true);
    try {
      const list = await serialListPorts();
      setPorts(list);
      if (list.length > 0 && !portName) {
        setPortName(list[0].portName);
      }
    } catch {
      setPorts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) loadPorts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleConnect = () => {
    if (!portName) return;
    onConnect({ portName, baudRate, dataBits, stopBits, parity, flowControl });
    onClose();
  };

  const selectClass = `w-full px-3 py-1.5 text-xs rounded-md border focus:outline-none focus:border-accent`;
  const selectStyle = { backgroundColor: inputBg, borderColor: theme.ui.border, color: theme.ui.textPrimary };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          onClick={onClose}
        >
          <motion.div
            className="w-[400px] max-w-[calc(100vw-2rem)] rounded-xl border border-border overflow-hidden shadow-2xl"
            style={{
              backgroundColor: cardBg,
              backdropFilter: vibrancy ? "blur(24px) saturate(1.4)" : undefined,
              WebkitBackdropFilter: vibrancy ? "blur(24px) saturate(1.4)" : undefined,
            }}
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border">
              <h3 className="text-sm font-medium text-text-primary">New Serial Connection</h3>
              <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              {/* Port selector */}
              <div>
                <label className="block text-xs text-text-muted mb-1.5">Port</label>
                <div className="flex gap-2">
                  {ports.length > 0 ? (
                    <select
                      value={portName}
                      onChange={(e) => setPortName(e.target.value)}
                      className={selectClass + " flex-1"}
                      style={selectStyle}
                    >
                      {ports.map((p) => (
                        <option key={p.portName} value={p.portName} style={{ backgroundColor: theme.ui.bgPrimary }}>
                          {p.portName}{p.description ? ` — ${p.description}` : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={portName}
                      onChange={(e) => setPortName(e.target.value)}
                      placeholder="e.g. COM3 or /dev/ttyUSB0"
                      className={selectClass + " flex-1"}
                      style={selectStyle}
                    />
                  )}
                  <button
                    onClick={loadPorts}
                    disabled={loading}
                    className="p-1.5 rounded-md border border-border text-text-muted hover:text-text-primary transition-colors"
                    style={{ backgroundColor: inputBg }}
                    title="Refresh ports"
                  >
                    <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                  </button>
                </div>
                {ports.length === 0 && !loading && (
                  <p className="text-[11px] text-text-muted mt-1">No ports detected. Enter manually.</p>
                )}
              </div>

              {/* Baud rate */}
              <div>
                <label className="block text-xs text-text-muted mb-1.5">Baud Rate</label>
                <select
                  value={baudRate}
                  onChange={(e) => setBaudRate(Number(e.target.value))}
                  className={selectClass}
                  style={selectStyle}
                >
                  {BAUD_RATES.map((r) => (
                    <option key={r} value={r} style={{ backgroundColor: theme.ui.bgPrimary }}>{r}</option>
                  ))}
                </select>
              </div>

              {/* Data / stop / parity in a row */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-text-muted mb-1.5">Data Bits</label>
                  <select value={dataBits} onChange={(e) => setDataBits(Number(e.target.value))} className={selectClass} style={selectStyle}>
                    {[5, 6, 7, 8].map((v) => <option key={v} value={v} style={{ backgroundColor: theme.ui.bgPrimary }}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1.5">Stop Bits</label>
                  <select value={stopBits} onChange={(e) => setStopBits(Number(e.target.value))} className={selectClass} style={selectStyle}>
                    {[1, 2].map((v) => <option key={v} value={v} style={{ backgroundColor: theme.ui.bgPrimary }}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1.5">Parity</label>
                  <select value={parity} onChange={(e) => setParity(e.target.value)} className={selectClass} style={selectStyle}>
                    {["none", "even", "odd"].map((v) => <option key={v} value={v} style={{ backgroundColor: theme.ui.bgPrimary }}>{v}</option>)}
                  </select>
                </div>
              </div>

              {/* Flow control */}
              <div>
                <label className="block text-xs text-text-muted mb-1.5">Flow Control</label>
                <select value={flowControl} onChange={(e) => setFlowControl(e.target.value)} className={selectClass} style={selectStyle}>
                  {[
                    { value: "none", label: "None" },
                    { value: "hardware", label: "Hardware (RTS/CTS)" },
                    { value: "software", label: "Software (XON/XOFF)" },
                  ].map((o) => (
                    <option key={o.value} value={o.value} style={{ backgroundColor: theme.ui.bgPrimary }}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
              <button onClick={onClose} className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary rounded-md transition-colors">
                Cancel
              </button>
              <button
                onClick={handleConnect}
                disabled={!portName}
                className="px-4 py-1.5 text-xs font-medium text-white rounded-md bg-accent hover:bg-accent-hover disabled:opacity-50 transition-colors"
              >
                Connect
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
