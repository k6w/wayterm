import { useId, useRef, useState, type FormEvent } from "react";
import { Button } from "./Button";
import { Dialog, DialogContent } from "./Dialog";
import { Field } from "./Field";
import { Input } from "./Input";

export interface InputDialogProps {
  open: boolean;
  title: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

/** Asks for one line of text (rename, new folder). The field starts from `defaultValue` on every open. */
export function InputDialog({ open, onCancel, ...props }: InputDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      {open && <InputDialogContent onCancel={onCancel} {...props} />}
    </Dialog>
  );
}

function InputDialogContent({
  title,
  label,
  defaultValue = "",
  placeholder,
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: Omit<InputDialogProps, "open">) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const formId = useId();
  const trimmed = value.trim();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (trimmed) onConfirm(trimmed);
  };

  return (
    <DialogContent
      size="sm"
      title={title}
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button type="submit" form={formId} variant="primary" disabled={!trimmed}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="py-1">
        <Field label={label}>
          {(control) => (
            <Input
              {...control}
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
            />
          )}
        </Field>
      </form>
    </DialogContent>
  );
}
