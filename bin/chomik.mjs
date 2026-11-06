#!/usr/bin/env node
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VERSION = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8')).version;
// SHA-256 of the skill files in every released version, to recognize files nobody edited.
const RELEASED = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'bin', 'released-files.json'), 'utf8'));
const SOURCE = join(PACKAGE_ROOT, 'template', '.claude', 'skills', 'chomik');
const TARGET_DIRS = ['.claude', join('.claude', 'skills'), join('.claude', 'skills', 'chomik')];
const TARGET = TARGET_DIRS.at(-1);
const FILES = ['SKILL.md', 'check.mjs'];

const HELP = `Usage: npx chomik [options]

Installs or updates the chomik skill in this project (.claude/skills/chomik/).
Shows the plan and asks before writing. Never overwrites changes that could not
be recovered from git, unless you use --force.

Options:
  --yes          Do not ask; required when not running in a terminal
  --dry-run      Show the plan and change nothing
  --force        Also overwrite files with changes that are not committed
  -h, --help     Show help
  --version      Show version`;

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const unknown = args.find((a) => !['--yes', '--dry-run', '--force', '--help', '-h', '--version'].includes(a));

try {
  if (unknown) {
    console.error(`chomik: unknown argument "${unknown}"\n`);
    console.error(HELP);
    process.exitCode = 1;
  } else if (has('--help') || has('-h')) {
    console.log(HELP);
  } else if (has('--version')) {
    console.log(VERSION);
  } else {
    process.exitCode = await installOrUpdate({ yes: has('--yes'), dryRun: has('--dry-run'), force: has('--force') });
  }
} catch (error) {
  console.error(`chomik: ${error.message}`);
  process.exitCode = 1;
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

  const plan = FILES.map((file) => {
    const source = readFileSync(join(SOURCE, file));
    const target = join(TARGET, file);
    if (!existsSync(target)) return { target, source, action: 'create' };
    const current = readFileSync(target);
    if (current.equals(source)) return { target, source, action: 'unchanged', from: VERSION };
    const from = releasedVersionOf(file, sha256(current));
    if (from) return { target, source, action: 'update', from };
    return { target, source, action: 'replace', committed: isCommittedInGit(target) };
  });

  const installed = installedVersion();
  if (plan.every((p) => p.action === 'unchanged')) {
    console.log(`chomik ${VERSION} is installed in this project and up to date.`);
    return 0;
  }

  console.log(`chomik ${VERSION} (installed here: ${installed})`);
  console.log('Plan:');
  for (const p of plan) {
    if (p.action === 'create') console.log(`  create   ${p.target}`);
    if (p.action === 'update') console.log(`  update   ${p.target} (${p.from} -> ${VERSION})`);
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
  for (const p of plan) if (p.action !== 'unchanged') writeFileSync(p.target, p.source);

  console.log(installed === 'not installed'
    ? 'Done. Open your coding agent in this project and type /chomik.'
    : `Done. chomik is now ${VERSION}.`);
  console.log('Commit .claude/skills/chomik/ to share it with your team.');
  return 0;
}

// A file can be identical in several versions, so the installed version is the
// newest one that matches every installed file.
function installedVersion() {
  const existing = FILES.filter((file) => existsSync(join(TARGET, file)));
  if (existing.length === 0) return 'not installed';
  const known = { ...RELEASED, [VERSION]: Object.fromEntries(FILES.map((f) => [f, sha256(readFileSync(join(SOURCE, f)))])) };
  const matching = Object.keys(known).filter((version) =>
    FILES.every((file) => existsSync(join(TARGET, file)) && known[version][file] === sha256(readFileSync(join(TARGET, file)))));
  if (matching.length === 0) return 'edited or incomplete';
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
