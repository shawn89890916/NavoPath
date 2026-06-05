#!/usr/bin/env python3
"""NavoPath 颜色修正脚本 — 去重灰/深紫, 恢复清爽品牌色"""

import re, os

CSS_PATH = r"D:\233cxy\OneDrive\文档\升学指导\planner-calendar-app\src\styles.css"

with open(CSS_PATH, "r", encoding="utf-8") as f:
    css = f.read()

lines = css.split("\n")
total = len(lines)
print(f"Total lines: {total}")

# ─── 1. :root block (lines 1-41) — 重写 ───
# Replace the entire :root block
new_root = """:root {
  --df-font-brand: "Sora", "Inter", system-ui, sans-serif;
  --df-font-ui: "HarmonyOS Sans SC", "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", system-ui, sans-serif;
  --df-font-task: "Inter", "HarmonyOS Sans SC", "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", system-ui, sans-serif;
  font-family: var(--df-font-ui);
  --color-primary: var(--mode-primary, #C69CF9);
  --color-primary-strong: var(--mode-primary-strong, #8B5CF6);
  --color-primary-soft: var(--mode-primary-soft, #F6EEFF);
  --color-accent: var(--mode-accent, #CAFF72);
  --color-accent-soft: var(--mode-accent-soft, #F3FFD6);
  --color-bg: #F8FAFC;
  --color-bg-tint: #FBF7FF;
  --color-surface: #FFFFFF;
  --color-border: #E5E7EB;
  --color-border-soft: #EEF0F4;
  --color-text: #111827;
  --color-muted: #6B7280;
  --color-faint: #9CA3AF;
  --color-danger: #EF4444;
  --color-warning: #F59E0B;
  --color-success: #10B981;
  color: #111827;
  background: #F8FAFC;
  font-synthesis: none;
  text-rendering: geometricPrecision;
  /* Clean design tokens */
  --nv-radius: 12px;
  --nv-radius-sm: 10px;
  --nv-radius-xs: 8px;
  --nv-shadow: 0 1px 3px rgba(0,0,0,0.04);
  --nv-shadow-sm: 0 1px 2px rgba(0,0,0,0.03);
  --nv-shadow-md: 0 4px 12px rgba(0,0,0,0.06);
  --nv-shadow-hover: 0 8px 20px rgba(198, 156, 249, 0.16);
  --nv-shadow-active: inset 0 1px 2px rgba(0,0,0,0.06);
  --nv-transition: all .15s ease;
}"""

# Find :root block boundaries
root_start = None
root_end = None
brace_count = 0
for i, line in enumerate(lines):
    if root_start is None and line.strip().startswith(":root"):
        root_start = i
        brace_count = line.count("{") - line.count("}")
    elif root_start is not None:
        brace_count += line.count("{") - line.count("}")
        if brace_count <= 0:
            root_end = i
            break

if root_start is not None and root_end is not None:
    lines[root_start:root_end+1] = new_root.split("\n")
    print(f"Replaced :root block (lines {root_start+1}-{root_end+1})")

# ─── 2. body background ───
for i, line in enumerate(lines):
    if "background: linear-gradient(145deg, #eef1f5, #e8ecf1, #eaecf2)" in line and "body" not in line:
        lines[i] = line.replace("background: linear-gradient(145deg, #eef1f5, #e8ecf1, #eaecf2)", "background: #F8FAFC")
    if "background:" in line and "#eef1f5" in line and "#e8ecf1" in line and "linear-gradient" in line:
        lines[i] = line.replace(line.strip(), "background: #F8FAFC;")

# ─── 3. .app-shell / .loading variables ───
for i, line in enumerate(lines):
    if "--bg: linear-gradient(145deg, #eef1f5, #e8ecf1, #eaecf2)" in line:
        lines[i] = line.replace("--bg: linear-gradient(145deg, #eef1f5, #e8ecf1, #eaecf2)", "--bg: #F8FAFC")
    if "--surface: rgba(255,255,255,0.72)" in line and "color-surface" not in line:
        lines[i] = line.replace("--surface: rgba(255,255,255,0.72)", "--surface: #FFFFFF")
    if "--surface-subtle: rgba(255,255,255,0.55)" in line:
        lines[i] = line.replace("--surface-subtle: rgba(255,255,255,0.55)", "--surface-subtle: #FAFAFA")
    if "--surface-raised: rgba(255,255,255,0.85)" in line:
        lines[i] = line.replace("--surface-raised: rgba(255,255,255,0.85)", "--surface-raised: #FFFFFF")
    if "--border: rgba(0,0,0,0.08)" in line and "--border-strong" not in line:
        lines[i] = line.replace("--border: rgba(0,0,0,0.08)", "--border: #E5E7EB")

# ─── 4. .app-shell / .loading background ───
# Find the multi-line background with radial-gradient in .app-shell/.loading
in_app_shell_bg = False
app_shell_bg_start = None
app_shell_bg_end = None
for i, line in enumerate(lines):
    if ".app-shell," in line or ".loading {" in line:
        # Find the background: radial-gradient block inside
        pass
    if "radial-gradient(ellipse at 15% 5%" in line and "mode-primary" in line:
        # This is in .app-shell/.loading background
        # Look backwards for "background:"
        for j in range(i-1, max(0, i-5), -1):
            if "background:" in lines[j]:
                app_shell_bg_start = j
                break
        # Find end of background declaration
        for j in range(i+1, min(len(lines), i+10)):
            if ";" in lines[j]:
                app_shell_bg_end = j
                break
        break

if app_shell_bg_start is not None and app_shell_bg_end is not None:
    lines[app_shell_bg_start:app_shell_bg_end+1] = ["  background: #F8FAFC;"]
    print(f"Replaced .app-shell/.loading background (lines {app_shell_bg_start+1}-{app_shell_bg_end+1})")

# ─── 5. .df-app block — rewrite key variables ───
for i, line in enumerate(lines):
    # --df-bg
    if "--df-bg:" in line and "eef0f5" in line:
        lines[i] = line.replace("#eef0f5", "#F8FAFC")
    # --df-surface
    if "--df-surface:" in line and "rgba(255,255,255,0.72)" in line:
        lines[i] = line.replace("rgba(255,255,255,0.72)", "#FFFFFF")
    # --df-border
    if "--df-border:" in line and "rgba(0,0,0,0.08)" in line:
        lines[i] = line.replace("rgba(0,0,0,0.08)", "#E5E7EB")

