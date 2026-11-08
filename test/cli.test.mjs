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
  assert.match(stdout, /\n\nchomik just moved in\. Say hi: start a new session of your coding agent in this project and type \/chomik\.\n$/);
  assert.match(stdout, /Feel free to share chomik with your team/);
  assert.deepEqual(readdirSync(join(root, SKILL_DIR)).sort(), ['SKILL.md', 'setup.md', 'README.md', SCRIPT, 'chomik-workflow.yml'].sort());
  for (const file of ['SKILL.md', 'setup.md', 'README.md', SCRIPT, 'chomik-workflow.yml'].sort()) assert.ok(readFileSync(join(root, SKILL_DIR, file)).equals(template(file)));
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
  assert.match(stdout, /\n\nchomik learned some new tricks\. Say hi: start a new session of your coding agent in this project and type \/chomik\.\n$/);
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

test('--version prints the package version', () => {
  const { code, stdout } = run(project(), ['--version']);
  assert.equal(code, 0);
  assert.equal(stdout.trim(), VERSION);
});

test('an unknown argument such as the old "init" fails on stderr', () => {
  const { code, stdout, stderr } = run(project(), ['init']);
  assert.equal(code, 1);
  assert.match(stderr, /unknown argument "init"/);
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
