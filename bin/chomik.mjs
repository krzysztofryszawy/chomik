#!/usr/bin/env node
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(PACKAGE_ROOT, 'template', '.claude', 'skills', 'chomik');
const TARGET_DIRS = ['.claude', join('.claude', 'skills'), join('.claude', 'skills', 'chomik')];
const TARGET = TARGET_DIRS.at(-1);
const FILES = ['SKILL.md', 'check.mjs'];

const args = process.argv.slice(2);
const command = args.find((a) => !a.startsWith('-'));

try {
  if (args.includes('--version')) {
    console.log(JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8')).version);
  } else if (command === 'init') {
    process.exitCode = await init(args.includes('--yes'));
  } else {
    console.log('Usage: npx chomik init [--yes]');
    console.log('Adds the chomik skill to this project in .claude/skills/chomik/.');
    process.exitCode = command ? 1 : 0;
  }
} catch (error) {
  console.log(`chomik: ${error.message}`);
  process.exitCode = 1;
}

async function init(yes) {
  if (!existsSync('package.json')) {
    console.log('chomik: no package.json here. Run this in the root of a Node project.');
    return 1;
  }

  // Refuse symbolic links on the way, so chomik never writes outside the project.
  for (const path of [...TARGET_DIRS, ...FILES.map((f) => join(TARGET, f))]) {
    if (isLink(path)) {
      console.log(`chomik: ${path} is a symbolic link; refusing to write through it.`);
      return 1;
    }
  }

  const plan = FILES.map((file) => {
    const source = readFileSync(join(SOURCE, file));
    const target = join(TARGET, file);
    const action = !existsSync(target) ? 'create' : readFileSync(target).equals(source) ? 'unchanged' : 'update';
    return { file, target, source, action };
  });

  if (plan.every((p) => p.action === 'unchanged')) {
    console.log('chomik is already installed in this project and up to date.');
    return 0;
  }

  console.log('chomik will change only these files in this project:');
  for (const p of plan) if (p.action !== 'unchanged') console.log(`  ${p.action} ${p.target}`);
  console.log('Nothing else is changed. No dependencies are added.');

  if (!yes) {
    if (!process.stdin.isTTY) {
      console.log('chomik: run this in a terminal to confirm, or add --yes.');
      return 1;
    }
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = (await rl.question('Continue? (y/N) ')).trim().toLowerCase();
    rl.close();
    if (answer !== 'y' && answer !== 'yes') {
      console.log('Nothing was changed.');
      return 0;
    }
  }

  mkdirSync(TARGET, { recursive: true });
  for (const p of plan) if (p.action !== 'unchanged') writeFileSync(p.target, p.source);

  console.log('Done. Open your coding agent in this project and type /chomik.');
  console.log('Commit .claude/skills/chomik/ to share it with your team.');
  return 0;
}

function isLink(path) {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}
