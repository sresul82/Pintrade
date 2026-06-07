import re

file_path = r'h:\_Egitim ve Gelistirme\Kodlama\_V2.4\Sidebarlar\js\drawing\ui\property-toolbar.js'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace DrawingManager._getToolStyle with window.DrawingManager check
pattern = re.compile(r"DrawingManager\._getToolStyle\(_drawing\.tool\)", re.MULTILINE)
replacement = r"(window.DrawingManager && window.DrawingManager._getToolStyle ? window.DrawingManager._getToolStyle(_drawing.tool) : {})"

new_content = pattern.sub(replacement, content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Successfully secured DrawingManager calls in property-toolbar.js")
