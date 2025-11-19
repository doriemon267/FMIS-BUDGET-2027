Migration scripts
=================

normalize-recipient-userids.js
------------------------------

This script normalizes `recipientUserId` values in the `notifications` collection.
It writes the normalized value to `recipientUserIdNormalized` and keeps the original in `recipientUserIdOriginal`.

Usage (local or dev):

1. Set your environment variables (MONGODB_BUDGET_URL etc.)
2. Run:

```bash
npm run --prefix SERVER migrate:normalize-recipient-ids
```

Notes:
- The script attempts to skip emails and UUID-like identifiers. It's designed to normalize role-like strings (e.g. 'Budget Manager' -> 'BUDGET_MANAGER').
- The project adds a Mongoose pre-save and pre-insertMany hook to auto-normalize recipient IDs for newly created notifications; the migration script is only required for legacy data.
