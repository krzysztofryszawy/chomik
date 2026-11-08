#!/usr/bin/env node
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VERSION = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8')).version;
// SHA-256 of the skill files in every released version, to recognize files nobody edited.
const RELEASED = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'bin', 'released-files.json'), 'utf8'));
const SOURCE = join(PACKAGE_ROOT, 'template', '.claude', 'skills', 'chomik');
const TARGET_DIRS = ['.claude', join('.claude', 'skills'), join('.claude', 'skills', 'chomik')];
const TARGET = TARGET_DIRS.at(-1);
const FILES = ['SKILL.md', 'setup.md', 'README.md', 'CHANGELOG.md', 'looking-for-messages-from-the-past.mjs', 'chomik-workflow.yml'];

const FIRST_TIME_PROMPT = 'Read https://github.com/krzysztofryszawy/chomik and explain with its examples what chomik does and how it could help in this project. Do not change anything.';
// The same two lines open the README; a test keeps them equal.
const PITCH = `Bulletproof reminders for things that really matter. A message from the past
turns the build red on a chosen date, with everything the team needs to act.`;

const HELP = `Usage: npx chomik@latest [options]
       npx chomik check

Installs chomik in this project, or updates it: run the same command again.
The installer writes only .claude/skills/chomik/, the skill your coding agent
reads. It shows the plan and asks before writing, and never overwrites edits
that are not committed to git, unless you use --force.

Then type /chomik in Claude Code or GitHub Copilot. The agent sets chomik up
with you and, after you confirm, adds .chomik/ and, on GitHub,
.github/workflows/chomik.yml. Not on GitHub? chomik also works locally.

Example: an API key expires in a year. A week before, the main-branch build
turns red with a ready prompt for your coding agent.

Commands:
  check          Show reminders that are due, the same check CI runs; never fails
                 outside CI

Options:
  --yes          Do not ask; required when not running in a terminal
  --dry-run      Show the plan and change nothing
  --force        Also overwrite files with changes that are not committed
  -h, --help     Show help
  --version      Show version

About chomik, including how to stop or remove it:
https://github.com/krzysztofryszawy/chomik, or once installed,
.claude/skills/chomik/README.md`;

const args = process.argv.slice(2);
const command = args[0] === 'check' ? 'check' : null;
const options = command ? args.slice(1) : args;
const has = (flag) => options.includes(flag);
const allowed = command ? ['--help', '-h'] : ['--yes', '--dry-run', '--force', '--help', '-h', '--version'];
const unknown = options.find((a) => !allowed.includes(a));
const CHECK_SCRIPT = join('.chomik', 'looking-for-messages-from-the-past.mjs');

try {
  if (unknown) {
    console.error(`chomik: unknown argument "${unknown}" in chomik ${VERSION}.`);
    console.error(`If it comes from a newer chomik, try: npx chomik@latest ${args.join(' ')}\n`);
    console.error(HELP);
    process.exitCode = 1;
  } else if (has('--help') || has('-h')) {
    console.log(HELP);
  } else if (has('--version')) {
    console.log(VERSION);
  } else if (command === 'check') {
    process.exitCode = check();
  } else {
    process.exitCode = await installOrUpdate({ yes: has('--yes'), dryRun: has('--dry-run'), force: has('--force') });
  }
} catch (error) {
  console.error(`chomik: ${error.message}`);
  process.exitCode = 1;
}

// Runs the project's own copy, the same file CI runs, so both give the same answer.
function check() {
  if (!existsSync(CHECK_SCRIPT) && !existsSync(join(TARGET, 'SKILL.md'))) {
    console.error(`chomik is not in this project yet.\n\n${PITCH}\nBuilt for coding agents.\n`);
    console.error('Give chomik a chance to impress you: npx chomik@latest');
    console.error(`Curious first? Paste this into your coding agent:\n  ${FIRST_TIME_PROMPT}`);
    return 1;
  }
  if (!existsSync(CHECK_SCRIPT)) {
    console.error('chomik is installed here, but its setup is not finished yet.\nTo finish, type /chomik in your coding agent.');
    return 1;
  }
  if (lstatSync(CHECK_SCRIPT).isSymbolicLink() || lstatSync('.chomik').isSymbolicLink()) {
    console.error(`chomik: ${CHECK_SCRIPT} is a symbolic link; not running it.`);
    return 1;
  }
  const status = spawnSync(process.execPath, [CHECK_SCRIPT], { stdio: 'inherit' }).status ?? 1;
  const hint = versionHint();
  if (hint) console.log(`\n${hint}`);
  return status;
}

// Three versions can differ: this package, the skill and the copies setup made.
// Only the first mismatch is named; fixing it leads to the next one.
function versionHint() {
  const skill = installedVersion();
  if (!/^\d/.test(skill)) return '';
  if (newer(VERSION, skill)) return `chomik ${VERSION} is out; this project has ${skill}. To update: npx chomik@latest`;
  const stamp = /🐹 chomik (\d+\.\d+\.\d+)/.exec(readFileSync(CHECK_SCRIPT, 'utf8').split('\n').slice(0, 2).join('\n'));
  const copies = stamp ? stamp[1] : 'an older version';
  if (!stamp || newer(skill, copies)) {
    return `chomik was updated, but its copies here are still ${copies}. To update them, type /chomik in your coding agent.`;
  }
  return '';
}

function newer(a, b) {
  return a.localeCompare(b, undefined, { numeric: true }) > 0;
}

