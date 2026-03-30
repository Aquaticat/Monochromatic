# Git credential loss after `gh auth setup-git`

## Problem

`git push` fails intermittently with authentication errors.
Running `gh auth setup-git` restores credentials, but the fix does not persist across sessions or after some elapsed time.

## Symptoms

- `git push` fails with credential/auth errors
- `gh auth setup-git` immediately fixes it
- The fix is temporary; credentials are lost again later

## Investigation tasks

- [ ] Check what `gh auth setup-git` actually writes (run with `--verbose` or diff gitconfig before/after)
- [ ] Determine which credential helper is configured (`git config --show-origin credential.helper`) and whether it changes between working/broken states
- [ ] Check if another process or tool overwrites `~/.gitconfig` or `~/.config/git/config`
- [ ] Look for competing credential helpers (libsecret, credential-cache with a timeout, gnome-keyring)
- [ ] Check if `credential-cache` is in use and whether its daemon (`git-credential-cache--daemon`) dies or times out
- [ ] Inspect `gh auth status` output when push fails vs when it works
- [ ] Check if the gh oauth token itself expires (unlikely for PATs, possible for OAuth app tokens)
- [ ] Verify whether the issue correlates with system sleep/resume, network changes, or session restarts
- [ ] Check systemd user service status if credential-cache or a secret agent is involved (`systemctl --user status`)

## Potential fixes to evaluate

- Configure `gh` as the credential helper permanently in the correct gitconfig scope
- Pin the credential helper in a project-local `.gitconfig` include
- Add a systemd user timer or shell hook that re-runs `gh auth setup-git` on login
- Switch to SSH-based push URLs to bypass HTTPS credential management entirely
- Detect auth failures in the existing `git` bash wrapper function and auto-run `gh auth setup-git` before retrying
