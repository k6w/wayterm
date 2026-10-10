# Wayterm shell integration for zsh (installed by Wayterm; do not edit).
#
# Wayterm starts zsh with ZDOTDIR pointing here. This file puts the user's
# ZDOTDIR back first, so zsh then reads the user's own .zshenv, .zprofile
# (login shells only), .zshrc and .zlogin exactly as it would without Wayterm,
# and nested shells are not integrated again.

# Session values: kept in unexported shell variables, removed from the environment.
'builtin' 'typeset' -g _wt_nonce="${WAYTERM_SI_NONCE-}" _wt_enabled="${WAYTERM_SHELL_INTEGRATION-}"
'builtin' 'unset' WAYTERM_SI_NONCE WAYTERM_SHELL_INTEGRATION

if [[ -n "${WAYTERM_ORIG_ZDOTDIR_UNSET-}" ]]; then
  'builtin' 'unset' ZDOTDIR
elif [[ -n "${WAYTERM_ORIG_ZDOTDIR+set}" ]]; then
  'builtin' 'export' ZDOTDIR="$WAYTERM_ORIG_ZDOTDIR"
else
  # Not started by Wayterm's spawn plan: behave as if this file did not exist.
  'builtin' 'unset' ZDOTDIR
fi
'builtin' 'unset' WAYTERM_ORIG_ZDOTDIR WAYTERM_ORIG_ZDOTDIR_UNSET

'builtin' 'typeset' _wt_file="${ZDOTDIR:-$HOME}/.zshenv"
[[ ! -r "$_wt_file" ]] || 'builtin' 'source' '--' "$_wt_file"
'builtin' 'unset' _wt_file

if [[ -o interactive && "$_wt_enabled" == 1 ]]; then
  # Percent-encodes $1 into REPLY, byte by byte (UTF-8 stays UTF-8 once decoded).
  _wt_urlencode() {
    'builtin' 'emulate' -L zsh -o extendedglob -o nomultibyte
    REPLY="${1//(#m)[^a-zA-Z0-9\/._~-]/%${(l:2::0:)$(( [##16] #MATCH ))}}"
  }

  _wt_precmd() {
    'builtin' 'local' _wt_status=$?
    if (( _wt_ran )); then
      'builtin' 'printf' '\e]133;D;%s;wt=%s\a' "$_wt_status" "$_wt_nonce"
      _wt_ran=0
    fi
    _wt_urlencode "$PWD"
    # cwd, title (the cwd, as before) and prompt start. A is printed here rather
    # than put in PS1 so a prompt redrawn by zle (resize) does not repeat it.
    'builtin' 'printf' '\e]7;file://%s%s\a\e]0;%s\a\e]133;A;wt=%s\a' \
      "${HOST-}" "$REPLY" "${PWD//[[:cntrl:]]/}" "$_wt_nonce"
    # Themes rebuild PS1 before every prompt, so mark its end again whenever needed.
    'builtin' 'local' _wt_mark=$'%{\e]133;B\a%}'
    if [[ "$PS1" != *"$_wt_mark" ]]; then
      PS1="${PS1//$_wt_mark/}$_wt_mark"
    fi
  }

  _wt_preexec() {
    _wt_ran=1
    _wt_urlencode "$1"
    'builtin' 'printf' '\e]133;C;cmdline_url=%s;wt=%s\a' "$REPLY" "$_wt_nonce"
  }

  # Installs the hooks at the first prompt, after the user's config added its
  # own (prompt themes, instant prompts), so ours run last and see final PS1.
  _wt_deferred_init() {
    add-zsh-hook -d precmd _wt_deferred_init
    'builtin' 'typeset' -gi _wt_ran=0
    add-zsh-hook precmd _wt_precmd
    add-zsh-hook preexec _wt_preexec
    _wt_precmd
  }

  'builtin' 'autoload' -Uz add-zsh-hook
  add-zsh-hook precmd _wt_deferred_init
fi
'builtin' 'unset' _wt_enabled
