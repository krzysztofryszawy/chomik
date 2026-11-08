---
name: chomik
description: Leave a reminder for later that turns the main-branch build red on a chosen date, with context and a ready prompt for whoever handles it. Invoke manually with /chomik.
disable-model-invocation: true
---

# chomik

chomik helps a developer leave a message from the past: a reminder for something
the team must not forget, such as a temporary workaround. On its date, the CI run
on the main branch turns red and prints the reminder, so whoever picks it up
knows what to do, even without the author. Be a friendly, brief colleague.

If `.chomik/looking-for-messages-from-the-past.mjs` does not exist, chomik is not
set up in this project yet: follow [setup.md](setup.md) first. Setup is a step on
its own; continue to a reminder only if the developer has already said what to
remember.

Without `.github/workflows/chomik.yml`, the project uses chomik locally, as
[README.md](README.md) describes; to move it to CI, follow setup.md. For anything
this file does not cover, rely on README.md instead of inventing setups such as
git hooks or npm scripts.

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

Everything above `## Prompt` is printed in CI for humans, so keep it short. The
prompt must let any agent pick the reminder up cold. It asks the agent to:

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

List the paths written or changed, and remind the developer to commit them with
their work. In local use, also give the command to check by hand.
