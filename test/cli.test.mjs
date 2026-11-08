import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

const BIN = resolve('bin/chomik.mjs');
const TEMPLATE = resolve('template/.claude/skills/chomik');
const SKILL_DIR = join('.claude', 'skills', 'chomik');
const VERSION = JSON.parse(readFileSync('package.json', 'utf8')).version;
const RELEASED = JSON.parse(readFileSync('bin/released-files.json', 'utf8'));

function project({ packageJson = true, git = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'chomik-cli-'));
  if (packageJson) writeFileSync(join(root, 'package.json'), '{"name":"app"}\n');
  if (git) {
    gitIn(root, 'init', '-q');
    gitIn(root, 'add', '-A');
    gitIn(root, 'commit', '-qm', 'init');
  }
  return root;
}

function gitIn(root, ...args) {
  execFileSync('git', ['-c', 'user.email=test@example.invalid', '-c', 'user.name=test', ...args], { cwd: root });
}

function run(root, args) {
  const result = spawnSync(process.execPath, [BIN, ...args], { cwd: root, encoding: 'utf8', input: '' });
  return { code: result.status, out: result.stdout + result.stderr, stdout: result.stdout, stderr: result.stderr };
}

const skillFile = (root) => join(root, SKILL_DIR, 'SKILL.md');
const template = (file) => readFileSync(join(TEMPLATE, file));
const SCRIPT = 'looking-for-messages-from-the-past.mjs';

test('npx chomik --yes installs exactly the two skill files', () => {
  const root = project();
  const { code, stdout } = run(root, ['--yes']);
  assert.equal(code, 0);
  assert.match(stdout, new RegExp(`Installing chomik ${VERSION.replaceAll('.', '\\.')} in this project`));
  assert.match(stdout, /create\s+\.claude\/skills\/chomik\/SKILL\.md/);
  assert.match(stdout, /\n\nchomik just moved in\.\nFirst time with chomik\? Paste this into a new session of your coding agent:\n {2}Read https:\/\/github\.com\/krzysztofryszawy\/chomik and explain with its examples .*Do not change anything\.\nThen type \/chomik there to set it up\.\n$/);
  assert.match(stdout, /Feel free to share chomik with your team/);
  assert.deepEqual(readdirSync(join(root, SKILL_DIR)).sort(), ['SKILL.md', 'setup.md', 'README.md', 'CHANGELOG.md', SCRIPT, 'chomik-workflow.yml'].sort());
  for (const file of ['SKILL.md', 'setup.md', 'README.md', 'CHANGELOG.md', SCRIPT, 'chomik-workflow.yml'].sort()) assert.ok(readFileSync(join(root, SKILL_DIR, file)).equals(template(file)));
  assert.deepEqual(readdirSync(root).sort(), ['.claude', 'package.json']);
});

test('running again reports that everything is up to date', () => {
  const root = project();
  run(root, ['--yes']);
  const { code, stdout } = run(root, ['--yes']);
  assert.equal(code, 0);
  assert.match(stdout, new RegExp(`chomik ${VERSION.replaceAll('.', '\\.')} is already here and up to date`));
});

test('an unedited older release is updated and shows the versions', () => {
  const tag = (() => {
    try {
      return execFileSync('git', ['tag', '--list', 'v*', '--sort=-v:refname'], { encoding: 'utf8' }).split('\n')[0];
    } catch {
      return '';
    }
  })();
  if (!tag) return;
  const oldFile = (file) => execFileSync('git', ['show', `${tag}:template/.claude/skills/chomik/${file}`]);
  if (oldFile('SKILL.md').equals(template('SKILL.md'))) return;
  const root = project();
  mkdirSync(join(root, SKILL_DIR), { recursive: true });
  const oldFiles = Object.keys(RELEASED[tag.slice(1)]);
  for (const file of oldFiles) writeFileSync(join(root, SKILL_DIR, file), oldFile(file));
  const version = tag.slice(1).replaceAll('.', '\\.');
  const { code, stdout } = run(root, ['--yes']);
  assert.equal(code, 0);
  assert.match(stdout, new RegExp(`Updating chomik in this project: ${version} -> `));
  assert.match(stdout, new RegExp(`\\n\\nchomik learned some new tricks\\. Curious which\\? Paste this into a new session of your coding agent:\\n {2}Read \\.claude/skills/chomik/CHANGELOG\\.md and tell me briefly what changed since chomik ${version} and what it means .*Do not change anything\\.\\n$`));
  assert.match(stdout, /update\s+\.claude\/skills\/chomik\/SKILL\.md/);
  assert.ok(readFileSync(skillFile(root)).equals(template('SKILL.md')));
});

