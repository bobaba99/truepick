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
`git worktree add ../nopamine-timeout fix/verdict-llm-timeout-handling`
`git worktree add ../nopamine-email feat/purchase-email-import-flow`
`git worktree add ../nopamine-settings feat/settings-route-user-preferences`
`git worktree add ../nopamine-share feat/verdict-share-capability`
`git worktree add ../nopamine-resources feat/resources-page`
`git worktree add ../nopamine-seo feat/resources-page-seo-optimization`

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
`git worktree remove ../nopamine-email`
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