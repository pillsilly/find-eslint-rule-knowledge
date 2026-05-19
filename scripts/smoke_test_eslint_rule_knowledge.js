#!/usr/bin/env node
/**
 * Dependency-free smoke test for the ESLint rule knowledge resolver.
 *
 * It validates:
 * - workspace-local default ESLint repo checkout path
 * - `--eslint-repo` override behavior
 * - caching output under `.tmp/eslint-rule-knowledge/`
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const eslintVersion = '8.0.0';
const ruleId = 'no-unused-vars';

function runGit(args, cwd) {
  execFileSync('git', args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  });
}

function writeFakeRuleDoc(repoPath, docContent) {
  const docDir = path.join(repoPath, 'docs', 'src', 'rules');
  fs.mkdirSync(docDir, { recursive: true });
  fs.writeFileSync(path.join(docDir, `${ruleId}.md`), docContent, 'utf8');
}

function initGitRepoWithTag(repoPath, tagName) {
  fs.mkdirSync(repoPath, { recursive: true });
  runGit(['init', '-q'], repoPath);
  runGit(['add', '-A'], repoPath);
  execFileSync(
    'git',
    [
      '-c',
      'user.name=Test User',
      '-c',
      'user.email=test@example.com',
      'commit',
      '-q',
      '-m',
      'init',
    ],
    { cwd: repoPath, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' }
  );
  runGit(['tag', tagName], repoPath);
}

function writeWorkspacePackageLock(workspacePath) {
  const pkg = {
    name: 'smoke-test-workspace',
    lockfileVersion: 3,
    packages: {
      '': { dependencies: { eslint: eslintVersion } },
      [`node_modules/eslint`]: { version: eslintVersion },
    },
  };
  fs.writeFileSync(path.join(workspacePath, 'package-lock.json'), JSON.stringify(pkg), 'utf8');
}

function runResolver({ workspacePath, eslintRepoOverride }) {
  const resolverScript = path.join(__dirname, 'resolve_eslint_rule_doc.js');

  const args = [
    resolverScript,
    '--workspace',
    workspacePath,
    '--rule',
    ruleId,
  ];
  if (eslintRepoOverride) {
    args.push('--eslint-repo', eslintRepoOverride);
  }

  const stdout = execFileSync(process.execPath, args, {
    cwd: path.resolve(__dirname, '..'),
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  }).trim();

  const parsed = JSON.parse(stdout);
  return parsed;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readFileIfExists(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

function assertOutputMatches({ payload, expectedRepoPath, expectedDocContent }) {
  assert(payload.eslintRepoPath === expectedRepoPath, `Unexpected eslintRepoPath. Got ${payload.eslintRepoPath}`);
  assert(payload.docFound === true, `Expected docFound=true for ${ruleId}`);
  assert(
    payload.docPath === `v${eslintVersion}:docs/src/rules/${ruleId}.md`,
    `Unexpected docPath: ${payload.docPath}`
  );

  assert(fs.existsSync(payload.sourceCachePath), `Missing sourceCachePath: ${payload.sourceCachePath}`);
  const cached = readFileIfExists(payload.sourceCachePath);
  assert(cached && cached.includes(expectedDocContent), 'Cached source.md does not match expected content');

  assert(fs.existsSync(payload.indexPath), `Missing indexPath: ${payload.indexPath}`);
}

const keepTemp = process.env.KEEP_TEMP === '1';
const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'eslint-rule-knowledge-smoke-'));

let workspacePath = null;
try {
  workspacePath = path.join(tmpBase, 'workspace');
  fs.mkdirSync(workspacePath, { recursive: true });
  writeWorkspacePackageLock(workspacePath);

  const defaultRepoPath = path.join(
    workspacePath,
    '.tmp',
    'eslint-rule-knowledge',
    'eslint-repo'
  );

  const defaultDocContent = 'DEFAULT_DOC_CONTENT';
  writeFakeRuleDoc(defaultRepoPath, defaultDocContent);
  initGitRepoWithTag(defaultRepoPath, `v${eslintVersion}`);

  const overrideRepoPath = path.join(tmpBase, 'custom-eslint-repo');
  const overrideDocContent = 'OVERRIDE_DOC_CONTENT';
  writeFakeRuleDoc(overrideRepoPath, overrideDocContent);
  initGitRepoWithTag(overrideRepoPath, `v${eslintVersion}`);

  // 1) Default case: no `--eslint-repo`
  const defaultPayload = runResolver({ workspacePath });
  assertOutputMatches({
    payload: defaultPayload,
    expectedRepoPath: defaultRepoPath,
    expectedDocContent: defaultDocContent,
  });

  // 2) Override case: explicit `--eslint-repo`
  const overridePayload = runResolver({
    workspacePath,
    eslintRepoOverride: overrideRepoPath,
  });
  assertOutputMatches({
    payload: overridePayload,
    expectedRepoPath: overrideRepoPath,
    expectedDocContent: overrideDocContent,
  });

  // A bit of human-friendly confirmation for debugging.
  console.log('Smoke test passed:', {
    eslintVersion,
    ruleId,
    defaultRepoPath: defaultPayload.eslintRepoPath,
    overrideRepoPath: overridePayload.eslintRepoPath,
  });
} catch (err) {
  console.error('Smoke test FAILED');
  console.error(err && err.stack ? err.stack : String(err));
  if (!keepTemp) fs.rmSync(tmpBase, { recursive: true, force: true });
  process.exit(1);
}

if (!keepTemp) {
  fs.rmSync(tmpBase, { recursive: true, force: true });
}

