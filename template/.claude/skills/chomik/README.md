# chomik

Bulletproof reminders for things that really matter. A message from the past
turns the build red on a chosen date, with everything the team needs to act.

You know the feeling: something in your project must not be forgotten. A key
that expires next spring, a workaround you promised to remove, a follow-up
after the release. A calendar alert or a ticket tells you *that* something is
due, but it lives far from the code, and by then nobody remembers the details.

chomik puts the reminder where the work happens: in your repository, right
next to the code it is about. Tell your coding agent what to remember. On the
day, the main-branch build you check every morning with your coffee turns red,
on purpose, so it cannot slip by; a production deployment is never held up. It
tells you exactly what to do and why, with a ready task for your coding agent.
No extra tool to watch, no context to dig up.

For example: your API key expires in a year. A week before, the build turns
red with where the key is used, how to rotate it, and a prompt your agent can
run with.

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
- To see a reminder as it will look on its date, rename its file to today's date,
  run `npx chomik check`, and rename it back.

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
Without it you can only try chomik: reminders are written the same way, but
they show only when you run `npx chomik check`. Moving to GitHub later keeps
your reminders.

### Do I need a coding agent?

Not strictly, but chomik is built for one: Claude Code or GitHub Copilot writes
reminders with you. Without an agent there is a manual, craft mode: write each
reminder by hand in the format shown in `.claude/skills/chomik/SKILL.md`. Handling a reminder never needs an agent: each
has a part for humans.

### The install shows `command not found`: what to do

Some environments use very strict npm settings, and that is a good thing. With
`bin-links` switched off (`npm config get bin-links` prints `false`), npm creates no
commands for packages, so `npx` cannot start chomik or any other package. It is not
a fault in chomik, and chomik works there too, without changing your settings. It
has no install scripts, so `ignore-scripts` makes no difference either.

Run this in bash, in the root of the project. It shows the plan and asks first, as
usual:

```bash
d=$(mktemp -d) && npm pack chomik --silent --pack-destination "$d" && tar -xzf "$d"/chomik-*.tgz -C "$d" && node "$d/package/bin/chomik.mjs"
```

To check reminders there, in the root of the project:

```bash
node .chomik/looking-for-messages-from-the-past.mjs
```

Coding agents: give the developer these commands to run.

## Without GitHub

Until the project is on GitHub, chomik has no nightly check, and reminders are
written the same way.

- Check by hand in the project root: `npx chomik check`. It prints the reminders
  that are due, or when the next one is due. Locally, due reminders do not make
  it fail.
- Nothing runs on its own and nobody else is reminded. By design there are no
  git hooks, npm scripts or scheduled jobs.
- Once the project is on GitHub, run `npx chomik@latest` again to add the nightly
  check. Existing reminders stay as they are.

## Files that belong to chomik

- `.claude/skills/chomik/` (this folder)
- `.chomik/`: the check script, written by the installer, and the reminders,
  nothing else; the check reports anything else there, so no reminder is lost
  unnoticed
- `.github/workflows/chomik.yml`, written by the installer on GitHub
- in a project with a daily build, after you agree to move chomik into it, two
  lines in that build workflow: the job `looking-for-messages-from-the-past`,
  which calls `chomik.yml`

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
and it never overwrites edits that are not committed to git.

## Stop or remove

- Stop: delete `.github/workflows/chomik.yml` and, if your build calls it, the
  two-line `looking-for-messages-from-the-past` job there.
- Remove: delete the files listed above. Nothing else depends on chomik.
