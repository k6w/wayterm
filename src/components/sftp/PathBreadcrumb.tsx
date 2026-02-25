import { ChevronRight } from "lucide-react";

interface PathBreadcrumbProps {
  path: string;
  onNavigate: (path: string) => void;
  label?: string;
}

export default function PathBreadcrumb({
  path,
  onNavigate,
  label,
}: PathBreadcrumbProps) {
  // Normalize path: handle both Unix "/" and Windows "C:\" paths
  const isWindows = /^[A-Za-z]:[\\/]/.test(path);
  const separator = "/";
  const normalizedPath = path.replace(/\\/g, "/");

  // Split into segments
  const parts = normalizedPath.split("/").filter(Boolean);

  // Build clickable segments with their full path
  const segments: { name: string; fullPath: string }[] = [];

  if (isWindows) {
    // Windows: first part is "C:", root is "C:/"
    if (parts.length > 0) {
      segments.push({ name: parts[0], fullPath: parts[0] + "/" });
      for (let i = 1; i < parts.length; i++) {
        segments.push({
          name: parts[i],
          fullPath: parts.slice(0, i + 1).join(separator) + (i === 0 ? "/" : ""),
        });
      }
      // Fix windows paths
      for (let i = 1; i < segments.length; i++) {
        segments[i].fullPath = parts[0] + "/" + parts.slice(1, i + 1).join(separator);
      }
    }
  } else {
    // Unix: root is "/"
    for (let i = 0; i < parts.length; i++) {
      segments.push({
        name: parts[i],
        fullPath: "/" + parts.slice(0, i + 1).join(separator),
      });
    }
  }

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto text-xs min-w-0 px-2 py-1">
      {label && (
        <span className="shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-text-muted mr-1.5">
          {label}
        </span>
      )}

      {/* Root segment */}
      <button
        onClick={() => onNavigate(isWindows && parts.length > 0 ? parts[0] + "/" : "/")}
        className="shrink-0 text-text-secondary hover:text-text-primary transition-colors"
      >
        {isWindows && parts.length > 0 ? parts[0] + separator : "/"}
      </button>

      {/* Path segments (skip first for Windows since root already shown) */}
      {(isWindows ? segments.slice(1) : segments).map((seg, i, arr) => {
        const isLast = i === arr.length - 1;
        return (
          <span key={seg.fullPath} className="flex items-center gap-0.5 shrink-0">
            <ChevronRight size={10} className="text-text-muted" />
            <button
              onClick={() => onNavigate(seg.fullPath)}
              className={`transition-colors ${
                isLast
                  ? "text-accent font-medium"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {seg.name}
            </button>
          </span>
        );
      })}
    </div>
  );
}
