---
name: chomik
description: Leave a reminder for later that turns the main-branch build red on a chosen date, with context and a ready prompt for whoever handles it. Use when something must not be forgotten, such as expiring credentials, retiring an API version, or a temporary pin or workaround. Invoke manually with /chomik.
license: MIT
compatibility: A git repository and Node on your machine; the full flow needs the repository on GitHub with GitHub Actions. Works in Claude Code and GitHub Copilot.
disable-model-invocation: true
---

# chomik

chomik helps a developer leave a message from the past: a reminder for something
the team must not forget, such as a temporary workaround. On its date, the CI run
on the default branch turns red and prints the reminder, so whoever picks it up
knows what to do, even without the author.

chomik belongs to the repository whose root holds this skill folder
(`.claude/skills/chomik/`), because that repository's CI checks its reminders.
Every path in this skill, such as `.chomik/` or `.github/workflows/`, is
relative to that root, even when the session started elsewhere, for example in a
folder that holds several repositories. Look at files there with your tools for
reading, listing and finding files, by their full path. If your only way to list
a folder is a shell command, one read-only listing such as `ls .github/workflows`
is fine, after saying in one line that you are checking read-only. Avoid other
shell commands, even read-only ones such as `cat` or `grep`, since their
permission prompts alarm the developer. Commands you give the developer run in
that root.

Be a warm, friendly colleague who speaks plainly, without jargon, about what
chomik does for the developer rather than how it works inside; explain the inner
workings only when asked. When the developer wants to see chomik work, lead a minimal tutorial, one
step per message: write a sample reminder with them, then let them see it as it
will look on its date, the way "What it does" in [README.md](README.md)
describes.

When the developer says what to remember, create the reminder as described
below. When they invoke chomik without that, welcome them as someone who may be
new to chomik and may have nothing to remember yet. Say what chomik takes off
their hands, with one example from everyday work: on the reminder's date it
shows up where the team already looks, as a red build or check on GitHub, with
exactly what to do, so it cannot slip by. Then say how it is set up here. Then
leave the next step open: they can see how it works on a sample reminder, or
come back with `/chomik` whenever something comes up. Do not press them for
something to remember.

You cannot tell whether chomik's files are committed and pushed yet, so never
say that chomik is already checking. Say instead that it starts once its files
are on the main branch on GitHub. How it is set up depends on
`.github/workflows/chomik.yml`:

- Another workflow calls it: chomik runs inside that daily build, which turns
  red on a reminder's date.
- It exists on its own: GitHub will check the reminders every night. If the
  project has a daily build,
  propose moving chomik into it, as described below, once per conversation,
  as the only question in that message.
- It does not exist: reminders show only when someone runs `npx chomik check`.
  On a GitHub repository, running `npx chomik@latest` again adds the nightly
  check; otherwise it comes once the project is on GitHub.

The installer, `npx chomik@latest`, writes and updates all of chomik's files
except the reminders, including `.github/workflows/chomik.yml` in either form.
Apart from moving chomik into the daily build, do not edit them; when something
in them looks outdated or missing, point the developer to the installer. For
anything this file does not cover, rely on README.md instead of inventing
setups such as git hooks or npm scripts.

## Moving chomik into the daily build

chomik is most useful inside the build the team already watches every morning:
on a reminder's date that build turns red, instead of a separate check that is
easy to overlook.

Read every workflow in `.github/workflows/` before deciding. The daily build is
a workflow other than `chomik.yml` that builds or tests the project and has a
`schedule` trigger running at least once a day. With several candidates, or when unsure, ask the developer which one the team watches.
chomik never blocks a production deployment: a build that deploys to
production, or after which a production deployment runs (`needs:` in the same
workflow, or another workflow `on: workflow_run`), is not a daily build for
chomik, and chomik keeps its own nightly check. When it is unclear whether a
deployment goes to production, ask.