# ─── 6. .df-app.mode-execute / .mode-planning — mode-bg variables ───
for i, line in enumerate(lines):
    # --mode-bg-a: color-mix(in srgb, ... #eef1f5) → #F8FAFC
    if "--mode-bg-a:" in line and "color-mix" in line:
        lines[i] = re.sub(r'--mode-bg-a:.*?;', '--mode-bg-a: #F8FAFC;', line)
    # --mode-bg-b: #e8ecf1 → #FAFAFA
    if "--mode-bg-b:" in line and "#e8ecf1" in line:
        lines[i] = line.replace("#e8ecf1", "#FAFAFA")
    # --mode-bg-c: color-mix(in srgb, ... #eaecf2) → #FBF7FF
    if "--mode-bg-c:" in line and "color-mix" in line:
        lines[i] = re.sub(r'--mode-bg-c:.*?;', '--mode-bg-c: #FBF7FF;', line)
    elif "--mode-bg-c:" in line and "#eaecf2" in line:
        lines[i] = line.replace("#eaecf2", "#FBF7FF")

    # --header-fg in mode blocks
    if "--header-fg:" in line and "#fff" in line.lower():
        lines[i] = re.sub(r'--header-fg:.*?;', '--header-fg: #111827;', line)
    if "--header-fg-muted:" in line and "rgba(255,255,255" in line:
        lines[i] = re.sub(r'--header-fg-muted:.*?;', '--header-fg-muted: #6B7280;', line)

# ─── 7. .df-app background — gradient → solid ───
# Find .df-app { background: ... multi-line gradient
for i, line in enumerate(lines):
    if line.strip().startswith("background:") and "radial-gradient(ellipse at 15% 5%" in line and "mode-primary" in line:
        # Check if this is inside .df-app
        for j in range(max(0, i-30), i):
            if ".df-app {" in lines[j] or ".df-app{" in lines[j]:
                # Find the full background declaration (might span multiple lines)
                bg_start = i
                bg_end = i
                for k in range(i, min(len(lines), i+10)):
                    if ";" in lines[k]:
                        bg_end = k
                        break
                lines[bg_start:bg_end+1] = ["  background: #F8FAFC;"]
                print(f"Replaced .df-app background at line {bg_start+1}")
                break

# ─── 8. .df-header — from dark purple to light ───
# Find .df-header { line
header_start = None
for i, line in enumerate(lines):
    if line.strip() == ".df-header {" or line.strip().startswith(".df-header {"):
        # Check it's not .df-header::after or .df-header-right etc.
        if "::" not in line and "-right" not in line and " > " not in line and ".no-theme" not in line:
            header_start = i
            break

if header_start is not None:
    # Find the closing brace
    brace_count = 0
    header_end = None
    for i in range(header_start, min(len(lines), header_start + 30)):
        brace_count += lines[i].count("{") - lines[i].count("}")
        if brace_count == 0 and i > header_start:
            header_end = i
            break

    if header_end is not None:
        new_header = """.df-header {
  position: relative;
  overflow: hidden;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 18px 0 4px;
  background: linear-gradient(180deg, #FFFFFF 0%, #FBF7FF 100%);
  border-bottom: 1px solid #E5E7EB;
  color: #111827;
  transition: background .42s ease, border-color .42s ease, color .2s ease;
}"""
        lines[header_start:header_end+1] = new_header.split("\n")
        print(f"Replaced .df-header (lines {header_start+1}-{header_end+1})")

# ─── 9. .df-header::after — remove the color sweep animation ───
for i, line in enumerate(lines):
    if ".df-header::after" in line and "::" in line and "right" not in line:
        # Keep the ::after block but change background to a very subtle version
        pass  # We'll handle this with targeted edits

# ─── 10. .df-header .df-tabs — light theme ───
for i, line in enumerate(lines):
    if ".df-header .df-tabs {" in line and "button" not in line and "active" not in line:
        # Find the end of this block
        brace_count = 0
        block_end = None
        for k in range(i, min(len(lines), i+10)):
            brace_count += lines[k].count("{") - lines[k].count("}")
            if brace_count == 0 and k > i:
                block_end = k
                break
        if block_end is not None:
            new_block = """.df-header .df-tabs {
  background: rgba(198, 156, 249, 0.08);
  border-color: rgba(198, 156, 249, 0.2);
}"""
            lines[i:block_end+1] = new_block.split("\n")
            print(f"Replaced .df-header .df-tabs at line {i+1}")
            break

# ─── 11. .df-header .df-tabs button — dark text ───
for i, line in enumerate(lines):
    if ".df-header .df-tabs button" in line and "active" not in line and "hover" not in line and ".df-header .df-tabs button {" in line:
        brace_count = 0
        block_end = None
        for k in range(i, min(len(lines), i+10)):
            brace_count += lines[k].count("{") - lines[k].count("}")
            if brace_count == 0 and k > i:
                block_end = k
                break
        if block_end is not None:
            new_block = """.df-header .df-tabs button {
  color: #6B7280 !important;
}"""
            lines[i:block_end+1] = new_block.split("\n")
            print(f"Replaced .df-header .df-tabs button at line {i+1}")
            break

# ─── 12. .df-header .df-tabs button.active — purple active state ───
for i, line in enumerate(lines):
    if ".df-header .df-tabs button.active" in line and "hover" not in line:
        brace_count = 0
        block_end = None
        for k in range(i, min(len(lines), i+10)):
            brace_count += lines[k].count("{") - lines[k].count("}")
            if brace_count == 0 and k > i:
                block_end = k
                break
        if block_end is not None:
            new_block = """.df-header .df-tabs button.active {
  background: #F6EEFF !important;
  border: 1px solid #C69CF9 !important;
  color: #5B21B6 !important;
}"""
            lines[i:block_end+1] = new_block.split("\n")
            print(f"Replaced .df-header .df-tabs button.active at line {i+1}")
            break

# ─── 13. .df-execute background — clean ───
for i, line in enumerate(lines):
    if ".df-execute {" in line and "no-theme" not in line and "top" not in line:
        brace_count = 0
        block_end = None
        for k in range(i, min(len(lines), i+30)):
            brace_count += lines[k].count("{") - lines[k].count("}")
            if brace_count == 0 and k > i:
                block_end = k
                break
        if block_end is not None:
            new_block = """.df-execute {
  display: grid;
  grid-template-columns: minmax(320px, 410px) 1fr;
  gap: 20px;
  height: calc(100vh - 64px);
  padding: 8px 8px 10px;
  overflow: hidden;
  border-radius: 0;
  background: #F8FAFC;
  animation: dfPageIn .22s ease-out;
}"""
            lines[i:block_end+1] = new_block.split("\n")
            print(f"Replaced .df-execute at line {i+1}")
            break

# ─── 14. .df-candidate-panel etc — surface/border vars ───
# These already use var(--df-surface) and var(--df-border) which we've updated,
# but the box-shadow and specific overrides need fixing

# ─── 15. .df-task-card — clean borders ───
for i, line in enumerate(lines):
    if "border: 1px solid rgba(226, 232, 240, .9)" in line:
        lines[i] = line.replace("border: 1px solid rgba(226, 232, 240, .9)", "border: 1px solid #E5E7EB")
    if "box-shadow: 0 2px 7px rgba(15, 23, 42, .11)" in line:
        lines[i] = line.replace("box-shadow: 0 2px 7px rgba(15, 23, 42, .11)", "box-shadow: 0 1px 3px rgba(0,0,0,0.04)")

