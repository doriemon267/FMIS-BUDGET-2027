Organize SERVER/utils
=====================

This small helper script classifies JavaScript files in this `SERVER/utils` folder and offers a safe, reversible way to move likely test/debug/maintenance scripts into subfolders.

Files created
- `organize-utils.js` - Scans files, prints a dry-run plan by default, and can move files when run with `apply`.

How it classifies
- `tests` - files whose names or contents include `test`, `debug`, `check`, `demo`, `example`, or contain test frameworks (mocha/jest) or `console.log` hints.
- `experimental` - small one-off scripts (import/generator/processor), maintenance or backup scripts.
- `keep` - files that look like core utilities (not moved).

Usage
- Dry run (preview only):
  node organize-utils.js
- Apply moves (prompts for confirmation):
  node organize-utils.js apply

Notes & safety
- The script moves files using filesystem rename. It's reversible via git if you haven't committed yet. Always review the dry-run plan first.
- If you'd like different classification rules, edit the heuristics at the top of `organize-utils.js`.

Follow-ups
- I can run the script and show the preview. If you'd like, I can apply the moves and open a PR or show the git diff.
