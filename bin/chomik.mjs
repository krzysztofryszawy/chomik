#!/usr/bin/env node
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGE = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8'));
const VERSION = PACKAGE.version;
const MIN_NODE = Number(/\d+/.exec(PACKAGE.engines.node)[0]);
// SHA-256 of chomik's files in every released version, to recognize files nobody edited.
const RELEASED = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'bin', 'released-files.json'), 'utf8'));
const SOURCE = join(PACKAGE_ROOT, 'template', '.claude', 'skills', 'chomik');
const TARGET_DIRS = ['.claude', join('.claude', 'skills'), join('.claude', 'skills', 'chomik')];
const TARGET = TARGET_DIRS.at(-1);
const FILES = ['SKILL.md', 'README.md', 'CHANGELOG.md'];
const SCRIPT = 'looking-for-messages-from-the-past.mjs';
const CHECK_SCRIPT = join('.chomik', SCRIPT);
const WORKFLOW = join('.github', 'workflows', 'chomik.yml');
const OWN_SCHEDULE = /^ *# chomik: only without a daily build, begin\n[\s\S]*?^ *# chomik: only without a daily build, end\n/m;
// The nightly workflow only makes sense on GitHub, so elsewhere it is left out of the plan.
const ownFiles = () => [
  ...FILES.map((file) => ({ key: file, content: readFileSync(join(SOURCE, file)), target: join(TARGET, file) })),
  { key: SCRIPT, content: readFileSync(join(PACKAGE_ROOT, 'template', '.chomik', SCRIPT)), target: CHECK_SCRIPT, note: ' (checks the reminders)' },
  ...(onGitHub() ? [workflowFile()] : []),
];

// Once the daily build calls chomik.yml, chomik's own schedule is gone from it, so it
// never runs twice; the installer keeps whichever of the two forms the project uses.
function workflowFile() {
  const template = readFileSync(join(PACKAGE_ROOT, 'template', WORKFLOW), 'utf8');
  if (calledByBuild()) {
    return { key: 'chomik.yml#called', content: Buffer.from(template.replace(OWN_SCHEDULE, '')), target: WORKFLOW, note: ' (called by your daily build)' };
  }
  return { key: 'chomik.yml', content: Buffer.from(template), target: WORKFLOW, note: ' (runs the check every night on GitHub)' };
}

function calledByBuild() {
  const dir = join('.github', 'workflows');
  if (!existsSync(dir)) return false;
  return readdirSync(dir)
    .filter((name) => /\.ya?ml$/.test(name) && name !== 'chomik.yml')
    .some((name) => /uses:\s*\.\/\.github\/workflows\/chomik\.yml\b/.test(readFileSync(join(dir, name), 'utf8')));
}

// The agent cannot start the next step itself, so the prompt asks it to invite me to it.
const explainFrom = (where, next) => `Read ${where} and tell me in at most four short sentences what trouble chomik takes off my hands and what I gain, with one example. Do not search this project. Then invite me to ${next}, and say what that will and will not change, so I can try it without worry. Do not change anything.`;
// The same two lines open the README; a test keeps them equal.
const PITCH = `Bulletproof reminders for things that really matter. A message from the past
turns the build red on a chosen date, with everything the team needs to act.`;

const HELP = `Usage: npx chomik@latest [options]
       npx chomik check

Installs chomik in this project, or updates it: run the same command again.
The installer writes only chomik's own files: .claude/skills/chomik/, the skill
your coding agent reads, the check script in .chomik/ and, on GitHub,
.github/workflows/chomik.yml, which runs the check every night. It shows the
plan and asks before writing, and never overwrites edits that are not committed
to git, unless you use --force.

Then type /chomik in Claude Code or GitHub Copilot to leave a reminder.

Example: an API key expires in a year. A week before, the main-branch build
turns red with a ready prompt for your coding agent.

Commands:
  check          Show reminders that are due, the same check CI runs. Outside CI,
                 due reminders do not make it fail

Options:
  -y, --yes      Do not ask; required when not running in a terminal
  --dry-run      Show the plan and change nothing
  --force        Also overwrite edits that are not committed, or a newer chomik
  -h, --help     Show help
  --version      Show version

About chomik, including how to stop or remove it:
https://github.com/krzysztofryszawy/chomik, or once installed,
.claude/skills/chomik/README.md`;

