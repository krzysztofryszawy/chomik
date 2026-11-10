#!/usr/bin/env node
// Run right after a release is approved on npm: records the hashes of the released
// files, so the installer recognizes them later, and starts the next version.
// Not part of the npm package.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const SKILL = 'template/.claude/skills/chomik/';
const SCRIPT = 'template/.chomik/looking-for-messages-from-the-past.mjs';
const WORKFLOW = 'template/.github/workflows/chomik.yml';
// The same form the installer writes once the daily build calls chomik.yml.
const OWN_SCHEDULE = /^ *# chomik: only without a daily build, begin\n[\s\S]*?^ *# chomik: only without a daily build, end\n/m;

const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
const tag = `v${version}`;
const released = JSON.parse(readFileSync('bin/released-files.json', 'utf8'));

const stop = (message) => {
  console.error(`after-release: ${message}`);
  process.exit(1);
};
if (released[version]) stop(`${version} is already recorded in bin/released-files.json.`);
if (execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()) stop('commit or stash your changes first.');
try {
  execFileSync('git', ['rev-parse', '--verify', '--quiet', `refs/tags/${tag}`], { stdio: 'ignore' });
} catch {
  stop(`tag ${tag} does not exist; release first.`);
}

const show = (path) => execFileSync('git', ['show', `${tag}:${path}`]);
const sha256 = (content) => createHash('sha256').update(content).digest('hex');
const workflow = show(WORKFLOW).toString('utf8');
released[version] = {
  'SKILL.md': sha256(show(`${SKILL}SKILL.md`)),
  'README.md': sha256(show(`${SKILL}README.md`)),
  'CHANGELOG.md': sha256(show(`${SKILL}CHANGELOG.md`)),
  'looking-for-messages-from-the-past.mjs': sha256(show(SCRIPT)),
  'chomik.yml': sha256(workflow),
  'chomik.yml#called': sha256(workflow.replace(OWN_SCHEDULE, '')),
};
writeFileSync('bin/released-files.json', `${JSON.stringify(released, null, 2)}\n`);

const [major, minor, patch] = version.split('.').map(Number);
const next = `${major}.${minor}.${patch + 1}`;
const replaceIn = (path, from, to) => {
  const text = readFileSync(path, 'utf8');
  if (!text.includes(from)) stop(`"${from}" not found in ${path}.`);
  writeFileSync(path, text.replace(from, to));
};
replaceIn('package.json', `"version": "${version}"`, `"version": "${next}"`);
replaceIn(SCRIPT, `chomik ${version}:`, `chomik ${next}:`);
replaceIn(WORKFLOW, `chomik ${version} `, `chomik ${next} `);

const changelog = `${SKILL}CHANGELOG.md`;
if (major === 0 && minor < 2) {
  writeFileSync(changelog, `# Changelog\n\n## [${next}] - unreleased\n\nA working version before the 0.2.0 beta. Changes are not listed until then.\n`);
} else {
  replaceIn(changelog, '\n## [', `\n## [${next}] - unreleased\n\n## [`);
}

console.log(`Recorded ${version} and started ${next}. Review with git diff, then commit:`);
console.log(`  chore: record ${version} and start ${next}`);
