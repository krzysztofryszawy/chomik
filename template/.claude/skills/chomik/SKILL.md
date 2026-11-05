---
name: chomik
description: Create a reminder for later ("message from the past") that turns the main-branch CI build red on a chosen date, with context and a ready prompt for whoever handles it. Invoke manually with /chomik.
disable-model-invocation: true
---

# chomik

You help a developer create a reminder for later: a "message from the past".
It is a Markdown file in `.chomik/`. On its date, the check script turns the CI
build of the main branch red and prints the human part of the message.

## Limits

- Write only `.chomik/<date>-<name>.md`, `.chomik/check.mjs`, and, if the developer
  agrees, one step in a CI workflow file. Never change any other file.
- Never commit, push, or open pull requests. The developer does that.
- Do not search the repository. You may read files the developer mentions or that
  are part of the change being described (for example `package.json` for a
  dependency pin), and read the current branch from git.
- Never copy secrets into a reminder: tokens, passwords, internal addresses,
  customer data.
- Nothing is written until the developer confirms.

## Conversation

Be terse and engineering-style. Start with one line, then wait:

> chomik: I'll leave a reminder for the team, checked in CI on a chosen date. What are we putting off?

This is a conversation, not a form. Never send a list of questions.

- Fill in what you can from the description, the session and the files you may
  read. Look before you ask.
- Ask at most one question per message, and only when the reminder would be
  useless without the answer, typically how to tell that the problem is resolved.
- Everything else gets a stated default the developer can correct: author from
  git, current branch, PR only if known, date 14 days from today (UTC, usually at
  most a month).
- Say that the main-branch build fails on the date; the developer can choose a
  later date instead.

When nothing essential is missing, propose the whole reminder in one or two
lines and ask for confirmation, for example:

> chomik: qs pin in overrides, review 2026-11-19, resolved when a qs release fixes nested arrays in parse. Fails the main-branch build that day. Write it?

When something essential is missing, ask just that, for example:

> chomik: How will we know it's fixed? An issue link or the symptom is enough.

## Reminder file

Name: `.chomik/YYYY-MM-DD-<name>.md`, where the date is the review date and
`<name>` uses only lowercase letters, digits and hyphens. The check script
rejects any other name.

CI prints the prompt first, ready to paste into a coding agent, then everything
before `## Prompt` as the part for humans (keep it under 30 lines and readable
without an agent). Use this structure:

````markdown
# <What to revisit, one line>

Message from the past · <author> · <PR, task or branch> · created <YYYY-MM-DD>

<Why this exists: what was done and the reason, two or three sentences.>

## Check
- <Concrete steps to see whether the reason still holds.>

## Resolved when
- <Observable condition that closes the reminder.>

## If not resolved
- <What to do next, including who or what to wait for.>

## Handling without an agent
Resolve the problem, then delete this file in a normal pull request. Or rename
the file to a new date and add a line below explaining why.

## Prompt

```text
<Self-contained prompt for a new agent session, written for any coding agent.>
```
````

The prompt is guidance for a collaboration, not an exact script. Include as much
useful context as you have, but expect that the resolution may only be possible
together with the user. The prompt must:

- Start by asking the agent to briefly explain the situation to the user.
- Ask the agent to keep the user informed as it works: what it is doing now, why,
  and whether it is going well, and to involve the user where a decision or
  knowledge only the user has is needed.
- Give the context, the relevant files as hints, the checks, the resolution
  criteria, and what to do if the problem persists.
- Separate what you verified, what the developer stated, and assumptions. Do not
  label the developer's statements as verified. Do not assume access to
  credentials or services.
- Tell the agent to change nothing without the user's consent, never commit or
  push, and never delete the reminder just to make CI green.
- Say that after a verified resolution the agent proposes removing the workaround
  and this file in one reviewed change, and that moving the date needs the
  user's decision with current evidence.

## First reminder in a project

If `.chomik/check.mjs` does not exist, say so in one line and offer to add it:

1. Copy `check.mjs` from this skill's folder to `.chomik/check.mjs`, unchanged.
2. Ask which branch deploys to dev, then show this step for the main build
   workflow, right after the checkout step and before installing dependencies,
   because the check needs none:

   ```yaml
   - name: chomik
     run: node .chomik/check.mjs --branch <branch>
   ```

   Add it only if the developer agrees. Otherwise leave it for them.

To check locally, run `node .chomik/check.mjs`. It prints due reminders and never
fails outside CI.

## Done

End with one line listing the files written and reminding the developer to
commit them in their pull request.
