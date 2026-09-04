import { Tooltip } from "./Tooltip";
import { cn } from "./utils";

export interface MiddleTruncateProps {
  text: string;
  /** Characters pinned at the end. */
  tail?: number;
  className?: string;
}

/**
 * Text that takes the width it is given and ellipsizes in the middle, keeping
 * the last `tail` characters visible (a branch's distinguishing suffix). The
 * full text is the Tooltip and the accessible name.
 */
export function MiddleTruncate({
  text,
  tail = 10,
  className,
}: MiddleTruncateProps) {
  const split = text.length > tail * 2;
  return (
    <Tooltip content={text}>
      <span className={cn("flex min-w-0 whitespace-nowrap", className)}>
        <span className="sr-only">{text}</span>
        <span aria-hidden data-truncate-head className="truncate">
          {split ? text.slice(0, -tail) : text}
        </span>
        {split && (
          <span aria-hidden data-truncate-tail className="shrink-0">
            {text.slice(-tail)}
          </span>
        )}
      </span>
    </Tooltip>
  );
}
