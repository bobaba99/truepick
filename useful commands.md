Run `npm install` in `apps/web` to pull @supabase/supabase-js (package-lock not updated yet).

Run `npm run dev` in `apps/web`.

After staging all files for `git add`, use `git restore --staged '*.md'` to unstage specific files for other commits.

Use `git add '*.tsx'` to add only certain files.

Fix last commit message: `git commit --amend`

Undo last local commit without deleting changes `git reset HEAD~1`

Undo pushed commmit safely `git revert <commit-hash>`