const args = process.argv.slice(2);
const command = args[0] === 'check' ? 'check' : null;
const options = command ? args.slice(1) : args;
const has = (flag) => options.includes(flag);
const allowed = command ? ['--help', '-h'] : ['--yes', '-y', '--dry-run', '--force', '--help', '-h', '--version'];
const unknown = options.find((a) => !allowed.includes(a));

try {
  // npm only warns about "engines", so chomik checks Node itself before doing anything.
  if (Number(process.versions.node.split('.')[0]) < MIN_NODE) {
    console.error(`chomik needs Node ${MIN_NODE} or newer; this is Node ${process.versions.node}.`);
    console.error('Update Node: https://nodejs.org');
    process.exitCode = 1;
  } else if (unknown) {
    console.error(`chomik: unknown argument "${unknown}" in chomik ${VERSION}.`);
    const near = closest(unknown, command ? allowed : ['check', ...allowed]);
    if (near) console.error(`Did you mean "${near}"?`);
    // Without -y or --yes, so following the hint still shows the plan and asks first.
    else console.error(`If it comes from a newer chomik, try: npx chomik@latest ${args.filter((a) => a !== '-y' && a !== '--yes').join(' ')}`);
    console.error('Help: npx chomik@latest --help');
    process.exitCode = 1;
  } else if (has('--help') || has('-h')) {
    console.log(HELP);
  } else if (has('--version')) {
    console.log(VERSION);
  } else if (reposBelow().length) {
    const repos = reposBelow();
    const again = command === 'check' ? 'npx chomik check' : 'npx chomik@latest';
    const names = repos.length > 5 ? `${repos.slice(0, 5).join(', ')} and ${repos.length - 5} more` : repos.join(', ');
    console.error(`chomik: this folder is not a git repository, but it holds ${repos.length === 1 ? 'one' : repos.length}: ${names}.`);
    console.error("chomik works in one repository, the one whose build checks its reminders. Run it there, for example:");
    console.error(`  cd ${repos[0]} && ${again}`);
    process.exitCode = 1;
  } else if (outsideRoot()) {
    console.error('chomik: run this in the root of the repository, where GitHub reads workflows from:');
    console.error(`  cd ${outsideRoot()}`);
    process.exitCode = 1;
  } else if (command === 'check') {
    process.exitCode = check();
  } else {
    process.exitCode = await installOrUpdate({ yes: has('--yes') || has('-y'), dryRun: has('--dry-run'), force: has('--force') });
  }
} catch (error) {
  console.error(`chomik: ${error.message}`);
  process.exitCode = 1;
}

// Wrapped by hand, because a terminal breaks long lines in the middle of a word.
function indented(text, width = 78) {
  const lines = [];
  let line = ' ';
  for (const word of text.split(' ')) {
    if (line.length + word.length + 1 > width) {
      lines.push(line);
      line = ' ';
    }
    line += ` ${word}`;
  }
  return [...lines, line].join('\n');
}

// A folder that only groups repositories, such as an editor workspace, has no CI of
// its own, so chomik names the repositories instead of installing there.
function reposBelow() {
  if (outsideRoot() || existsSync('.git')) return [];
  return readdirSync('.', { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(entry.name, '.git')))
    .map((entry) => entry.name)
    .sort();
}

// In a subfolder or a package of a monorepo, chomik's files would land where GitHub
// never reads them, so both commands run only in the repository root.
function outsideRoot() {
  const here = resolve('.');
  for (let dir = here; ; dir = dirname(dir)) {
    if (existsSync(join(dir, '.git'))) return dir === here ? '' : dir;
    if (dirname(dir) === dir) return '';
  }
}

// Someone who runs chomik where it cannot work yet is often seeing it for the first time.
function introduce(problem, start) {
  console.error(`${problem}\n\n${PITCH}\nBuilt for coding agents.\n`);
  console.error(start);
  console.error(`Curious first? Paste this into your coding agent:\n\n${indented(explainFrom('https://github.com/krzysztofryszawy/chomik', 'install chomik by running npx chomik@latest in the root of this project'))}`);
}

