import type { IDisposable, IMarker, Terminal } from "@xterm/xterm";

/**
 * Command blocks from OSC 133 shell integration marks (FinalTerm semantics):
 * A = prompt start, B = command start, C = output start, D;n = command done.
 * The shell integration scripts also report the cwd with OSC 7.
 */

export type BlockState = "prompt" | "input" | "running" | "done";

export interface Block {
  id: string;
  state: BlockState;
  promptStart: IMarker;
  commandStart?: IMarker;
  commandCol?: number;
  outputStart?: IMarker;
  outputCol?: number;
  end?: IMarker;
  endCol?: number;
  /** Command line reported by the shell (zsh, fish); bash's comes from the screen. */
  command?: string;
  /** The command report carried this session's nonce, so it came from our script. */
  trusted: boolean;
  exitCode?: number;
  startedAt?: number;
  endedAt?: number;
  cwd?: string;
}

export interface BlockTrackerOptions {
  /** Called for every OSC 7 cwd report. */
  onCwd?: (cwd: string) => void;
  /** Called when a command reports its exit (D). */
  onCommandEnd?: (block: Block) => void;
  maxBlocks?: number;
  now?: () => number;
}

const MAX_BLOCKS = 5000;
const MAX_COMMAND_LENGTH = 4096;

/** `key=value` pairs after the mark letter, e.g. `C;cmdline_url=ls;nx=abc`. */
function parseParams(parts: string[]): Map<string, string> {
  const params = new Map<string, string>();
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq > 0) params.set(part.slice(0, eq), part.slice(eq + 1));
  }
  return params;
}

