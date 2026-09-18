# Nexterm shell integration for fish (installed by Nexterm; do not edit).
#
# Nexterm starts fish as `fish -C "source <this file>"`, which runs after the
# user's config.fish, so the user's config loads exactly as before.

# Session values: kept in an unexported global, removed from the environment.
set -g _nx_nonce "$NEXTERM_SI_NONCE"
set -l _nx_enabled "$NEXTERM_SHELL_INTEGRATION"
set -e NEXTERM_SI_NONCE
set -e NEXTERM_SHELL_INTEGRATION

# The window title is the cwd (Nexterm's behaviour before this script).
function fish_title
    echo $PWD
end

if test "$_nx_enabled" = 1; and status is-interactive
    # fish 4 reports prompt start, command start and exit status itself.
    set -g _nx_native_marks 0
    set -l _nx_major (string match -r '^[0-9]+' -- $FISH_VERSION)
    if test -n "$_nx_major"; and test "$_nx_major" -ge 4
        set -g _nx_native_marks 1
    end

    set -g _nx_host $hostname
    test -n "$_nx_host"; or set -g _nx_host (hostname 2>/dev/null)
    function _nx_report_cwd --on-variable PWD
        printf '\e]7;file://%s%s\a' "$_nx_host" (string escape --style=url -- $PWD)
    end
    _nx_report_cwd

    function _nx_preexec --on-event fish_preexec
        printf '\e]133;C;cmdline_url=%s;nx=%s\a' (string escape --style=url -- $argv[1]) $_nx_nonce
    end

    if test $_nx_native_marks = 0
        function _nx_postexec --on-event fish_postexec
            printf '\e]133;D;%s\a' $status
        end

        # Ends the user's prompt with B. Prompts can be redefined at any time
        # (themes, `fish_config`), so the wrapper is checked before each prompt.
        function _nx_wrap_prompt
            functions -q fish_prompt; or return
            if not functions fish_prompt | string match -q '*_nx_user_fish_prompt*'
                functions -e _nx_user_fish_prompt
                functions -c fish_prompt _nx_user_fish_prompt
                function fish_prompt
                    _nx_user_fish_prompt
                    printf '\e]133;B\a'
                end
            end
        end

        function _nx_prompt_start --on-event fish_prompt
            _nx_wrap_prompt
            printf '\e]133;A\a'
        end
    end
end