test('uncommitted edits block the whole update and nothing is written', () => {
  const root = project({ git: true });
  run(root, ['--yes']);
  gitIn(root, 'add', '-A');
  gitIn(root, 'commit', '-qm', 'chomik');
  writeFileSync(skillFile(root), 'my uncommitted edit');
  writeFileSync(join(root, SKILL_DIR, SCRIPT), 'old');
  const { code, stderr } = run(root, ['--yes']);
  assert.equal(code, 1);
  assert.match(stderr, /would be lost for good/);
  assert.equal(readFileSync(skillFile(root), 'utf8'), 'my uncommitted edit');
  assert.equal(readFileSync(join(root, SKILL_DIR, SCRIPT), 'utf8'), 'old');
});

test('edits in a project without git block the update', () => {
  const root = project();
  run(root, ['--yes']);
  writeFileSync(skillFile(root), 'my edit');
  const { code, stderr } = run(root, ['--yes']);
  assert.equal(code, 1);
  assert.match(stderr, /would be lost for good/);
  assert.equal(readFileSync(skillFile(root), 'utf8'), 'my edit');
});

test('committed edits are replaced with a note, since git keeps them', () => {
  const root = project({ git: true });
  run(root, ['--yes']);
  writeFileSync(skillFile(root), 'my committed edit');
  gitIn(root, 'add', '-A');
  gitIn(root, 'commit', '-qm', 'customize');
  const { code, stdout } = run(root, ['--yes']);
  assert.equal(code, 0);
  assert.match(stdout, /replace\s+.*SKILL\.md \(edited here; your committed changes stay in git history\)/);
  assert.ok(readFileSync(skillFile(root)).equals(template('SKILL.md')));
});

test('--force overwrites edits that are not committed', () => {
  const root = project();
  run(root, ['--yes']);
  writeFileSync(skillFile(root), 'my edit');
  const { code } = run(root, ['--yes', '--force']);
  assert.equal(code, 0);
  assert.ok(readFileSync(skillFile(root)).equals(template('SKILL.md')));
});

test('--dry-run shows the plan and writes nothing', () => {
  const root = project();
  const { code, stdout } = run(root, ['--dry-run']);
  assert.equal(code, 0);
  assert.match(stdout, /create/);
  assert.match(stdout, /Dry run: nothing was changed/);
  assert.equal(existsSync(join(root, '.claude')), false);
});

test('without a terminal and without --yes nothing is written', () => {
  const root = project();
  const { code, stderr } = run(root, []);
  assert.equal(code, 1);
  assert.match(stderr, /add --yes/);
  assert.equal(existsSync(join(root, '.claude')), false);
});

test('refuses to run outside a Node project', () => {
  const root = project({ packageJson: false });
  const { code, stderr } = run(root, ['--yes']);
  assert.equal(code, 1);
  assert.match(stderr, /no package\.json/);
  assert.equal(existsSync(join(root, '.claude')), false);
});

test('refuses to write through a symbolic link', () => {
  const root = project();
  const outside = mkdtempSync(join(tmpdir(), 'chomik-outside-'));
  symlinkSync(outside, join(root, '.claude'));
  const { code, stderr } = run(root, ['--yes']);
  assert.equal(code, 1);
  assert.match(stderr, /symbolic link/);
  assert.deepEqual(readdirSync(outside), []);
});

