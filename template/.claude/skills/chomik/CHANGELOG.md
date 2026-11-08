# Changelog

What changed in chomik, newest first. chomik follows
[Semantic Versioning](https://semver.org/); versions 0.1.x are test versions.

## [0.1.6] - unreleased

### Added

- `npx chomik check` shows the reminders that are due, the same check CI runs.
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
