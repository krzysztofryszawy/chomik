# Roadmap

Plans for chomik's development. Decisions and their reasons are in
[decisions.md](decisions.md).

## Version 0

Status on 2026-11-08: released up to 0.1.5; `main` holds 0.1.6 in progress.

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

## Compatibility groundwork, before 0.2.0

Cheap now, expensive once reminders live in other people's repositories. In order:

1. A format version in every reminder, so new code can tell old formats apart.
2. An old check script that meets a reminder it does not understand fails loudly
   in CI and says to update chomik; it never skips a reminder silently.
3. The chomik version in a comment in the copied check script and in
   `chomik.yml`, so a project shows which version wrote them.
4. An unknown `npx chomik` command fails and suggests
   `npx chomik@latest <command>`.

Open question: whether the beta should be 1.0.0 instead of 0.2.0.

## Beta: version 0.2.0

- Breaking changes are fine until then.
- Until then, working versions are 0.1.x.
- Publish 0.2.0 as the beta, then unpublish all 0.1.x versions, in that order.

## Later

- Deterministic conditions besides dates: a dependency version in the lockfile,
  presence or absence of a file or text in the repository.
- Personal skill installation, Claude Code plugin marketplace.
- Stacks other than Node, CI systems other than GitHub Actions.
- A decision model such as `rkinas/basal`, then a full LLM query in CI.
- Other delivery channels, if testing shows they work better than the skill in a
  conversation with an agent: a deterministic `chomik` CLI (for example `add`,
  `extend`, `list`, `check`) or an MCP server. Open options, not plans.
