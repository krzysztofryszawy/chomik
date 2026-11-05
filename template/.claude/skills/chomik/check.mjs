#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const DIR = '.chomik';
const REMINDER_NAME = /^(\d{4})-(\d{2})-(\d{2})-[a-z0-9][a-z0-9-]*\.md$/;
const PROMPT_HEADING = /^#{1,6}\s+prompt\b/i;
const MAX_LINES = 40;

const env = process.env;
const inActions = env.GITHUB_ACTIONS === 'true';
const branch = argValue('--branch');
const enforce = inActions && Boolean(branch) && env.GITHUB_REF_TYPE === 'branch' && env.GITHUB_REF_NAME === branch;

try {
  process.exitCode = run();
} catch (error) {
  console.log(`chomik: checker error: ${error.message}`);
  process.exitCode = enforce ? 2 : 0;
}

function run() {
  let entries;
  try {
    entries = readdirSync(DIR, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return 0;
    throw error;
  }

  const today = new Date().toISOString().slice(0, 10);
  const due = [];
  const invalid = [];

  // Symbolic links and folders are skipped on purpose, so the check never reads outside .chomik.
  for (const entry of entries.filter((e) => e.isFile() && e.name.endsWith('.md')).sort(byName)) {
    const match = REMINDER_NAME.exec(entry.name);
    if (!match || !isRealDate(match[1], match[2], match[3])) {
      invalid.push(entry.name);
    } else if (entry.name.slice(0, 10) <= today) {
      due.push(entry.name);
    }
  }

  if (due.length === 0 && invalid.length === 0) return 0;

  if (inActions) {
    if (due.length) console.log('::error title=chomik::chomik sent a message from the past');
    if (invalid.length) console.log('::error title=chomik::chomik found an invalid reminder file');
  }

  // Reminder text is untrusted, so GitHub workflow commands are switched off while it is printed.
  const token = inActions ? randomUUID() : null;
  if (token) console.log(`::stop-commands::${token}`);

  if (due.length) {
    console.log('chomik sent a message from the past');
    for (const name of due) {
      console.log('');
      console.log(join(DIR, name));
      console.log(humanPart(readFileSync(join(DIR, name), 'utf8')));
    }
    console.log('');
    console.log('Resolve and delete the file, or move the date in its name with a reason.');
    console.log('Optional: a ready prompt for an agent is in the "Prompt" section of the file.');
  }

  if (invalid.length) {
    console.log('');
    console.log('chomik found an invalid reminder file (expected .chomik/YYYY-MM-DD-name.md):');
    for (const name of invalid) console.log(`  ${join(DIR, name)}`);
  }

  console.log('');
  console.log('Run locally: node .chomik/check.mjs');
  if (!enforce) {
    console.log(branch
      ? `Not failing: the build fails only in GitHub Actions on branch "${branch}".`
      : 'Not failing: no branch given with --branch.');
  }

  if (token) console.log(`::${token}::`);

  if (!enforce) return 0;
  return invalid.length ? 2 : 1;
}

function humanPart(text) {
  const lines = [];
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    if (PROMPT_HEADING.test(line)) break;
    lines.push(line);
  }
  while (lines.length && lines.at(-1).trim() === '') lines.pop();
  if (lines.length > MAX_LINES) return [...lines.slice(0, MAX_LINES), '...'].join('\n');
  return lines.join('\n');
}

function isRealDate(year, month, day) {
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.getUTCFullYear() === Number(year)
    && date.getUTCMonth() === Number(month) - 1
    && date.getUTCDate() === Number(day);
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function byName(a, b) {
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}
