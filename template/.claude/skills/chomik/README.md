# chomik

Bulletproof reminders for things that really matter. A message from the past
turns the build red on a chosen date, with everything the team needs to act.

## What it does

- A reminder is a Markdown file `.chomik/YYYY-MM-DD-name.md`: a part for humans
  and a ready prompt for any coding agent.
- `.chomik/looking-for-messages-from-the-past.mjs` runs in CI through
  `.github/workflows/chomik.yml`. From a reminder's date it prints the prompt and
  the part for humans, and the run on the main branch turns red. Locally and in
  pull requests it only prints.
- To create a reminder, type `/chomik` in Claude Code or GitHub Copilot.
- To handle a reminder, resolve the problem and delete its file, or rename the
  file to a new date and add a line explaining why. No agent is required.

## Use it locally

The full flow needs GitHub Actions. To try chomik without it, the project needs
only `.chomik/looking-for-messages-from-the-past.mjs`; ask `/chomik` to set it up
locally. Reminders are written the same way.

- Check by hand in the project root:
  `node .chomik/looking-for-messages-from-the-past.mjs`. It prints the reminders
  that are due, or when the next one is due, and never fails locally.
- Nothing runs on its own and nobody else is reminded. By design there are no
  git hooks, npm scripts or scheduled jobs.
- To move to the full flow, type `/chomik` and ask to set up CI. Existing
  reminders stay as they are.

## Files that belong to chomik

- `.claude/skills/chomik/` (this folder)
- `.chomik/`: the check script and the reminders
- `.github/workflows/chomik.yml` (not in local use)
- in a project with a daily build, two lines in that build workflow: the job
  `looking-for-messages-from-the-past`, which calls `chomik.yml`

## Is it safe?

- No dependencies, no install scripts, no network access, no build step.
- The check script only reads `.chomik/*.md`. It never executes their content and
  switches off GitHub workflow commands while printing it.
- `chomik.yml` has read-only permissions and pins its action to a commit SHA.
- Source: https://github.com/krzysztofryszawy/chomik. Releases are published with
  npm provenance (`npm audit signatures`).

## Help

`npx chomik@latest --help`

## Update

Run `npx chomik@latest` in the project root. It shows the plan and asks first,
and it never overwrites edits that are not committed to git.

## Stop or remove

- Stop: delete the two-line `looking-for-messages-from-the-past` job from the
  build workflow, or `.github/workflows/chomik.yml` if there is no build.
- Remove: delete the files listed above. Nothing else depends on chomik.