# ─── 16. .df-time-block — clean style ───
# Find the .df-time-block blocks and fix colors
for i, line in enumerate(lines):
    # The main time block styling with blue-ish border
    if "border: 1px solid rgba(127, 171, 194, .38)" in line:
        lines[i] = line.replace("border: 1px solid rgba(127, 171, 194, .38)", "border: 1px solid rgba(198, 156, 249, 0.55)")
    # Second override with mode-primary
    if "border-color: color-mix(in srgb, var(--mode-primary) 34%, #CBD5E1)" in line:
        lines[i] = line.replace("border-color: color-mix(in srgb, var(--mode-primary) 34%, #CBD5E1)", "border-color: rgba(198, 156, 249, 0.55)")
    # Shadow
    if "box-shadow: 0 8px 18px rgba(31,91,130,.12)" in line:
        lines[i] = line.replace("box-shadow: 0 8px 18px rgba(31,91,130,.12)", "box-shadow: 0 2px 6px rgba(198, 156, 249, 0.12)")

# ─── 17. .df-timeline-canvas — clean grid ───
for i, line in enumerate(lines):
    if "border-left: 2px solid color-mix(in srgb, var(--mode-primary) 34%, transparent)" in line:
        lines[i] = line.replace("border-left: 2px solid color-mix(in srgb, var(--mode-primary) 34%, transparent)", "border-left: 2px solid rgba(198, 156, 249, 0.3)")

# ─── 18. .df-slot — clean hour/major lines ───
for i, line in enumerate(lines):
    if "border-top: 1px solid color-mix(in srgb, var(--mode-primary) 15%, #CBD5E1)" in line:
        lines[i] = line.replace("border-top: 1px solid color-mix(in srgb, var(--mode-primary) 15%, #CBD5E1)", "border-top: 1px solid #E5E7EB")
    if "border-top-color: color-mix(in srgb, var(--mode-primary) 26%, #CBD5E1)" in line:
        lines[i] = line.replace("border-top-color: color-mix(in srgb, var(--mode-primary) 26%, #CBD5E1)", "border-top-color: #D1D5DB")

# ─── 19. .df-timeline-panel — clean background ───
for i, line in enumerate(lines):
    if ".df-timeline-panel {" in line and "no-theme" not in line:
        brace_count = 0
        block_end = None
        for k in range(i, min(len(lines), i+20)):
            brace_count += lines[k].count("{") - lines[k].count("}")
            if brace_count == 0 and k > i:
                block_end = k
                break
        if block_end is not None:
            new_block = """.df-timeline-panel {
  position: relative;
  display: grid;
  grid-template-rows: auto auto 1fr;
  overflow: hidden;
  border-radius: 14px;
  background: #FFFFFF;
  border-color: #E5E7EB;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  animation: dfPanelPop .24s ease-out;
}"""
            lines[i:block_end+1] = new_block.split("\n")
            print(f"Replaced .df-timeline-panel at line {i+1}")
            break

# ─── 20. .df-ai-plan — light style ───
for i, line in enumerate(lines):
    if "background: linear-gradient(135deg, var(--mode-primary-strong), var(--mode-primary))" in line and "ai-plan" not in lines[max(0,i-3):i+1].__repr__():
        # This is in the general button/submit, not specifically ai-plan
        pass

# ─── 21. .task-edit-overlay — lighter overlay ───
for i, line in enumerate(lines):
    if "background: rgba(17, 24, 39, 0.16)" in line:
        lines[i] = line.replace("background: rgba(17, 24, 39, 0.16)", "background: rgba(17, 24, 39, 0.14)")
    if "backdrop-filter: blur(2px)" in line:
        lines[i] = line.replace("backdrop-filter: blur(2px)", "backdrop-filter: blur(4px)")

# ─── 22. .df-user-avatar — light header colors ───
for i, line in enumerate(lines):
    if "border: 1.5px solid color-mix(in srgb, var(--header-fg, #fff) 42%, transparent)" in line:
        lines[i] = line.replace("border: 1.5px solid color-mix(in srgb, var(--header-fg, #fff) 42%, transparent)", "border: 1.5px solid #E5E7EB")
    if "background: color-mix(in srgb, var(--header-fg, #fff) 18%, transparent)" in line:
        lines[i] = line.replace("background: color-mix(in srgb, var(--header-fg, #fff) 18%, transparent)", "background: #F6EEFF")
    if "color: color-mix(in srgb, var(--header-fg, #fff) 85%, transparent)" in line:
        lines[i] = line.replace("color: color-mix(in srgb, var(--header-fg, #fff) 85%, transparent)", "color: #5B21B6")

# ─── 23. .df-user-avatar:hover ───
for i, line in enumerate(lines):
    if "background: color-mix(in srgb, var(--header-fg, #fff) 28%, transparent)" in line:
        lines[i] = line.replace("background: color-mix(in srgb, var(--header-fg, #fff) 28%, transparent)", "background: #EFE3FF")
    if "border-color: color-mix(in srgb, var(--header-fg, #fff) 65%, transparent)" in line:
        lines[i] = line.replace("border-color: color-mix(in srgb, var(--header-fg, #fff) 65%, transparent)", "border-color: #C69CF9")

# ─── 24. .df-top-view-switch — light header style ───
for i, line in enumerate(lines):
    if "background: color-mix(in srgb, var(--header-fg, #fff) 10%, transparent)" in line:
        lines[i] = line.replace("background: color-mix(in srgb, var(--header-fg, #fff) 10%, transparent)", "background: rgba(198, 156, 249, 0.06)")
    if "color: color-mix(in srgb, var(--header-fg, #fff) 90%, transparent)" in line:
        lines[i] = line.replace("color: color-mix(in srgb, var(--header-fg, #fff) 90%, transparent)", "color: #6B7280")
    if "background: color-mix(in srgb, var(--header-fg, #fff) 12%, transparent)" in line:
        lines[i] = line.replace("background: color-mix(in srgb, var(--header-fg, #fff) 12%, transparent)", "background: rgba(198, 156, 249, 0.1)")
    if "background: color-mix(in srgb, var(--header-fg, #fff) 18%, transparent)" in line:
        lines[i] = line.replace("background: color-mix(in srgb, var(--header-fg, #fff) 18%, transparent)", "background: rgba(198, 156, 249, 0.15)")
    if "color: var(--header-fg, #fff)" in line and "mode-primary" not in line:
        lines[i] = line.replace("color: var(--header-fg, #fff)", "color: #111827")

