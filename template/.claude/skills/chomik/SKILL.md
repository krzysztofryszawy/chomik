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
- Do not search the repository on your own initiative. Use the context already in
  this session and what the developer tells you.
- Never copy secrets into a reminder: tokens, passwords, internal addresses,
  customer data.
- Nothing is written until the developer confirms.

## Conversation

Be terse and engineering-style. Start with one line, then wait:

> chomik: I'll leave a reminder for the team, checked in CI on a chosen date. What are we putting off?

From the developer's description and the session context, work out the reminder.
Ask only about what is missing. Propose, do not decide:

- Date: 14 days from today (UTC) unless the developer says otherwise. Usually at
  most a month.
- Blocking: the main-branch build fails on the date. Say so; the developer can
  choose a later date instead.

Then confirm in one line, for example:

> chomik: 2026-11-19, fails the main-branch build. Write it?

## Reminder file

Name: `.chomik/YYYY-MM-DD-<name>.md`, where the date is the review date and
`<name>` uses only lowercase letters, digits and hyphens. The check script
rejects any other name.

Everything before the `## Prompt` heading is printed in CI; keep it under 30
lines and readable without an agent. Use this structure:

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

The prompt must:

- Start by asking the agent to briefly explain the situation to the user.
- Give the context, the relevant files as hints, the checks, the resolution
  criteria, and what to do if the problem persists.
- Separate verified facts from assumptions, and not assume access to credentials
  or services.
- Tell the agent to change nothing without the user's consent, never commit or
  push, and never delete the reminder just to make CI green.
- Say that after a verified resolution the agent proposes removing the workaround
  and this file in one reviewed change, and that moving the date needs the
  user's decision with current evidence.

## First reminder in a project

If `.chomik/check.mjs` does not exist, say so in one line and offer to add it:

1. Copy `check.mjs` from this skill's folder to `.chomik/check.mjs`, unchanged.
2. Ask which branch deploys to dev, then show this step for the main build
   workflow, after the checkout step and next to the tests:

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
