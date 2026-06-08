import re

file_path = r'h:\_Egitim ve Gelistirme\Kodlama\_V2.4\Sidebarlar\js\drawing\tools\drawing-trend.js'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. replace s.textColor || '#a3a6af' or s.textColor || s.color || '#a3a6af' with #ffffff
content = re.sub(r"s\.textColor\s*\|\|\s*(s\.color\s*\|\|\s*)?['\"]#a3a6af['\"]", "s.textColor || '#ffffff'", content)

# 2. replace ctx.fillStyle = '#a3a6af'; (hint cases)
content = re.sub(r"(ctx\.fillStyle\s*=\s*)['\"]#a3a6af['\"](\s*;\s*//\s*hint)", r"\1'#ffffff'\2", content)
content = re.sub(r"(ctx\.fillStyle\s*=\s*)['\"]#a3a6af['\"](\s*;)", r"\1'#ffffff'\2", content) # generic fallback labels

# Specific for _drawTrendStats (Satır 596 ve 599)
content = content.replace("ctx.fillStyle = '#a3a6af';", "ctx.fillStyle = '#ffffff';")
content = content.replace("ctx.strokeStyle = '#a3a6af';", "ctx.strokeStyle = '#ffffff';")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully updated drawing-trend.js using Python Regex.")
