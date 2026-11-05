# Decisions

Newest first. Each entry records what was decided and why. The current state of
the convention is in [message-from-the-past.md](message-from-the-past.md).

## 2026-11-06

- **Staged publishing.** The trusted publisher on npm may only stage versions;
  the owner approves each one on npmjs.com with 2FA before it becomes public.
  Why: even a compromised repository or workflow cannot release a version alone.

## 2026-11-05

- **The prompt guides a collaboration; it is not an exact script.** It carries as
  much context as possible, but the resolution may need the user. The agent
  explains what it is doing now, why, and whether it is going well.
- **A setup phase before the first reminder.** After installation chomik must
  find out, with the user or on its own, how to hook into the build that runs
  daily on the main branch, in any repository it has never seen. In this phase
  the skill may read CI configuration such as `.github/workflows/`, then
  proposes the exact place for the check step and asks for confirmation.
- **The next test is the full flow in a real repository with the package
  downloaded from npm.**
- **The build log leads with the agent prompt.** Order: one line saying a message
  from the past arrived, one instruction to paste the prompt into a coding agent
  session in this repository or read FOR HUMANS below, the prompt between
  markers, then the human part between markers. Why: in the sandbox test the
  prompt was hidden behind a pointer to the file and was hard to find.
- **The check mechanism is decided:** one Markdown file per reminder in
  `.chomik/`, read by a dependency-free Node script called by its own CI step.
- **The skill never sends a series of questions.** At most one question per
  message, only when the reminder would be useless without the answer; all else
  gets a stated default. The skill may read files the developer mentions or that
  are part of the described change, and the current git branch, but still does
  not search the repository. Why: the first sandbox test produced a list of three
  questions, one of which the agent could have answered by reading `package.json`.
- **Branch and commit convention:** `type/short-description` branches and
  Conventional Commits pull request titles. Why: squash merges turn titles into
  `main`'s history, which then doubles as the release changelog.
- **The clean start happened early, before the first release.** The prototype
  repository was renamed to `chomik-prototype` and kept private; this repository
  starts with one clean commit and stays private until the release. From now on
  `main` gets only squash-merged changes, and prototypes live on feature
  branches that are deleted afterwards.
- **Highest possible transparency.** Chomik must be easy to verify as safe by
  people, their coding agents and automated scanners. Plain JavaScript without
  a build step, a plain-language page describing every effect, and public,
  verifiable signals. Details in [security-checklist.md](security-checklist.md).
- **The check is a dependency-free Node script.** Version 0 targets GitHub-hosted
  Linux runners, which ship with Node.js preinstalled (Node.js 22 on Ubuntu
  24.04). Node starts in well under a tenth of a second and handles the safety
  requirements and future conditions more simply than shell.
- **`package.json` is not changed.** The check is a Node script with no
  dependencies, called directly by its own CI step. Locally it is run with one
  command that the failure message prints, so reproducing it needs no setup.
- **The check fails the build only in CI on the configured main branch.**
  Locally and in pull requests it prints the same message but passes, so the
  person handling a reminder sees it locally without blocking anyone else. The
  script recognizes CI by environment variables and reads the main branch name
  from configuration, because names differ between repositories.
- **The package must always be classified as very safe.** At this stage: no
  install scripts and no runtime dependencies. The command copies files bundled
  in the package and needs no network access. Publishing goes through trusted
  publishing with provenance, and the published files are limited to what users
  need, small and readable.
- **Installing chomik as a dependency is allowed but never required.** The
  package has no install scripts (such as `postinstall`) and no dependencies of
  its own, so `npm install chomik` only downloads it and changes nothing until
  someone runs the command. Teams that prefer update bots can use it this way.
- **`npx chomik` touches only chomik's own files**, after showing the plan and
  getting confirmation. A later version may move or delete them to follow a new
  convention. Reminders are the users' data: they may be moved, never silently
  dropped. Prefer acting only on files tracked by git, so every change shows in
  `git diff` and can be undone.
- **Updates are proposed, never automatic.** When invoked, the skill can say a
  newer chomik exists and offer to update. Running `npx chomik` again only brings
  new, visible files into the project; the user sees what changes and decides
  whether to keep them, in a normally reviewed PR. Pulling the latest version on
  every build was rejected for security and stability.
- **Delivery is one command from chomik's own npm package**, run with `npx` in
  any Node project, with no manual copying and no dependency added to the
  project. Goal: anyone who reads about chomik can try it in seconds.
- **No third-party installer such as Vercel's `skills` CLI.** Why: it adds trust in
  another vendor's code and gives nothing chomik needs. BMAD Method moved to it
  in v7, which was reviewed and rejected as a model for chomik.
- **Version 0 installs the skill at project level, in `.claude/skills/`.** Both
  Claude Code and GitHub Copilot read skills from that folder, per their docs.
  Committing it is the project's choice; once committed, everyone with the repo
  can use it. Personal installation can come later.
