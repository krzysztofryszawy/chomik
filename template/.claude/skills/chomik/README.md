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

## FAQ

### What would I use it for?

For dates you cannot afford to miss. Three typical cases:

- **Credentials that expire.** A new integration uses an API key or certificate
  valid for a year. A week before it expires, the build turns red. If someone
  has already rotated it, the agent confirms that, proposes a reminder for the
  next expiry and deletes the old one, with no code change.
- **Retiring your own API version.** You told clients that v1 stops on 1 March.
  Two weeks before, the reminder's prompt guides the agent: find out who still
  calls v1, help warn them, and on the day remove the old endpoints. The same
  works when a provider retires an API you depend on.
- **A temporary security workaround.** During an incident someone pins a package
  or switches off a check "for now". The reminder makes sure "for now" ends, and
  its prompt says what to verify before undoing it.

### Do I need GitHub?

For the full flow, yes: GitHub Actions checks every day and turns the build red.
Without it, chomik works locally: reminders are written the same way and
`npx chomik check` shows the ones that are due. Moving to GitHub later keeps
your reminders.

### Do I need a coding agent?

To set chomik up and write reminders, yes: Claude Code or GitHub Copilot.
Handling a reminder does not need one: each has a part for humans.

## Use it locally

The full flow needs GitHub Actions. To try chomik without it, the project needs
only `.chomik/looking-for-messages-from-the-past.mjs`; ask `/chomik` to set it up
locally. Reminders are written the same way.

- Check by hand in the project root: `npx chomik check`. It prints the reminders
  that are due, or when the next one is due. Locally, due reminders do not make
  it fail.
- Nothing runs on its own and nobody else is reminded. By design there are no
  git hooks, npm scripts or scheduled jobs.
- To move to the full flow, type `/chomik` and ask to set up CI. Existing
  reminders stay as they are.

## Files that belong to chomik

- `.claude/skills/chomik/` (this folder)
- `.chomik/`: the check script and the reminders, nothing else; the check
  reports anything else there, so no reminder is lost unnoticed
- `.github/workflows/chomik.yml` (not in local use)
- in a project with a daily build, two lines in that build workflow: the job
  `looking-for-messages-from-the-past`, which calls `chomik.yml`

## Is it safe?

- No dependencies, no install scripts, no network access, no build step.
- The check script only reads `.chomik/*.md`. It never executes their content and
  switches off GitHub workflow commands while printing it.
- `chomik.yml` has read-only permissions and pins its action to a commit SHA.
- Source: https://github.com/krzysztofryszawy/chomik. Releases are published with
  npm provenance. To verify a release yourself, in an empty folder (not your
  project): `npm install chomik && npm audit signatures`. It should say: 1
  package has a verified attestation.

## Help

`npx chomik@latest --help`

## Update

Run `npx chomik@latest` in the project root. It shows the plan and asks first,
and it never overwrites edits that are not committed to git. What changed:
[CHANGELOG.md](CHANGELOG.md).

## Stop or remove

- Stop: delete the two-line `looking-for-messages-from-the-past` job from the
  build workflow, or `.github/workflows/chomik.yml` if there is no build.
- Remove: delete the files listed above. Nothing else depends on chomik.
