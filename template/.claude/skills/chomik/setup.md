# Setting chomik up in CI

The installer has already put the check script in `.chomik/`; setup connects it
to CI. CI configuration breaks easily, so make the changes below and no others.
If the developer declines CI, change nothing and go to step 4; "Use it locally"
in README.md says what that means.

1. Say you are checking how CI runs, read-only, then read:
   - the files in `.github/workflows/`;
   - whether the `origin` remote in `.git/config` is on github.com. If it is
     not, say briefly that the full flow needs a GitHub repository with Actions,
     and ask whether they will put the project on GitHub first, which they do
     themselves before coming back with `/chomik`, or go without CI for now;
   - the default branch, from `.git/refs/remotes/origin/HEAD`
     (`ref: refs/remotes/origin/<branch>`). A repository that was not cloned has
     no such file; then ask the developer which branch is the default one,
     suggesting the current branch from `.git/HEAD`. With a wrong branch the
     build would never turn red.
2. Look for the daily build: a workflow other than `chomik.yml` that builds or
   tests the project and has a `schedule` trigger running at least once a day.
   Scheduled workflows run only on the default branch, which is why chomik uses
   that branch. With several candidates, or when unsure, ask the developer which
   one the team watches. With none, chomik gets its own nightly run.
3. Propose the setup in two or three plain sentences and confirm once: this is a
   one-time step that adds one workflow file, plus two lines in the daily build
   if there is one, and after it chomik checks by itself every day. Mention only
   what would really surprise the developer, for example an `origin` that is not
   their repository. Then:
   - Copy `chomik-workflow.yml` from this folder to
     `.github/workflows/chomik.yml`, with `BRANCH` replaced by the default
     branch.
   - With a daily build: in `chomik.yml`, delete the lines from
     `chomik: only without a daily build, begin` to `end`, inclusive. At the end
     of the build's `jobs:` section, add this job, indented like the other jobs
     there, and change nothing else in that file:

     ```yaml
     looking-for-messages-from-the-past: # 🐹 chomik, see .github/workflows/chomik.yml
       uses: ./.github/workflows/chomik.yml
     ```

     If another workflow deploys only after this build succeeds
     (`on: workflow_run`), mention that on a reminder's date that deployment
     waits until the reminder is handled.
   - Without a daily build: keep that block in `chomik.yml` and remove only its
     two marker comments, so it runs every night and on push by itself.
4. Skip how the files were checked and finish as a short dialogue with someone
   new to chomik, one step per message, waiting for their reply each time:
   - invite them to run `npx chomik check` now, and say in one sentence what it
     shows;
   - then suggest adding these to their next commit, each with what it gives
     them: `.claude/skills/chomik/`, so the whole team can type `/chomik`;
     `.chomik/`, which holds the reminders and the script that checks them; and
     any workflow changed in step 3;
   - then say chomik is ready, and in plain words when its reminders will show:
     every night in CI, or, without CI, whenever someone runs
     `npx chomik check`. If they already said what to remember, continue with
     that reminder; otherwise invite them to type `/chomik` whenever something
     must not be forgotten.

   Say what happens instead of using terms such as "tracked", "checker" or
   "local mode".

## Updating chomik.yml

For a project whose `.github/workflows/chomik.yml` is older than
`chomik-workflow.yml` in this folder. Keep the setup the project already has:

1. In the existing file, note the branch after `--branch` and whether there is a
   `schedule` trigger.
2. Replace the file with a copy of `chomik-workflow.yml`, with `BRANCH` replaced
   by that branch. If the old file had a `schedule` trigger, remove only the two
   marker comments; if it had none, delete the lines from
   `chomik: only without a daily build, begin` to `end`, inclusive.
3. Leave the daily build as it is; its job that calls `chomik.yml` stays the
   same. Name `.github/workflows/chomik.yml` as the file to commit.
