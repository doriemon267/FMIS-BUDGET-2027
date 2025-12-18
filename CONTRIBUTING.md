# Contributing Guidelines

Thank you for contributing to this repository. To keep the repository focused and avoid committing local or one-off utilities, we follow a small set of rules for which files are tracked in git.

## Files and folders intentionally untracked
- All `*.md` files (documentation is kept out of the code tree for our workflow).  
- Test and helper scripts are intentionally untracked under the following patterns and folders:
  - `test/`, `tests/`, `__tests__/` and `**/test*` patterns
  - `CLIENT/src/components/test/`
  - `SCRIPTS/` (local script helpers)
  - `TEMP_FILES/`
  - `SERVER/tests/`, `SERVER/test-scripts/`, `SERVER/security-scripts/`, `SERVER/scripts/`

These rules are enforced via `.gitignore` so future commits do not accidentally add these files.

## Archive policy
- When we want to clean the repo but keep files available for future reference, we move them into the top-level `archive/` directory while preserving path structure. Files in `archive/` are tracked (committed) so they are available for restore.

How to restore an archived file:
1. Move the file from `archive/<path>` back to its original path in the repo (for example `archive/SERVER/scripts/foo.js` -> `SERVER/scripts/foo.js`).
2. Remove or adjust any matching `.gitignore` rules that would prevent the file from being tracked.
3. git add, commit, and push the restoration.

If you're unsure about a file's purpose, open an issue or mention it in a PR and we can decide whether to restore, keep archived, or remove it permanently.

— Thanks!
