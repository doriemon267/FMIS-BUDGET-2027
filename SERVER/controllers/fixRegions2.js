const fs = require('fs');
let code = fs.readFileSync('tierController.js', 'utf8');

// Undo duplicate addAmount (the one at line 306)
const dupStart = '    // Combine and structure the data';
const dupEnd = '      regionalData[region][lineItemId].total += amount;\n    };';
const idx1 = code.lastIndexOf(dupStart);
if (idx1 > 150) {
    code = code.substring(0, idx1) + code.substring(idx1 + dupEnd.length + 100);
}

// Fix the region push
code = code.replace(
    /regionalBreakdown\.regions = \['CENTRAL OFFICE', \.\.\.Array\.from\(regionNamesSet\)\.filter\(n => n !== 'CENTRAL OFFICE'\)\.sort\(\), 'TOTAL REGIONS'\];/,
    "regionalBreakdown.regions = [...Array.from(regionNamesSet).sort(), 'TOTAL REGIONS'];"
);

fs.writeFileSync('tierController.js', code);
console.log('Fixed regions array');