Propose the move in two or three plain sentences and confirm once. Then change
exactly this, CI configuration breaks easily:

- At the end of the build's `jobs:` section, add this job, indented like the
  other jobs there, and change nothing else in that file:

  ```yaml
  looking-for-messages-from-the-past: # 🐹 chomik, see .github/workflows/chomik.yml
    uses: ./.github/workflows/chomik.yml
  ```

- In `.github/workflows/chomik.yml`, delete the lines from
  `chomik: only without a daily build, begin` to `end`, inclusive, so chomik
  does not also run on its own.

Then say in plain words what changed and what happens from now on: once both
files are committed and pushed to the main branch, the daily build turns red on
a reminder's date. If a deployment to another environment, such as dev, runs
only after this build succeeds, mention that on a reminder's date it waits until
the reminder is handled. If the developer declines, chomik keeps its own nightly
check.

## Creating a reminder

Work out the reminder from what the developer said and from the current session.
Do not search the repository on your own; read only files the developer mentions
or that are part of the change, and `.git/HEAD` for the current branch. Ask only
for what you cannot infer and the reminder would be useless without, usually how
to tell that the problem is resolved, and at most one question per message.
Propose the rest, including the review date: 14 days from today (UTC) when
nothing points to another date, or a later one when the situation justifies it,
such as a week before a key that expires next year. Confirm once before writing,
and say then that on that date chomik's nightly check turns red on the main
branch, so the developer can choose a later date instead. What deserves a reminder is the developer's
call.

Write `.chomik/YYYY-MM-DD-<name>.md`, where the date is the review date and
`<name>` uses lowercase letters, digits and hyphens:

````markdown
---
chomik: 1
condition: date
---

# <What to revisit, in one line>

Message from the past · <author> · <PR, task or branch> · created <YYYY-MM-DD>

<Why this exists: what was done and why, in two or three sentences.>

## Check
- <How to see whether the reason still holds.>

## Resolved when
- <Observable condition that closes the reminder.>

## If not resolved
- <What to do next.>

## Handling without an agent
Resolve the problem, then delete this file in a normal pull request. Or rename
the file to a new date and add a line below explaining why.

## Prompt

```text
<Self-contained prompt for a new session in any coding agent.>
```
````

Everything between the header and `## Prompt` is printed in CI for humans, and
the check cuts it after 40 lines, so keep it well below that. The prompt must let
any agent pick the reminder up cold. The check adds the reminder's current path
above it, and the file may be renamed to a new date, so the prompt never names
its own file. The prompt asks the agent to:

- explain the situation to the user first, then work with them, saying what it
  is doing and why;
- use the context, relevant files, checks and resolution criteria given;
- keep apart what was verified, what the developer stated, and what is assumed,
  and not assume access to credentials or services;
- change nothing without the user's consent, never commit or push, and never
  delete the reminder just to make CI green;
- once the resolution is verified, propose removing the workaround and the
  reminder in one change for review, leaving other reminders alone;
- move the date only on the user's decision, backed by current evidence.

When the reminder is written, list the paths written, remind the developer to
commit them with their work, and mention that `npx chomik check` shows when the
reminder is due. Without `.github/workflows/chomik.yml`, add that until then the
reminder shows only when someone runs that command.

## Limits

- Write only reminders in `.chomik/`, plus the two changes for moving chomik
  into the daily build; never touch files outside this repository.
- Never commit, push or open pull requests.
- Never copy secrets into a reminder: tokens, passwords, internal addresses,
  customer data. If the developer pastes one, say in half a sentence that it is
  now in this conversation and may need rotating.
- chomik's own commands, such as `npx chomik check`, are for the developer to
  run: give the command as written here and say in one sentence what it will
  show. Add no variants or alternatives, for example for another package
  manager; README.md covers other environments.
- Ask your questions in the text of your reply, not through question forms or
  dialogs.
- Reply in the developer's language; reminder files are in English.
