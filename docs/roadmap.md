# Roadmap

Plans for chomik's development. Decisions and their reasons are in
[decisions.md](decisions.md).

## Version 0

- Dependency-free Node check script, copied into the project as `.chomik/check.mjs`.
  Done: bundled with the skill as `template/.claude/skills/chomik/check.mjs`, with tests.
- Skill for creating a reminder, installed at project level in `.claude/skills/`.
  The skill copies the check script with the first reminder in a project.
  First draft: `template/.claude/skills/chomik/SKILL.md`.
- `npx chomik init`: installs the skill after showing the plan and getting
  confirmation.
- Setup phase in the skill: in an unfamiliar repository, read the CI workflows,
  find the build that runs daily on the main branch, propose where the check
  step goes, and confirm with the user.
- Full-flow test in a real repository, with the package downloaded from npm.
- Test in a real Node project from a local folder, before publishing.
- Clean repository start, `LICENSE`, `SECURITY.md`, public repository.
- Publishing through a workflow with trusted publishing and provenance.
- Unpublishing the experimental versions 0.0.1 and 0.0.2.

## Chomik CLI

A deterministic command-line tool that both people and agents use, so the
format is enforced by code rather than by instructions to a model. Planned
commands, added once the reminder format is stable:

- `chomik add`: creates a correctly named reminder file. The manual path for
  people who do not use an agent, and the safe path for agents that create
  reminders for themselves.
- `chomik extend`: moves a reminder's date and requires a reason.
- `chomik list`: overview of all reminders in the project, the basis for audit mode.
- `chomik check`: the same check as the copied script, for local use.

Every command follows the same rules as the rest of chomik: no dependencies,
no network, only chomik's own files, plan shown and confirmed before writing.
An MCP server can later be built on top of this CLI.

## Later

- Deterministic conditions besides dates: a dependency version in the lockfile,
  presence or absence of a file or text in the repository.
- Personal skill installation, Claude Code plugin marketplace.
- Stacks other than Node, CI systems other than GitHub Actions.
- A decision model such as `rkinas/basal`, then a full LLM query in CI.
