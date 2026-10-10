/**
 * Shell code for remote hosts (`~/.zshrc`, `~/.bashrc`, `config.fish`) that reports prompts,
 * commands, exit codes and the folder (OSC 7 and the title) to Wayterm over SSH. Remote marks carry no nonce, so
 * their commands are only ever pasted, never re-run directly.
 */
export type RemoteShell = "bash" | "zsh" | "fish";

const GUARD_NOTE =
  "# Runs only in Wayterm. ssh does not pass TERM_PROGRAM unless the client has\n" +
  "# `SendEnv TERM_PROGRAM` and the server `AcceptEnv TERM_PROGRAM`; otherwise drop the check.";

const SNIPPETS: Record<RemoteShell, string> = {
  bash: `# Wayterm command blocks: add to ~/.bashrc on the remote host.
${GUARD_NOTE}
if [[ "$TERM_PROGRAM" == wayterm && $- == *i* ]]; then
  _wt_precmd() {
    local s=$?
    printf '\\e]133;D;%s\\a\\e]7;file://%s%s\\a\\e]0;%s\\a\\e]133;A\\a' "$s" "$HOSTNAME" "\${PWD// /%20}" "$PWD"
    [[ "$PS1" == *'\\[\\e]133;B\\a\\]' ]] || PS1="$PS1"'\\[\\e]133;B\\a\\]'
  }
  PROMPT_COMMAND="_wt_precmd\${PROMPT_COMMAND:+;$PROMPT_COMMAND}"
  PS0='\\e]133;C\\a'"\${PS0-}"
fi
`,
  zsh: `# Wayterm command blocks: add to ~/.zshrc on the remote host.
${GUARD_NOTE}
if [[ "$TERM_PROGRAM" == wayterm && -o interactive ]]; then
  _wt_precmd() {
    local s=$? mark=$'%{\\e]133;B\\a%}'
    printf '\\e]133;D;%s\\a\\e]7;file://%s%s\\a\\e]0;%s\\a\\e]133;A\\a' "$s" "$HOST" "\${PWD// /%20}" "$PWD"
    [[ "$PS1" == *"$mark" ]] || PS1="$PS1$mark"
  }
  _wt_preexec() { printf '\\e]133;C\\a'; }
  autoload -Uz add-zsh-hook
  add-zsh-hook precmd _wt_precmd
  add-zsh-hook preexec _wt_preexec
fi
`,
  fish: `# Wayterm command blocks: add to ~/.config/fish/config.fish on the remote host.
${GUARD_NOTE}
if test "$TERM_PROGRAM" = wayterm; and status is-interactive
    function _wt_prompt --on-event fish_prompt
        printf '\\e]133;A\\a'
    end
    function _wt_preexec --on-event fish_preexec
        printf '\\e]133;C\\a'
    end
    function _wt_postexec --on-event fish_postexec
        printf '\\e]133;D;%s\\a' $status
    end
    function _wt_cwd --on-variable PWD
        printf '\\e]7;file://%s%s\\a\\e]0;%s\\a' $hostname (string escape --style=url -- $PWD) $PWD
    end
end
`,
};

export function remoteSnippet(shell: RemoteShell): string {
  return SNIPPETS[shell];
}
