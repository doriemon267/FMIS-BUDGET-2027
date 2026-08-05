const fs = require('fs');
let code = fs.readFileSync('tierController.js', 'utf8');

// 1. Fix drawHeaders
const oldHeaderFuncStart = '    const drawHeaders = (y) => {';
const oldHeaderFuncEnd = '      recipe.rectangle(35, y + 40, TABLE_WIDTH, 1, { fill: [0, 0, 0] });\n    };';

const newHeaderFunc = \    const drawHeaders = (y) => {
      // Draw background for entire header (height 50)
      recipe.rectangle(35, y, TABLE_WIDTH, 50, { fill: '#eaeaea' });
      
      // "PARTICULAR" text, centered vertically in the 50px header
      recipe.text("PARTICULAR", 40, y + 25, { bold: true, fontSize: 10, color: [0, 0, 0] });
      
      groups.forEach((g, i) => {
        const startX = 240 + (i * GROUP_WIDTH);
        
        // Group Name (e.g. GRAND TOTAL) - Row 1
        const gWidth = recipe.textDimensions(g, { bold: true, fontSize: 8 }).width || (g.length * 4);
        recipe.text(g, startX + (GROUP_WIDTH / 2) - (gWidth / 2), y + 10, { bold: true, fontSize: 8, color: [0, 0, 0] });
        
        // Col 1: Projected Corporate Income [a]
        recipe.text("PROJECTED CORPORATE", startX + 5, y + 26, { bold: true, fontSize: 6, color: [0, 0, 0] });
        recipe.text("INCOME [a]", startX + 5, y + 34, { bold: true, fontSize: 6, color: [0, 0, 0] });
        
        // Col 2: Projected Subsidy (Spans 3 cols) - Row 2
        recipe.text("PROJECTED SUBSIDY", startX + SUB_COL_WIDTH + 5, y + 24, { bold: true, fontSize: 7, color: [0, 0, 0] });
        
        // Tier 1 - Row 3
        recipe.text("TIER 1", startX + SUB_COL_WIDTH + 5, y + 38, { bold: true, fontSize: 6, color: [0, 0, 0] });
        recipe.text("[b]", startX + SUB_COL_WIDTH + 5, y + 46, { bold: true, fontSize: 6, color: [0, 0, 0] });
        
        // Tier 2 - Row 3
        recipe.text("TIER 2", startX + (SUB_COL_WIDTH * 2) + 5, y + 38, { bold: true, fontSize: 6, color: [0, 0, 0] });
        recipe.text("[c]", startX + (SUB_COL_WIDTH * 2) + 5, y + 46, { bold: true, fontSize: 6, color: [0, 0, 0] });
        
        // Total - Row 3
        recipe.text("TOTAL", startX + (SUB_COL_WIDTH * 3) + 5, y + 38, { bold: true, fontSize: 6, color: [0, 0, 0] });
        recipe.text("[d = b + c]", startX + (SUB_COL_WIDTH * 3) + 5, y + 46, { bold: true, fontSize: 6, color: [0, 0, 0] });
        
        // Col 5: Proposed Budget [e = a + d]
        recipe.text("PROPOSED", startX + (SUB_COL_WIDTH * 4) + 5, y + 26, { bold: true, fontSize: 6, color: [0, 0, 0] });
        recipe.text("BUDGET [e = a + d]", startX + (SUB_COL_WIDTH * 4) + 5, y + 34, { bold: true, fontSize: 6, color: [0, 0, 0] });
        
        // Horizontal line under PROJECTED SUBSIDY (spans from Tier 1 to Total)
        recipe.rectangle(startX + SUB_COL_WIDTH, y + 30, SUB_COL_WIDTH * 3, 1, { fill: [0, 0, 0] });
        
        // Vertical lines for sub-columns
        // Between Corporate Income and Tier 1 (starts from y + 16, height 34)
        recipe.rectangle(startX + SUB_COL_WIDTH, y + 16, 1, 34, { fill: [0, 0, 0] });
        
        // Between Tier 1 and Tier 2 (starts from y + 30, height 20)
        recipe.rectangle(startX + (SUB_COL_WIDTH * 2), y + 30, 1, 20, { fill: [0, 0, 0] });
        
        // Between Tier 2 and Total (starts from y + 30, height 20)
        recipe.rectangle(startX + (SUB_COL_WIDTH * 3), y + 30, 1, 20, { fill: [0, 0, 0] });
        
        // Between Total and Proposed Budget (starts from y + 16, height 34)
        recipe.rectangle(startX + (SUB_COL_WIDTH * 4), y + 16, 1, 34, { fill: [0, 0, 0] });
      });

      // Group borders (vertical lines for each group) - height 50
      groupStartBorderX.forEach(x => {
        recipe.rectangle(x, y, 1, 50, { fill: [0, 0, 0] });
      });
      
      // Rightmost border for PARTICULAR column
      recipe.rectangle(240, y, 1, 50, { fill: [0, 0, 0] });
      
      // Top border of header
      recipe.rectangle(35, y, TABLE_WIDTH, 1, { fill: [0, 0, 0] });
      
      // Horizontal line under Group Names
      recipe.rectangle(240, y + 16, TABLE_WIDTH - 205, 1, { fill: [0, 0, 0] });
      
      // Bottom border of header
      recipe.rectangle(35, y + 50, TABLE_WIDTH, 1, { fill: [0, 0, 0] });
    };\;

const startIdx = code.indexOf(oldHeaderFuncStart);
const endIdx = code.indexOf(oldHeaderFuncEnd) + oldHeaderFuncEnd.length;

if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
  code = code.substring(0, startIdx) + newHeaderFunc + code.substring(endIdx);
  // Also fix the initial curY advance
  code = code.replace('    drawHeaders(curY);\n    curY += 40;', '    drawHeaders(curY);\n    curY += 50;');
}

// 2. Fix the lookup to be robust
const lookupReg = /const rData = regionalBreakdown\.data\[r\]\?\.\[lineItem\.lineItemId\];/g;
const robustLookup = \const targetKey = String(lineItem.lineItemId).trim().toLowerCase().replace(/\\s+/g, ' ');
             const rMap = regionalBreakdown.data[r] || {};
             const actualKey = Object.keys(rMap).find(k => k.trim().toLowerCase().replace(/\\s+/g, ' ') === targetKey);
             const rData = actualKey ? rMap[actualKey] : null;\;

code = code.replace(lookupReg, robustLookup);

// 3. Fix the sub-total lookup
const subTotalReg = /const data = regionalBreakdown\.data\[rName\]\?\.\[item\.lineItemId\];/g;
const robustSubTotalLookup = \const targetKey2 = String(item.lineItemId).trim().toLowerCase().replace(/\\s+/g, ' ');
             const rMap2 = regionalBreakdown.data[rName] || {};
             const actualKey2 = Object.keys(rMap2).find(k => k.trim().toLowerCase().replace(/\\s+/g, ' ') === targetKey2);
             const data = actualKey2 ? rMap2[actualKey2] : null;\;

code = code.replace(subTotalReg, robustSubTotalLookup);

// 4. Shrink the table width for Folio Size by scaling
code = code.replace('const scale = Math.min(1, maxW / TABLE_WIDTH);', 'const scale = Math.min(0.9, maxW / TABLE_WIDTH);');

fs.writeFileSync('tierController.js', code);
console.log('Fixed tierController.js completely!');
