# Secrets handling and recommended workflow

This document describes how to securely manage secrets for the FMIS server, with immediate steps to remove the currently committed `MAIL_PASSWORD` and recommended longer-term best practices.

## Immediate steps (do this now)

1. **Rotate the exposed Gmail app password**
   - Login to the Gmail account (Google Account > Security > App passwords) and revoke the compromised app password, then create a new app password.
   - Record the new app password in your preferred secrets store (see options below).

2. **Remove the tracked `SERVER/.env` file from git history (prevents future commits)**
   - Untrack the file while keeping a local copy:

```bash
# Run from repository root
git rm --cached SERVER/.env
git commit -m "chore(secrets): remove tracked SERVER/.env and replace with placeholder"
# Push the commit
git push origin <your-branch>
```

> Note: This removes the current file from the index but does not remove it from past commits. If the password was ever committed to public or shared history, consider rewriting history with `git filter-repo` or `bfg` to purge it and coordinate with your team.

3. **Set the new MAIL_PASSWORD as an environment secret on your server/CI**
   - Example: systemd (Linux)

```ini
# /etc/systemd/system/fmis.service (EnvironmentFile style)
[Service]
Environment="MAIL_PASSWORD=super-secret-app-password"
```

   - Example: Docker Compose

```yaml
services:
  server:
    image: your-image
    secrets:
      - mail_password
secrets:
  mail_password:
    external: true
```

   - Example: GitHub Actions (Repository/Environment secret): set `MAIL_PASSWORD` in the secrets UI and reference it in workflow via `${{ secrets.MAIL_PASSWORD }}`.

4. **For local development**
   - Keep a local-only `.env.local` with your dev secrets (this repo's `.gitignore` already excludes `.env.local`). DO NOT commit this file.

## Recommended approaches (pick one)

- **Server environment variables (recommended, simplest)**: set secrets in the hosting environment or process manager.
- **Cloud-managed secrets**: AWS Secrets Manager, Azure Key Vault, or Google Secret Manager – good for rotation and auditing.
- **SOPS / git-crypt**: encrypt `.env` and allow safe repo commits with access control via GPG/KMS.
- **Dotenv Vault / secrets tooling**: developer-friendly solutions for teams.

## Code-level safety measures

- `index.js` now performs a production-time check to ensure required `MAIL_*` vars are present; the server will exit during startup in production if these are missing.
- `emailNotification.js` throws a helpful error when the transporter is not configured; this prevents silent failures.

## Additional notes

- If the exposed password has been shared or committed publicly, treat it as compromised and rotate immediately.
- If you want, I can help add SOPS or configure your CI to fetch secrets (I can provide a PR and CI snippets).

---
If you'd like, I can proceed to run `git rm --cached SERVER/.env` and create a commit for you (I can add the commit message and changes) — tell me if you want me to make those git operations or prefer to run them locally.
