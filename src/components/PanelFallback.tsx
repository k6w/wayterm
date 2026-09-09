import { Spinner } from "../ui";

/** Suspense fallback for lazy panels: a centred spinner that fills the space the panel will take. */
export function PanelFallback({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex h-full min-h-0 w-full flex-1 items-center justify-center">
      <Spinner label={label} />
    </div>
  );
}
