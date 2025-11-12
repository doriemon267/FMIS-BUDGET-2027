#!/usr/bin/env python3
import re

file_path = r'd:\DREED\FMIS-BUDGET-SEPTEMBER\SERVER\controllers\proposalController.js'

# Read the file
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find and replace both occurrences of "const consolidateDrafts = async" with "const consolidateDrafts = "
new_lines = []
for i, line in enumerate(lines):
    if 'const consolidateDrafts = async (proposals) => {' in line:
        # Replace async version with sync version
        new_lines.append(line.replace('const consolidateDrafts = async (proposals) => {', 'const consolidateDrafts = (proposals) => {'))
        print(f"✅ Replaced async at line {i+1}")
    elif 'finalProposals = await consolidateDrafts(finalProposals)' in line:
        # Remove await
        new_lines.append(line.replace('finalProposals = await consolidateDrafts(finalProposals)', 'finalProposals = consolidateDrafts(finalProposals)'))
        print(f"✅ Removed await at line {i+1}")
    else:
        new_lines.append(line)

# Write back
with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("✅ File updated!")