# ─── 25. .df-tabs — light style ───
for i, line in enumerate(lines):
    if "border: 1px solid color-mix(in srgb, var(--header-fg, #fff) 55%, transparent)" in line:
        lines[i] = line.replace("border: 1px solid color-mix(in srgb, var(--header-fg, #fff) 55%, transparent)", "border: 1px solid rgba(198, 156, 249, 0.2)")
    if "background: color-mix(in srgb, var(--header-fg, #fff) 72%, transparent)" in line:
        lines[i] = line.replace("background: color-mix(in srgb, var(--header-fg, #fff) 72%, transparent)", "background: rgba(198, 156, 249, 0.08)")
    if "box-shadow: 0 8px 18px color-mix(in srgb, var(--mode-primary-strong) 12%, transparent), inset 0 0 0 1px color-mix(in srgb, var(--header-fg, #fff) 28%, transparent)" in line:
        lines[i] = line.replace("box-shadow: 0 8px 18px color-mix(in srgb, var(--mode-primary-strong) 12%, transparent), inset 0 0 0 1px color-mix(in srgb, var(--header-fg, #fff) 28%, transparent)", "box-shadow: 0 1px 3px rgba(198, 156, 249, 0.1)")
    if "color: color-mix(in srgb, var(--mode-primary-strong) 72%, #111827)" in line:
        lines[i] = line.replace("color: color-mix(in srgb, var(--mode-primary-strong) 72%, #111827)", "color: #6B7280")
    if "background: linear-gradient(135deg, var(--mode-primary-strong), var(--mode-primary))" in line and "active" in lines[i]:
        lines[i] = line.replace("background: linear-gradient(135deg, var(--mode-primary-strong), var(--mode-primary))", "background: #F6EEFF")
    if "border: 1px solid rgba(255,255,255,.62)" in line:
        lines[i] = line.replace("border: 1px solid rgba(255,255,255,.62)", "border: 1px solid #C69CF9")
    if "color: var(--mode-on-primary)" in line and "active" in lines[i]:
        lines[i] = line.replace("color: var(--mode-on-primary)", "color: #5B21B6")

# ─── 26. .df-candidate-panel shadow ───
for i, line in enumerate(lines):
    if "box-shadow: 0 16px 36px color-mix(in srgb, var(--mode-primary) 16%, transparent)" in line:
        lines[i] = line.replace("box-shadow: 0 16px 36px color-mix(in srgb, var(--mode-primary) 16%, transparent)", "box-shadow: 0 1px 3px rgba(0,0,0,0.04)")

# ─── 27. .df-planning background ───
for i, line in enumerate(lines):
    if ".df-planning {" in line and "no-theme" not in line and "shell" not in line:
        brace_count = 0
        block_end = None
        for k in range(i, min(len(lines), i+20)):
            brace_count += lines[k].count("{") - lines[k].count("}")
            if brace_count == 0 and k > i:
                block_end = k
                break
        if block_end is not None:
            # Replace just the background line within the block
            for k in range(i, block_end+1):
                if "background:" in lines[k] and ("radial-gradient" in lines[k] or "mode-bg" in lines[k]):
                    # Find full background declaration
                    bg_start = k
                    bg_end = k
                    for m in range(k, min(len(lines), k+5)):
                        if ";" in lines[m]:
                            bg_end = m
                            break
                    lines[bg_start:bg_end+1] = ["  background: #F8FAFC;"]
                    print(f"Replaced .df-planning background at line {bg_start+1}")
                    break
            break

# ─── 28. .df-app button — solid white background ───
for i, line in enumerate(lines):
    if ".df-app button { cursor: pointer;" in line:
        lines[i] = line.replace("background: rgba(255,255,255,0.72)", "background: #FFFFFF")

# ─── 29. .df-app.no-theme-gradient — clean ───
for i, line in enumerate(lines):
    if ".df-app.no-theme-gradient {" in line and "background:" in line and len(line.strip()) < 80:
        lines[i] = line.replace("background: linear-gradient(145deg, #eef1f5, #e8ecf1, #eaecf2)", "background: #F8FAFC")
    # no-theme-gradient header
    if ".df-app.no-theme-gradient .df-header {" in line:
        brace_count = 0
        block_end = None
        for k in range(i, min(len(lines), i+5)):
            brace_count += lines[k].count("{") - lines[k].count("}")
            if brace_count == 0 and k > i:
                block_end = k
                break
        if block_end is not None:
            new_block = """.df-app.no-theme-gradient .df-header {
  background: linear-gradient(180deg, #FFFFFF 0%, #FBF7FF 100%) !important;
}"""
            lines[i:block_end+1] = new_block.split("\n")
            print(f"Replaced .no-theme-gradient .df-header at line {i+1}")

# no-theme-gradient panels → solid white
for i, line in enumerate(lines):
    if "background: rgba(255,255,255,0.72)" in line and "!important" in line and "no-theme" not in line:
        # This might be in the no-theme-gradient section
        lines[i] = line.replace("background: rgba(255,255,255,0.72)", "background: #FFFFFF")
    if "background: rgba(255,255,255,0.6)" in line and "!important" in line:
        lines[i] = line.replace("background: rgba(255,255,255,0.6)", "background: #F8FAFC")

# ─── 30. Gradient design system section — convert glass → clean ───
# Find the section starting with "/* ── Gradient Design System"
gradient_section_start = None
for i, line in enumerate(lines):
    if "Gradient Design System" in line or "gradient design system" in line.lower():
        gradient_section_start = i
        break

