# Roadmap

Plans for chomik's development. Decisions and their reasons are in
[decisions.md](decisions.md).

## Version 0

Status on 2026-11-07: released up to 0.1.4; `main` holds 0.1.5 in progress.

Done:

- Dependency-free Node check script, installed with the skill and copied by it
  into the project as `.chomik/looking-for-messages-from-the-past.mjs`, with tests.
- Skill for creating a reminder (`SKILL.md`), installed at project level in
  `.claude/skills/chomik/`, with a separate `setup.md` for first use.
- `npx chomik`: installs or updates the skill after showing the plan and getting
  confirmation; all or nothing, never overwrites uncommitted edits unless
  `--force`; `--dry-run` shows the plan only.
- `.github/workflows/chomik.yml` template: called by the daily build with two
  lines, or runs nightly on its own in a project without one.
- Clean repository start, `LICENSE`, `SECURITY.md`, public repository.
- Publishing through a workflow with trusted publishing, staged publishing and
  provenance.
- Experimental versions 0.0.1 and 0.0.2 unpublished from npm.
- Tested: install from npm, the skill in Claude Code and GitHub Copilot, writing
  a reminder, the check script locally.

Next: full end-to-end proof of concept on real GitHub. A small test repository
with a Node app and a nightly build: run setup, set a reminder due today, see
the build turn red in GitHub Actions, then handle the reminder from its prompt
in a fresh agent session. Not tested yet: setup in a repository with CI, a real
red run, handling by someone else.

## Beta: version 0.2.0

- Breaking changes are fine until then.
- Until then, working versions are 0.1.x.
- Publish 0.2.0 as the beta, then unpublish all 0.1.x versions, in that order.

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
