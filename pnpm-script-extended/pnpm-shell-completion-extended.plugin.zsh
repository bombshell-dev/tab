#compdef pnpm

# -----------------------------------------------------------------------------
# pnpm Shell Completion Extension
# Adds support for tab completion of CLIs executed through pnpm
# -----------------------------------------------------------------------------

# Set to 1 to enable debug logging, 0 to disable
PNPM_TAB_DEBUG=0
DEBUG_FILE="/tmp/pnpm-completion-debug.log"

# Debug logging function
_pnpm_tab_debug() {
  if [[ $PNPM_TAB_DEBUG -eq 1 ]]; then
    echo "$(date): $*" >> $DEBUG_FILE
  fi
}

_pnpm_tab_debug "Loading pnpm completion script with CLI tab completion support"

# Run a CLI tool through pnpm directly
_pnpm_run_cli() {
    local cli_name=$1
    shift
    local cli_args=("$@")
    
    _pnpm_tab_debug "Running CLI via pnpm: $cli_name ${cli_args[*]}"
    # Execute the command through pnpm directly
    pnpm $cli_name "${cli_args[@]}" 2>/dev/null
}

# Complete commands using pnpm execution
_pnpm_complete_cli() {
    local cli_name=$1
    shift
    local cli_args=("$@")
    local output
    
    _pnpm_tab_debug "Completing $cli_name with args: ${cli_args[*]}"
    
    # Add __complete as the first argument
    cli_args=("__complete" "${cli_args[@]}")
    output=$(_pnpm_run_cli $cli_name "${cli_args[@]}" 2>&1)
    _pnpm_tab_debug "Completion output from pnpm: $output"
    
    # Process the output for ZSH completion
    if [[ -n "$output" ]]; then
        # Convert the output into a format that ZSH can use for completion
        local -a completions
        
        # Process each line of the output
        while IFS=$'\n' read -r line; do
            _pnpm_tab_debug "Processing line: $line"
            # Check if the line has a tab character (description)
            if [[ "$line" == *$'\t'* ]]; then
                # Split the line at the tab character
                local value=${line%%$'\t'*}
                local description=${line#*$'\t'}
                _pnpm_tab_debug "Adding completion with description: $value -> $description"
                completions+=("${value}:${description}")
            else
                # No description
                _pnpm_tab_debug "Adding completion without description: $line"
                completions+=("$line")
            fi
        done <<< "$output"
        
        # Use _describe to present the completions
        if [[ ${#completions[@]} -gt 0 ]]; then
            _pnpm_tab_debug "Found ${#completions[@]} completions, calling _describe"
            _describe "completions" completions
            return 0
        fi
    fi
    
    _pnpm_tab_debug "No completions found, falling back to file completion"
    # If we couldn't get or process completions, fall back to file completion
    _files
    return 1
}

# Check if a CLI supports __complete by running it through pnpm
_pnpm_cli_has_completions() {
    local cli_name=$1
    _pnpm_tab_debug "Checking if $cli_name has completions via pnpm"
    
    # Try to execute the __complete command through pnpm
    if output=$(_pnpm_run_cli $cli_name "__complete" 2>/dev/null) && [[ -n "$output" ]]; then
        _pnpm_tab_debug "$cli_name supports completions via pnpm: $output"
        return 0
    fi
    
    _pnpm_tab_debug "$cli_name does not support completions via pnpm"
    return 1
}

# Original pnpm-shell-completion logic
if command -v pnpm-shell-completion &> /dev/null; then
    pnpm_comp_bin="$(which pnpm-shell-completion)"
    _pnpm_tab_debug "Found pnpm-shell-completion at $pnpm_comp_bin"
else
    pnpm_comp_bin="$(dirname $0)/pnpm-shell-completion"
    _pnpm_tab_debug "Using relative pnpm-shell-completion at $pnpm_comp_bin"
fi

_pnpm() {
    typeset -A opt_args
    _pnpm_tab_debug "Starting pnpm completion, words: ${words[*]}"

    _arguments \
        '(--filter -F)'{--filter,-F}'=:flag:->filter' \
        ':command:->scripts' \
        '*:: :->command_args'

    local target_pkg=${opt_args[--filter]:-$opt_args[-F]}
    _pnpm_tab_debug "State: $state, target_pkg: $target_pkg"
        
    case $state in
        filter)
            if [[ -f ./pnpm-workspace.yaml ]] && [[ -x "$pnpm_comp_bin" ]]; then
                _pnpm_tab_debug "Using pnpm-shell-completion for filter packages"
                _values 'filter packages' $(FEATURE=filter $pnpm_comp_bin)
            else
                _pnpm_tab_debug "No workspace or pnpm-shell-completion for filter"
                _message "package filter"
            fi
            ;;
        scripts)
            if [[ -x "$pnpm_comp_bin" ]]; then
                _pnpm_tab_debug "Using pnpm-shell-completion for scripts"
                _values 'scripts' $(FEATURE=scripts TARGET_PKG=$target_pkg ZSH=true $pnpm_comp_bin) \
                    add remove install update publish
            else
                _pnpm_tab_debug "Using basic pnpm commands (no pnpm-shell-completion)"
                _values 'scripts' \
                    'add:Add a dependency' \
                    'install:Install dependencies' \
                    'remove:Remove a dependency' \
                    'update:Update dependencies' \
                    'publish:Publish package' \
                    'run:Run script'
            fi
            ;;
        command_args)
            local cmd=$words[1]
            _pnpm_tab_debug "Completing command args for $cmd"
            
            # Get the pnpm command if available
            local pnpm_cmd=""
            if [[ -x "$pnpm_comp_bin" ]]; then
                pnpm_cmd=$(FEATURE=pnpm_cmd $pnpm_comp_bin $words 2>/dev/null)
                _pnpm_tab_debug "pnpm-shell-completion identified command: $pnpm_cmd"
            else
                pnpm_cmd=$cmd
                _pnpm_tab_debug "Using first word as command: $pnpm_cmd"
            fi
            
            # Check if this is a potential CLI command that might support tab completion
            if [[ $cmd != "add" && $cmd != "remove" && $cmd != "install" && 
                  $cmd != "update" && $cmd != "publish" && $cmd != "i" && 
                  $cmd != "rm" && $cmd != "up" && $cmd != "run" ]]; then
                
                _pnpm_tab_debug "Checking if $cmd has tab completions via pnpm"
                # Check if the command has tab completions through pnpm
                if _pnpm_cli_has_completions $cmd; then
                    _pnpm_tab_debug "$cmd has tab completions via pnpm, passing args"
                    # Pass remaining arguments to the CLI's completion
                    local cli_args=("${words[@]:2}")
                    _pnpm_complete_cli $cmd "${cli_args[@]}"
                    return
                fi
            fi
            
            # Fall back to default pnpm completion behavior
            _pnpm_tab_debug "Using standard completion for pnpm $pnpm_cmd"
            case $pnpm_cmd in
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
                    if [[ -f ./package.json && -x "$pnpm_comp_bin" ]]; then
                        _values 'deps' $(FEATURE=deps TARGET_PKG=$target_pkg $pnpm_comp_bin)
                    else
                        _message "package name"
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
                    if [[ -f ./package.json && -x "$pnpm_comp_bin" ]]; then
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
                    if [[ -f ./package.json && -x "$pnpm_comp_bin" ]]; then
                        _values 'scripts' $(FEATURE=scripts TARGET_PKG=$target_pkg ZSH=true $pnpm_comp_bin)
                    else
                        _message "script name"
                    fi
                    ;;
                *)
                    _files
            esac
    esac
}

compdef _pnpm pnpm

_pnpm_tab_debug "pnpm extended completion script loaded" 