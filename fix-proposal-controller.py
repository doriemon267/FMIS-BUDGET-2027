#!/usr/bin/env python3
import re

# Read the file
with open('d:\\DREED\\FMIS-BUDGET-SEPTEMBER\\SERVER\\controllers\\proposalController.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Fixed code for consolidatedDrafts - simple synchronous version
fixed_consolidatedDrafts = """      // Calculate combined totals for display only - DO NOT create Proposal documents
      // FIXED: These are virtual aggregations for UI, NOT to be persisted to database
      const consolidatedDrafts = Array.from(draftMap.values()).map((draft) => {
        const totalExpenses = (draft.personnelTotal || 0) + (draft.mooeTotal || 0) + (draft.capitalTotal || 0);
        const totalIncome = draft.incomeTotal || 0;
        
        return {
          ...draft,
          totalExpenses,
          totalIncome,
          proposedBudget: totalExpenses + totalIncome,
          Total: totalExpenses + totalIncome,
          aggregatedTitle: `Draft Budget (${draft.includedModels.length} categories)`,
          particulars: draft.includedModels
            .map(m => {
              if (m === 'personnel') return 'Personnel Services';
              if (m === 'mooe') return 'MOOE';
              if (m === 'capital') return 'Capital Outlay';
              if (m === 'income') return 'Corporate Income';
              return m;
            })
            .join(' + ')
        };
      });"""

# Pattern to find the broken/original consolidatedDrafts sections
broken_pattern = r'      // Calculate combined totals for display only - DO NOT create Proposal documents\s+const consolidatedDrafts = Array\.from\(draftMap\.values\(\)\.map\(\s+Array\.from\(draftMap\.values\(\)\.map\(async \(draft\) => \{[^}]*?return \{[^}]*?\};[^}]*?\}[^}]*?\}\);'

# Replace all instances
content_fixed = re.sub(broken_pattern, fixed_consolidatedDrafts, content, flags=re.DOTALL)

# Count replacements
if content_fixed != content:
    print("✅ Fixed broken consolidatedDrafts code")
    # Write back
    with open('d:\\DREED\\FMIS-BUDGET-SEPTEMBER\\SERVER\\controllers\\proposalController.js', 'w', encoding='utf-8') as f:
        f.write(content_fixed)
    print("File saved successfully!")
else:
    print("⚠️ Pattern not found - trying alternative approach")
    
    # Use a simpler approach - find the problematic section
    # Look for: const consolidatedDrafts = Array.from(draftMap.values()).map(\n        Array.from
    pattern2 = r'const consolidatedDrafts = Array\.from\(draftMap\.values\(\)\.map\(\s*Array\.from\(draftMap\.values\(\)\.map\(async'
    
    if re.search(pattern2, content):
        print("Found broken pattern!")
        # This is more careful replacement
        content_fixed = re.sub(
            r'const consolidatedDrafts = Array\.from\(draftMap\.values\(\)\.map\(\s*Array\.from\(draftMap\.values\(\)\.map\(async \(draft\)',
            'const consolidatedDrafts = Array.from(draftMap.values()).map((draft)',
            content
        )
        
        with open('d:\\DREED\\FMIS-BUDGET-SEPTEMBER\\SERVER\\controllers\\proposalController.js', 'w', encoding='utf-8') as f:
            f.write(content_fixed)
        print("✅ Fixed with simpler pattern!")
    else:
        print("❌ Could not find pattern to fix")