if gradient_section_start is not None:
    print(f"Found gradient section at line {gradient_section_start+1}")
    # Apply bulk replacements within this section (to end of file)
    for i in range(gradient_section_start, len(lines)):
        line = lines[i]

        # Glass backgrounds → solid white
        if "background: rgba(255,255,255,0.72)" in line:
            lines[i] = line.replace("background: rgba(255,255,255,0.72)", "background: #FFFFFF")
        if "background: rgba(255,255,255,0.78)" in line:
            lines[i] = line.replace("background: rgba(255,255,255,0.78)", "background: #FFFFFF")
        if "background: rgba(255,255,255,0.82)" in line:
            lines[i] = line.replace("background: rgba(255,255,255,0.82)", "background: #FFFFFF")
        if "background: rgba(255,255,255,0.85)" in line:
            lines[i] = line.replace("background: rgba(255,255,255,0.85)", "background: #FFFFFF")
        if "background: rgba(255,255,255,0.88)" in line:
            lines[i] = line.replace("background: rgba(255,255,255,0.88)", "background: #FFFFFF")
        if "background: rgba(255,255,255,0.96)" in line:
            lines[i] = line.replace("background: rgba(255,255,255,0.96)", "background: #FFFFFF")
        if "background: rgba(255,255,255,0.98)" in line:
            lines[i] = line.replace("background: rgba(255,255,255,0.98)", "background: #FFFFFF")
        if "background: rgba(255,255,255,0.55)" in line:
            lines[i] = line.replace("background: rgba(255,255,255,0.55)", "background: #FAFAFA")
        if "background: rgba(255,255,255,0.6)" in line:
            lines[i] = line.replace("background: rgba(255,255,255,0.6)", "background: #FAFAFA")
        if "background: rgba(255,255,255,0.45)" in line:
            lines[i] = line.replace("background: rgba(255,255,255,0.45)", "background: #F9FAFB")

        # Remove backdrop-filter lines (replace with comment or remove)
        if "backdrop-filter:" in line and "blur(" in line:
            lines[i] = ""  # Remove the line
        if "-webkit-backdrop-filter:" in line and "blur(" in line:
            lines[i] = ""  # Remove the line

        # Glass borders → solid
        if "border: 1px solid rgba(255,255,255,0.5)" in line:
            lines[i] = line.replace("border: 1px solid rgba(255,255,255,0.5)", "border: 1px solid #E5E7EB")
        if "border: 1px solid rgba(255,255,255,0.4)" in line:
            lines[i] = line.replace("border: 1px solid rgba(255,255,255,0.4)", "border: 1px solid #E5E7EB")
        if "border: 1px solid rgba(255,255,255,0.3)" in line:
            lines[i] = line.replace("border: 1px solid rgba(255,255,255,0.3)", "border: 1px solid #EEF0F4")
        if "border: 1px solid rgba(255,255,255,0.6)" in line:
            lines[i] = line.replace("border: 1px solid rgba(255,255,255,0.6)", "border: 1px solid #E5E7EB")

        # Shadow cleanup
        if "box-shadow: var(--gf-shadow)" in line:
            lines[i] = line.replace("box-shadow: var(--gf-shadow)", "box-shadow: 0 1px 3px rgba(0,0,0,0.04)")
        if "box-shadow: var(--gf-shadow-sm)" in line:
            lines[i] = line.replace("box-shadow: var(--gf-shadow-sm)", "box-shadow: 0 1px 2px rgba(0,0,0,0.03)")
        if "box-shadow: var(--gf-shadow-hover)" in line:
            lines[i] = line.replace("box-shadow: var(--gf-shadow-hover)", "box-shadow: 0 8px 20px rgba(198, 156, 249, 0.16)")
        if "box-shadow: var(--gf-shadow-active)" in line:
            lines[i] = line.replace("box-shadow: var(--gf-shadow-active)", "box-shadow: inset 0 1px 2px rgba(0,0,0,0.06)")

        # Border radius tokens → direct values
        if "border-radius: var(--gf-radius," in line:
            match = re.search(r'var\(--gf-radius,\s*(\d+px)\)', line)
            if match:
                lines[i] = line.replace(f"var(--gf-radius, {match.group(1)})", match.group(1))
        if "border-radius: var(--gf-radius-sm," in line:
            match = re.search(r'var\(--gf-radius-sm,\s*(\d+px)\)', line)
            if match:
                lines[i] = line.replace(f"var(--gf-radius-sm, {match.group(1)})", match.group(1))
        if "border-radius: var(--gf-radius-xs," in line:
            match = re.search(r'var\(--gf-radius-xs,\s*(\d+px)\)', line)
            if match:
                lines[i] = line.replace(f"var(--gf-radius-xs, {match.group(1)})", match.group(1))

        # transition tokens
        if "transition: var(--gf-transition)" in line:
            lines[i] = line.replace("transition: var(--gf-transition)", "transition: all .15s ease")

    print(f"Processed gradient section (lines {gradient_section_start+1}-{len(lines)})")

# ─── 31. Clean up empty lines left by removed backdrop-filter ───
# Remove consecutive empty lines (max 1 empty line between blocks)
cleaned = []
prev_empty = False
for line in lines:
    is_empty = line.strip() == ""
    if is_empty and prev_empty:
        continue
    cleaned.append(line)
    prev_empty = is_empty

# ─── 32. Fix .df-execute gradient override in gradient section ───
final_text = "\n".join(cleaned)

# Replace the gradient execute background in the gradient section
final_text = final_text.replace(
    """background:
    radial-gradient(ellipse at 72% 8%, color-mix(in srgb, var(--mode-primary) 18%, transparent), transparent 45%),
    radial-gradient(ellipse at 20% 90%, color-mix(in srgb, var(--mode-primary) 10%, transparent), transparent 45%),
    linear-gradient(145deg, var(--mode-bg-a) 0%, var(--mode-bg-b) 50%, var(--mode-bg-c) 100%);
  border-radius: 14px 14px 0 0;""",
    """background: #F8FAFC;
  border-radius: 0;"""
)

# Replace the gradient planning background in the gradient section
final_text = final_text.replace(
    """background:
    radial-gradient(ellipse at 28% 8%, color-mix(in srgb, var(--mode-primary) 18%, transparent), transparent 45%),
    radial-gradient(ellipse at 80% 90%, color-mix(in srgb, var(--mode-primary) 10%, transparent), transparent 45%),
    linear-gradient(145deg, var(--mode-bg-a) 0%, var(--mode-bg-b) 50%, var(--mode-bg-c) 100%);""",
    """background: #F8FAFC;"""
)

# ─── 33. Fix .df-ai-plan button — lighter style ───
# The AI plan button should be light purple, not deep gradient
final_text = final_text.replace(
    """background: linear-gradient(135deg, var(--mode-primary-strong), var(--mode-primary)) !important;
  color: var(--mode-on-primary) !important;
  font-size: 12px;
  font-weight: 900;
  font-family: var(--df-font-brand);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  box-shadow: 0 8px 18px color-mix(in srgb, var(--mode-primary-strong) 24%, transparent) !important;""",
    """background: #F6EEFF !important;
  color: #5B21B6 !important;
  font-size: 12px;
  font-weight: 900;
  font-family: var(--df-font-brand);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  border: 1px solid rgba(198, 156, 249, 0.6) !important;
  box-shadow: 0 1px 3px rgba(198, 156, 249, 0.2) !important;"""
)

# ─── 34. Fix AI FAB — keep gradient but add lime hover ───
final_text = final_text.replace(
    """.df-ai-fab { bottom: 24px; width: 52px; height: 52px; border-radius: 18px; color: var(--mode-on-primary); background: linear-gradient(135deg, var(--mode-primary-strong), var(--mode-primary)); border: 0; }""",
    """.df-ai-fab { bottom: 24px; width: 52px; height: 52px; border-radius: 18px; color: #FFFFFF; background: linear-gradient(135deg, #8B5CF6, #C69CF9); border: 0; }"""
)

final_text = final_text.replace(
    """.df-ai-fab:hover { box-shadow: 0 0 0 6px color-mix(in srgb, var(--mode-primary) 22%, transparent), 0 12px 28px color-mix(in srgb, var(--mode-primary-strong) 24%, transparent); }""",
    """.df-ai-fab:hover { box-shadow: 0 0 0 6px rgba(202, 255, 114, 0.28), 0 8px 24px rgba(139, 92, 246, 0.3); }"""
)

# ─── 35. Fix .df-add-fab ───
final_text = final_text.replace(
    """.df-add-fab { bottom: 86px; background: #fff; color: var(--mode-primary-strong); border-color: color-mix(in srgb, var(--mode-primary) 26%, #E5E7EB); }""",
    """.df-add-fab { bottom: 86px; background: #FFFFFF; color: #5B21B6; border-color: rgba(198, 156, 249, 0.5); }"""
)

# ─── 36. Fix .df-brand strong color ───
# Brand text should be dark
for i, line in enumerate(final_text.split("\n")):
    pass  # This is handled by .df-header color: #111827

# ─── 37. Fix .df-quick-add background ───
final_text = final_text.replace(
    "background: rgba(255, 255, 255, .94);",
    "background: #FFFFFF;"
)

