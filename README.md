# find-eslint-rule-knowlege

```
#Install:
npx skills add pillsilly/find-eslint-rule-knowledge -g
```

> Provide precise, version-aligned explanations\fix-examples for core ESLint rules.

This skill resolves and caches core ESLint rule documentation from the upstream `eslint/eslint` repository and produces concise summaries tailored to the ESLint version used by a workspace.

## What it does

- Resolves the exact ESLint version used by a workspace (from `package-lock.json`).
- Locates the corresponding rule doc under `docs/src/rules/<rule>.md` in the ESLint repo.
- Caches source docs and synthesized summaries under the workspace `.tmp/eslint-rule-knowledge/` directory.
- Produces a structured summary: rule, meaning, why it triggers, how to fix, examples, trade-offs, and source.

## When to use

Use this skill when you need an authoritative, version-correct explanation for a core ESLint rule (for example: `no-unused-vars`, `eqeqeq`, `prefer-const`). Do not use this skill for non-core rules from plugins — the skill only covers core `eslint/eslint` rules.

## Quick usage

From the skill directory run the bundled resolver script (point `--workspace` to your project root):

```bash
node scripts/resolve_eslint_rule_doc.js --workspace /path/to/workspace --rule no-unused-vars
```

The resolver prints JSON including `eslintVersion`, `ruleId`, `isCoreRule`, `docFound`, `docPath`, `cacheDir`, `sourceCachePath`, and `summaryCachePath`.

## Smoke test

To sanity-check the resolver end-to-end (workspace-local default + `--eslint-repo` override), run:

```bash
node scripts/smoke_test_eslint_rule_knowledge.js
```

If `docFound` is true, the skill will read the cached `source.md` and synthesize a `summary.md` at:

```
.tmp/eslint-rule-knowledge/<eslint-version>/<rule-id>/summary.md
```

## Summary format

Summaries follow this structure:

- Rule: id and ESLint version
- Meaning: what the rule enforces or prevents
- Why it triggers: typical code shapes that cause violations
- How to fix: common, safe fixes first
- Examples: one failing and one passing snippet
- Trade-offs: readability, correctness, false positives, migration cost
- Source: local doc path and cache location

## Caching and safety

- Cache location: `.tmp/eslint-rule-knowledge/` in the target workspace, including the auto-cloned ESLint repo at `.tmp/eslint-rule-knowledge/eslint-repo`.
- Key format: `<eslint-version>:<rule-id>` — prefer cached summaries when present.
- Do not reset or rewrite the cached ESLint repo; resolve docs via git tags and cache results instead.

## Contribution

If you improve the resolver or summary logic, add tests and update `scripts/resolve_eslint_rule_doc.js` accordingly. Keep behavior conservative: do not invent repo-backed guidance for non-core rules.

## Example requests

- "What does ESLint `no-unused-vars` actually mean here?"
- "Explain `eqeqeq` with trade-offs and show how to fix this lint error."
- "Cache the knowledge for `prefer-const` from the exact ESLint version we use."

---

For full implementation details and usage patterns, see the skill's `SKILL.md`.