test('other files under .claude are left untouched', () => {
  const root = project();
  mkdirSync(join(root, '.claude', 'skills', 'other'), { recursive: true });
  writeFileSync(join(root, '.claude', 'skills', 'other', 'SKILL.md'), 'keep me');
  run(root, ['--yes']);
  assert.equal(readFileSync(join(root, '.claude', 'skills', 'other', 'SKILL.md'), 'utf8'), 'keep me');
});

test('--help and -h print help and write nothing', () => {
  for (const flag of ['--help', '-h']) {
    const root = project();
    const { code, stdout } = run(root, [flag]);
    assert.equal(code, 0);
    assert.match(stdout, /Usage: npx chomik@latest \[options\]/);
    assert.match(stdout, /\.claude\/skills\/chomik\/README\.md/);
    assert.equal(existsSync(join(root, '.claude')), false);
  }
});

test('check runs the project\'s check script and passes outside CI', () => {
  const root = project();
  mkdirSync(join(root, '.chomik'));
  writeFileSync(join(root, '.chomik', SCRIPT), template(SCRIPT));
  const { code, stdout } = run(root, ['check']);
  assert.equal(code, 0);
  assert.match(stdout, /^chomik: no reminders in \.chomik\/ yet\./);
});

test('check in a project without chomik introduces it with a prompt for an agent', () => {
  const { code, stdout, stderr } = run(project(), ['check']);
  assert.equal(code, 1);
  assert.equal(stdout, '');
  assert.match(stderr, /^chomik is not in this project yet\.\n\nBulletproof reminders/);
  assert.match(stderr, /Give chomik a chance to impress you: npx chomik@latest\nCurious first\? Paste this into your coding agent:\n {2}Read https:\/\/github\.com\/krzysztofryszawy\/chomik /);
});

test('check with the skill installed but not set up says how to finish', () => {
  const root = project();
  run(root, ['--yes']);
  const { code, stderr } = run(root, ['check']);
  assert.equal(code, 1);
  assert.equal(stderr, 'chomik is installed here, but its setup is not finished yet.\nTo finish, type /chomik in your coding agent.\n');
});

