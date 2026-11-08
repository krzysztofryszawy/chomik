# Setting up chomik in a project

Follow these steps exactly; CI configuration breaks easily.

1. This is usually the developer's first contact with chomik, so open with one
   sentence on what it is for, then say you are checking how CI runs, read-only.
   Read the files
   in `.github/workflows/`, the default branch from
   `.git/refs/remotes/origin/HEAD` (`ref: refs/remotes/origin/<branch>`), and
   whether the `origin` remote in `.git/config` is on github.com. If it is not,
   say chomik needs GitHub Actions for now, and stop.
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
4. Say that chomik is ready, list the files to commit, and that next time
   `/chomik` with a short description is all it takes.

The steps above are the full flow; describe it as such. Only if the developer
does not want the CI part, now or at all, or the project is not on GitHub and
they ask how to use chomik anyway, offer local use: copy only the check script
as in step 3 and point to "Use it locally" in README.md. Moving to CI later is
this setup from step 1; the script is replaced with the same file and reminders
already in `.chomik/` stay as they are.
