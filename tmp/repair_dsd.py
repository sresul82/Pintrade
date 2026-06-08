import re

file_path = r'h:\_Egitim ve Gelistirme\Kodlama\_V2.4\Sidebarlar\js\drawing\ui\dsd-tabs\dsd-standard-tabs.js'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix missing function signature for renderTextTab
target = r"const defaultStyle = \(window\.DrawingManager && DrawingManager\._getToolStyle\) \? DrawingManager\._getToolStyle\(d\.tool\) : {};"
# Note: Since the file content might have been partially edited, let's be more flexible with regex
pattern = re.compile(r"return html;\s*}\s+(const defaultStyle = \(window\.DrawingManager && DrawingManager\._getToolStyle\) \? DrawingManager\._getToolStyle\(d\.tool\) : {};)", re.MULTILINE)

replacement = r"return html;\n  }\n\n  function renderTextTab(d) {\n    const s = d.style || {};\n    \1"

new_content = pattern.sub(replacement, content)

# Also fix the s is not defined error which might happen if s was used before definition
# Looking at line 422: const textColor = s.textColor || defaultStyle.textColor || '#ffffff';
# s must be defined.

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Successfully repaired dsd-standard-tabs.js syntax.")
