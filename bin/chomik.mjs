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
const FILES = ['SKILL.md', 'setup.md', 'README.md', 'looking-for-messages-from-the-past.mjs', 'chomik-workflow.yml'];

const HELP = `Usage: npx chomik@latest [options]
       npx chomik check

Installs chomik in this project, or updates it: run the same command again.
Writes only .claude/skills/chomik/. Shows the plan and asks before writing, and
never overwrites edits that are not committed to git, unless you use --force.
Then type /chomik in Claude Code or GitHub Copilot.

Commands:
  check          Show reminders that are due, the same check CI runs; never fails
                 outside CI

Options:
  --yes          Do not ask; required when not running in a terminal
  --dry-run      Show the plan and change nothing
  --force        Also overwrite files with changes that are not committed
  -h, --help     Show help
  --version      Show version

About chomik, including how to stop or remove it: .claude/skills/chomik/README.md`;

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
  if (!existsSync(CHECK_SCRIPT)) {
    console.error('chomik: not set up in this project yet. To set it up, type /chomik in your coding agent.');
    return 1;
  }
  if (lstatSync(CHECK_SCRIPT).isSymbolicLink() || lstatSync('.chomik').isSymbolicLink()) {
    console.error(`chomik: ${CHECK_SCRIPT} is a symbolic link; not running it.`);
    return 1;
  }
  return spawnSync(process.execPath, [CHECK_SCRIPT], { stdio: 'inherit' }).status ?? 1;
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
    console.log('Dry run: nothing was changed.');
    return 0;
  }

  if (!yes) {
    if (!process.stdin.isTTY) {
      console.error('chomik: run this in a terminal to confirm, or add --yes.');
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
  const greeting = installed === 'not installed' ? 'chomik just moved in.' : 'chomik learned some new tricks.';
  console.log(`${greeting} Say hi: start a new session of your coding agent in this project and type /chomik.`);
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