async function installOrUpdate({ yes, dryRun, force }) {
  if (!existsSync('package.json')) {
    console.error('chomik: no package.json here. Run this in the root of a Node project.');
    return 1;
  }

  // Refuse symbolic links on the way, so chomik never writes outside the project.
  for (const path of [...TARGET_DIRS, ...FILES.map((f) => join(TARGET, f))]) {
    if (isLink(path)) {
      console.error(`chomik: ${path} is a symbolic link; refusing to write through it.`);
      return 1;
    }
  }

  const installed = installedVersion();
  const plan = [];
  for (const file of FILES) {
    const source = readFileSync(join(SOURCE, file));
    const target = join(TARGET, file);
    if (!existsSync(target)) {
      plan.push({ target, source, action: 'create' });
      continue;
    }
    const current = readFileSync(target);
    if (current.equals(source)) continue;
    const from = releasedVersionOf(file, sha256(current));
    plan.push(from ? { target, source, action: 'update', from } : { target, source, action: 'replace', committed: isCommittedInGit(target) });
  }

  if (plan.length === 0) {
    console.log(`chomik ${VERSION} is already here and up to date.`);
    return 0;
  }

  if (installed === 'not installed') console.log(`Installing chomik ${VERSION} in this project.`);
  else if (installed === 'edited') console.log(`Updating chomik in this project to ${VERSION} (some of its files were edited here).`);
  else console.log(`Updating chomik in this project: ${installed} -> ${VERSION}.`);
  console.log('Plan:');
  for (const p of plan) {
    if (p.action === 'create') console.log(`  create   ${p.target}`);
    if (p.action === 'update') console.log(`  update   ${p.target}`);
    if (p.action === 'replace') {
      console.log(`  replace  ${p.target} (edited here; ${p.committed ? 'your committed changes stay in git history' : 'changes are NOT committed'})`);
    }
  }
  console.log('Nothing else is changed. No dependencies are added.');
  if (installed === 'not installed') {
    console.log('Then /chomik in your coding agent sets chomik up with you: it copies the check');
    console.log('script to .chomik/ and, on GitHub, adds .github/workflows/chomik.yml.');
    if (!onGitHub()) console.log('This project is not on GitHub yet; chomik can work locally until it is.');
  }

  const atRisk = plan.filter((p) => p.action === 'replace' && !p.committed);
  if (atRisk.length && !force) {
    console.error('');
    console.error('chomik: not updating, because these edits would be lost for good:');
    for (const p of atRisk) console.error(`  ${p.target}`);
    console.error('Commit them (or stash them) and run again, or add --force to overwrite.');
    console.error('Nothing was changed.');
    return 1;
  }

  if (dryRun) {
    console.log('Dry run: nothing was changed. To install, run the same command without --dry-run.');
    return 0;
  }

  if (!yes) {
    if (!process.stdin.isTTY) {
      console.error('chomik: run this in a terminal to confirm, or confirm in the command itself:');
      console.error('  npx chomik@latest --yes');
      console.error('Nothing was changed.');
      return 1;
    }
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = (await rl.question('Continue? (Y/n) ')).trim().toLowerCase();
    rl.close();
    if (!['', 'y', 'yes'].includes(answer)) {
      console.log('Nothing was changed.');
      return 0;
    }
  }

  mkdirSync(TARGET, { recursive: true });
  for (const p of plan) writeFileSync(p.target, p.source);

  console.log(installed === 'not installed' ? `Done. chomik ${VERSION} is installed.` : `Done. chomik is now ${VERSION}.`);
  console.log('Feel free to share chomik with your team: commit .claude/skills/chomik/.');
  console.log('');
  if (installed === 'not installed') {
    console.log('chomik just moved in.');
    console.log(`First time with chomik? Paste this into a new session of your coding agent:\n  ${FIRST_TIME_PROMPT}`);
    console.log('Then type /chomik there to set it up.');
  } else {
    const since = /^\d/.test(installed) ? `since chomik ${installed}` : 'in recent versions of chomik';
    console.log('chomik learned some new tricks. Curious which? Paste this into a new session of your coding agent:');
    console.log(`  Read .claude/skills/chomik/CHANGELOG.md and tell me briefly what changed ${since} and what it means for this project. Do not change anything.`);
  }
  return 0;
}

// A file can be identical in several versions, so the installed version is the
// newest one that every present skill file matches.
function installedVersion() {
  const present = FILES.filter((file) => existsSync(join(TARGET, file)));
  if (present.length === 0) return 'not installed';
  const current = Object.fromEntries(FILES.map((f) => [f, sha256(readFileSync(join(SOURCE, f)))]));
  const known = { ...RELEASED, [VERSION]: current };
  const matching = Object.keys(known).filter((version) => {
    const files = present.filter((file) => known[version][file]);
    return files.length > 0 && files.every((file) => sha256(readFileSync(join(TARGET, file))) === known[version][file]);
  });
  if (matching.length === 0) return 'edited';
  return matching.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).at(-1);
}

// Read-only, like the skill's own check: an "origin" remote on github.com.
function onGitHub() {
  if (!existsSync(join('.git', 'config'))) return false;
  const origin = /\[remote "origin"\]([^[]*)/.exec(readFileSync(join('.git', 'config'), 'utf8'));
  return Boolean(origin && /^\s*url\s*=.*github\.com[:/]/m.test(origin[1]));
}

function releasedVersionOf(file, hash) {
  return Object.keys(RELEASED).find((version) => RELEASED[version][file] === hash);
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

// Read-only check: git reports nothing for the path only when it is tracked and committed as is.
function isCommittedInGit(path) {
  try {
    const status = execFileSync('git', ['status', '--porcelain', '--', path], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    if (status.trim() !== '') return false;
    execFileSync('git', ['ls-files', '--error-unmatch', '--', path], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function isLink(path) {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}
