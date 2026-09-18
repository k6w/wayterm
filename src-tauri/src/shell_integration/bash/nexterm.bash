# Nexterm shell integration for bash (installed by Nexterm; do not edit).
#
# Nexterm starts bash as `bash --rcfile <this file>`. bash reads its system
# bashrc (if it was built with one) itself, so this file loads what bash would
# otherwise have read, ~/.bashrc, then adds the reports. Works with bash 3.2+.

# Session values: kept in unexported shell variables, removed from the environment.
_nx_nonce="${NEXTERM_SI_NONCE-}"
_nx_enabled="${NEXTERM_SHELL_INTEGRATION-}"
unset NEXTERM_SI_NONCE NEXTERM_SHELL_INTEGRATION

if [[ "${NEXTERM_BASH_LOGIN-}" == 1 ]]; then
  unset NEXTERM_BASH_LOGIN
  [[ -r /etc/profile ]] && . /etc/profile
  for _nx_file in ~/.bash_profile ~/.bash_login ~/.profile; do
    if [[ -r "$_nx_file" ]]; then
      . "$_nx_file"
      break
    fi
  done
  unset _nx_file
else
  [[ -r ~/.bashrc ]] && . ~/.bashrc
fi

if [[ "$_nx_enabled" == 1 && $- == *i* ]]; then
  # Percent-encodes $1 into REPLY, byte by byte.
  _nx_urlencode() {
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

  # Runs last before each prompt; $_nx_status is the last command's status.
  _nx_precmd() {
    if [[ -n "${_nx_started-}" ]]; then
      builtin printf '\e]133;D;%s\a' "$_nx_status"
    fi
    _nx_started=1
    _nx_urlencode "$PWD"
    # cwd, title (the cwd, as before) and prompt start.
    builtin printf '\e]7;file://%s%s\a\e]0;%s\a\e]133;A\a' "${HOSTNAME-}" "$REPLY" "$PWD"
    # Prompt frameworks rebuild PS1, so mark its end again whenever needed.
    local mark='\[\e]133;B\a\]'
    if [[ "$PS1" != *"$mark" ]]; then
      PS1="${PS1//"$mark"/}$mark"
    fi
    if [[ -n "${_nx_ps0_mark-}" && "$PS0" != *"$_nx_ps0_mark" ]]; then
      PS0="${PS0//"$_nx_ps0_mark"/}$_nx_ps0_mark"
    fi
    _nx_at_prompt=1
  }

  if [[ -n "${bash_preexec_imported-}${__bp_imported-}" ]]; then
    # bash-preexec owns PROMPT_COMMAND and the DEBUG trap; join its hooks.
    _nx_bp_precmd() {
      _nx_status=$?
      _nx_precmd
    }
    _nx_bp_preexec() {
      _nx_urlencode "$1"
      builtin printf '\e]133;C;cmdline_url=%s;nx=%s\a' "$REPLY" "$_nx_nonce"
    }
    precmd_functions+=(_nx_bp_precmd)
    preexec_functions+=(_nx_bp_preexec)
  else
    # The status must be read before any other prompt command changes it.
    if [[ "$(declare -p PROMPT_COMMAND 2>/dev/null)" == "declare -a"* ]]; then
      PROMPT_COMMAND=('_nx_status=$?' "${PROMPT_COMMAND[@]}" _nx_precmd)
    else
      PROMPT_COMMAND=$'_nx_status=$?\n'"${PROMPT_COMMAND-}"$'\n_nx_precmd'
    fi

    if (( BASH_VERSINFO[0] > 4 || (BASH_VERSINFO[0] == 4 && BASH_VERSINFO[1] >= 4) )); then
      # bash 4.4+ prints PS0 after reading a command line, before running it.
      _nx_ps0_mark=$'\e]133;C;nx='"$_nx_nonce"$'\a'
    elif [[ -z "$(trap -p DEBUG)" ]]; then
      # Older bash (macOS /bin/bash 3.2): the first command run after a prompt,
      # other than the prompt commands themselves and completion.
      _nx_at_prompt=0
      _nx_debug() {
        [[ "$_nx_at_prompt" == 1 && -z "${COMP_LINE-}" ]] || return 0
        _nx_at_prompt=0
        [[ "$BASH_COMMAND" == '_nx_status=$?' ]] && return 0
        builtin printf '\e]133;C;nx=%s\a' "$_nx_nonce"
      }
      trap '_nx_debug' DEBUG
    fi
    # Without either (a DEBUG trap of the user's own), commands are not reported.
  fi
fi
unset _nx_enabled
