# @bombsh/tab

## 0.0.13

### Patch Changes

- f619ad7: Widen `peerDependencies` to accept citty v0.2.

## 0.0.12

### Patch Changes

- 23a6ef9: Update fish shell completion script to match latest Cobra output. (#99)

## 0.0.11

### Patch Changes

- 88bfb2a: fix: wrap dashes and arguments in single quotes
- 864242b: fix: should complete options after boolean option

## 0.0.10

### Patch Changes

- 060c025: Fix PowerShell completion argument parsing
- 5832a09: switching command execution from execSync (string-based, shell-parsed) to spawnSync with an argv array. this ensures trailing "" arguments are not dropped during shell re-parsing

## 0.0.9

### Patch Changes

- d6cdbe4: fix(cli): use the globally installed version for shell completions

## 0.0.8

### Patch Changes

- 86b24d4: parse args manually for tab's cli instead of using cac

## 0.0.7

### Patch Changes

- 7178288: fix: use npx for portable completion scripts instead of absolute paths
- 8defa6f: npm exec support

## 0.0.6

### Patch Changes

- 5f929c4: fix: citty should not throw an error when there is no subcommand
- 9aa80ef: remove mri dep

## 0.0.5

### Patch Changes

- ab8c800: trigger release

## 0.0.4

### Patch Changes

- 8b89b06: release v0.0.4

## 0.0.3

### Patch Changes

- 1655153: Update package metadata with repo URL.

## 0.0.2

### Patch Changes

- 3be9781: Update package org to bomb.sh

## 0.0.1

### Patch Changes

- ea5eca3: Update package metadata to include keywords and authors.
