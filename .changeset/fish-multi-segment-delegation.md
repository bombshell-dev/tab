---
'@bomb.sh/tab': patch
---

fix(fish): pass multi-segment CLI paths as separate arguments

In fish, completing a package-manager-delegated CLI with more than one path segment (e.g. `pnpm <cli> <subcommand> --<TAB>`) returned nothing and fell back to the package manager's own flags. The generated fish script built the request with `string join ' '` + `eval`, and because fish does not expand bare `(...)` command substitution inside double quotes, the whole path collapsed into a single token on re-parse. The template now invokes the backend directly with fish list expansion, so every segment reaches the completion backend as its own argument. zsh and bash already quoted each argument individually; PowerShell was audited and quotes each token before `Invoke-Expression`, so it is unaffected.
