# chomik-for-robots: directions for multi-agent sessions

`chomik-for-robots` is a working name; whether this split is right is still to be
decided. Written on 2026-11-08 from analysis of chomik 0.1.7, the basal project
page and jevai.net, and checked against chomik 0.1.9 where noted.

Every claim about benefits below is a hypothesis. Costs and quality were not
measured on real session logs.

## Summary

Chomik can grow into a general primitive: a deferred intention with a trigger, an
evaluator, a payload that allows a cold start, and an addressee with clearly
defined permissions. A date is only the first possible trigger. For multi-agent
sessions the value lies in three things agents lack today: memory over time,
cheap and fast decisions, and controlled autonomy with oversight on demand.

## Why it is separate from chomik

The two products have opposite principles. `chomik` is for people: deterministic,
no automation, a person confirms each step, and trust is its strength.
`chomik-for-robots` is for agents, with no limits on what they can do and no cost
of collaborating with a person, and agents use it for different purposes than
reminders for people.

Proposed separation, not decided:

- A separate npm package (the name `chomik-for-robots` was free on 2026-11-08),
  so a person using `chomik` can verify that no evaluation code is present rather
  than trust a switch.
- Its own skill and command, installed only by that package, and its own CI job
  if it needs one.
- Dependency in one direction: it may build on `chomik`; `chomik` does not know
  about it. A third "core" package is avoided, because `chomik` would then have a
  dependency.
- What is shared is still open: most likely the format specification and the
  rules for reading it, not code.
- Where its records live is open and depends on its purposes. `chomik` reports
  anything unknown in `.chomik/` as a red build, so records there would break
  projects using `chomik` alone.

Prior art found: `--no-ai` flag (ship-safe), optional extras in one package
(Schliff: "the core engine never requires a network call"), a separate optional
layer (Jido and `jido_ai`). The search was short.

## Current state of chomik

Read from the 0.1.7 package; still true in 0.1.9 unless noted.

- A reminder is a Markdown file `.chomik/YYYY-MM-DD-name.md` with the header
  `chomik: 1` and `condition: date`. It holds a description, the sections Check,
  Resolved when, If not resolved and Handling without an agent, and a Prompt for
  any coding agent.
- The check script runs in CI. From a reminder's date it prints the prompt and
  the part for humans. On the branch given with `--branch` the build ends with
  exit code 1, and with 2 for invalid or unreadable files. Elsewhere it only
  prints.
- The parser rejects unknown values of `chomik` and `condition` as a reminder
  needing a newer version, instead of skipping it.
- Safety per the README: no dependencies, install scripts or network; the script
  reads only `.md` files, never executes their content, and switches off GitHub
  workflow commands while printing. The workflow is read-only and its action is
  pinned to a commit SHA.
- The skill has `disable-model-invocation: true`. The agent does not commit,
  push, delete a reminder to turn the build green, or move a date without
  consent, and writes only in `.chomik/` after confirmation.
- Print limits: 40 lines for the part for humans, 200 for the prompt.

Changed since 0.1.7: the installer writes the check script to `.chomik/`; every
other file or folder in `.chomik/` is reported; the header is required; the
check adds the reminder's current path to the prompt.

## Mental model

Four parts that can be replaced independently: trigger (when), evaluator (is the
condition met and what follows), payload (what context the executor gets), and
addressee with permissions (who may do what). Today the trigger is a date, the
evaluator a date comparison, the payload a prompt plus a description for people,
and the addressee whoever picks the reminder up first.

## Problems in multi-agent sessions

- Continuity: an agent does not remember the previous session and cannot wake
  itself, so deferred matters are lost or fall to a person.
- Cost and speed: much of the LLM use in orchestration goes to simple decisions
  (is it done, who takes it, should it escalate).
- Human attention: agents produce changes faster than people can review them, so
  temporary workarounds multiply faster than before.

## Directions to explore

- Self-evaluating records. Check and Resolved when are nearly a machine-readable
  specification of a condition. An evaluator could check them itself, then close,
  defer or escalate.
- A register of assumptions with expiry. An agent records an assumption with the
  condition that invalidates it; the trigger is the invalidation, not time.
- Leases instead of locks. A parallel agent takes a task for a set time, and the
  expiry of the lease wakes another executor. Coordination happens in the
  repository, without a server.
- Event triggers from another agent, such as "when agent B marks the task ready"
  or "when the PR is merged". The directory then works as a versioned coordination
  board with a full audit trail in git.
- Routing instead of an alarm: deciding whether to wake a person, an agent or
  nobody, based on priority and the cost of delay.
