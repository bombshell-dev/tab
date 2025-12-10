---
'@bomb.sh/tab': patch
---

switching command execution from execSync (string-based, shell-parsed) to spawnSync with an argv array. this ensures trailing "" arguments are not dropped during shell re-parsing
