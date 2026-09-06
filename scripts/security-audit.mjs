import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ignoredDirs = new Set(['.git', 'dist', 'node_modules', 'audit-artifacts']);
const ignoredFiles = new Set(['package-lock.json']);
const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (!ignoredFiles.has(entry.name)) files.push(full);
  }
}
walk(root);

const forbiddenNames = files.filter((file) => /^\.env(?:\..+)?$/u.test(path.basename(file)) && path.basename(file) !== '.env.example');
if (forbiddenNames.length) throw new Error(`Real environment file found: ${forbiddenNames.join(', ')}`);
if (fs.existsSync(path.join(root, 'node_modules'))) throw new Error('node_modules must not be included in the repository output.');

const secretPatterns = [
  { name: 'private key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u },
  { name: 'seed phrase label', pattern: /(?:seed phrase|mnemonic)\s*[:=]\s*[a-z]+(?:\s+[a-z]+){11,}/iu },
  { name: 'common API token', pattern: /\b(?:sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{30,}|xox[baprs]-[A-Za-z0-9-]{20,})\b/u },
  { name: 'hardcoded bearer', pattern: /authorization\s*[:=]\s*["']Bearer\s+[A-Za-z0-9._-]{20,}["']/iu },
];

for (const file of files) {
  const stat = fs.statSync(file);
  if (stat.size > 2_000_000) continue;
  const content = fs.readFileSync(file, 'utf8');
  for (const rule of secretPatterns) {
    if (rule.pattern.test(content)) throw new Error(`Potential ${rule.name} in ${path.relative(root, file)}.`);
  }
}

const html = fs.readFileSync(path.join(root, 'web', 'index.html'), 'utf8');
for (const match of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/giu)) {
  if (!/rel="[^"]*noopener[^"]*noreferrer[^"]*"/iu.test(match[0])) {
    throw new Error(`External target=_blank link lacks noopener noreferrer: ${match[0]}`);
  }
}

const allText = files
  .filter((file) => fs.statSync(file).size < 2_000_000)
  .map((file) => fs.readFileSync(file, 'utf8'))
  .join('\n');

for (const claim of [/\bproduction[- ]ready\b/iu, /\bindependently audited\b/iu, /\blive mainnet\b/iu]) {
  if (claim.test(allText)) throw new Error(`Potentially misleading status claim found: ${claim}`);
}

console.log(`Security audit passed: ${files.length} repository files scanned; no embedded secrets or banned high-risk patterns found.`);
