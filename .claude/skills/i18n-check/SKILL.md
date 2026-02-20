---
name: i18n-check
description: Check for missing translation keys across all 6 language packs (EN, FR, DE, IT, KO, RO) in translations.js. Reports which languages are missing which keys and gives a PASS/FAIL verdict.
---

Check the `translations.js` file for missing translation keys across all 6 supported languages.

## Steps

1. Run this Node.js script from the repo root to extract key coverage:

```bash
node -e "
const window = {};
eval(require('fs').readFileSync('translations.js', 'utf8'));
const t = window.DSI18N.translations;
const langs = Object.keys(t);
const enKeys = new Set(Object.keys(t.en));

console.log('EN reference: ' + enKeys.size + ' keys\n');

let allPass = true;
for (const lang of langs) {
  if (lang === 'en') continue;
  const langKeys = new Set(Object.keys(t[lang]));
  const missing = [...enKeys].filter(k => !langKeys.has(k));
  const extra = [...langKeys].filter(k => !enKeys.has(k));
  const status = missing.length === 0 ? 'PASS' : 'FAIL';
  if (missing.length > 0) allPass = false;
  console.log(lang.toUpperCase() + ': ' + langKeys.size + ' keys | missing=' + missing.length + ' | extra=' + extra.length + ' | ' + status);
  if (missing.length > 0) console.log('  Missing: ' + missing.join(', '));
  if (extra.length > 0) console.log('  Extra: ' + extra.join(', '));
}
console.log('\nOverall: ' + (allPass ? 'PASS' : 'FAIL'));
"
```

2. Format the results as a clear report:

```
## i18n Key Coverage Report

EN reference: N keys

| Language | Keys | Missing | Extra | Status |
|----------|------|---------|-------|--------|
| FR       | N    | 0       | 0     | ✅ PASS |
| DE       | N    | 3       | 0     | ⚠️ FAIL |
| IT       | N    | 1       | 0     | ⚠️ FAIL |
| KO       | N    | 0       | 0     | ✅ PASS |
| RO       | N    | 5       | 0     | ⚠️ FAIL |

### Missing Keys Detail
**DE** is missing: `key_name_1`, `key_name_2`, `key_name_3`
**IT** is missing: `key_name_1`
**RO** is missing: `key_name_1`, `key_name_2`, `key_name_3`, `key_name_4`, `key_name_5`

### Verdict
PASS / FAIL — [N] languages complete, [N] have gaps
```

3. If any keys are missing, suggest adding them to `translations.js` by finding the EN value and noting the key names that need translating.

## Key facts about this codebase
- `translations.js` uses the IIFE pattern: `(function initDSI18N(global){...})(window)`
- The translations object lives at `window.DSI18N.translations`
- The 6 language codes are: `en`, `fr`, `de`, `it`, `ko`, `ro`
- EN is the canonical reference — other languages should have every key EN has
