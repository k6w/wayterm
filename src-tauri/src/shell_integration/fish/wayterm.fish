# Wayterm shell integration for fish (installed by Wayterm; do not edit).
#
# Wayterm starts fish as `fish -C "source <this file>"`, which runs after the
# user's config.fish, so the user's config loads exactly as before.

# Session values: kept in an unexported global, removed from the environment.
set -g _wt_nonce "$WAYTERM_SI_NONCE"
set -l _wt_enabled "$WAYTERM_SHELL_INTEGRATION"
set -e WAYTERM_SI_NONCE
set -e WAYTERM_SHELL_INTEGRATION

# The window title is the cwd (Wayterm's behaviour before this script).
function fish_title
    echo $PWD
end

if test "$_wt_enabled" = 1; and status is-interactive
    set -g _wt_host $hostname
    test -n "$_wt_host"; or set -g _wt_host (hostname 2>/dev/null)
    function _wt_report_cwd --on-variable PWD
        printf '\e]7;file://%s%s\a' "$_wt_host" (string escape --style=url -- $PWD)
    end
    _wt_report_cwd

    # fish 4 also marks prompts and exit statuses itself, without the nonce;
    # Wayterm only accepts the marks below, which carry it.
    function _wt_preexec --on-event fish_preexec
        printf '\e]133;C;cmdline_url=%s;wt=%s\a' (string escape --style=url -- $argv[1]) $_wt_nonce
    end

    function _wt_postexec --on-event fish_postexec
        printf '\e]133;D;%s;wt=%s\a' $status $_wt_nonce
    end

    # Ends the user's prompt with B. Prompts can be redefined at any time
    # (themes, `fish_config`), so the wrapper is checked before each prompt.
    function _wt_wrap_prompt
        functions -q fish_prompt; or return
        if not functions fish_prompt | string match -q '*_wt_user_fish_prompt*'
            functions -e _wt_user_fish_prompt
            functions -c fish_prompt _wt_user_fish_prompt
            function fish_prompt
                _wt_user_fish_prompt
                printf '\e]133;B\a'
            end
        end
    end

    function _wt_prompt_start --on-event fish_prompt
        _wt_wrap_prompt
        printf '\e]133;A;wt=%s\a' $_wt_nonce
    end
end
