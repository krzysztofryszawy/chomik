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
on the main branch turns red and prints the reminder, so whoever picks it up
knows what to do, even without the author. Be a friendly, brief colleague.

chomik works in stages, and the developer starts each one:

1. **Setup**, connecting chomik to CI: follow [setup.md](setup.md) when
   `.github/workflows/chomik.yml` does not exist and `.chomik/` has no reminders
   yet, or when the developer asks for CI. On first contact, setup ends with
   chomik ready, nothing more.
2. **Creating a reminder**, below, when the developer brings something to
   remember, in the same message or in a later session.
3. **Handling a reminder**, on its date, by whoever picks it up, from the prompt
   inside it; this skill is not involved.

The installer keeps the check script in `.chomik/` up to date. The CI workflow
`.github/workflows/chomik.yml` names its chomik version in the first comment; if
it is older than `chomik-workflow.yml` in this folder, chomik was updated: first
propose replacing it as in step 3 of setup.md, and wait for a yes.

Without `.github/workflows/chomik.yml`, reminders show only when someone runs
`npx chomik check`: a stopgap for trying chomik, not how it is meant to work. So
after writing a reminder there, say so in one sentence and that `/chomik` can set
up CI. For anything this file does not cover, rely on [README.md](README.md)
instead of inventing setups such as git hooks or npm scripts.

## Creating a reminder

Work out the reminder from what the developer said and from the current session;
read files directly involved in the change if needed. Ask only for what you
cannot infer and the reminder would be useless without, usually how to tell that
the problem is resolved. Propose the rest (review date: 14 days from today, UTC)
and confirm once before writing. What deserves a reminder is the developer's
call.

Write `.chomik/YYYY-MM-DD-<name>.md` in English, where the date is the review
date and `<name>` uses lowercase letters, digits and hyphens:

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

Everything between the header and `## Prompt` is printed in CI for humans, so
keep it short. The prompt must let any agent pick the reminder up cold. It asks
the agent to:

- explain the situation to the user first, then work with them, saying what it
  is doing and why;
- use the context, relevant files, checks and resolution criteria given;
- keep apart what was verified, what the developer stated, and what is assumed,
  and not assume access to credentials or services;
- change nothing without the user's consent, never commit or push, never delete
  the reminder just to make CI green, and leave moving the date to the user.

## Limits

- Write only in `.chomik/`, plus the CI changes described in setup.md, and only
  after the developer confirms.
- Never commit, push or open pull requests.
- Never copy secrets into a reminder: tokens, passwords, internal addresses,
  customer data.
- Look at files with file-reading tools rather than shell commands.
- Reply in the developer's language; reminder files are in English.

## Done

List the paths written or changed, remind the developer to commit them with
their work, and mention that `npx chomik check` shows when the reminder is due.
