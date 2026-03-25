#!/usr/bin/env node
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DEFAULT_REPO = path.resolve('/code/3rdparty/eslint');
const REPO_URL = 'https://github.com/eslint/eslint.git';

function run(cmd, args, cwd) {
  try {
    return execFileSync(cmd, args, { cwd: cwd || undefined, encoding: 'utf8' }).trim();
  } catch (err) {
    const msg = (err.stderr || err.stdout || err.message || '').toString().trim();
    throw new Error(msg || `command failed: ${cmd} ${args.join(' ')}`);
  }
}

function loadPackageLock(workspace) {
  const packageLock = path.join(workspace, 'package-lock.json');
  if (!fs.existsSync(packageLock)) throw new Error(`package-lock.json not found under ${workspace}`);
  return JSON.parse(fs.readFileSync(packageLock, 'utf8'));
}

function resolveEslintVersion(packageLockJson) {
  const packages = packageLockJson.packages || {};
  if (packages['node_modules/eslint'] && packages['node_modules/eslint'].version) return packages['node_modules/eslint'].version;
  const root = packages[''] || {};
  for (const bucket of ['dependencies', 'devDependencies']) {
    if (root[bucket] && root[bucket].eslint) return root[bucket].eslint;
  }
  throw new Error('Unable to find eslint version in package-lock.json');
}

function ensureBaseRepo(repoPath) {
  if (fs.existsSync(repoPath)) return;
  fs.mkdirSync(path.dirname(repoPath), { recursive: true });
  run('git', ['clone', REPO_URL, repoPath]);
}

function ensureTagAvailable(baseRepo, version) {
  const tagName = `v${version}`;
  try {
    run('git', ['rev-parse', '--verify', tagName], baseRepo);
    return tagName;
  } catch (err) {
    run('git', ['fetch', '--tags', '--force'], baseRepo);
    run('git', ['rev-parse', '--verify', tagName], baseRepo);
    return tagName;
  }
}

function readRuleDocFromTag(baseRepo, gitRef, ruleId) {
  return run('git', ['show', `${gitRef}:docs/src/rules/${ruleId}.md`], baseRepo);
}

function sanitizeRuleId(ruleId) {
  return ruleId.trim();
}

function isCoreRule(ruleId) {
  return ruleId && ruleId.indexOf('/') === -1;
}

function updateIndex(indexPath, payload) {
  const dir = path.dirname(indexPath);
  fs.mkdirSync(dir, { recursive: true });
  let index = {};
  if (fs.existsSync(indexPath)) {
    try { index = JSON.parse(fs.readFileSync(indexPath, 'utf8')); } catch (e) { index = {}; }
  }
  index[payload.cacheKey] = payload;
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');
}

function main() {
  const argv = process.argv.slice(2);
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--workspace') args.workspace = argv[++i];
    else if (a === '--rule') args.rule = argv[++i];
    else if (a === '--eslint-repo') args.eslintRepo = argv[++i];
  }
  if (!args.workspace || !args.rule) {
    console.error('Usage: resolve_eslint_rule_doc.js --workspace <workspace> --rule <rule> [--eslint-repo <path>]');
    process.exit(2);
  }

  const workspace = path.resolve(args.workspace);
  const ruleId = sanitizeRuleId(args.rule);
  const repoPath = path.resolve(args.eslintRepo || DEFAULT_REPO);

  const packageLockJson = loadPackageLock(workspace);
  const eslintVersion = resolveEslintVersion(packageLockJson);

  const cacheRoot = path.join(workspace, '.tmp', 'eslint-rule-knowledge');
  const indexPath = path.join(cacheRoot, 'index.json');
  const versionRuleDir = path.join(cacheRoot, eslintVersion, ruleId.replace('/', '__'));
  fs.mkdirSync(versionRuleDir, { recursive: true });

  const sourceCachePath = path.join(versionRuleDir, 'source.md');
  const summaryCachePath = path.join(versionRuleDir, 'summary.md');

  const coreRule = isCoreRule(ruleId);
  let docPath = null;
  let gitRef = null;
  let docFound = false;

  if (coreRule) {
    ensureBaseRepo(repoPath);
    gitRef = ensureTagAvailable(repoPath, eslintVersion);
    try {
      const sourceDoc = readRuleDocFromTag(repoPath, gitRef, ruleId);
      docFound = true;
      docPath = `${gitRef}:docs/src/rules/${ruleId}.md`;
      fs.writeFileSync(sourceCachePath, sourceDoc, 'utf8');
    } catch (err) {
      docFound = false;
    }
  }

  const now = new Date().toISOString();
  const payload = {
    cacheKey: `${eslintVersion}:${ruleId}`,
    workspace,
    packageLockPath: path.join(workspace, 'package-lock.json'),
    eslintVersion,
    ruleId,
    isCoreRule: coreRule,
    docFound,
    docPath: docPath || null,
    cacheDir: versionRuleDir,
    sourceCachePath,
    summaryCachePath,
    indexPath,
    gitRef,
    eslintRepoPath: repoPath,
    cachedAt: now,
  };

  updateIndex(indexPath, payload);
  console.log(JSON.stringify(payload, null, 2));
}

if (require.main === module) {
  try { main(); } catch (err) { console.error(err.message || String(err)); process.exit(1); }
}
