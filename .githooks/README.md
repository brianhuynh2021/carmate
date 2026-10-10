# Git hooks

This directory contains hooks committed to the repo, in place of `.git/hooks/`
(that directory is not tracked by git, so it is lost when the repo is re-cloned).

## Activation

```bash
npm run hooks:install
```

This command points `core.hooksPath` at `.githooks`. It only needs to be run once
per clone.

## `pre-push`

Blocks pushes to `main` if the E2E suite is not green: it spins up a server on port 4999,
runs `npm test`, and only allows the push when all tests pass.

This is a substitute layer for GitHub branch protection — that feature
is not available on private repos on the Free plan.

Skip it once when really necessary:

```bash
git push --no-verify
```
