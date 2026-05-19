---
name: find-eslint-rule-knowledge
description: "Use when the user asks what a core ESLint rule means, why an ESLint lint error happens, how to fix a core ESLint rule violation, what trade-offs a core ESLint rule has, or wants examples grounded in the exact ESLint version used by the current project. Also use when the user wants local, version-aligned ESLint rule documentation cached under the workspace .tmp directory."
---

# ESLint Rule Knowledge

Use this skill to answer questions about core ESLint rules from the upstream ESLint repository instead of guessing from memory.

This skill is specifically for core ESLint rules documented in the `eslint/eslint` repository. If the rule comes from a plugin such as `@typescript-eslint`, `@angular-eslint`, `eslint-plugin-import`, or another non-core package, do not pretend it is covered by this skill. Say that the rule is not a core ESLint rule and stop unless the user asks for a broader search strategy.

## What this skill does

1. Ensures a local clone of `eslint/eslint` exists under the workspace cache at `.tmp/eslint-rule-knowledge/eslint-repo`.
2. Reads the exact ESLint version used by the current workspace from `package-lock.json`.
3. Resolves the exact ESLint git tag for the version used by the current project without destructively rewriting the cached checkout.
4. Locates the matching rule documentation under `docs/src/rules/<rule>.md`.
5. Caches the source doc and lookup metadata under the workspace `.tmp/eslint-rule-knowledge/` directory.
6. Produces a concise explanation of the rule: meaning, why it triggers, how to fix it, examples, and trade-offs.

## Required input

You need all of the following before answering:

- The workspace root, for example `/path/to/workspace`
- The ESLint rule id, for example `no-unused-vars`
- A local `package-lock.json` in that workspace

If the user only pasted an ESLint error line, extract the rule id from the trailing token when possible.

## First step: resolve and cache the rule doc

Run the bundled resolver script first (run from the skill directory or the workspace).

```bash
# Use the Node.js resolver in the skill's `scripts/` folder:
node scripts/resolve_eslint_rule_doc.js --workspace /path/to/workspace --rule no-unused-vars
```

The script prints JSON with:

- `eslintVersion`
- `ruleId`
- `isCoreRule`
- `docFound`
- `docPath`
- `cacheDir`
- `sourceCachePath`
- `summaryCachePath`
- `indexPath`
- `gitRef`

## How to answer after resolution

If `isCoreRule` is false:

- Tell the user this is not a core ESLint rule.
- State that the local ESLint repo docs only cover core rules.
- Do not invent guidance from memory as if it came from the repo.

If `docFound` is false:

- Tell the user no matching core-rule doc was found for that ESLint version.
- Mention the resolved version and looked-up rule id.
- Stop unless the user asks for fallback behavior.

If `docFound` is true:

1. Read the cached source markdown from `sourceCachePath`.
2. Synthesize the knowledge into a concise summary.
3. Save that summary to `summaryCachePath` so later searches can reuse it.

## Summary format

Use this structure unless the user asks for something else:

### Rule
- rule id
- exact ESLint version

### Meaning
- what the rule is trying to prevent or enforce

### Why it triggers
- what code shape usually causes the violation

### How to fix
- the safest/common fixes first
- configuration or disablement only if the rule doc meaningfully supports that choice

### Examples
- one short failing example
- one short passing example

### Trade-offs
- readability, correctness, consistency, false positives, migration cost, or stylistic constraints

### Source
- local doc path used
- cache location

## Caching rules

Cache everything under the workspace `.tmp` directory:

- `.tmp/eslint-rule-knowledge/index.json`
- `.tmp/eslint-rule-knowledge/<eslint-version>/<rule-id>/source.md`
- `.tmp/eslint-rule-knowledge/<eslint-version>/<rule-id>/summary.md`

The resolver script maintains the index and source-doc cache. After you produce a summary, write it to `summary.md` so future sessions can search it quickly.

## Search behavior

Prefer cached knowledge first when the exact key already exists:

- key format: `<eslint-version>:<rule-id>`

If there is already a cached `summary.md`, you can use it directly and only re-open the source doc if the user asks for more detail.

## Safety and repo handling

- Do not hard reset or discard changes in the cached ESLint repo under `.tmp/eslint-rule-knowledge/eslint-repo`.
- Do not switch the cached checkout's working tree to another version.
- Resolve docs from the exact git tag for the workspace's ESLint version and cache the result under `.tmp`.
- If the repo does not exist, the resolver may clone it.

## Good defaults

- Assume the workspace-local `.tmp/eslint-rule-knowledge/eslint-repo` checkout is the preferred source repo path.
- Assume `package-lock.json` is at the workspace root.
- Treat rule ids containing `/` as non-core unless you have explicit evidence otherwise.

## Example requests that should trigger this skill

- "What does ESLint `no-unused-vars` actually mean here?"
- "Explain `eqeqeq` with trade-offs and show me how to fix this lint error."
- "Use the ESLint repo docs for the version in this project and tell me what `no-prototype-builtins` is about."
- "Cache the knowledge for `prefer-const` from the exact ESLint version we use."
