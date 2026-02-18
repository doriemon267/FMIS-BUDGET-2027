#!/usr/bin/env node
/**
 * Reads commit message from stdin, removes lines starting with "Co-authored-by:",
 * writes result to stdout. Used by git filter-branch --msg-filter.
 */
const chunks = [];
process.stdin.on('data', (chunk) => chunks.push(chunk));
process.stdin.on('end', () => {
  const msg = Buffer.concat(chunks).toString('utf8');
  const lines = msg.split(/\r?\n/);
  const out = lines.filter((line) => !line.match(/^\s*Co-authored-by:\s*/i)).join('\n');
  // Trim trailing newlines but keep single trailing newline if original had one
  process.stdout.write(out.replace(/\n+$/, '') + '\n');
});
