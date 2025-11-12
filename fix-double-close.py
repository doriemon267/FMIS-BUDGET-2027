#!/usr/bin/env python3

file_path = r'd:\DREED\FMIS-BUDGET-SEPTEMBER\SERVER\controllers\proposalController.js'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the double closing parens/braces
old_pattern = """        })
      );"""

new_pattern = """        });"""

count = content.count(old_pattern)
content = content.replace(old_pattern, new_pattern)

print(f"✅ Fixed {count} instances of double closing")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Done!")
