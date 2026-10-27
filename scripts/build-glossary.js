#!/usr/bin/env node
'use strict';

/*
 * Builds public/glossary.json from docs/GLOSSARY.md so the in-app Help panel
 * and the written glossary cannot drift apart. Run after editing the markdown:
 *   node scripts/build-glossary.js
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'docs', 'GLOSSARY.md');
const TARGET = path.join(ROOT, 'public', 'glossary.json');

function clean(value) {
  return String(value || '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normaliseTerm(value) {
  return clean(value).replace(/\.$/, '').trim();
}

function tableDefinition(headers, cells) {
  const parts = [];
  cells.forEach((cell, index) => {
    const value = clean(cell);
    if (!value) return;
    const label = clean(headers[index + 1] || '');
    parts.push(label ? `${label}: ${value}` : value);
  });
  return parts.join(' ');
}

function addEntry(entries, term, category, definition) {
  const name = normaliseTerm(term);
  const text = clean(definition);
  if (!name || !text || name.length > 80) return;
  const key = `${name.toLowerCase()}::${category}`;
  const existing = entries.find((entry) => `${entry.term.toLowerCase()}::${entry.category}` === key);
  if (existing) {
    if (!existing.definition.includes(text)) existing.definition += ` ${text}`;
    return;
  }
  const keywords = [name, ...text.match(/[A-Z][A-Z0-9_]{2,}/g) || []].slice(0, 12);
  entries.push({ term: name, category, definition: text, keywords: Array.from(new Set(keywords)) });
}

function parse(markdown) {
  const lines = markdown.split(/\r?\n/);
  const entries = [];
  let category = 'Overview';
  let inTable = false;
  let tableHeaders = [];

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const line = raw.trim();

    if (/^##\s+/.test(line)) {
      category = clean(line.replace(/^##\s+/, ''));
      inTable = false;
      tableHeaders = [];
      continue;
    }
    if (/^###\s+/.test(line)) {
      inTable = false;
      tableHeaders = [];
      continue;
    }

    if (/^\|/.test(line)) {
      const cells = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
      if (cells.every((cell) => /^:?-{2,}:?$/.test(cell) || cell === '')) continue;
      if (!inTable) {
        inTable = true;
        tableHeaders = cells;
        continue;
      }
      const term = cells[0];
      if (!term) continue;
      addEntry(entries, term, category, tableDefinition(tableHeaders, cells.slice(1)));
      continue;
    }
    inTable = false;
    tableHeaders = [];

    const bold = line.match(/^(?:[-*]\s+)?\*\*([^*]+)\*\*\s*(?:\([^)]*\))?\s*[—–-]\s+(.+)$/);
    if (bold) {
      addEntry(entries, bold[1], category, bold[2]);
      continue;
    }

    // "### How the You panel syncs" prose is covered by the field table. The
    // numbered lists and long paragraphs stay in the markdown only.
  }

  const counts = new Map();
  entries.forEach((entry) => counts.set(entry.category, (counts.get(entry.category) || 0) + 1));
  // Small sections read better at the top of the category chips.
  const order = ['Quick disambiguation', 'The eight rooms', 'Signals, Vault, and clusters', 'The Gate: statuses and lifecycle', 'Verdicts', 'Price vocabulary', 'Budget and the spend ledger', 'Library vocabulary', 'Rules vocabulary', 'You (personal context)', 'Capture and promotion', 'Router and background work', 'Data, security, and deployment', 'The numbers in the seeded demo'];
  entries.sort((a, b) => {
    const ai = order.indexOf(a.category);
    const bi = order.indexOf(b.category);
    if (ai !== bi) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    return 0;
  });

  return {
    title: 'Stashov Glossary',
    generated_from: 'docs/GLOSSARY.md',
    counts: Object.fromEntries(Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]))),
    terms: entries
  };
}

const markdown = fs.readFileSync(SOURCE, 'utf8');
const glossary = parse(markdown);
if (glossary.terms.length < 40) {
  console.error(`Only parsed ${glossary.terms.length} terms; refusing to overwrite the glossary.`);
  process.exit(1);
}
fs.writeFileSync(TARGET, `${JSON.stringify(glossary, null, 2)}\n`);
console.log(`Wrote ${path.relative(ROOT, TARGET)} with ${glossary.terms.length} terms across ${Object.keys(glossary.counts).length} categories.`);