- A retrospective loop. An agent leaves a record for its own review ("check in a
  week whether this decision held up"), which yields calibration data.
- The prompt format as a contract for passing context between subagents:
  separating what is verified, what the author stated and what is assumed, plus
  resolution criteria.
- Conditions other than dates, as the general mechanism the others rest on.

## Evaluator levels

**Deterministic code.** Cheap, predictable, no dependencies. Handles only
conditions expressible as rules, such as dates and thresholds. These should stay
in code whatever model is chosen.

**Small decision model (Jev, basal).** "System 1" models take state as JSON and a
typed question, and in one pass return a probability for each allowed option, with
no text generation. They fit routing, "is it resolved?" and urgency.

- basal: open engine (Apache-2.0), Polish and English, endpoints including
  `/v1/systemone`. Question types include `choice`, `noul` (probability of yes)
  and `score`; `multi`, `act` and `tool` also exist, partly experimental. Models
  range from 0.8B to 31B. It runs on NVIDIA GPUs, Apple Silicon or CPU, depending
  on the setup. Its README names Jev as an inspiration.
- basal's known limits per its README: small models have limited world knowledge
  and do not know rules introduced after training, so facts must be supplied;
  exact arithmetic and thresholds belong in code; decisions with serious
  consequences for people should be reviewed by a person; at a 1% error target
  few decisions are automated with the shipped calibration.
- Jev: hosted API, version 1.14, early access, 0.084 USD per million input tokens
  according to jevai.net. The page does not mention basal.

All figures come from the authors and were not independently verified.

**Full LLM.** Understands context and can perform Check itself: read code, see
whether a workaround still exists, propose closing. Chomik then becomes scheduled
agent memory with autonomous closing. The costs: higher prices, non-determinism,
a larger prompt-injection surface and a need for approval gates.

**Cascade.** The most promising option economically: a cheap level filters the
obvious cases and a full LLM gets only the ambiguous ones, so reasoning is paid
for only where a comparison is not enough.

## Autonomy as a dial

The same record is read by a person and an agent; only what may be done without
asking differs. The current format already supports this: a part for humans and a
prompt in one file, and a decision trail in git (a date change with its reason).

- Permission policy instead of fixed bans. Example levels: analyze only, propose
  a change, act within what is reversible, act fully. A record could carry its own
  permissions.
- Oversight on demand: pause and an emergency stop, a preview of intended actions,
  a full audit. With autonomy, trust depends on how easy it is to step in and take
  over.
- Trust between agents. When an agent acts on a message written by another agent,
  it needs provenance (who wrote it and whether it was changed), or that message
  becomes a path for prompt injection.

## Tensions and risks

- "No dependencies and no network" cannot coexist with calling a model, so the
  evaluator must stay out of `chomik` itself.
- The skill today forbids model invocation, commits and deletions. Autonomy in
  multi-agent sessions needs a deliberate change of those rules, in the separate
  product.
- Hosting: running a model needs suitable hardware, and Jev means cost and handing
  record contents to an outside service.
- A closed set of answers from a small model limits the effect of prompt injection,
  but that is an inference from the design, not a confirmed property. Record text
  stays untrusted input at every level.

## Open decisions

- The product's stance: the source analysis describes a tool used by people that
  can work without a person in multi-agent sessions, with oversight always
  available; the owner's direction is a version built for agents, without
  collaboration overhead. To reconcile.
- Whether to split at all, and how: see "Why it is separate from chomik".
- Who grants permissions: the record's author, a repository policy, or both, with
  the stricter value binding.
- First experiment: routing ("who and what next?") or an evaluator ("is it
  resolved?"). Routing does not change what a red build means.
- Validation on real session logs: what share of decisions is simple enough for a
  small model.
- The header shape for new conditions, and compatibility with `chomik: 1`.
- How to keep "no dependencies and no network" for `chomik` itself.

## Sources and what was checked

Read for the original analysis: README, skill, check script and workflow from the
chomik 0.1.7 package; the basal README; the jevai.net home page.

Checked on 2026-11-08: chomik's code at 0.1.9; basal's license, question types,
endpoints, models, hardware and limits; Jev's version, status and price; the
chomik repository has no issues.

Not confirmed on that check, so not stated above: basal's figures of 9 to 45 ms
per decision and 58.6% auto-acceptance at 1.2% errors; Jev's endpoint
(`/v1/decide` in the original analysis) and whether jevai.net is an independent
community site. Not read: basal's technical report and Jev's full API
documentation.
