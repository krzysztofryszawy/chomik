# Decisions

Newest first. Each entry records what was decided and why. The current state of
the convention is in [message-from-the-past.md](message-from-the-past.md).

## 2026-11-08

- **An older installer never silently downgrades a newer skill.** The installer
  reads the skill's version from the top entry of the installed `CHANGELOG.md`
  and stops when it is newer than itself; `--force` allows a deliberate
  downgrade. Why: npx may run a cached older chomik, which cannot know the hashes
  of newer files and would treat them as edited. Installers up to 0.1.6 do not
  have this check.
- **`npx chomik check` names one version mismatch at most.** After the check, it
  says when a newer chomik is out than the skill in the project, or else when the
  copies setup made are older than the skill. Versions come from the package,
  the skill file hashes and the first comment of the copied script. Why: three
  versions can differ, and fixing the first mismatch leads to the next one.
- **An update says what changed, and the skill updates its copies.** After an
  update, the installer prints a prompt for the agent to read the changelog
  since the old version. The installer
  writes only the skill, so on the next `/chomik` the skill compares the version
  in the first comment of the copied check script and `chomik.yml` with its own
  and proposes replacing them. Why: the copies are what CI runs, and an old copy
  could misread reminders written by the new skill.
- **A changelog file, installed with the skill.** `CHANGELOG.md` in the skill
  folder follows Keep a Changelog: written for users, newest first, one entry
  per version. The agent reads it locally after an update, with no network and
  no links with parameters, and it always matches the installed version. Why:
  Keep a Changelog advises against commit logs as changelogs, since they are
  full of noise; this replaces using `main`'s history as the changelog.
- **First contact comes with a prompt for the agent.** After the first install,
  and from `npx chomik check` in a project without chomik, chomik prints one
  ready prompt: read the repository and explain with its examples what chomik
  does and how it could help here, changing nothing. `--help` gives one example.
  Why: one good example says more than a description, and the agent can relate
  the examples to the developer's project.
- **`npx chomik check` runs the check by hand, on trial until 0.2.0.** It runs
  the project's own copy of the check script, the file CI runs, so both give
  the same answer; it refuses a symbolic link. Before 0.2.0 it is decided whether
  it stays; after that it stays, or remains as a stub that says what to use.
  Why: `node .chomik/looking-for-messages-from-the-past.mjs` is too long to type
  again and again, and nothing may require setup from the user.
- **The beta stays 0.2.0, not 1.0.0.** Why: chomik is not yet ready for a stable
  promise; 1.0.0 comes when it is.
- **An unknown `npx chomik` argument suggests the latest version.** It still fails
  on stderr with exit code 1, and now names the installed version and suggests
  `npx chomik@latest` with the same arguments. Why: an older chomik cached by npx
  cannot know commands added later, so the most it can do is point to them.
- **The files copied into a project name the chomik version.** The first comment
  of the check script and of `chomik.yml` says, for example, `chomik 0.1.6`; a
  test keeps it equal to `package.json`. Why: these copies stay in other
  repositories for years, and the version is the first thing needed to help.
- **A reminder the check script does not understand fails the build.** An
  unknown format version or condition, before or on its date, is reported with
  `npx chomik@latest` as the fix, and fails like an invalid file (exit code 2)
  on the main branch. Why: an old copy of the script lives on in a repository;
  skipping what it does not understand could hide a reminder for good.
- **Reminders start with a YAML header: `chomik: 1` and `condition: date`.** The
  check script reads only flat `key: value` lines and never prints the header. A
  reminder without a header is format 1. Why: a standard header that agents write
  reliably, readable without dependencies and extensible to other conditions; a
  hidden HTML comment would be a custom syntax.
- **Versioning follows what lives longest.** chomik's interfaces live for very
  different times: `npx chomik` commands and skill files are replaced on update,
  while the check script copied to `.chomik/`, the reminder format and the job in
  the user's workflow stay in other repositories for years. Rules: the public
  interface is named explicitly; changes are additive; anything unknown fails
  loudly with a hint instead of being guessed or skipped; a removed command keeps
  its name as a stub that says what to use instead. Why: SemVer only works once
  the public interface is declared, data outlives code, and RFC 9413 shows that
  silent tolerance entrenches errors. For chomik the worst failure is a reminder
  that silently never shows.
- **The check always says something.** With nothing due, it says there are no
  reminders yet, with how to leave one, or when the next one is due. Counts and
  dates come from file names only. Exit codes are unchanged. Why: a silent pass
  looks broken to someone trying chomik for the first time.
- **Local use is an option, not the pitch.** Setup always aims at the full flow
  with CI; without GitHub it asks whether to set that up first or go without CI
  for now. Only when the developer chooses to go without CI, the skill copies
  just the check script, which is run by hand; no hooks, npm scripts or
  schedules. Moving to CI later is the normal setup and keeps existing
  reminders. Why: some developers want to understand chomik locally first, and
  without a defined option the agent improvised, proposing a git hook.
- **The skill stays short; the details live in its README.** `SKILL.md` and
  `setup.md` hold only what the agent needs every time. Questions they do not
  cover are answered from `.claude/skills/chomik/README.md`, never improvised.
  Why: a long skill dilutes the essential instructions, and the README is
  installed next to it, so the agent can always read it.