# ─── 38. Fix .df-view-switch ───
final_text = final_text.replace(
    "background: color-mix(in srgb, var(--mode-primary) 10%, transparent);\n  border: 1px solid color-mix(in srgb, var(--mode-primary) 18%, transparent);\n  padding: 3px;\n  box-shadow: 0 1px 4px color-mix(in srgb, var(--mode-primary) 8%, transparent);",
    "background: rgba(198, 156, 249, 0.08);\n  border: 1px solid rgba(198, 156, 249, 0.2);\n  padding: 3px;\n  box-shadow: 0 1px 3px rgba(198, 156, 249, 0.08);"
)

# ─── 39. Fix view switch active button ───
final_text = final_text.replace(
    "background: var(--mode-primary-strong) !important;\n  color: var(--mode-on-primary) !important;\n  box-shadow:\n    0 2px 8px color-mix(in srgb, var(--mode-primary-strong) 35%, transparent),\n    0 1px 2px rgba(0,0,0,.12) !important;",
    "background: #F6EEFF !important;\n  border: 1px solid #C69CF9 !important;\n  color: #5B21B6 !important;\n  box-shadow: 0 1px 3px rgba(198, 156, 249, 0.2) !important;"
)

# ─── 40. Fix .df-quick-add-submit ───
# Keep the gradient but make it lighter
final_text = final_text.replace(
    "background: linear-gradient(135deg, var(--mode-primary-strong), var(--mode-primary));\n  box-shadow: 0 8px 18px color-mix(in srgb, var(--mode-primary-strong) 24%, transparent);",
    "background: linear-gradient(135deg, #8B5CF6, #C69CF9);\n  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.2);"
)

# ─── 41. Fix .df-quick-add in gradient section ───
final_text = final_text.replace(
    "background: rgba(255,255,255,0.55);\n  border: 1px solid rgba(255,255,255,0.4);",
    "background: #FAFAFA;\n  border: 1px solid #E5E7EB;"
)

# ─── 42. Fix settings card ───
final_text = final_text.replace(
    "background: rgba(255,255,255,0.78);\n  backdrop-filter: blur(12px) saturate(1.1);\n  -webkit-backdrop-filter: blur(12px) saturate(1.1);\n  border: 1px solid rgba(255,255,255,0.5);",
    "background: #FFFFFF;\n  border: 1px solid #E5E7EB;"
)

# ─── 43. Fix note card ───
final_text = final_text.replace(
    "background: rgba(255,255,255,0.78);\n  backdrop-filter: blur(12px) saturate(1.1);\n  -webkit-backdrop-filter: blur(12px) saturate(1.1);\n  border: 1px solid rgba(255,255,255,0.5);",
    "background: #FFFFFF;\n  border: 1px solid #E5E7EB;"
)

# ─── 44. Fix user menu ───
final_text = final_text.replace(
    "background: rgba(255,255,255,0.82) !important;\n  backdrop-filter: blur(20px) saturate(1.3) !important;\n  -webkit-backdrop-filter: blur(20px) saturate(1.3) !important;\n  border: 1px solid rgba(255,255,255,0.5) !important;",
    "background: #FFFFFF !important;\n  border: 1px solid #E5E7EB !important;"
)

# ─── 45. Fix utility panel/drawer ───
final_text = final_text.replace(
    "background: rgba(255,255,255,0.78) !important;\n  backdrop-filter: blur(20px) saturate(1.3) !important;\n  -webkit-backdrop-filter: blur(20px) saturate(1.3) !important;\n  border: 1px solid rgba(255,255,255,0.5) !important;\n  border-radius: 14px;\n  box-shadow: 0 8px 32px rgba(0,0,0,.08);",
    "background: #FFFFFF !important;\n  border: 1px solid #E5E7EB !important;\n  border-radius: 14px;\n  box-shadow: 0 4px 16px rgba(0,0,0,0.08);"
)

# ─── 46. Fix no-theme-gradient in gradient section ───
final_text = final_text.replace(
    "background: linear-gradient(145deg, #eef1f5, #e8ecf1, #eaecf2);",
    "background: #F8FAFC;"
)

# ─── 47. Fix UI style toggle preview ───
final_text = final_text.replace(
    "background: linear-gradient(145deg, #eef1f5, #e8ecf1, #eaecf2);\n  border: 1px solid rgba(255,255,255,0.5);\n  box-shadow: 0 1px 3px rgba(0,0,0,.06);",
    "background: #F8FAFC;\n  border: 1px solid #E5E7EB;\n  box-shadow: 0 1px 3px rgba(0,0,0,.04);"
)

# ─── 48. Fix .df-candidate-panel in gradient section ───
# The border-radius override should stay
# The panel uses var(--df-surface) which is now #FFFFFF

# ─── 49. Fix .df-dayflow-icon filter ───
final_text = final_text.replace(
    "filter: drop-shadow(0 4px 10px color-mix(in srgb, var(--mode-primary-strong) 18%, transparent));",
    "filter: none;"
)

# ─── 50. Fix .df-date-title color ───
final_text = final_text.replace(
    "color: rgba(17,24,39,.86);",
    "color: #111827;"
)

# ─── 51. Fix timeline scroll background ───
# Keep transparent

# ─── 52. Fix .df-utility-backdrop ───
final_text = final_text.replace(
    "background: rgba(17,24,39,.18);",
    "background: rgba(17,24,39,.14);"
)

# ─── 53. Fix .df-task-card hover in gradient section ───
final_text = final_text.replace(
    "box-shadow: var(--gf-shadow-hover);\n  border-color: #D1D5DB;",
    "box-shadow: 0 8px 20px rgba(198, 156, 249, 0.16);\n  border-color: rgba(198, 156, 249, 0.6);"
)

# ─── 54. Fix .df-time-block in gradient section ───
final_text = final_text.replace(
    "background: rgba(255,255,255,0.88);\n  border: 1px solid rgba(255,255,255,0.3);",
    "background: #FFFFFF;\n  border: 1px solid rgba(198, 156, 249, 0.55);"
)

# Fix time-block hover
final_text = final_text.replace(
    ".df-time-block:hover {\n  border-color: #E5E7EB;\n  box-shadow: var(--gf-shadow-sm);",
    ".df-time-block:hover {\n  border-color: rgba(198, 156, 249, 0.7);\n  box-shadow: 0 8px 20px rgba(198, 156, 249, 0.18);"
)

# ─── 55. Fix .df-tabs button.active in gradient section ───
final_text = final_text.replace(
    """.df-tabs button.active,
.df-ai-plan,
.df-quick-add-submit,
.df-ai-fab,
.df-add-fab,
.primary-button {
  background: var(--mode-primary-strong);
  color: var(--mode-on-primary);
  border: 1px solid transparent;
  border-radius: var(--gf-radius-sm, 8px);
  box-shadow: 0 1px 3px color-mix(in srgb, var(--mode-primary-strong) 24%, transparent);
  transition: var(--gf-transition);
}""",
    """.df-tabs button.active,
.primary-button {
  background: #F6EEFF;
  color: #5B21B6;
  border: 1px solid #C69CF9;
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(198, 156, 249, 0.2);
  transition: all .15s ease;
}

.df-ai-plan,
.df-quick-add-submit,
.df-ai-fab {
  background: linear-gradient(135deg, #8B5CF6, #C69CF9);
  color: #FFFFFF;
  border: 1px solid transparent;
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.2);
  transition: all .15s ease;
}

.df-add-fab {
  background: #FFFFFF;
  color: #5B21B6;
  border: 1px solid rgba(198, 156, 249, 0.5);
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  transition: all .15s ease;
}"""
)

