export interface StartupRunnerOptions {
  commands: readonly string[];
  /** Writes text to the pane as if typed. Never goes through a shell `-c`. */
  send: (text: string) => void;
  /** The pane is an SSH session: nothing runs until it is connected (see `connected` and `authPrompt`). */
  ssh?: boolean;
  /** Silence after output that means the prompt is up. */
  quietMs?: number;
  /** Local shells: run anyway after this long without any output. */
  maxWaitMs?: number;
  /** Delay between two commands. */
  gapMs?: number;
  /** Local shell with shell integration: run at its first prompt mark (`promptReady`), not on quiet output. */
  waitForPrompt?: boolean;
}

export interface StartupRunner {
  /** Feed every chunk of text the pane prints. */
  output: (text: string) => void;
  /** The user typed into the pane. */
  input: () => void;
  /** SSH: the session is established and its prompt is showing. */
  connected: () => void;
  /** SSH: the host asked for a password or passphrase; wait for the user to answer. */
  authPrompt: () => void;
  /** Shell integration: the shell showed its first prompt. */
  promptReady: () => void;
  /** Stop for good (pane closed, process exited). */
  dispose: () => void;
  /** True once the commands were sent (or there was nothing to send, or it was disposed). */
  readonly done: boolean;
}

const AUTH_QUIET_MS = 1500;
/** Output that means authentication is not finished (a new prompt) or failed. */
const AUTH_PENDING = /password|passphrase|verification|yes\/no|denied|permission|refused|closed|timed out|could not|not known|fingerprint/i;

/**
 * Types a pane's startup commands once, after its shell (or SSH session) is
 * ready. Readiness is the shell going quiet after its first output; for SSH it
 * additionally requires the connection to be established. Each command is sent
 * as input text with a carriage return, like typing it.
 */
export function createStartupRunner(options: StartupRunnerOptions): StartupRunner {
  const { commands, send, ssh = false, quietMs = 400, maxWaitMs = 5000, gapMs = 50, waitForPrompt = false } = options;
  let done = commands.length === 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const pending: ReturnType<typeof setTimeout>[] = [];
  // Which readiness path applies: local shells and connected SSH sessions watch for quiet output right away.
  let mode: "wait" | "quiet" | "auth" | "prompt" = ssh ? "wait" : waitForPrompt ? "prompt" : "quiet";
  let answered = false;

  const clear = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  const run = () => {
    clear();
    if (done) return;
    done = true;
    commands.forEach((command, index) => {
      if (index === 0) send(`${command}\r`);
      else pending.push(setTimeout(() => send(`${command}\r`), index * gapMs));
    });
  };

  const arm = (ms: number) => {
    clear();
    if (!done) timer = setTimeout(run, ms);
  };

  if (!ssh) arm(maxWaitMs);

  return {
    output(text) {
      if (done) return;
      if (mode === "quiet") {
        arm(quietMs);
      } else if (mode === "auth") {
        if (AUTH_PENDING.test(text)) {
          answered = false;
          clear();
        } else if (answered) {
          arm(AUTH_QUIET_MS);
        }
      }
    },
    input() {
      answered = true;
    },
    connected() {
      if (done) return;
      mode = "quiet";
      arm(quietMs);
    },
    promptReady() {
      if (mode === "prompt") run();
    },
    authPrompt() {
      if (done) return;
      mode = "auth";
      answered = false;
      clear();
    },
    dispose() {
      clear();
      pending.forEach(clearTimeout);
      pending.length = 0;
      done = true;
    },
    get done() {
      return done;
    },
  };
}