- **One skill with supporting files, not several skills.** Larger topics get
  their own file next to `SKILL.md`, read only when needed. Why: a helper skill
  that the agent can call has its description in context in every session and
  can run on its own; one that it cannot call needs a second command from the
  user.

## 2026-11-07

- **London kept, Barcelona (check code as an external GitHub Action) rejected.**
  Archived with full reasoning in
  [archive/2026-11-07-barcelona-rejected.md](archive/2026-11-07-barcelona-rejected.md).
- **The skill was rewritten from scratch, following Anthropic's skill-authoring
  best practices**, after rules piled up and made the agent verbose. It states
  only what the model would not know: purpose, the reminder file format, what
  the prompt must cover, and hard limits. Setup, which is fragile, moved to
  `setup.md` with exact steps, read only on first use. No sample sentences for
  the agent to copy and no style micro-rules.
- **No separate pull request flow for reminders.** A reminder belongs in the
  same pull request as the change it is about, so the reviewer sees the
  workaround and its expiry together. A dedicated flow (sparse worktree, own
  branch and PR) was designed and dropped: it added complexity and broke that
  link. The developer commits the reminder with their work.
- **Chomik is for things that really matter.** A red build is a strong signal,
  so chomik is a bulletproof reminder, not a TODO list. The README leads with
  this. What matters is the developer's call: the skill never judges whether a
  reminder is important enough.
- **Chomik explains itself inside the project.** It installs
  `.claude/skills/chomik/README.md` (what it is, its files, why it is safe, help,
  update, stop and remove), and every chomik file points to it in its first
  lines. Why: the public README is not in the user's repository, and an agent
  asked about chomik there must find the answer locally. The public README, the
  installed README and every `--help` use the same structure and wording.
- **Chomik lives in one file, `.github/workflows/chomik.yml`.** In a project
  with a daily build, the build calls it with two lines
  (`looking-for-messages-from-the-past: uses: ./.github/workflows/chomik.yml`),
  so the build turns red on a reminder's date while its other jobs run on; the
  file then has no schedule of its own, so it never runs twice. Without a daily
  build, the same file runs every night (02:07 UTC) and on push. A separate
  workflow alone was rejected for projects with CI: easy to overlook. The name
  `looking-for-messages-from-the-past` is used consistently for the script, the
  job and the step. No switches or remove command: removing chomik means
  deleting its files and the two lines, described in the README.
- **A project without a daily build gets its own small workflow.** The skill
  proposes `.github/workflows/chomik.yml`, copied from a template shipped with
  the skill (actions pinned to a commit SHA), that only runs the check every day,
  on push to the default branch and on demand. Other CI systems, git hooks and
  npm scripts were rejected; manual checks became the local option on 2026-11-08. GitHub notifies the person
  who created a scheduled workflow, which in a small project is the author.
- **Language:** conversation in English by default and in the developer's
  language once they use it; reminder files always in English. Kept to one
  short instruction in the skill.
- **The skill looks around without shell commands.** It reads files instead
  (`.github/workflows/`, `.git/HEAD`, `.git/refs/remotes/origin/HEAD`) and says
  in one line that it is checking, read-only. Why: a permission prompt for
  `git symbolic-ref` sounded alarming to the developer although it changed
  nothing.
- **The recommended command is `npx chomik@latest`.** Why: installation must be
  as simple as possible, and `@latest` avoids an older copy cached by npx.
  Pinning a version stays possible and documented.
- **Friendly voice, humor only where it fits.** The check script is now
  `.chomik/looking-for-messages-from-the-past.mjs`; install and update messages
  say plainly what happens; after installing, chomik invites sharing it with the
  team. Humor never goes into errors or agent prompts. No migration from older
  names: nobody uses 0.1.x, and those versions are deleted at the beta.

## 2026-11-06

- **`npx chomik` is the single command for install and update; `init` is gone.**
  Why: two ways to do the same thing make people unsure whether they really do
  the same. The plan shows versions (for example `0.1.0 -> 0.2.0`), the prompt
  is `(Y/n)` so Enter accepts after reading the plan, and `--dry-run` shows the
  plan only.
- **Updates are all or nothing, and never lose edits for good.** Users may edit
  the skill files freely. Files identical to a released version are updated
  silently; edited files that are committed are replaced with a note, since git
  keeps them; edited files that are not committed, or edited files outside git,
  block the whole update unless `--force`. Released versions are recognized by
  SHA-256 hashes in `bin/released-files.json`.
- **Breaking changes are allowed until the beta, which is version 0.2.0.**
  Working versions are 0.1.x; commands and files may change without
  compatibility until then. At the beta, the fresh opening: publish 0.2.0, then
  unpublish all 0.1.x versions so only the beta remains. Never unpublish
  before the new version is out, so the name stays held. Repository history is
  not rewritten.
- **The check script is stated, never asked about.** It is required for chomik to
  work. Setup asks for one confirmation covering the script and the CI step.
  Why: in the npm test in Copilot, a separate question about the script was
  confusing and pointless.
- **Verified: `npx chomik@0.1.0 init` from npm works, and `/chomik` works in
  GitHub Copilot in VS Code.** Not yet checked: whether Copilot honors
  `disable-model-invocation`.
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
  a readable `main` history. The changelog for users is `CHANGELOG.md`.
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
