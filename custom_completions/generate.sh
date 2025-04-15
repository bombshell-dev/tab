#!/usr/bin/env bash

# Generate the enhanced pnpm completion script
cat << 'EOF'
#compdef pnpm

if command -v pnpm-shell-completion &> /dev/null; then
    pnpm_comp_bin="$(which pnpm-shell-completion)"
else
    pnpm_comp_bin="$(dirname $0)/pnpm-shell-completion"
fi

# Function to check if a command has Tab-powered completions
_has_tab_completion() {
    local cmd="$1"
    
    # The most reliable method: Check if running the command's completion outputs a directive
    # Tab completions end with a line like ":4" to indicate the completion directive
    # Use timeout to prevent hanging on commands that don't support completions
    if timeout 1 pnpm exec $cmd complete -- "" 2>/dev/null | grep -q ':[0-9]\+$'; then
        return 0  # Success - command has Tab completions
    fi
    
    # No completion found
    return 1  # Failure - command doesn't have Tab completions
}

# Function to get completions from a Tab-powered command
_get_tab_completions() {
    local cmd="$1"
    shift
    local args=("$@")
    
    # Standard completion method with timeout to prevent hanging
    timeout 1 pnpm exec $cmd complete -- "${args[@]}" 2>/dev/null
    return $?
}

_pnpm() {
    typeset -A opt_args
    local cmd_index=1
    local has_custom_completion=0
    local custom_cmd=""
    
    # Check if we have command arguments beyond "pnpm"
    if (( CURRENT > 1 )); then
        # The first argument after pnpm might be a command with its own completion
        custom_cmd="${words[2]}"
        
        # Check for workspace-specific flags that would shift the command position
        if [[ "${words[2]}" == "--filter" || "${words[2]}" == "-F" ]]; then
            # The command comes after the filter and value
            if (( CURRENT > 3 )); then
                custom_cmd="${words[4]}"
                cmd_index=4
            else
                custom_cmd=""
            fi
        fi
        
        # Check if the command has Tab completions
        if [[ -n "$custom_cmd" ]] && _has_tab_completion "$custom_cmd"; then
            has_custom_completion=1
        fi
    fi
    
    # If we found a command with Tab completions and we're trying to complete its arguments
    if [[ $has_custom_completion -eq 1 ]] && (( CURRENT > cmd_index )); then
        # Extract the arguments for the custom command
        local cmd_args=("${words[@]:cmd_index}")
        
        # Get Tab completions for this command
        _get_tab_completions "$custom_cmd" "${cmd_args[@]}"
        return 0
    fi
    
    # Original pnpm completion logic
    _arguments \
        '(--filter -F)'{--filter,-F}'=:flag:->filter' \
        ':command:->scripts' \
        '*:: :->command_args'

    local target_pkg=${opt_args[--filter]:-$opt_args[-F]}

    case $state in
        filter)
            if [[ -f ./pnpm-workspace.yaml ]]; then
                _values 'filter packages' $(FEATURE=filter $pnpm_comp_bin)
            fi
            ;;
        scripts)
            _values 'scripts' $(FEATURE=scripts TARGET_PKG=$target_pkg ZSH=true $pnpm_comp_bin) \
                add remove install update publish
            ;;
        command_args)
            local cmd=$(FEATURE=pnpm_cmd $pnpm_comp_bin $words)
            case $cmd in
                add)
                    _arguments \
                        '(--global -g)'{--global,-g}'[Install as a global package]' \
                        '(--save-dev -D)'{--save-dev,-D}'[Save package to your `devDependencies`]' \
                        '--save-peer[Save package to your `peerDependencies` and `devDependencies`]'
                    ;;
                install|i)
                    _arguments \
                        '(--dev -D)'{--dev,-D}'[Only `devDependencies` are installed regardless of the `NODE_ENV`]' \
                        '--fix-lockfile[Fix broken lockfile entries automatically]' \
                        '--force[Force reinstall dependencies]' \
                        "--ignore-scripts[Don't run lifecycle scripts]" \
                        '--lockfile-only[Dependencies are not downloaded. Only `pnpm-lock.yaml` is updated]' \
                        '--no-optional[`optionalDependencies` are not installed]' \
                        '--offline[Trigger an error if any required dependencies are not available in local store]' \
                        '--prefer-offline[Skip staleness checks for cached data, but request missing data from the server]' \
                        '(--prod -P)'{--prod,-P}"[Packages in \`devDependencies\` won't be installed]"
                    ;;
                remove|rm|why)
                    if [[ -f ./package.json ]]; then
                        _values 'deps' $(FEATURE=deps TARGET_PKG=$target_pkg $pnpm_comp_bin)
                    fi
                    ;;
                update|upgrade|up)
                    _arguments \
                        '(--dev -D)'{--dev,-D}'[Update packages only in "devDependencies"]' \
                        '(--global -g)'{--global,-g}'[Update globally installed packages]' \
                        '(--interactive -i)'{--interactive,-i}'[Show outdated dependencies and select which ones to update]' \
                        '(--latest -L)'{--latest,-L}'[Ignore version ranges in package.json]' \
                        "--no-optional[Don't update packages in \`optionalDependencies\`]" \
                        '(--prod -P)'{--prod,-P}'[Update packages only in "dependencies" and "optionalDependencies"]' \
                        '(--recursive -r)'{--recursive,-r}'[Update in every package found in subdirectories or every workspace package]'
                    if [[ -f ./package.json ]]; then
                        _values 'deps' $(FEATURE=deps TARGET_PKG=$target_pkg $pnpm_comp_bin)
                    fi
                    ;;
                publish)
                    _arguments \
                        '--access=[Tells the registry whether this package should be published as public or restricted]: :(public restricted)' \
                        '--dry-run[Does everything a publish would do except actually publishing to the registry]' \
                        '--force[Packages are proceeded to be published even if their current version is already in the registry]' \
                        '--ignore-scripts[Ignores any publish related lifecycle scripts (prepublishOnly, postpublish, and the like)]' \
                        "--no-git-checks[Don't check if current branch is your publish branch, clean, and up to date]" \
                        '--otp[Specify a one-time password]' \
                        '--publish-branch[Sets branch name to publish]' \
                        '(--recursive -r)'{--recursive,-r}'[Publish all packages from the workspace]' \
                        '--tag=[Registers the published package with the given tag]'
                    ;;
                run)
                    if [[ -f ./package.json ]]; then
                        _values 'scripts' $(FEATURE=scripts TARGET_PKG=$target_pkg ZSH=true $pnpm_comp_bin)
                    fi
                    ;;
                *)
                    _files
            esac
    esac
}

compdef _pnpm pnpm
EOF 