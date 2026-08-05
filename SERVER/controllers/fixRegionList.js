const fs = require('fs');
let code = fs.readFileSync('tierController.js', 'utf8');

// Replace hardcoded CENTRAL OFFICE
code = code.replace(
  /regionalBreakdown\.regions = \['CENTRAL OFFICE', \.\.\.Array\.from\(regionNamesSet\)\.filter\(n => n !== 'CENTRAL OFFICE'\)\.sort\(\), 'TOTAL REGIONS'\];/g,
  \egionalBreakdown.regions = [...Array.from(regionNamesSet).sort(), 'TOTAL REGIONS'];\
);

// We should also remove the explicit handling of CENTRAL OFFICE in the loop to just treat it like any other region!
// Actually, no, the explicit handling was added by someone (me?) earlier:
// if (r !== 'CENTRAL OFFICE' && r !== 'TOTAL REGIONS') { ... }
// We can just leave that be, but remove the hardcoded push!

fs.writeFileSync('tierController.js', code);
console.log('Removed hardcoded Central Office');
