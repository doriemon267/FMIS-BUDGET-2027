#!/usr/bin/env python3

file_path = r'd:\DREED\FMIS-BUDGET-SEPTEMBER\SERVER\controllers\proposalController.js'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines):
    # Remove all await Proposal.findOne calls
    if 'let proposalDoc = await Proposal.findOne(proposalFilter);' in line:
        new_lines.append(line.replace(
            'let proposalDoc = await Proposal.findOne(proposalFilter);',
            '// FIXED: No database lookup - consolidated-draft proposals are virtual only\n          let proposalDoc = {};'
        ))
        print(f"✅ Fixed await at line {i+1}")
    else:
        new_lines.append(line)

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("✅ Done!")
