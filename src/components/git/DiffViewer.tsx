import { useState } from 'react';
import { Columns2, AlignLeft } from 'lucide-react';
import type { GitDiff } from '../../types/git';

interface DiffViewerProps {
  diffs: GitDiff[];
}

interface DiffLine {
  type: 'added' | 'removed' | 'context' | 'hunk';
  content: string;
  oldLineNo?: number;
  newLineNo?: number;
}

function parseDiff(changes: string): DiffLine[] {
  const lines = changes.split('\n');
  const result: DiffLine[] = [];
  let oldLineNo = 0;
  let newLineNo = 0;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      // Parse hunk header: @@ -a,b +c,d @@
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldLineNo = parseInt(match[1], 10);
        newLineNo = parseInt(match[2], 10);
      }
      result.push({ type: 'hunk', content: line });
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      result.push({ type: 'added', content: line.slice(1), newLineNo: newLineNo++ });
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      result.push({ type: 'removed', content: line.slice(1), oldLineNo: oldLineNo++ });
    } else if (!line.startsWith('\\') && !line.startsWith('diff') && !line.startsWith('index') && !line.startsWith('---') && !line.startsWith('+++')) {
      if (line.length > 0) {
        result.push({ type: 'context', content: line.slice(1), oldLineNo: oldLineNo++, newLineNo: newLineNo++ });
      }
    }
  }

  return result;
}

function buildSideBySide(lines: DiffLine[]): { left: DiffLine | null; right: DiffLine | null }[] {
  const pairs: { left: DiffLine | null; right: DiffLine | null }[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (line.type === 'hunk') {
      pairs.push({ left: line, right: line });
      i++;
    } else if (line.type === 'context') {
      pairs.push({ left: line, right: line });
      i++;
    } else if (line.type === 'removed') {
      // Pair with next added if present
      const next = lines[i + 1];
      if (next && next.type === 'added') {
        pairs.push({ left: line, right: next });
        i += 2;
      } else {
        pairs.push({ left: line, right: null });
        i++;
      }
    } else if (line.type === 'added') {
      pairs.push({ left: null, right: line });
      i++;
    } else {
      i++;
    }
  }

  return pairs;
}

function lineClass(type: DiffLine['type']) {
  switch (type) {
    case 'added': return 'bg-success/10 text-success';
    case 'removed': return 'bg-error/10 text-error';
    case 'hunk': return 'bg-accent/5 text-accent/70 select-none';
    default: return 'text-text-secondary';
  }
}

function linePrefix(type: DiffLine['type']) {
  if (type === 'added') return '+';
  if (type === 'removed') return '-';
  if (type === 'hunk') return '';
  return ' ';
}

interface FileDiffProps {
  diff: GitDiff;
  splitMode: boolean;
}

function FileDiff({ diff, splitMode }: FileDiffProps) {
  const [collapsed, setCollapsed] = useState(false);
  const lines = parseDiff(diff.changes);

  return (
    <div className="mb-4 border border-white/[0.08] rounded-lg overflow-hidden">
      {/* File header */}
      <button
        type="button"
        onClick={() => setCollapsed((p) => !p)}
        className="w-full flex items-center justify-between px-3 py-2 bg-white/[0.04] hover:bg-white/[0.06] transition-colors text-left"
      >
        <span className="text-xs font-mono text-text-primary truncate">{diff.file}</span>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {diff.additions > 0 && (
            <span className="text-[10px] text-success">+{diff.additions}</span>
          )}
          {diff.deletions > 0 && (
            <span className="text-[10px] text-error">-{diff.deletions}</span>
          )}
        </div>
      </button>

      {!collapsed && (
        <div className="overflow-x-auto">
          {splitMode ? (
            <SplitView lines={lines} />
          ) : (
            <UnifiedView lines={lines} />
          )}
        </div>
      )}
    </div>
  );
}

function UnifiedView({ lines }: { lines: DiffLine[] }) {
  return (
    <table className="w-full text-[11px] font-mono border-collapse">
      <tbody>
        {lines.map((line, i) => (
          <tr key={i} className={lineClass(line.type)}>
            <td className="w-10 text-right px-1.5 py-0 text-text-muted select-none border-r border-white/[0.06] align-top text-[10px]">
              {line.type !== 'hunk' ? (line.oldLineNo ?? '') : ''}
            </td>
            <td className="w-10 text-right px-1.5 py-0 text-text-muted select-none border-r border-white/[0.06] align-top text-[10px]">
              {line.type !== 'hunk' ? (line.newLineNo ?? '') : ''}
            </td>
            <td className="w-4 px-1 py-0 text-center select-none align-top">
              {linePrefix(line.type)}
            </td>
            <td className="px-2 py-0 whitespace-pre align-top">
              {line.content}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SplitView({ lines }: { lines: DiffLine[] }) {
  const pairs = buildSideBySide(lines);

  return (
    <table className="w-full text-[11px] font-mono border-collapse">
      <tbody>
        {pairs.map((pair, i) => {
          const { left, right } = pair;

          // Hunk row spans both sides
          if (left?.type === 'hunk') {
            return (
              <tr key={i}>
                <td colSpan={4} className={`px-2 py-0 ${lineClass('hunk')}`}>
                  {left.content}
                </td>
              </tr>
            );
          }

          return (
            <tr key={i}>
              {/* Left side */}
              <td className="w-9 text-right px-1 py-0 text-text-muted select-none border-r border-white/[0.04] text-[10px] align-top" style={{ minWidth: '2rem' }}>
                {left?.oldLineNo ?? ''}
              </td>
              <td
                className={`px-2 py-0 whitespace-pre align-top w-1/2 ${left ? lineClass(left.type) : ''}`}
                style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}
              >
                {left ? `${linePrefix(left.type)}${left.content}` : ''}
              </td>
              {/* Right side */}
              <td className="w-9 text-right px-1 py-0 text-text-muted select-none border-r border-white/[0.04] text-[10px] align-top" style={{ minWidth: '2rem' }}>
                {right?.newLineNo ?? ''}
              </td>
              <td className={`px-2 py-0 whitespace-pre align-top w-1/2 ${right ? lineClass(right.type) : ''}`}>
                {right ? `${linePrefix(right.type)}${right.content}` : ''}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function DiffViewer({ diffs }: DiffViewerProps) {
  const [splitMode, setSplitMode] = useState(false);

  if (diffs.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-xs text-text-muted">
        No changes
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.08]">
        <span className="text-[11px] text-text-muted">{diffs.length} file{diffs.length !== 1 ? 's' : ''} changed</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSplitMode(false)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors ${
              !splitMode ? 'bg-accent/15 text-accent' : 'text-text-muted hover:text-text-secondary'
            }`}
            title="Unified view"
          >
            <AlignLeft size={11} />
            Unified
          </button>
          <button
            type="button"
            onClick={() => setSplitMode(true)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors ${
              splitMode ? 'bg-accent/15 text-accent' : 'text-text-muted hover:text-text-secondary'
            }`}
            title="Split view"
          >
            <Columns2 size={11} />
            Split
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {diffs.map((diff) => (
          <FileDiff key={diff.file} diff={diff} splitMode={splitMode} />
        ))}
      </div>
    </div>
  );
}
