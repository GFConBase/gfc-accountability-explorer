import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ignoredDirs = new Set(['.git', '.netlify', 'node_modules', 'coverage', 'dist']);
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

const forbiddenEnvFiles = files.filter((file) => {
  const name = path.basename(file);
  return /^\.env(?:\..+)?$/u.test(name) && name !== '.env.example';
});
if (forbiddenEnvFiles.length) {
  throw new Error(`Real environment file found: ${forbiddenEnvFiles.map((file) => path.relative(root, file)).join(', ')}`);
}

if (fs.existsSync(path.join(root, 'node_modules'))) {
  throw new Error('node_modules must not be included in the repository archive.');
}
if (fs.existsSync(path.join(root, '.netlify'))) {
  throw new Error('.netlify must not be included in the repository archive.');
}

const secretPatterns = [
  { name: 'private key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u },
  { name: 'seed phrase', pattern: /(?:seed phrase|mnemonic)\s*[:=]\s*[a-z]+(?:\s+[a-z]+){11,}/iu },
  { name: 'OpenAI-style API token', pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/u },
  { name: 'GitHub token', pattern: /\bghp_[A-Za-z0-9]{30,}\b/u },
  { name: 'Slack token', pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/u },
];

for (const file of files) {
  const stat = fs.statSync(file);
  if (stat.size > 2_000_000) continue;
  let content;
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  for (const rule of secretPatterns) {
    if (rule.pattern.test(content)) {
      throw new Error(`Potential ${rule.name} in ${path.relative(root, file)}.`);
    }
  }
}

for (const locale of ['de', 'en']) {
  const html = fs.readFileSync(path.join(root, `partials/${locale}/explorer/explorer.html`), 'utf8');
  for (const match of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/giu)) {
    if (!/rel="[^"]*noopener[^"]*noreferrer[^"]*"/iu.test(match[0])) {
      throw new Error(`${locale}: external target=_blank link lacks noopener noreferrer.`);
    }
  }
}

const browserSource = [
  ...files.filter((file) => file.includes(`${path.sep}js${path.sep}explorer${path.sep}`)),
  ...files.filter((file) => file.includes(`${path.sep}partials${path.sep}`) && file.endsWith('.html')),
].map((file) => fs.readFileSync(file, 'utf8')).join('\n');

for (const secretName of ['OPENAI_API_KEY', 'GRAPH_API_KEY']) {
  if (browserSource.includes(secretName)) {
    throw new Error(`${secretName} must not appear in browser source.`);
  }
}

console.log(`Security audit passed: ${files.length} repository files scanned; no embedded secrets or forbidden local deployment state found.`);