# Fix hover states for primary buttons
final_text = final_text.replace(
    """.df-tabs button.active:hover,
.df-ai-plan:hover,
.df-quick-add-submit:hover,
.df-ai-fab:hover,
.df-add-fab:hover,
.primary-button:hover {
  box-shadow: 0 2px 8px color-mix(in srgb, var(--mode-primary-strong) 32%, transparent);
  transform: translateY(-1px);
}""",
    """.df-tabs button.active:hover,
.primary-button:hover {
  box-shadow: 0 4px 12px rgba(198, 156, 249, 0.24);
  transform: translateY(-1px);
}

.df-ai-plan:hover,
.df-quick-add-submit:hover,
.df-ai-fab:hover {
  box-shadow: 0 6px 18px rgba(139, 92, 246, 0.28);
  transform: translateY(-1px);
}

.df-add-fab:hover {
  box-shadow: 0 4px 12px rgba(198, 156, 249, 0.2);
  transform: translateY(-1px);
}"""
)

# Fix active states
final_text = final_text.replace(
    """.df-tabs button.active:active,
.df-ai-plan:active,
.df-quick-add-submit:active,
.df-ai-fab:active,
.df-add-fab:active,
.primary-button:active {
  box-shadow: inset 0 1px 2px rgba(0,0,0,.12);
  transform: translateY(0);
}""",
    """.df-tabs button.active:active,
.primary-button:active {
  box-shadow: inset 0 1px 2px rgba(198, 156, 249, 0.15);
  transform: translateY(0);
}

.df-ai-plan:active,
.df-quick-add-submit:active,
.df-ai-fab:active {
  box-shadow: inset 0 1px 2px rgba(139, 92, 246, 0.2);
  transform: translateY(0);
}

.df-add-fab:active {
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.06);
  transform: translateY(0);
}"""
)

# ─── 56. Fix .df-app button in gradient section ───
final_text = final_text.replace(
    """.df-app button {
  background: rgba(255,255,255,0.88);
  border: 1px solid rgba(255,255,255,0.4);
  border-radius: var(--gf-radius-sm, 8px);
  box-shadow: none;
  color: var(--df-text);
  transition: var(--gf-transition);
}

.df-app button:hover {
  background: rgba(255,255,255,0.55);
  border-color: #D1D5DB;
  box-shadow: var(--gf-shadow-sm);
}

.df-app button:active {
  background: rgba(255,255,255,0.45);
  box-shadow: var(--gf-shadow-active);
  transform: translateY(0);
}""",
    """.df-app button {
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 10px;
  box-shadow: none;
  color: #111827;
  transition: all .15s ease;
}

.df-app button:hover {
  background: #F6EEFF;
  border-color: rgba(198, 156, 249, 0.5);
  box-shadow: 0 4px 12px rgba(198, 156, 249, 0.12);
}

.df-app button:active {
  background: #EFE3FF;
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.06);
  transform: translateY(0);
}"""
)

# ─── 57. Fix task-card in gradient section ───
final_text = final_text.replace(
    """.df-task-card,
.mini-task-card,
.planning-task-card,
.matrix-task-card,
.ai-task-item {
  background: rgba(255,255,255,0.82);
  border: 1px solid rgba(255,255,255,0.4);
  border-radius: var(--gf-radius-sm, 8px);
  box-shadow: var(--gf-shadow-sm);
  transition: var(--gf-transition);
}""",
    """.df-task-card,
.mini-task-card,
.planning-task-card,
.matrix-task-card,
.ai-task-item {
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  transition: all .15s ease;
}"""
)

# ─── 58. Fix .df-mindmap gradient ───
final_text = final_text.replace(
    "background: linear-gradient(180deg, #fff, color-mix(in srgb, var(--mode-primary-soft) 56%, #fff));",
    "background: #FFFFFF;"
)

# ─── 59. Fix panel backgrounds in gradient section ───
final_text = final_text.replace(
    """.focus-panel,
.calendar-large,
.day-agenda,
.tree-board,
.matrix-board,
.add-panel {
  background: rgba(255,255,255,0.72);
  border: 1px solid rgba(255,255,255,0.5);
  border-radius: var(--gf-radius, 10px);
  box-shadow: var(--gf-shadow);
  transition: var(--gf-transition);
}""",
    """.focus-panel,
.calendar-large,
.day-agenda,
.tree-board,
.matrix-board,
.add-panel {
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  transition: all .15s ease;
}"""
)

# ─── 60. Fix tree nodes in gradient section ───
final_text = final_text.replace(
    """.tree-category-node,
.tree-project-node,
.planning-task-card {
  background: rgba(255,255,255,0.82);
  border: 1px solid rgba(255,255,255,0.4);
  border-radius: var(--gf-radius-sm, 8px);
  box-shadow: var(--gf-shadow-sm);
  transition: var(--gf-transition);
}""",
    """.tree-category-node,
.tree-project-node,
.planning-task-card {
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  transition: all .15s ease;
}"""
)

final_text = final_text.replace(
    """.tree-category-node:hover,
.tree-project-node:hover {
  box-shadow: var(--gf-shadow-hover);
  border-color: #D1D5DB;
}""",
    """.tree-category-node:hover,
.tree-project-node:hover {
  box-shadow: 0 8px 20px rgba(198, 156, 249, 0.16);
  border-color: rgba(198, 156, 249, 0.6);
}"""
)

# ─── 61. Fix matrix quadrant ───
final_text = final_text.replace(
    """.matrix-quadrant {
  background: rgba(255,255,255,0.6);
  border: 1px solid rgba(255,255,255,0.4);
  border-radius: var(--gf-radius, 10px);
  box-shadow: none;
}""",
    """.matrix-quadrant {
  background: #FAFAFA;
  border: 1px solid #E5E7EB;
  border-radius: 12px;
  box-shadow: none;
}"""
)

# ─── 62. Fix empty state ───
final_text = final_text.replace(
    """.df-empty {
  background: rgba(255,255,255,0.6);
  border: 1px dashed #D1D5DB;
  border-radius: var(--gf-radius, 10px);
  box-shadow: none;
}""",
    """.df-empty {
  background: #FAFAFA;
  border: 1px dashed #D1D5DB;
  border-radius: 12px;
  box-shadow: none;
}"""
)

# ─── 63. Fix toast ───
final_text = final_text.replace(
    """.df-toast {
  background: rgba(255,255,255,0.88);
  border: 1px solid rgba(255,255,255,0.4);
  border-radius: var(--gf-radius-sm, 8px);
  box-shadow: 0 4px 16px rgba(0,0,0,.1);
}""",
    """.df-toast {
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0,0,0,.08);
}"""
)

