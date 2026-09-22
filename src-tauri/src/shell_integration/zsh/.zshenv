# Nexterm shell integration for zsh (installed by Nexterm; do not edit).
#
# Nexterm starts zsh with ZDOTDIR pointing here. This file puts the user's
# ZDOTDIR back first, so zsh then reads the user's own .zshenv, .zprofile
# (login shells only), .zshrc and .zlogin exactly as it would without Nexterm,
# and nested shells are not integrated again.

# Session values: kept in unexported shell variables, removed from the environment.
'builtin' 'typeset' -g _nx_nonce="${NEXTERM_SI_NONCE-}" _nx_enabled="${NEXTERM_SHELL_INTEGRATION-}"
'builtin' 'unset' NEXTERM_SI_NONCE NEXTERM_SHELL_INTEGRATION

if [[ -n "${NEXTERM_ORIG_ZDOTDIR_UNSET-}" ]]; then
  'builtin' 'unset' ZDOTDIR
elif [[ -n "${NEXTERM_ORIG_ZDOTDIR+set}" ]]; then
  'builtin' 'export' ZDOTDIR="$NEXTERM_ORIG_ZDOTDIR"
else
  # Not started by Nexterm's spawn plan: behave as if this file did not exist.
  'builtin' 'unset' ZDOTDIR
fi
'builtin' 'unset' NEXTERM_ORIG_ZDOTDIR NEXTERM_ORIG_ZDOTDIR_UNSET

'builtin' 'typeset' _nx_file="${ZDOTDIR:-$HOME}/.zshenv"
[[ ! -r "$_nx_file" ]] || 'builtin' 'source' '--' "$_nx_file"
'builtin' 'unset' _nx_file

if [[ -o interactive && "$_nx_enabled" == 1 ]]; then
  # Percent-encodes $1 into REPLY, byte by byte (UTF-8 stays UTF-8 once decoded).
  _nx_urlencode() {
    'builtin' 'emulate' -L zsh -o extendedglob -o nomultibyte
    REPLY="${1//(#m)[^a-zA-Z0-9\/._~-]/%${(l:2::0:)$(( [##16] #MATCH ))}}"
  }

  _nx_precmd() {
    'builtin' 'local' _nx_status=$?
    if (( _nx_ran )); then
      'builtin' 'printf' '\e]133;D;%s;nx=%s\a' "$_nx_status" "$_nx_nonce"
      _nx_ran=0
    fi
    _nx_urlencode "$PWD"
    # cwd, title (the cwd, as before) and prompt start. A is printed here rather
    # than put in PS1 so a prompt redrawn by zle (resize) does not repeat it.
    'builtin' 'printf' '\e]7;file://%s%s\a\e]0;%s\a\e]133;A;nx=%s\a' \
      "${HOST-}" "$REPLY" "${PWD//[[:cntrl:]]/}" "$_nx_nonce"
    # Themes rebuild PS1 before every prompt, so mark its end again whenever needed.
    'builtin' 'local' _nx_mark=$'%{\e]133;B\a%}'
    if [[ "$PS1" != *"$_nx_mark" ]]; then
      PS1="${PS1//$_nx_mark/}$_nx_mark"
    fi
  }

  _nx_preexec() {
    _nx_ran=1
    _nx_urlencode "$1"
    'builtin' 'printf' '\e]133;C;cmdline_url=%s;nx=%s\a' "$REPLY" "$_nx_nonce"
  }

  # Installs the hooks at the first prompt, after the user's config added its
  # own (prompt themes, instant prompts), so ours run last and see final PS1.
  _nx_deferred_init() {
    add-zsh-hook -d precmd _nx_deferred_init
    'builtin' 'typeset' -gi _nx_ran=0
    add-zsh-hook precmd _nx_precmd
    add-zsh-hook preexec _nx_preexec
    _nx_precmd
  }

  'builtin' 'autoload' -Uz add-zsh-hook
  add-zsh-hook precmd _nx_deferred_init
fi
'builtin' 'unset' _nx_enabled