test('the check pitch opens the README word for word', () => {
  const pitch = /const PITCH = `([^`]*)`/.exec(readFileSync(BIN, 'utf8'))[1];
  assert.ok(readFileSync('README.md', 'utf8').includes(`\n\n${pitch}\n\n`));
});

function setUp(root, script = template(SCRIPT)) {
  run(root, ['--yes']);
  mkdirSync(join(root, '.chomik'));
  writeFileSync(join(root, '.chomik', SCRIPT), script);
}

test('check adds nothing when the skill and its copies match', () => {
  const root = project();
  setUp(root);
  const { code, stdout } = run(root, ['check']);
  assert.equal(code, 0);
  assert.doesNotMatch(stdout, /To update/);
});

test('check says when the copies are older than the skill', () => {
  const root = project();
  setUp(root, template(SCRIPT).toString('utf8').replace(`chomik ${VERSION}:`, 'chomik 0.1.0:'));
  const { code, stdout } = run(root, ['check']);
  assert.equal(code, 0);
  assert.match(stdout, /\n\nchomik was updated, but its copies here are still 0\.1\.0\. To update them, type \/chomik in your coding agent\.\n$/);
});

test('check says when a newer chomik is out than the skill in the project', () => {
  const tag = (() => {
    try {
      return execFileSync('git', ['tag', '--list', 'v*', '--sort=-v:refname'], { encoding: 'utf8' }).split('\n')[0];
    } catch {
      return '';
    }
  })();
  if (!tag || tag.slice(1) === VERSION) return;
  const root = project();
  mkdirSync(join(root, SKILL_DIR), { recursive: true });
  for (const file of Object.keys(RELEASED[tag.slice(1)])) {
    writeFileSync(join(root, SKILL_DIR, file), execFileSync('git', ['show', `${tag}:template/.claude/skills/chomik/${file}`]));
  }
  mkdirSync(join(root, '.chomik'));
  writeFileSync(join(root, '.chomik', SCRIPT), template(SCRIPT));
  const { stdout } = run(root, ['check']);
  assert.match(stdout, new RegExp(`\\n\\nchomik ${VERSION.replaceAll('.', '\\.')} is out; this project has ${tag.slice(1).replaceAll('.', '\\.')}\\. To update: npx chomik@latest\\n$`));
});

test('check refuses a check script that is a symbolic link', () => {
  const root = project();
  mkdirSync(join(root, '.chomik'));
  writeFileSync(join(root, 'elsewhere.mjs'), 'console.log("ran")');
  symlinkSync(join(root, 'elsewhere.mjs'), join(root, '.chomik', SCRIPT));
  const { code, stdout } = run(root, ['check']);
  assert.equal(code, 1);
  assert.equal(stdout, '');
});

test('check --help prints help and an unknown check option fails', () => {
  assert.match(run(project(), ['check', '--help']).stdout, /npx chomik check/);
  const { code, stderr } = run(project(), ['check', '--yes']);
  assert.equal(code, 1);
  assert.match(stderr, /unknown argument "--yes"/);
});

test('--version prints the package version', () => {
  const { code, stdout } = run(project(), ['--version']);
  assert.equal(code, 0);
  assert.equal(stdout.trim(), VERSION);
});

test('an unknown argument such as the old "init" fails on stderr', () => {
  const { code, stdout, stderr } = run(project(), ['init']);
  assert.equal(code, 1);
  assert.match(stderr, new RegExp(`unknown argument "init" in chomik ${VERSION.replaceAll('.', '\\.')}\\.\nIf it comes from a newer chomik, try: npx chomik@latest init\n`));
  assert.equal(stdout, '');
});

test('released-files.json matches the files of every release tag in this repository', () => {
  let tags = [];
  try {
    tags = execFileSync('git', ['tag', '--list', 'v*'], { encoding: 'utf8' }).split('\n').filter(Boolean);
  } catch {
    return;
  }
  // The tag of the version being released is the current version, not a past one.
  for (const tag of tags.filter((t) => t !== `v${VERSION}`)) {
    for (const file of Object.keys(RELEASED[tag.slice(1)] ?? { 'SKILL.md': 1 })) {
      const content = execFileSync('git', ['show', `${tag}:template/.claude/skills/chomik/${file}`]);
      const hash = createHash('sha256').update(content).digest('hex');
      assert.equal(RELEASED[tag.slice(1)]?.[file], hash, `${tag} ${file}`);
    }
  }
});


test('the changelog has an entry for the current version', () => {
  assert.match(template('CHANGELOG.md').toString('utf8'), new RegExp(`^## \\[${VERSION.replaceAll('.', '\\.')}\\] - `, 'm'));
});

test('the files copied into a project name the current chomik version', () => {
  for (const file of [SCRIPT, 'chomik-workflow.yml']) assert.match(template(file).toString('utf8').split('\n').slice(0, 2).join('\n'), new RegExp(`🐹 chomik ${VERSION.replaceAll('.', '\\.')}[ :]`));
});

test('the workflow templates pin every action to a full commit SHA', () => {
  for (const file of ['chomik-workflow.yml']) {
    const uses = readFileSync(join(TEMPLATE, file), 'utf8').match(/uses:\s*\S+/g) ?? [];
    assert.ok(uses.length > 0, file);
    for (const line of uses) assert.match(line, /@[0-9a-f]{40}$/, `${file}: ${line}`);
  }
});

test('the workflow template marks its own schedule and uses the shared name', () => {
  const text = readFileSync(join(TEMPLATE, 'chomik-workflow.yml'), 'utf8');
  assert.match(text, /workflow_call:/);
  assert.match(text, /# chomik: only without a daily build, begin\n[\s\S]*schedule:[\s\S]*# chomik: only without a daily build, end/);
  assert.match(text, /^ {2}looking-for-messages-from-the-past:$/m);
  assert.match(text, /node \.chomik\/looking-for-messages-from-the-past\.mjs --branch BRANCH/);
});
