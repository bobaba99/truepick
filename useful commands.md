Run `npm install` in `apps/web` to pull @supabase/supabase-js (package-lock not updated yet).

Run `npm run dev` in `apps/web`.

Create new migration: `supabase migration new [MIGRATION]`

After staging all files for `git add`, use `git restore --staged '*.md'` to unstage specific files for other commits.

Use `git add '*.tsx'` to add only certain files.

Fix last commit message: `git commit --amend`

Undo last local commit without deleting changes `git reset HEAD~1`

Undo pushed commmit safely `git revert <commit-hash>`

npm linting command: `npm --workspace apps/web run lint`

# Git Work Trees

Use git work trees to work on multiple branches at the same time.
`git worktree add <path> <branch>`
`git worktree list`
`git worktree remove <path>`

For example:
`git worktree add ../truepick-timeout fix/verdict-llm-timeout-handling`
`git worktree add ../truepick-email feat/purchase-email-import-flow`
`git worktree add ../truepick-settings feat/settings-route-user-preferences`
`git worktree add ../truepick-share feat/verdict-share-capability`
`git worktree add ../truepick-resources feat/resources-page`
`git worktree add ../truepick-seo feat/resources-page-seo-optimization`

Run API server in `apps/api`:
`npm --workspace apps/api run dev`

Run `npm run dev` in the respective paths to start the development servers.
`npm run dev -- --port 3001`
`npm run dev -- --port 3002`
`npm run dev -- --port 3003`

Merge later:
`git checkout main`
`git merge feat/purchase-email-import-flow`
`git push`

Clean up work trees:
`git worktree remove ../truepick-email`
`git branch -d feat/purchase-email-import-flow`

# Pulling changes from main branch on work trees

`git fetch origin`
`git stash`
`git merge main`
`git stash pop`

# If I had to fix something while working on another branch

`git stash .`
`git checkout -b [hotfix]`
`git stash pop` or `git stash apply stash@{0}` safer without deleting it like `pop`
`git commit -m 'fix: `
`git checkout main`
`git merge fix: `
`git push`
`git checkout [original branch]`
`git pull origin main`

# Delete remote branch

`git push original --delete [branch name]`

# Branching + global docs workflow

## Start a second independent feature

Keep current feature branch alive, then:
`git switch main`
`git pull`
`git switch -c feat/<second-feature>`

Optional (parallel work, recommended):
`git worktree add .worktrees/feat-<second-feature> -b feat/<second-feature> main`

## Global docs updates (affect all features)

Do docs in a small docs branch from main:
`git switch main`
`git pull`
`git switch -c docs/<topic>`
`git commit -m "doc: <topic>"`
`git push -u origin docs/<topic>`

After docs PR is merged, update feature branches:
`git fetch origin`
`git switch feat/<feature>`
`git rebase origin/main`

## If docs were accidentally committed in a feature branch

Create docs branch and move commit there:
`git switch main`
`git pull`
`git switch -c docs/<topic>`
`git cherry-pick <doc-commit-hash>`
`git push -u origin docs/<topic>`

Then remove that commit from feature branch:
`git switch feat/<feature>`
`git rebase -i main`

In Vim during rebase:
- change `pick <doc-commit>` to `drop <doc-commit>` (or delete that line)
- save + quit: `Esc`, `:wq`, `Enter`

## Push rejected after rebase (non-fast-forward)

Use:
`git push --force-with-lease`

If still blocked:
`git fetch origin`
`git log --oneline --decorate --graph HEAD..origin/<branch>`

## Keep or delete branch?

- Keep branch alive while work/PR is still active.
- Delete after merge:
`git branch -d feat/<feature>`
`git push origin --delete feat/<feature>`
