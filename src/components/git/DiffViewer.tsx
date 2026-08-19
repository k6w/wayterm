import { useState } from 'react';
import { AlignLeft, Check, Columns2 } from 'lucide-react';
import { Badge, EmptyState, ICON_MD, ICON_SM, SegmentedControl, Toolbar, ToolbarSpacer, cn, focusRing } from '../../ui';
import { plural } from '../../lib/plural';
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
    case 'added': return 'bg-success-subtle text-success';
    case 'removed': return 'bg-danger-subtle text-danger';
    case 'hunk': return 'bg-info-subtle text-info select-none';
    default: return 'text-fg-secondary';
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
    <section className="mb-3 overflow-hidden rounded-lg border border-border">
      <button
        type="button"
        aria-expanded={!collapsed}
        onClick={() => setCollapsed((p) => !p)}
        className={cn(
          'flex w-full items-center justify-between gap-2 bg-raised px-3 py-1.5 text-left transition-colors duration-150 ease-out hover:bg-hover',
          focusRing
        )}
      >
        <span className="truncate font-mono text-label text-fg">{diff.file}</span>
        <span className="flex shrink-0 items-center gap-1">
          {diff.additions > 0 && <Badge tone="success">+{diff.additions}</Badge>}
          {diff.deletions > 0 && <Badge tone="danger">-{diff.deletions}</Badge>}
        </span>
      </button>

      {!collapsed && (
        <div className="overflow-x-auto">
          {splitMode ? <SplitView lines={lines} /> : <UnifiedView lines={lines} />}
        </div>
      )}
    </section>
  );
}

const NUMBER_CELL = 'w-10 select-none border-r border-border px-1.5 py-0 text-right align-top text-caption text-fg-muted';

function UnifiedView({ lines }: { lines: DiffLine[] }) {
  return (
    <table className="w-full border-collapse font-mono text-label">
      <tbody>
        {lines.map((line, i) => (
          <tr key={i} className={lineClass(line.type)}>
            <td className={NUMBER_CELL}>{line.type !== 'hunk' ? (line.oldLineNo ?? '') : ''}</td>
            <td className={NUMBER_CELL}>{line.type !== 'hunk' ? (line.newLineNo ?? '') : ''}</td>
            <td className="w-4 select-none px-1 py-0 text-center align-top">{linePrefix(line.type)}</td>
            <td className="whitespace-pre px-2 py-0 align-top">{line.content}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SplitView({ lines }: { lines: DiffLine[] }) {
  const pairs = buildSideBySide(lines);

  return (
    <table className="w-full border-collapse font-mono text-label">
      <tbody>
        {pairs.map((pair, i) => {
          const { left, right } = pair;

          // Hunk row spans both sides
          if (left?.type === 'hunk') {
            return (
              <tr key={i}>
                <td colSpan={4} className={cn('px-2 py-0', lineClass('hunk'))}>
                  {left.content}
                </td>
              </tr>
            );
          }

          return (
            <tr key={i}>
              <td className={cn(NUMBER_CELL, 'min-w-8')}>{left?.oldLineNo ?? ''}</td>
              <td className={cn('w-1/2 whitespace-pre border-r border-border px-2 py-0 align-top', left && lineClass(left.type))}>
                {left ? `${linePrefix(left.type)}${left.content}` : ''}
              </td>
              <td className={cn(NUMBER_CELL, 'min-w-8')}>{right?.newLineNo ?? ''}</td>
              <td className={cn('w-1/2 whitespace-pre px-2 py-0 align-top', right && lineClass(right.type))}>
                {right ? `${linePrefix(right.type)}${right.content}` : ''}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** File-by-file diff with a unified / side-by-side switch. */
export default function DiffViewer({ diffs }: DiffViewerProps) {
  const [mode, setMode] = useState<'unified' | 'split'>('unified');

  if (diffs.length === 0) {
    return <EmptyState icon={<Check {...ICON_MD} />} title="No changes" />;
  }

  return (
    <div className="flex h-full flex-col">
      <Toolbar aria-label="Diff view" className="h-8 shrink-0 gap-2 border-b border-border px-3">
        <span className="whitespace-nowrap text-label text-fg-muted">{plural(diffs.length, 'file')} changed</span>
        <ToolbarSpacer />
        <SegmentedControl
          size="sm"
          aria-label="Diff layout"
          value={mode}
          onValueChange={setMode}
          options={[
            { value: 'unified', label: 'Unified', icon: <AlignLeft {...ICON_SM} /> },
            { value: 'split', label: 'Split', icon: <Columns2 {...ICON_SM} /> },
          ]}
        />
      </Toolbar>

      <div className="flex-1 overflow-y-auto p-3">
        {diffs.map((diff) => (
          <FileDiff key={diff.file} diff={diff} splitMode={mode === 'split'} />
        ))}
      </div>
    </div>
  );
}
