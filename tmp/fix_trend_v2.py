import re

file_path = r'h:\_Egitim ve Gelistirme\Kodlama\_V2.4\Sidebarlar\js\drawing\tools\drawing-trend.js'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Regression Trend Price Label Injection
# Look for the R: text draw logic and insert labels before it
regression_label_logic = """
      // Price labels for Regression Trend
      if (s.priceLabel !== false) {
        if (p1pt.regPrice != null) _drawPriceLabel(ctx, p1pt.regPrice, p1py, pane, s.color || '#2962ff');
        if (p2pt.regPrice != null) _drawPriceLabel(ctx, p2pt.regPrice, p2py, pane, s.color || '#2962ff');
      }
"""
if "Price labels for Regression Trend" not in content:
    content = content.replace("      // — Pearson's R metni —", regression_label_logic + "\n      // — Pearson's R metni —")

# 2. Parallel Channel Price Label Injection
# Look for levels rendering logic
channel_label_logic = """
      // Price labels for Parallel Channel
      if (s.priceLabel !== false) {
        if (d.p1.price != null) _drawPriceLabel(ctx, d.p1.price, a.y, pane, s.color || '#2962ff');
        if (d.p2.price != null) _drawPriceLabel(ctx, d.p2.price, b.y, pane, s.color || '#2962ff');
      }
"""
if "Price labels for Parallel Channel" not in content:
    content = content.replace("    // Text rendering logic for Parallel Channel", channel_label_logic + "\n    // Text rendering logic for Parallel Channel")

# 3. Ensure all text fallbacks are still white (double check)
content = re.sub(r"s\.textColor\s*\|\|\s*(s\.color\s*\|\|\s*)?['\"]#a3a6af['\"]", "s.textColor || '#ffffff'", content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully injected Price Label logic and updated fallbacks.")
