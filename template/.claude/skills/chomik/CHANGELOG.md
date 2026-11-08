# Changelog

What changed in chomik, newest first. chomik follows
[Semantic Versioning](https://semver.org/); versions 0.1.x are test versions.

## [0.1.8] - unreleased

## [0.1.7] - 2026-11-08

### Fixed

- In a subfolder or a package of a monorepo, `npx chomik` and `npx chomik check`
  stop and name the repository root, where GitHub reads workflows from, instead
  of installing in the wrong place or saying chomik is not in the project.
- No reminder is skipped silently any more. Every file or folder in `.chomik/`
  other than the check script is a reminder or is reported with its reason, for
  example `.MD` in capitals, `.md.bak`, a subfolder, a symbolic link or an empty
  file, and fails the build on the main branch like an invalid name.
- A reminder whose header the check cannot read says it may need a newer chomik
  or have a mistake, and what the header should say.
- Reading a reminder never loses text: a code block inside the prompt no longer
  cuts it short, a heading such as "Prompt engineering notes" stays in the part
  for humans, a file saved with a byte order mark (Windows Notepad) keeps its
  header, and a cut prompt says where the rest is.
- An older chomik, for example one cached by npx, no longer replaces a newer
  skill: it stops and suggests `npx chomik@latest`, unless you add `--force`.
- `/chomik` proposes replacing the copied check script and workflow only when
  they are older than the skill, not when they are newer.

### Changed

- The README shows provenance with `npm view chomik dist.attestations`;
  `npm audit signatures` works only for installed dependencies.
- A typo in a command or option suggests the closest one ("Did you mean
  check?") instead of printing the whole help; `-y` works like `--yes`.
- Without git, the installer no longer suggests committing or stashing.
- A deleted skill file is restored with "Restoring missing chomik files" instead
  of "0.1.6 -> 0.1.6".
- When the check script is missing but reminders are there, `npx chomik check`
  says how many reminders are not checked.
- With no reminders yet, the check points to the skill's README, which explains
  reminders, instead of the installer's help.
- Without GitHub, setup says that putting the project on GitHub is up to you,
  before you come back with `/chomik`.
- `--help` and the README no longer say that `npx chomik check` never fails
  outside CI: only due reminders do not make it fail there.
- `--help` says which files the agent adds during setup, that chomik also works
  without GitHub, and where to read more before installing.
- The install plan says what `/chomik` will add later, and whether the project is
  on GitHub yet. A dry run says how to install for real.
- Without a terminal, the installer shows the full command with `--yes` and says
  that nothing was changed.
- After the first install, the prompt for your coding agent reads the README
  installed with the skill, so it works without internet; the README now has the
  FAQ with examples. The note about committing the skill for your team comes at
  the end of setup instead.

## [0.1.6] - 2026-11-08

### Added

- `npx chomik check` shows the reminders that are due, the same check CI runs,
  and says when chomik or its copies in the project can be updated.
- With nothing due, the check says there are no reminders yet, or when the next
  one is due.
- Local use without CI, for when you do not want CI for now. Moving to CI later
  keeps your reminders.
- Reminders start with a short header with their format version and condition
  type (`chomik: 1`, `condition: date`).
- A reminder from a newer chomik fails the build on the main branch and asks to
  update chomik, instead of being skipped.
- After an update, `/chomik` offers to update the copied check script and
  workflow.
- The first install, and `npx chomik check` in a project without chomik, print a
  ready prompt for your coding agent that explains chomik with examples.
- This changelog, installed with the skill.

### Changed

- Without a GitHub repository, setup asks whether to set it up first or go
  without CI for now, instead of stopping.
- Setup ends with chomik ready and a short tutorial; it no longer asks for a
  reminder.
- After installing, chomik asks you to start a new session of your coding agent.
- The copied check script and workflow name the chomik version in their first
  comment.
- An unknown argument names the installed version and suggests
  `npx chomik@latest`.

## [0.1.0] to [0.1.5] - 2026-11-06 to 2026-11-08

Test versions: the skill, the check script, the installer and setup in GitHub
Actions.