# ─── 64. Fix event pill ───
final_text = final_text.replace(
    """.event-pill {
  background: rgba(255,255,255,0.55);
  border: 1px solid rgba(255,255,255,0.4);
  border-radius: 999px;
  box-shadow: none;
}""",
    """.event-pill {
  background: #F6EEFF;
  border: 1px solid rgba(198, 156, 249, 0.3);
  border-radius: 999px;
  box-shadow: none;
}"""
)

# ─── 65. Fix .df-ui-style-btn ───
final_text = final_text.replace(
    """background: rgba(255,255,255,0.55);
  border: 1px solid rgba(255,255,255,0.4);""",
    """background: #FAFAFA;
  border: 1px solid #E5E7EB;"""
)

final_text = final_text.replace(
    """background: rgba(255,255,255,0.88);
  border-color: #D1D5DB;""",
    """background: #F6EEFF;
  border-color: rgba(198, 156, 249, 0.5);"""
)

# ─── 66. Fix .df-month-task ───
final_text = final_text.replace(
    """.df-month-task {
  background: rgba(255,255,255,0.55);
  border: 1px solid rgba(255,255,255,0.3);
  border-radius: 6px;
  box-shadow: none;
}""",
    """.df-month-task {
  background: #FFFFFF;
  border: 1px solid #EEF0F4;
  border-radius: 6px;
  box-shadow: none;
}"""
)

# ─── 67. Fix quick time select ───
final_text = final_text.replace(
    """.df-quick-time select {
  background: rgba(255,255,255,0.88);
  border: 1px solid rgba(255,255,255,0.6);
  border-radius: var(--gf-radius-xs, 6px);
  box-shadow: none;
}""",
    """.df-quick-time select {
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 8px;
  box-shadow: none;
}"""
)

# ─── 68. Fix panel title buttons ───
final_text = final_text.replace(
    """.df-panel-title button {
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--gf-radius-xs, 6px);
  box-shadow: none;
  transition: var(--gf-transition);
}

.df-panel-title button:hover {
  background: rgba(255,255,255,0.55);
  border-color: #E5E7EB;
}

.df-panel-title button:active {
  background: rgba(255,255,255,0.45);
}""",
    """.df-panel-title button {
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  box-shadow: none;
  transition: all .15s ease;
}

.df-panel-title button:hover {
  background: #F6EEFF;
  border-color: rgba(198, 156, 249, 0.3);
}

.df-panel-title button:active {
  background: #EFE3FF;
}"""
)

# ─── 69. Fix all-day-bar ───
final_text = final_text.replace(
    """.df-all-day-bar {
  background: rgba(255,255,255,0.55);
  border: 1px solid rgba(255,255,255,0.3);
  border-radius: var(--gf-radius-xs, 6px);
  box-shadow: none;
}""",
    """.df-all-day-bar {
  background: #FAFAFA;
  border: 1px solid #EEF0F4;
  border-radius: 8px;
  box-shadow: none;
}"""
)

# ─── 70. Fix wizard elements ───
final_text = final_text.replace(
    """.wizard-summary {
  background: rgba(255,255,255,0.88);
  border: 1px solid rgba(255,255,255,0.4);
  border-radius: var(--gf-radius, 10px);
  box-shadow: var(--gf-shadow);
}""",
    """.wizard-summary {
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}"""
)

final_text = final_text.replace(
    """.wizard-type-btn {
  background: rgba(255,255,255,0.82);
  border: 1px solid rgba(255,255,255,0.4);
  border-radius: var(--gf-radius-sm, 8px);
  box-shadow: var(--gf-shadow-sm);
  transition: var(--gf-transition);
}""",
    """.wizard-type-btn {
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 10px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.03);
  transition: all .15s ease;
}"""
)

final_text = final_text.replace(
    """.wizard-type-btn:hover {
  border-color: var(--mode-primary);
  box-shadow: var(--gf-shadow-hover);
}""",
    """.wizard-type-btn:hover {
  border-color: rgba(198, 156, 249, 0.6);
  box-shadow: 0 8px 20px rgba(198, 156, 249, 0.16);
}"""
)

# ─── 71. Fix input focus in gradient section ───
final_text = final_text.replace(
    """.df-app input:focus,
.df-app select:focus,
.df-app textarea:focus {
  border-color: var(--mode-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--mode-primary) 18%, transparent);
}""",
    """.df-app input:focus,
.df-app select:focus,
.df-app textarea:focus {
  border-color: #C69CF9;
  box-shadow: 0 0 0 3px rgba(198, 156, 249, 0.18);
}"""
)

# ─── 72. Fix inputs in gradient section ───
final_text = final_text.replace(
    """.df-app input,
.df-app select,
.df-app textarea,
{
  background: #FFFFFF;
  border: 1px solid #E5E7EB;""",
    """.df-app input,
.df-app select,
.df-app textarea {
  background: #FFFFFF;
  border: 1px solid #E5E7EB;"""
)

# ─── 73. Fix placeholder ───
final_text = final_text.replace(
    """.df-app input::placeholder,
.df-app textarea::placeholder {
  color: #9CA3AF;""",
    """.df-app input::placeholder,
.df-app textarea::placeholder {
  color: #9CA3AF;"""
)

# ─── 74. Fix close button hover ───
final_text = final_text.replace(
    """.close-button:hover {
  background: #FEF2F2;
  border-color: #FECACA;
  color: var(--df-danger);
}""",
    """.close-button:hover {
  background: #FEF2F2;
  border-color: #FECACA;
  color: #EF4444;
}"""
)

# ─── 75. Fix the header sweep animation background ───
final_text = final_text.replace(
    "background: radial-gradient(circle at 82% 50%, color-mix(in srgb, var(--mode-primary) 60%, var(--mode-primary-strong)) 0 8%, color-mix(in srgb, var(--mode-primary-strong) 52%, transparent) 28%, transparent 62%);",
    "background: radial-gradient(circle at 82% 50%, rgba(198, 156, 249, 0.12), transparent 28%, transparent 62%);"
)

# ─── 76. Fix no-theme-gradient panels backdrop ───
final_text = final_text.replace(
    "backdrop-filter: blur(16px) saturate(1.2) !important;\n  -webkit-backdrop-filter: blur(16px) saturate(1.2) !important;\n  border-color: rgba(255,255,255,0.5) !important;\n  box-shadow: 0 2px 8px rgba(0,0,0,0.06) !important;",
    "border-color: #E5E7EB !important;\n  box-shadow: 0 1px 3px rgba(0,0,0,0.04) !important;"
)

# ─── 77. Fix no-theme-gradient tabs/view switch ───
final_text = final_text.replace(
    "background: color-mix(in srgb, var(--mode-primary-strong) 12%, transparent) !important;\n  border-color: color-mix(in srgb, var(--mode-primary) 28%, transparent) !important;",
    "background: rgba(198, 156, 249, 0.08) !important;\n  border-color: rgba(198, 156, 249, 0.2) !important;"
)

# ─── Write output ───
with open(CSS_PATH, "w", encoding="utf-8") as f:
    f.write(final_text)

print(f"\nDone! Wrote {len(final_text)} chars to {CSS_PATH}")