- **Version 0 targets Node projects only.** Other stacks come later.
- **Chomik is a generic tool for anyone, people and agents alike.** It solves
  the old problem of easily planning something for the future in the context of
  the place where we work. The work example is only one case. Agents must be
  able to create reminders for themselves. Dates are only the start; a decision model
  (such as `rkinas/basal`) is a later extension that opens very different
  possibilities.
- **Version 0 uses only simple deterministic triggers**, available easily and
  everywhere. The "no AI calls" rule for checks holds for version 0.
- **Wiring the check into a project is lazy by default.** The skill offers to add
  it with the first reminder in a project; a central shared build is an option
  where one exists. No reminders means no files and no overhead.
- **Top priority: closing a reminder must never introduce a bug.** The reminder
  lives physically apart from application code, so removing it cannot change
  what ships. Fixing the underlying problem (for example removing a pin) is a
  separate, normally reviewed code change; chomik only guarantees that its own
  part is isolated. Not every requirement can be met at once; we look for the
  best trade-off, with this one first.
- **Handling a reminder must be reproducible locally with a deterministic tool.**
  Whoever takes the task clones the repo, runs the usual build, sees the message
  on screen, and can paste it into their IDE agent. This is what worked best in
  the unit-test prototype. GitHub issues as reminder storage were considered and
  rejected for now: they need API access and do not show up in a local build.
- **Security and stability are critical: no code changes unless necessary.**
  Handling a reminder may require no work at all when the problem has resolved
  itself, so closing a reminder must not force a code change or rebuild just to
  remove a comment or file.
- **No assigned owner in handling a reminder.** The team reviews builds and
  pipelines together at the daily meeting and decides there who takes the task.
  A red build with a clear headline such as "chomik sent a message from the past"
  is enough. Why: GitHub notifies the scheduled workflow's creator, not the
  reminder's author, and the team does not rely on those notifications.
- **Two named phases: creating a reminder and handling a reminder.** Why: design
  discussions need precise terms for "before" and "after the deadline".
- **Chomik must never get in the way of manual resolution.** The agent is an
  optional extra; handling a reminder must work without it.
- **A due message is a task for someone on that day, not a note.** Chomik plans
  important follow-ups that must not be forgotten. It fails only the build of the
  main branch that deploys to dev (branch names differ between repositories),
  never pull requests or local work.
- **No large ecosystem.** Chomik simplifies a process already done by hand, so
  nobody has to explain it each time. The check mechanism is still open; tests
  are not a generic option because test conventions differ between repositories.
  Ruleset-required workflows are ruled out: they run only on pull request events.
- **Accepted risks after the prior-art review.** The team being blocked by a red
  preproduction build is intended, not a side effect. Prompts going stale is
  limited because deadlines are short, usually up to a month. Chomik depending
  on an agent is acceptable.
- **Simplicity of use comes first, and the mechanism is still open.** The skill
  and the prompt may end up as an add-on to a simpler core rather than the core
  itself. Why: competitors need one comment line, so chomik must not be harder
  to start with.
- **Messages block preproduction builds by default.** The agent says so when
  creating a message and the author can opt out. Production is never blocked.
  Why: a reminder that does not stop anything is easy to ignore.
- **Creation is a short conversation, started manually.** No hooks and no
  draft-for-approval forms. The agent introduces itself, waits for the
  developer's description, uses session context, and asks only what is missing.
  Why: safety, and no automation that overwhelms the developer.
- **The check is a step or job in the main build workflow**, separate from tests,
  not a separately scheduled workflow. The existing daily build covers inactive
  repositories. Why: keeps build responsibilities separate without new schedules.
- **The message format is the core; delivery channels are interchangeable.**
  Skill, CLI, MCP server, and GitHub Action are open options for experiments.
  Why: messages already in repositories must survive changes in tooling.
- **Dates first; other conditions later.** The format reserves a condition type.
  Candidates: deterministic checks, `rkinas/basal`, a full LLM in CI.
- **Prior art shapes the design.** `aki77/expiring-todo-comments-action` (Action
  plus a skill writing `TODO[YYYY-MM-DD]` comments) and the `/watch` skill in
  `nozomiishii/dotfiles` (version-conditioned TODOs or tracking issues) cover
  parts of the idea. None carries a prompt for a future agent, agent-led
  resolution and cleanup, or a blocking policy. Why: avoid rebuilding what
  exists; focus on what is missing.
- **The repository stays private until the first release.** The clean start
  keeps the prototype instead of deleting it: this repository and its local
  folder are renamed to `chomik-prototype` and stay private, and chomik starts in
  a new repository named `chomik` with one clean commit. Creating a repository
  with the old name ends GitHub's redirects from `chomik` to the renamed one,
  which is intended here.
