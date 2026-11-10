# Message From the Past

Status: working agreement, recorded on 2026-11-05 with Krzysiek.
This document defines a generic convention, not a dependency-specific solution.
It does not itself implement or enforce pipeline behavior. Chomik is the project
that implements it.

## Purpose

Leave an actionable message for a future teammate when introducing a TODO,
temporary workaround, exception, or follow-up that should not be forgotten.
The recipient must not need the author's previous conversations to act on it.

## Phases

- **Creating a reminder** (tworzenie przypomnienia): the author records the
  reminder at the moment the problem appears.
- **Handling a reminder** (obsługa przypomnienia): after the deadline, whoever
  meets the failed build resolves the problem or extends the deadline.

## Guiding Principle

Chomik must never get in the way of resolving the problem by hand. The agent is
optional, unexpected extra help, not automation. A person who does not want to
use an agent must be able to handle a reminder from the failure message and the
reminder file alone.

## Core Concept

- Agent at the beginning and end: a skill helps create the message and future
  prompt; the recipient's agent later explains it, helps resolve it, and cleans up.
- The skill is a concise, flexible consultant that understands the goal, not a
  rigid form. It uses project knowledge and asks only what is missing.
- Between these stages, deadline detection is deterministic. No AI is needed to
  wait, evaluate dates, or display the message. AI-based triggers are future scope.
- The message format is the stable core. Skills, a CLI, an MCP server, or a
  GitHub Action are interchangeable ways to create and read messages.

## Creation Experience

- The developer creates a message at the moment the problem appears, in the
  agent session that already holds the context.
- The skill runs only when the developer invokes it. No hooks, background
  detection, or automatic actions.
- After invocation the agent introduces itself in one line, says what it can do,
  and waits for the developer to describe the need in their own words.
- The agent does not search the repository on its own initiative. It uses the
  session context to understand the description and asks only about what is
  missing. It suggests; the developer decides.
- Communication is terse and engineering-style. Nothing is written to the
  repository until the developer confirms.

## Shared Delivery

- Target: dozens of GitHub repositories, independent of their technology stacks.
- Direction: a shared, version-pinned Action or reusable workflow, local messages,
  and minimal wiring. Unit tests are a prototype, not the generic mechanism.
- The check runs as its own always-run step or job inside the main build
  workflow, next to tests but separate from them. Only a project without a daily
  build gets chomik's own nightly workflow.
- Deadline checks must be lightweight: no application builds, dependency installs,
  or AI calls. Distinguish invalid configuration and checker errors from due messages.
- Evaluate blocking rules inside preproduction pipelines. A separate red workflow
  does not automatically block deployments; a job in the same workflow can, when
  the deployment job depends on it.
- The daily build, which also checks dependencies and base images, covers
  inactive repositories. It is not an exact-time delivery guarantee. In public
  GitHub repositories, scheduled workflows are disabled after 60 days without
  activity, which would also stop that daily build.
- Audit mode reviews relevance, stale references, resolved conditions, actual
  execution, and environment scope. Periodic audits need a separate scheduler.

## Agreed Rules

- A message blocks preproduction builds by default. The agent states this when
  creating the message, and the author can opt out.
- For now, the convention is limited to preproduction environments such as
  dev. Production pipelines and deployments must not be blocked by it.
  Check downstream dependencies as well as the immediate job before enabling it.
- Define an explicit trigger, such as a UTC review deadline, and any condition
  that makes the message relevant. A trigger requests review; it does not prove
  that the original problem has been resolved.
- Verify when and where the trigger will actually be evaluated. A date alone
  does not schedule an execution. Check real pipeline runs, not only configuration.
- Keep the human-facing introduction minimal: "Message from the past", author,
  originating PR or task, a short reason, and instructions for using the prompt.
- Keep the convention tool-independent: the same prompt must work in GitHub Copilot
  and Claude Code, without editor-specific commands or required integrations.
- Include a clearly delimited, self-contained prompt for a new agent session.
  The agent should first briefly explain the situation to the recipient.
- The prompt includes context, relevant files, required checks, resolution criteria,
  and what to do if the original problem persists. Separate verified facts from
  assumptions and do not assume future access to credentials or services.
- Do not remove or disable a reminder merely to make CI green. Extending its
  deadline requires an explicit human decision supported by current evidence.
- After resolution and successful verification, the agent removes the resolved
  message and support needed only by that message. Preserve other messages and
  shared infrastructure. Extending a deadline is not resolution.
- Tests must not delete files or modify the repository automatically. Cleanup is
  a reviewed code change. Commit and push require user authorization.
- Task-specific support is not part of the generic convention. For example,
  making a manifest available to a container may be needed by one reminder only.

## Failure Message

```
chomik sent a message from the past: .chomik/2026-11-19-qs.md
Paste the prompt below into a coding agent session in this repository.
To read yourself what needs to be done, see FOR HUMANS below the prompt.

===== PROMPT =====
<prompt>
===== END OF PROMPT =====

===== FOR HUMANS =====
<human part of the reminder>
===== END =====

Run locally: npx chomik check
```

With several due at once, the log first says how many, lists them by title,
and numbers each section ("1 of 3: title"); each is a separate task.

The prompt is the main part and comes first, ready to paste into any coding
agent. The first line tells the team at the daily meeting what happened. The
human part below is enough to handle the reminder without an agent.

## Still To Decide
- How multiple messages are organized. The format version and condition type
  are in each reminder's YAML header (`chomik: 1`, `condition: date`).
- Supported nonblocking notification modes and their delivery mechanisms.
- How authors declare and validate environment scope and blocking behavior.

## Future Conditions

Dates come first. Later condition types, in order of increasing cost:

1. Deterministic checks without AI, such as a dependency reaching a version or
   an upstream issue being closed.
2. A small typed-decision model such as `rkinas/basal`: yes/no, choice, or score
   answers with calibrated confidence, deferring to a person when unsure.
3. A full LLM query in CI.

Conditions 2 and 3 conflict with the lightweight-check rule and need network
access to their inputs, so they need a separate decision before adoption.

## Current Example

The qs review reminder in `tests/integration/message-from-the-past.spec.ts`, in
the project where this idea originated (not this repository), demonstrates the
idea. Its dependency details, deadline, and Docker support are specific to that
task and must not become defaults for future messages.
