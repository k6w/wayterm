# Wayterm shell integration for bash (installed by Wayterm; do not edit).
#
# Wayterm starts bash as `bash --rcfile <this file>`. bash reads its system
# bashrc (if it was built with one) itself, so this file loads what bash would
# otherwise have read, ~/.bashrc, then adds the reports. Works with bash 3.2+.

# Session values: kept in unexported shell variables, removed from the environment.
_wt_nonce="${WAYTERM_SI_NONCE-}"
_wt_enabled="${WAYTERM_SHELL_INTEGRATION-}"
unset WAYTERM_SI_NONCE WAYTERM_SHELL_INTEGRATION

if [[ "${WAYTERM_BASH_LOGIN-}" == 1 ]]; then
  unset WAYTERM_BASH_LOGIN
  [[ -r /etc/profile ]] && . /etc/profile
  for _wt_file in ~/.bash_profile ~/.bash_login ~/.profile; do
    if [[ -r "$_wt_file" ]]; then
      . "$_wt_file"
      break
    fi
  done
  unset _wt_file
else
  [[ -r ~/.bashrc ]] && . ~/.bashrc
fi

if [[ "$_wt_enabled" == 1 && $- == *i* ]]; then
  # Percent-encodes $1 into REPLY, byte by byte.
  _wt_urlencode() {
    local LC_ALL=C s="$1" out="" c i
    for (( i = 0; i < ${#s}; i++ )); do
      c="${s:i:1}"
      case "$c" in
        [a-zA-Z0-9/._~-]) out+="$c" ;;
        # Bytes above 0x7F can come out sign-extended; the last two digits are the byte.
        *) builtin printf -v c '%02X' "'$c"; out+="%${c: -2}" ;;
      esac
    done
    REPLY="$out"
  }

  # Runs last before each prompt; $_wt_status is the last command's status.
  _wt_precmd() {
    if [[ -n "${_wt_started-}" ]]; then
      builtin printf '\e]133;D;%s;wt=%s\a' "$_wt_status" "$_wt_nonce"
    fi
    _wt_started=1
    _wt_urlencode "$PWD"
    # cwd, title (the cwd, as before) and prompt start.
    builtin printf '\e]7;file://%s%s\a\e]0;%s\a\e]133;A;wt=%s\a' \
      "${HOSTNAME-}" "$REPLY" "$PWD" "$_wt_nonce"
    # Prompt frameworks rebuild PS1, so mark its end again whenever needed.
    local mark='\[\e]133;B\a\]'
    if [[ "$PS1" != *"$mark" ]]; then
      PS1="${PS1//"$mark"/}$mark"
    fi
    if [[ -n "${_wt_ps0_mark-}" && "$PS0" != *"$_wt_ps0_mark" ]]; then
      PS0="${PS0//"$_wt_ps0_mark"/}$_wt_ps0_mark"
    fi
    _wt_at_prompt=1
  }

  if [[ -n "${bash_preexec_imported-}${__bp_imported-}" ]]; then
    # bash-preexec owns PROMPT_COMMAND and the DEBUG trap; join its hooks.
    _wt_bp_precmd() {
      _wt_status=$?
      _wt_precmd
    }
    _wt_bp_preexec() {
      _wt_urlencode "$1"
      builtin printf '\e]133;C;cmdline_url=%s;wt=%s\a' "$REPLY" "$_wt_nonce"
    }
    precmd_functions+=(_wt_bp_precmd)
    preexec_functions+=(_wt_bp_preexec)
  else
    # The status must be read before any other prompt command changes it.
    if [[ "$(declare -p PROMPT_COMMAND 2>/dev/null)" == "declare -a"* ]]; then
      PROMPT_COMMAND=('_wt_status=$?' "${PROMPT_COMMAND[@]}" _wt_precmd)
    else
      PROMPT_COMMAND=$'_wt_status=$?\n'"${PROMPT_COMMAND-}"$'\n_wt_precmd'
    fi

    if (( BASH_VERSINFO[0] > 4 || (BASH_VERSINFO[0] == 4 && BASH_VERSINFO[1] >= 4) )); then
      # bash 4.4+ prints PS0 after reading a command line, before running it.
      # The nonce is expanded when PS0 is shown, so PS0 itself never holds it.
      if shopt -q promptvars; then
        _wt_ps0_mark=$'\e]133;C;wt=${_wt_nonce}\a'
      else
        _wt_ps0_mark=$'\e]133;C;wt='"$_wt_nonce"$'\a'
      fi
    elif [[ -z "$(trap -p DEBUG)" ]]; then
      # Older bash (macOS /bin/bash 3.2): the first command run after a prompt,
      # other than the prompt commands themselves and completion.
      _wt_at_prompt=0
      _wt_debug() {
        [[ "$_wt_at_prompt" == 1 && -z "${COMP_LINE-}" ]] || return 0
        _wt_at_prompt=0
        [[ "$BASH_COMMAND" == '_wt_status=$?' ]] && return 0
        builtin printf '\e]133;C;wt=%s\a' "$_wt_nonce"
      }
      trap '_wt_debug' DEBUG
    fi
    # Without either (a DEBUG trap of the user's own), commands are not reported.
  fi
fi
unset _wt_enabled
