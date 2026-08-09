import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Pattern for label with id
patt1 = r'<label style="[^"]*">\s*<input type="checkbox" id="(cb-[a-zA-Z0-9_]+)" checked> Open Discord\s*</label>'
# Pattern for label without id
patt2 = r'<label style="[^"]*">\s*<input type="checkbox" checked> Open Discord\s*</label>'

def repl1(m):
    id_val = m.group(1)
    return f'<label class="discord-toggle-label">\n                                    <input type="checkbox" class="discord-toggle-checkbox" id="{id_val}" checked> <span class="discord-toggle-text">Open Discord</span>\n                                </label>'

content = re.sub(patt1, repl1, content)

counter = 1
def repl2(m):
    global counter
    id_val = f'cb-generic-{counter}'
    counter += 1
    return f'<label class="discord-toggle-label">\n                                    <input type="checkbox" class="discord-toggle-checkbox" id="{id_val}" checked> <span class="discord-toggle-text">Open Discord</span>\n                                </label>'

content = re.sub(patt2, repl2, content)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated checkboxes in index.html")
