#!/bin/bash

# Determine the ZSH completion directory
ZSH_COMPLETION_DIR=~/.zsh/completions
if [ -d ~/.oh-my-zsh ]; then
  ZSH_COMPLETION_DIR=~/.oh-my-zsh/completions
fi

# Create completion directory if it doesn't exist
mkdir -p $ZSH_COMPLETION_DIR

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Copy the enhanced pnpm completion to the ZSH completion directory
cp "$SCRIPT_DIR/_pnpm_enhanced" "$ZSH_COMPLETION_DIR/_pnpm"

# Make sure the completion directory is in fpath
echo "Installed enhanced pnpm completion to $ZSH_COMPLETION_DIR/_pnpm"
echo ""
echo "To enable it, make sure you have the following in your .zshrc:"
echo ""
echo "# Add custom completions directory to fpath"
echo "fpath=($ZSH_COMPLETION_DIR \$fpath)"
echo ""
echo "# Initialize completions"
echo "autoload -Uz compinit"
echo "compinit"
echo ""
echo "Then restart your shell or run 'source ~/.zshrc'" 