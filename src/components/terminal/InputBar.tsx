import { useState, useRef, useCallback, type KeyboardEvent } from "react";
import { ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { useSettingsStore } from "../../stores/settings";

interface InputBarProps {
  sessionId: string;
  onSubmit: (command: string) => void;
}

export default function InputBar({ sessionId: _sessionId, onSubmit }: InputBarProps) {
  const [value, setValue] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const settings = useSettingsStore((s) => s.settings);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 20;
    const maxHeight = lineHeight * 5;
    const minHeight = lineHeight;
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight)}px`;
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setHistory((prev) => [trimmed, ...prev]);
    setHistoryIndex(-1);
    setValue("");
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    });
  }, [value, onSubmit]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
        return;
      }

      if (e.key === "ArrowUp" && !e.shiftKey) {
        const cursorAtStart =
          textareaRef.current?.selectionStart === 0 &&
          textareaRef.current?.selectionEnd === 0;
        if (cursorAtStart || !value.includes("\n")) {
          e.preventDefault();
          const nextIndex = historyIndex + 1;
          if (nextIndex < history.length) {
            setHistoryIndex(nextIndex);
            setValue(history[nextIndex]);
            requestAnimationFrame(adjustHeight);
          }
        }
        return;
      }

      if (e.key === "ArrowDown" && !e.shiftKey) {
        const textarea = textareaRef.current;
        const cursorAtEnd =
          textarea &&
          textarea.selectionStart === textarea.value.length &&
          textarea.selectionEnd === textarea.value.length;
        if (cursorAtEnd || !value.includes("\n")) {
          e.preventDefault();
          const nextIndex = historyIndex - 1;
          if (nextIndex >= 0) {
            setHistoryIndex(nextIndex);
            setValue(history[nextIndex]);
          } else {
            setHistoryIndex(-1);
            setValue("");
          }
          requestAnimationFrame(adjustHeight);
        }
      }
    },
    [handleSubmit, historyIndex, history, value, adjustHeight]
  );

  return (
    <motion.div
      initial={{ y: 10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.2, delay: 0.1 }}
    >
      <div className="flex w-full items-end gap-2 rounded-lg border border-white/10 bg-white/[0.08] px-3 py-2 backdrop-blur-sm transition-colors focus-within:border-accent">
        <ChevronRight
          size={16}
          className="mt-0.5 shrink-0 text-accent"
        />
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            requestAnimationFrame(adjustHeight);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Enter command..."
          rows={1}
          className="w-full resize-none bg-transparent text-sm leading-5 text-text-primary placeholder:text-text-muted outline-none"
          style={{
            fontFamily: settings.appearance.terminalFontFamily,
            fontSize: `${settings.appearance.terminalFontSize}px`,
          }}
          spellCheck={false}
          autoComplete="off"
        />
      </div>
    </motion.div>
  );
}