function decode(value: string): string | undefined {
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

/** The path of a `file://host/path` URL, or undefined. */
export function parseOsc7(data: string): string | undefined {
  const match = /^file:\/\/[^/]*(\/.*)$/.exec(data);
  return match ? decode(match[1]) : undefined;
}

export class BlockTracker {
  readonly blocks: Block[] = [];
  /** True once the shell sent its first prompt mark; until then the pane behaves as before. */
  active = false;
  /** Last cwd the shell reported. */
  cwd: string | undefined;
  /** The pane expected the integration but no prompt mark came in time (see `markInactive`). */
  inactive = false;
  /** Changes on every notification; a snapshot for useSyncExternalStore. */
  version = 0;
  /** The pane was started with the integration script (it knows its nonce). */
  readonly integrated: boolean;

  private selAnchor: string | null = null;
  private selFocus: string | null = null;

  private readonly listeners = new Set<() => void>();
  private readonly disposables: IDisposable[] = [];
  private readonly maxBlocks: number;
  private readonly now: () => number;
  private nextId = 1;
  private disposed = false;

  constructor(
    private readonly term: Terminal,
    private readonly nonce: string | null,
    private readonly options: BlockTrackerOptions = {},
  ) {
    this.integrated = nonce !== null;
    this.maxBlocks = options.maxBlocks ?? MAX_BLOCKS;
    this.now = options.now ?? Date.now;
    this.disposables.push(
      term.parser.registerOscHandler(133, (data) => {
        this.onMark(data);
        return true;
      }),
      term.parser.registerOscHandler(7, (data) => {
        this.onCwd(data);
        return true;
      }),
      // RIS (`reset`, `tput reset`) wipes the buffer without disposing markers.
      term.parser.registerEscHandler({ final: "c" }, () => {
        this.reset();
        return false;
      }),
    );
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  /** No prompt mark arrived in time: the shell runs without integration. Ignored once active. */
  markInactive(): void {
    if (this.active || this.inactive) return;
    this.inactive = true;
    this.notify();
  }

  /** Selected blocks, top to bottom (a contiguous range). */
  get selection(): Block[] {
    const a = this.indexOf(this.selAnchor);
    const f = this.indexOf(this.selFocus);
    if (a < 0 || f < 0) return [];
    return this.blocks.slice(Math.min(a, f), Math.max(a, f) + 1);
  }

  /** Selects one block, or with `extend` the range from the current anchor to it. */
  select(block: Block, extend = false): void {
    if (!extend || this.indexOf(this.selAnchor) < 0) this.selAnchor = block.id;
    this.selFocus = block.id;
    this.notify();
  }

  clearSelection(): void {
    if (this.selAnchor === null && this.selFocus === null) return;
    this.selAnchor = this.selFocus = null;
    this.notify();
  }

  /**
   * Moves the selection one block up (-1) or down (1), or extends it with `extend`.
   * Without a selection it starts from the last finished block. Returns the newly focused block.
   */
  moveSelection(direction: -1 | 1, extend = false): Block | undefined {
    const candidates = this.blocks.filter((b) => b.state === "done" || b.state === "running");
    if (candidates.length === 0) return undefined;
    const focus = this.indexOf(this.selFocus);
    let target: Block | undefined;
    if (focus < 0) {
      target = direction < 0 ? candidates[candidates.length - 1] : undefined;
    } else {
      const current = this.blocks[focus];
      const at = candidates.indexOf(current);
      target = candidates[at + direction] ?? (at < 0 ? undefined : current);
    }
    if (!target) return undefined;
    this.select(target, extend);
    return target;
  }

  private indexOf(id: string | null): number {
    return id === null ? -1 : this.blocks.findIndex((b) => b.id === id);
  }

  /** The block whose prompt starts at or above buffer line `y` (the block containing it). */
  blockAtLine(y: number): Block | undefined {
    let lo = 0;
    let hi = this.blocks.length - 1;
    let found: Block | undefined;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (this.blocks[mid].promptStart.line <= y) {
        found = this.blocks[mid];
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return found;
  }

  getCommandText(b: Block): string {
    if (b.command !== undefined) return b.command;
    if (!b.commandStart && !b.outputStart) return "";
    const start = b.commandStart ?? b.promptStart;
    const startCol = b.commandStart ? (b.commandCol ?? 0) : 0;
    const end = b.outputStart ? { line: b.outputStart.line, col: b.outputCol ?? 0 } : this.cursor();
    return this.readRange(start.line, startCol, end.line, end.col);
  }

  getOutputText(b: Block): string {
    if (!b.outputStart || b.outputStart.line < 0) return "";
    const next = this.blocks[this.blocks.indexOf(b) + 1];
    let end: { line: number; col: number };
    if (b.end && b.end.line >= 0) end = { line: b.end.line, col: b.endCol ?? 0 };
    else if (next) end = { line: next.promptStart.line, col: 0 };
    else end = this.cursor();
    return this.readRange(b.outputStart.line, b.outputCol ?? 0, end.line, end.col);
  }

  /** Forgets every block; call after `terminal.reset()`, which keeps stale markers. */
  reset(): void {
    if (this.blocks.length === 0) return;
    for (const b of this.blocks.splice(0)) this.disposeMarkers(b);
    this.notify();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const d of this.disposables) d.dispose();
    for (const b of this.blocks.splice(0)) this.disposeMarkers(b);
    this.listeners.clear();
  }

  private onMark(data: string): void {
    if (this.disposed) return;
    const [mark, ...rest] = data.split(";");
    const params = parseParams(rest);
    const signed = this.nonce !== null && params.get("nx") === this.nonce;
    // A pane started with our script knows its nonce: then only marks carrying
    // it count, so command output cannot fake prompts, commands or exits.
    // (B carries none; it is only taken at a prompt, when nothing else prints.)
    if (this.nonce !== null && !signed && mark !== "B") return;
    const alternate = this.term.buffer.active.type === "alternate";
    switch (mark) {
      case "A":
        if (!alternate) this.onPromptStart();
        break;
      case "B":
        if (!alternate) this.onCommandStart();
        break;
      case "C":
        this.onOutputStart(params, signed, alternate);
        break;
      case "D":
        this.onCommandEnd(rest[0]?.includes("=") ? undefined : rest[0], alternate);
        break;
      default:
        return;
    }
  }

  private onPromptStart(): void {
    this.active = true;
    this.inactive = false;
    const line = this.cursor().line;
    // Prompts at or below this line were overwritten (clear, redraw).
    while (this.blocks.length > 0 && this.last()!.promptStart.line >= line) {
      this.disposeMarkers(this.blocks.pop()!);
    }
    const open = this.last();
    if (open && (open.state === "prompt" || open.state === "input")) {
      // Nothing ran at that prompt (empty line, Ctrl+C): not a block.
      this.disposeMarkers(this.blocks.pop()!);
    } else if (open && open.state === "running") {
      // The shell is back without reporting an exit status.
      open.state = "done";
    }
    const marker = this.term.registerMarker(0);
    if (!marker) return;
    const block: Block = { id: `b${this.nextId++}`, state: "prompt", promptStart: marker, trusted: false, cwd: this.cwd };
    marker.onDispose(() => this.drop(block));
    this.blocks.push(block);
    while (this.blocks.length > this.maxBlocks) this.disposeMarkers(this.blocks.shift()!);
    this.notify();
  }

  private onCommandStart(): void {
    const b = this.last();
    if (!b || (b.state !== "prompt" && b.state !== "input")) return;
    b.commandStart?.dispose();
    b.commandStart = this.term.registerMarker(0);
    b.commandCol = this.term.buffer.active.cursorX;
    b.state = "input";
    this.notify();
  }

  private onOutputStart(params: Map<string, string>, trusted: boolean, alternate: boolean): void {
    const b = this.last();
    if (!b || (b.state !== "prompt" && b.state !== "input")) return;
    const cmdline = params.get("cmdline_url");
    b.state = "running";
    b.startedAt = this.now();
    b.trusted = trusted;
    if (cmdline !== undefined) b.command = decode(cmdline)?.slice(0, MAX_COMMAND_LENGTH);
    if (!alternate) {
      b.outputStart = this.term.registerMarker(0);
      b.outputCol = this.term.buffer.active.cursorX;
    }
    this.notify();
  }

  private onCommandEnd(status: string | undefined, alternate: boolean): void {
    const b = this.last();
    if (!b || b.state !== "running") return;
    const code = status === undefined || status === "" ? NaN : Number(status);
    b.exitCode = Number.isInteger(code) ? code : undefined;
    b.endedAt = this.now();
    b.state = "done";
    if (!alternate) {
      b.end = this.term.registerMarker(0);
      b.endCol = this.term.buffer.active.cursorX;
    }
    this.notify();
    this.options.onCommandEnd?.(b);
  }

  private onCwd(data: string): void {
    if (this.disposed) return;
    const cwd = parseOsc7(data);
    if (!cwd) return;
    this.cwd = cwd;
    const b = this.last();
    if (b && (b.state === "prompt" || b.state === "input")) b.cwd = cwd;
    this.options.onCwd?.(cwd);
  }

  /** Scrollback trimmed, cleared or reset past the block's prompt. */
  private drop(block: Block): void {
    const i = this.blocks.indexOf(block);
    if (i < 0) return;
    this.blocks.splice(i, 1);
    this.disposeMarkers(block);
    this.notify();
  }

  private disposeMarkers(b: Block): void {
    for (const m of [b.promptStart, b.commandStart, b.outputStart, b.end]) m?.dispose();
  }

  private last(): Block | undefined {
    return this.blocks[this.blocks.length - 1];
  }

  private cursor(): { line: number; col: number } {
    const buf = this.term.buffer.active;
    return { line: buf.baseY + buf.cursorY, col: buf.cursorX };
  }

  /** Text from (startLine, startCol) up to, not including, (endLine, endCol); wrapped lines are joined. */
  private readRange(startLine: number, startCol: number, endLine: number, endCol: number): string {
    const buf = this.term.buffer.active;
    let out = "";
    for (let y = startLine; y <= endLine; y++) {
      const line = buf.getLine(y);
      if (!line) break;
      const from = y === startLine ? startCol : 0;
      const to = y === endLine ? endCol : undefined;
      if (to === undefined || to > from) out += line.translateToString(true, from, to);
      if (y < endLine && !buf.getLine(y + 1)?.isWrapped) out += "\n";
    }
    return out.replace(/\s+$/, "");
  }

  private notify(): void {
    this.version++;
    for (const fn of this.listeners) fn();
  }
}
