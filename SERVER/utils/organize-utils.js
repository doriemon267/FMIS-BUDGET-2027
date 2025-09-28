const fs = require('fs');
const path = require('path');

// Organize utils folder: classify files and optionally move them into subfolders
// Usage:
//   node organize-utils.js        # dry run (default)
//   node organize-utils.js apply  # actually move the files

// targetDir: default to this script's directory (utils). Can pass a path to organize another folder.
// Use argv[2] as an optional target unless it's the 'apply' flag.
const doApply = process.argv.includes('apply');
let targetArg = undefined;
if (process.argv.length > 2) {
  // find first arg after the script path (argv[2]) that isn't 'apply'
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a === 'apply') continue;
    targetArg = a;
    break;
  }
}

const root = targetArg && !targetArg.includes('organize-utils.js')
  ? path.resolve(targetArg)
  : path.resolve(__dirname);
const experimentalDir = path.join(root, 'experimental');
const testsDir = path.join(root, 'tests');

function isLikelyTestOrDebug(name, content) {
  const lname = name.toLowerCase();
  if (/\b(test|debug|check|demo|example|dev)\b/.test(lname)) return true;
  if (/\.spec\.js$|\.test\.js$/.test(lname)) return true;
  // content heuristics
  if (!content) return false;
  if (/console\.log\(|assert\(|mocha|jest|chai|describe\(|it\(/i.test(content)) return true;
  if (/temporary|for testing|sample|example|debug/i.test(content)) return true;
  return false;
}

function isLikelyBackupOrMaintenance(name, content) {
  const lname = name.toLowerCase();
  if (/backup|cleanup|verification|progress|paths|restore/.test(lname)) return true;
  if (/backup|cleanup|verify|progress|temporary|temp|archive/i.test(content || '')) return true;
  return false;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
}

function classifyFiles() {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  const files = entries.filter(e => e.isFile() && e.name.endsWith('.js'));
  const classified = [];

  for (const f of files) {
    const filePath = path.join(root, f.name);
    let content = '';
    try { content = fs.readFileSync(filePath, 'utf8'); } catch (e) { /* ignore */ }

    let category = 'keep';
    // Always keep a top-level index.js (common entrypoint)
    if (f.name === 'index.js') {
      classified.push({ name: f.name, path: filePath, category });
      continue;
    }
    if (isLikelyTestOrDebug(f.name, content)) category = 'tests';
    else if (isLikelyBackupOrMaintenance(f.name, content)) category = 'maintenance';
  // fallback: small one-off scripts (heuristic: references to .xlsx or template)
  else if (/\.xlsx|template|import|processor|generator|final_test_template|demo|demo-/i.test(content) || /\.xlsx$/i.test(f.name)) category = 'experimental';

    classified.push({ name: f.name, path: filePath, category });
  }
  return classified;
}

function printPlan(list) {
  console.log('\nReorganization plan for: %s\n', root);
  const groups = list.reduce((acc, it) => {
    acc[it.category] = acc[it.category] || [];
    acc[it.category].push(it.name);
    return acc;
  }, {});

  for (const cat of Object.keys(groups)) {
    console.log('Category: %s', cat);
    for (const n of groups[cat]) console.log('  - %s', n);
    console.log('');
  }
}

function applyMoves(list) {
  ensureDir(experimentalDir);
  ensureDir(testsDir);

  for (const it of list) {
    if (it.category === 'tests') {
      const dest = path.join(testsDir, it.name);
      console.log('Moving %s -> %s', it.name, dest);
      fs.renameSync(it.path, dest);
    } else if (it.category === 'experimental' || it.category === 'maintenance') {
      const dest = path.join(experimentalDir, it.name);
      console.log('Moving %s -> %s', it.name, dest);
      fs.renameSync(it.path, dest);
    }
  }
}

function main() {
  const doApply = process.argv[2] === 'apply';
  const classified = classifyFiles();
  printPlan(classified);

  if (!doApply) {
    console.log('\nDry run only. To perform the moves run: node organize-utils.js apply');
    return;
  }

  // safety: confirm
  const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
  rl.question('Type YES to confirm moving files: ', ans => {
    rl.close();
    if (ans.trim() === 'YES') {
      applyMoves(classified);
      console.log('\nDone. Review changes and commit manually.');
    } else {
      console.log('Aborted by user. No changes made.');
    }
  });
}

if (require.main === module) main();

module.exports = { classifyFiles };