// Runs the project's own copy, the same file CI runs, so both give the same answer.
function check() {
  if (!existsSync(CHECK_SCRIPT) && !existsSync(join(TARGET, 'SKILL.md'))) {
    introduce('chomik is not in this project yet.', 'Give chomik a chance to impress you: npx chomik@latest');
    return 1;
  }
  if (!existsSync(CHECK_SCRIPT)) {
    const reminders = existsSync('.chomik') ? readdirSync('.chomik').filter((name) => name.endsWith('.md')).length : 0;
    const unchecked = reminders === 1 ? ', so 1 reminder there is not checked' : reminders ? `, so ${reminders} reminders there are not checked` : '';
    console.error(`chomik's check script is missing from .chomik/${unchecked}.`);
    console.error('To restore it, run: npx chomik@latest');
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

// One line at most, the first that applies: a newer chomik, a check script older than
// the skill, no CI at all, or a CI workflow older than the skill.
function versionHint() {
  const skill = installedVersion();
  if (/^\d/.test(skill) && newer(VERSION, skill)) return `chomik ${VERSION} is out; this project has ${skill}. To update: npx chomik@latest`;
  const script = stampOf(CHECK_SCRIPT);
  if (/^\d/.test(skill) && script && newer(skill, script)) {
    return `The check script in .chomik/ is older than chomik ${skill} here. To update it, run: npx chomik@latest`;
  }
  if (!existsSync(WORKFLOW)) {
    return onGitHub()
      ? 'The nightly check on GitHub is missing, so reminders show only when you run this. To add it, run: npx chomik@latest'
      : 'This project is not on GitHub yet, so reminders show only when you run this. Once it is, run npx chomik@latest again to add the nightly check.';
  }
  const ci = stampOf(WORKFLOW);
  if (/^\d/.test(skill) && ci && newer(skill, ci)) {
    return `chomik was updated, but .github/workflows/chomik.yml is still ${ci}. To update it, run: npx chomik@latest`;
  }
  return '';
}

function stampOf(file) {
  const stamp = /🐹 chomik (\d+\.\d+\.\d+)/.exec(readFileSync(file, 'utf8').split('\n').slice(0, 2).join('\n'));
  return stamp ? stamp[1] : '';
}

function newer(a, b) {
  return a.localeCompare(b, undefined, { numeric: true }) > 0;
}

async function installOrUpdate({ yes, dryRun, force }) {
  // chomik needs the root of a repository; package.json may live elsewhere, as in a monorepo.
  if (!existsSync('.git') && !existsSync('package.json')) {
    introduce('chomik: this folder is not the root of a repository, so there is nothing to install it in.', 'To try it, run this in the root of your repository: npx chomik@latest');
    return 1;
  }

  const OWN_FILES = ownFiles();
  // Refuse symbolic links on the way, so chomik never writes outside the project.
  for (const path of [...TARGET_DIRS, '.chomik', '.github', join('.github', 'workflows'), ...OWN_FILES.map((f) => f.target)]) {
    if (isLink(path)) {
      console.error(`chomik: ${path} is a symbolic link; refusing to write through it.`);
      return 1;
    }
  }

  const newerHere = changelogVersion();
  if (newerHere && newer(newerHere, VERSION) && !force) {
    console.error(`chomik: this project has chomik ${newerHere}, newer than ${VERSION} that you ran.`);
    console.error('To update, run: npx chomik@latest');
    console.error('To go back to an older version on purpose, add --force.');
    console.error('Nothing was changed.');
    return 1;
  }

  const installed = installedVersion();
  const plan = [];
  for (const { key, content: source, target, note = '' } of OWN_FILES) {
    if (!existsSync(target)) {
      plan.push({ target, source, note, action: 'create' });
      continue;
    }
    const current = readFileSync(target);
    if (current.equals(source)) continue;
    plan.push(releasedVersionOf(key, sha256(current))
      ? { target, source, note, action: 'update' }
      : { target, source, note, action: 'replace', committed: isCommittedInGit(target) });
  }

  if (plan.length === 0) {
    console.log(`chomik ${VERSION} is already here and up to date.`);
    return 0;
  }

  if (installed === 'not installed') console.log(`Installing chomik ${VERSION} in this project.`);
  else if (installed === VERSION && plan.every((p) => p.target === WORKFLOW)) console.log("Adding chomik's nightly check on GitHub to this project.");
  else if (installed === VERSION) console.log(`Restoring missing chomik ${VERSION} files in this project.`);
  else if (installed === 'edited') console.log(`Updating chomik in this project to ${VERSION} (some of its files were edited here).`);
  else console.log(`Updating chomik in this project: ${installed} -> ${VERSION}.`);
  console.log('Plan:');
  const keep = (p) => (p.committed ? 'your committed changes stay in git history' : existsSync('.git') ? 'changes are NOT committed' : 'this project has no git to keep them');
  for (const p of plan) {
    if (p.action === 'create') console.log(`  create   ${p.target}${p.note}`);
    if (p.action === 'update') console.log(`  update   ${p.target}${p.note}`);
    if (p.action === 'replace') console.log(`  replace  ${p.target} (edited here; ${keep(p)})`);
  }
  console.log('Nothing else is changed. No dependencies are added.');
  if (!onGitHub()) console.log('This project is not on GitHub yet, so there is no nightly check for now.');

  const atRisk = plan.filter((p) => p.action === 'replace' && !p.committed);
  if (atRisk.length && !force) {
    console.error('');
    console.error('chomik: not updating, because these edits would be lost for good:');
    for (const p of atRisk) console.error(`  ${p.target}`);
    console.error(existsSync('.git')
      ? 'Commit them (or stash them) and run again, or add --force to overwrite.'
      : 'Copy them somewhere safe and run again, or add --force to overwrite.');
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
    const { createInterface } = await import('node:readline/promises');
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = (await rl.question('Continue? (Y/n) ')).trim().toLowerCase();
    rl.close();
    if (!['', 'y', 'yes'].includes(answer)) {
      console.log('Nothing was changed.');
      return 0;
    }
  }

  for (const p of plan) {
    mkdirSync(dirname(p.target), { recursive: true });
    writeFileSync(p.target, p.source);
  }

  const written = plan.map((p) => p.target);
  const toCommit = [TARGET, '.chomik', ...(written.includes(WORKFLOW) ? [WORKFLOW] : [])].join(', ');
  if (installed === 'not installed') {
    console.log(`Done. chomik ${VERSION} just moved in.\n`);
    console.log(onGitHub()
      ? 'Commit these files and push them to your main branch: from then on GitHub\nchecks your reminders every night, and your whole team can leave them.\n'
      : 'Until this project is on GitHub, reminders show when you run npx chomik check.\nOnce it is, run npx chomik@latest again to add the nightly check.\n');
    console.log('Next: open your coding agent here, Claude Code or GitHub Copilot, and type\n/chomik. It will show you around and help you leave your first reminder.');
  } else if (installed === VERSION && written.every((target) => target === WORKFLOW)) {
    console.log(`Done. Commit ${WORKFLOW} and push it to your main branch:\nfrom then on GitHub checks your reminders every night.`);
  } else {
    console.log(`Done. chomik is now ${VERSION}.`);
    console.log(`Feel free to share chomik with your team: commit ${toCommit}.`);
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

// The top entry of the installed changelog names the skill's version in readable
// form, so a newer skill is recognized even by an installer that cannot know its hashes.
function changelogVersion() {
  const file = join(TARGET, 'CHANGELOG.md');
  if (!existsSync(file)) return '';
  const top = /^## \[(\d+\.\d+\.\d+)\]/m.exec(readFileSync(file, 'utf8'));
  return top ? top[1] : '';
}

function releasedVersionOf(file, hash) {
  return Object.keys(RELEASED).find((version) => RELEASED[version][file] === hash);
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

// Only for typos, so a distance of two edits at most.
function closest(word, candidates) {
  const distance = (a, b) => {
    const row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let previous = row[0];
      row[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const current = row[j];
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
        previous = current;
      }
    }
    return row[b.length];
  };
  const best = candidates.map((c) => [c, distance(word, c)]).sort((x, y) => x[1] - y[1])[0];
  return best && best[1] <= 2 ? best[0] : '';
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
