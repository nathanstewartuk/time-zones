# time-zones.net

Regression suite lives in `tests/` (Playwright). Run it after every edit or new feature - before considering any change done, and again after merging changes from parallel agents/worktrees.

```bash
npm install        # first time only, or after package.json changes
npx playwright test
```

All 4 projects (`ios-light`, `ios-dark`, `desktop-light`, `desktop-dark`) must pass. iOS is this site's primary platform - desktop is secondary/regression-only. If the two genuinely disagree on expected behavior, iOS wins.

Run a single file with `npx playwright test <filename>`. `tests/helpers.mjs` has the dial-geometry/pixel-sampling utilities the specs use - read it before writing new tests so you reuse them instead of re-deriving canvas angle math (a past source of real bugs in this project).

**`CLAUDE_CODE_MAX_OUTPUT_TOKENS` is locked at 8192, org-managed, cannot be raised.** Large rewrites error out mid-generation. Write new files in small pieces (a short skeleton `Write`, then incremental `Edit` calls) instead of one giant `Write`.
