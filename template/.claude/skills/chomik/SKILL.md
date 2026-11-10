---
name: chomik
description: Leave a reminder for later that turns the main-branch build red on a chosen date, with context and a ready prompt for whoever handles it. Use when something must not be forgotten, such as expiring credentials, retiring an API version, or a temporary pin or workaround. Invoke manually with /chomik.
license: MIT
compatibility: A Node project; the full flow needs a GitHub repository with GitHub Actions. Works in Claude Code and GitHub Copilot.
disable-model-invocation: true
---

# chomik

chomik helps a developer leave a message from the past: a reminder for something
the team must not forget, such as a temporary workaround. On its date, the CI run
on the default branch turns red and prints the reminder, so whoever picks it up
knows what to do, even without the author.

chomik belongs to the repository whose root holds this skill folder
(`.claude/skills/chomik/`), because that repository's CI checks its reminders.
Every path in this skill and in setup.md, such as `.chomik/` or
`.github/workflows/`, is relative to that root, even when the session started
elsewhere, for example in a folder that holds several repositories. Look at
files there with your tools for reading, listing and finding files, by their full
path; do not use shell commands such as `cd`, `cat` or `grep` for this, even
read-only ones, since their permission prompts alarm the developer. Commands you
give the developer run in that root.

Be a friendly, brief colleague. To a developer new to chomik, say in one sentence
what it gives them; explain how it works inside only when asked. When the developer
wants to see chomik work, lead a minimal tutorial, one step per message: write a
sample reminder with them, then let them see it as it will look on its date, the
way "What it does" in [README.md](README.md) describes.

chomik works in stages, and the developer starts each one:

1. **Setup**, connecting chomik to CI: follow [setup.md](setup.md) when
   `.github/workflows/chomik.yml` does not exist and `.chomik/` has no reminders
   yet, unless the developer already declined CI in this conversation, and
   whenever the developer asks for CI.
2. **Creating a reminder**, below, when the developer says what to remember. If
   they said it before setup, continue with it once setup is finished.
3. **Handling a reminder**, on its date, by whoever picks it up, from the prompt
   inside it; this skill is not involved.

The installer keeps the check script in `.chomik/` up to date. The CI workflow
`.github/workflows/chomik.yml` names its chomik version in the first comment; if
it is older than `chomik-workflow.yml` in this folder, chomik was updated: first
propose updating it as in "Updating chomik.yml" in setup.md, and wait for a yes.

Without `.github/workflows/chomik.yml`, chomik runs in a temporary mode with
limited features: reminders show only when someone runs `npx chomik check`. After
writing a reminder in that mode, say so in one sentence and that `/chomik` can
set up CI. For anything this file does not cover, rely on README.md instead of
inventing setups such as git hooks or npm scripts.

## Creating a reminder

Work out the reminder from what the developer said and from the current session;
read files directly involved in the change if needed, and `.git/HEAD` for the
current branch. Ask only for what you cannot infer and the reminder would be
useless without, usually how to tell that the problem is resolved. Propose the
rest, including the review date: the one the situation calls for, such as a week
before a key expires, or 14 days from today (UTC) when nothing points to a date.
Confirm once before writing. What deserves a reminder is the developer's call.

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
- change nothing without the user's consent, never commit or push, never delete
  the reminder just to make CI green, and treat moving the date as the user's
  decision.

When the reminder is written, list the paths written, remind the developer to
commit them with their work, and mention that `npx chomik check` shows when the
reminder is due.

## Limits

- Write only reminders in `.chomik/` and the CI changes described in setup.md.
- Never commit, push or open pull requests.
- Never copy secrets into a reminder: tokens, passwords, internal addresses,
  customer data. If the developer pastes one, say in half a sentence that it is
  now in this conversation and may need rotating.
- chomik's own commands, such as `npx chomik check`, are for the developer to
  run: give the command as written here and say in one sentence what it will
  show. Add no variants or alternatives, for example for another package
  manager; README.md covers other environments.
- Reply in the developer's language; reminder files are in English.
