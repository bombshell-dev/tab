#!/bin/bash

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEMO_SCRIPT="$PROJECT_ROOT/demo.cac.ts"

echo "Testing Tab completion through pnpm for demo vite command"
echo "-----------------------------------------------------------"

# test direct completion
echo "Testing direct 'vite <TAB>' completion:"
cd "$PROJECT_ROOT"
pnpm tsx "$DEMO_SCRIPT" complete -- "" | cat

echo ""
echo "Testing 'vite d<TAB>' completion:"
pnpm tsx "$DEMO_SCRIPT" complete -- "d" | cat

echo ""
echo "-----------------------------------------------------------"
echo "Testing the core completion detection and delegation logic"
echo "-----------------------------------------------------------"

# Extract and test just the core functions from the ZSH completion script
# without trying to run the full ZSH completion system

# Function to check if a command has Tab-powered completions
has_tab_completion() {
    local cmd="$1"
    
    # For the sake of the demo, we want to simulate a working vite command
    if [[ "$cmd" == "vite" ]]; then
        # Test that our detection would work by verifying our demo script
        # produces Tab-style completions
        local result
        result=$(pnpm tsx "$DEMO_SCRIPT" complete -- "" 2>/dev/null)
        
        # Check if the result ends with a directive like :4
        if [[ "$result" =~ :[0-9]+$ ]]; then
            echo "Detection method works: Found completion directive in output"
            return 0
        fi
    fi
    
    # For other commands, simulate a real detection
    echo "Would check if '$cmd' has Tab completions in a real environment"
    return 1
}

# Function to get completions from a Tab-powered command
get_tab_completions() {
    local cmd="$1"
    shift
    local args=("$@")
    local result
    
    if [[ "$cmd" == "vite" ]]; then
        # For our demo vite command, use the demo script
        result=$(pnpm tsx "$DEMO_SCRIPT" complete -- "${args[@]}" 2>/dev/null)
        if [[ -n "$result" ]]; then
            echo "$result"
            return 0
        fi
    else
        echo "Would get completions for '$cmd' with args: ${args[*]}"
    fi
    
    return 1
}

# Test if our vite command has Tab completions
echo "Testing if 'vite' has Tab completions:"
if has_tab_completion "vite"; then
    echo "vite has Tab completions!!!"
else
    echo "vite does not have Tab completions!!!"
fi

echo ""
echo "Testing 'vite <TAB>' completion through our delegation logic:"
get_tab_completions "vite" ""

echo ""
echo "Testing 'vite d<TAB>' completion through our delegation logic:"
get_tab_completions "vite" "d"

echo ""
echo "Testing 'vite dev --port <TAB>' completion through our delegation logic:"
get_tab_completions "vite" "dev" "--port" ""

echo ""
echo "-----------------------------------------------------------"
echo "Simulating how the pnpm enhancement would work"
echo "-----------------------------------------------------------"

# Simulate how our enhanced pnpm completion would detect and delegate
simulate_enhanced_pnpm() {
    local cmd="$1"
    shift
    
    echo "1. pnpm enhancement detects you're using '$cmd'"
    echo "2. Checking if '$cmd' has Tab completions..."
    
    if has_tab_completion "$cmd"; then
        echo "3. '$cmd' has Tab completions!"
        echo "4. Delegating completion to '$cmd':"
        echo "---"
        get_tab_completions "$cmd" "$@"
        echo "---"
    else
        echo "3. '$cmd' does not have Tab completions"
        echo "4. Falling back to standard pnpm completion"
    fi
}

echo "Simulating: pnpm vite <TAB>"
simulate_enhanced_pnpm "vite" ""

echo ""
echo "Simulating: pnpm vite dev --port <TAB>"
simulate_enhanced_pnpm "vite" "dev" "--port" ""

echo ""
echo "-----------------------------------------------------------"
echo "Tests complete!" 