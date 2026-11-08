# Setting up chomik in a project

Follow these steps exactly; CI configuration breaks easily. If the developer
prefers to go without CI for now, follow "Use it locally" in README.md instead
of steps 2 and 3.

1. This is usually the developer's first contact with chomik, so open with one
   sentence on what it is for, then say you are checking how CI runs, read-only.
   Read the files in `.github/workflows/`, the default branch from
   `.git/refs/remotes/origin/HEAD` (`ref: refs/remotes/origin/<branch>`), and
   whether the `origin` remote in `.git/config` is on github.com. If it is not,
   say briefly that the full flow needs a GitHub repository with Actions, and
   ask whether they will put the project on GitHub first, which they do
   themselves before coming back with `/chomik`, or go without CI for now.
2. Look for the daily build: a workflow with a `schedule` trigger. Scheduled
   workflows run only on the default branch, so that is the branch to use.
3. Propose the setup in one message and confirm once. Mention anything that may
   surprise the developer, for example an `origin` that is not their repository.
   Then:
   - Copy `looking-for-messages-from-the-past.mjs` from this folder to
     `.chomik/looking-for-messages-from-the-past.mjs`, unchanged.
   - Copy `chomik-workflow.yml` from this folder to
     `.github/workflows/chomik.yml`, with `BRANCH` replaced by the default
     branch.
   - With a daily build: in `chomik.yml`, delete the lines from
     `chomik: only without a daily build, begin` to `end`, inclusive. At the end
     of the build's `jobs:` section, add exactly these lines and change nothing
     else in it:

     ```yaml
       looking-for-messages-from-the-past: # 🐹 chomik, see .github/workflows/chomik.yml
         uses: ./.github/workflows/chomik.yml
     ```

     If another workflow deploys only after this build succeeds
     (`on: workflow_run`), mention that on a reminder's date that deployment
     waits until the reminder is handled.
   - Without a daily build: keep that block in `chomik.yml` and remove only its
     two marker comments, so it runs every night and on push by itself.
4. Skip how the files were checked and finish like a short tutorial for someone
   new to chomik: invite them to run `npx chomik check` now, say it finds
   nothing yet, and what it will show once a reminder is due. Then list the
   files to commit, including `.claude/skills/chomik/` so the whole team can
   use `/chomik`, and say that next time `/chomik` with a short description is
   all it takes.
