import re

with open('script.js', 'r', encoding='utf-8') as f:
    code = f.read()

# Add saveData() at the end of specific functions by matching their closing brace.
def inject(func_regex, replacement):
    global code
    code = re.sub(func_regex, replacement, code, flags=re.MULTILINE)

inject(r'updateFlaggedBadge\(\);\s*\}', 'updateFlaggedBadge();\n            saveData();\n        }')
inject(r'renderRoster\(\);\s*\}', 'renderRoster();\n            saveData();\n        }')
inject(r'renderHCBonus\(\);\s*\}', 'renderHCBonus();\n            saveData();\n        }')
inject(r'if\(appState\.currentTab === \'dashboard\'\) renderDashboard\(\);\s*\}', 'if(appState.currentTab === \\\'dashboard\\\') renderDashboard();\n                saveData();\n            }')
inject(r'closeModal\(\'modal-bonus\'\);\s*\}', 'closeModal(\\\'modal-bonus\\\');\n            saveData();\n        }')
inject(r'recalculateEverything\(\);\s*\}', 'recalculateEverything();\n            saveData();\n        }')

# Target channels functions (added recently)
inject(r'if\(appState\.currentTab === \'discord-hub\'\) renderIngestionHub\(\);\s*\}', 'if(appState.currentTab === \\\'discord-hub\\\') renderIngestionHub();\n            saveData();\n        }')

# Check toggleChannelStatus
inject(r'renderChannelsTable\(\);\s*\}\s*\}', 'renderChannelsTable();\n                saveData();\n            }\n        }')


with open('script.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("Injections complete")
