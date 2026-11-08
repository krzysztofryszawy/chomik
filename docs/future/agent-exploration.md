# Agent exploration: goal and method

An experiment for the direction in [chomik-for-robots.md](chomik-for-robots.md).
Written on 2026-11-08 from chomik 0.1.7, with notes on 0.1.9. It describes the goal
and the method; the results are not known yet. It needs no change to chomik: all
changes happen in a copy, in a throwaway repository.

## Summary

Goal: to find out whether agents discover new uses of chomik on their own, such as
planning work beyond one session, instead of only carrying out scenarios from the
documentation. The starting condition: the agent gets chomik described as a
capability (a primitive), not a list of recipes.

Method: a controlled experiment in a throwaway repository, with a goal longer than
one session, a modified skill, an experiment log in the repository and simulated
passing of time. It is repeated several times, because one run is too random. No
special infrastructure is needed, only a few short sessions.

## Context and vision

Chomik was created for developers, and was meant from the start to be useful to
coding agents too. Its potential is now being explored as a tool agents use for
their own needs in multi-agent sessions. A date is only the first trigger. The
evaluator is meant to be replaceable: deterministic code, a small decision model
(Jev, basal) or a full LLM.

## Research questions

The document does not assume the outcome. The experiment is to answer:

- Will an agent told about chomik as a capability, with no concrete examples of
  use, come up with useful applications itself, such as a multi-session plan with
  triggers?
- Does a cold continuation work: does a new session with no context, only the
  repository and chomik's output, finish the work correctly?
- What went wrong: misuse, reminder spam, loops, entrenched errors, token cost?
- Which uses appeared that the author did not foresee?

## What an agent needs to explore on its own

- A description of the primitive with guarantees and limits (what arrives, when, to
  whom, what is not allowed), instead of a list of scenarios.
- A safe sandbox where the agent can experiment without consequences.
- A goal and a budget for exploration: a fixed step near the end of a task, with a
  limit, where the agent asks what it will not finish now and what may expire.
- An experiment log in the repository (hypothesis, what happened to the reminder).
  Agents do not remember earlier sessions by default, so the log is their memory.
- Curation: discovered patterns reach a shared library only after review.

The current version does not support this. The skill has
`disable-model-invocation: true`, and its rules forbid the agent, among other
things, to commit, delete or move dates without the user's consent. The check
script uses the real date and has no way to override the clock.

## Method

1. Prepare a throwaway repository with a goal longer than one session. It can be a
   small real project on a separate branch, such as a multi-stage migration where
   some steps depend on dates or external conditions.
2. Install chomik in the copy and modify the skill: remove
   `disable-model-invocation: true`, describe chomik as a capability ("you can send
   a message to a future session with a trigger"), allow writes in `.chomik/`
   without asking (safe only in the sandbox), and add limits: a maximum number of
   reminders, a maximum horizon and a ban on self-renewal.
3. Start a log in the repository (for example `lab/NOTES.md`) where the agent
   records what it did and why.
4. Run the first session with a prompt containing the goal and permission to leave
   messages for future sessions. Do not suggest concrete uses, because discovering
   them is the point of the experiment.
5. Simulate the passing of time. Instead of waiting days, change the dates in the
   reminder file names to today and open a new session with no context, with only
   the repository and the output of `npx chomik check`.
6. Repeat 3 to 5 times with different goals, and if needed with different models.
   Each run starts from a clean repository.
7. Assess the results against the criteria below.

Notes on 0.1.9: the installer puts the check script in `.chomik/`, and the check
adds a reminder's current path to its prompt, so renaming files to simulate time
no longer leaves a stale path in new reminders. The limits in step 2 are only text
in the skill and nothing enforces them, so whether they are kept is itself a result
to measure.

## Assessment criteria

- Whether the cold continuation brought the work to an end without manual help.
- Which unforeseen uses of chomik appeared, and whether they were useful.
- The number of reminders and the depth of chains (a reminder creating others).
- The quality of prompts in reminders: whether they separate what is verified,
  stated and assumed.
- Token cost per run.
- Misuse and errors: spam, loops, entrenched wrong assumptions.

## Risks and limits

- A reminder written by an agent is a prompt for a future agent, so an error or
  injected content persists across sessions.
- Self-renewing reminders can create endless loops and costs. Limits are needed: a
  maximum horizon, chain depth and a register visible to a person.
- One run is too random, and results apply to a specific model and goal, so they
  should not be generalized without repetition.
- Writing without asking is acceptable only in a throwaway repository, never in a
  real project.
- Whether agents come up with useful new uses is an empirical question. If the
  experiment does not show it, the more sensible path is a channel where agents
  report observations ("X would be useful here") and a person curates patterns.

## Open questions

- The environment to run in (Claude Code or another).
- The choice of goal for the throwaway repository.
- The number of repetitions and models.
- The format of the experiment log.
- Who curates discovered patterns, and by what criteria.
