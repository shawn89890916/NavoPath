import re

css_path = r"D:\233cxy\OneDrive\文档\升学指导\planner-calendar-app\src\styles.css"

with open(css_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the Soft Flat section and replace it entirely
old_section_start = """/* ================================================================
   SOFT FLAT DESIGN SYSTEM — NavoPath Default Theme
   ================================================================
   Aesthetic: soft flat · lightweight · structured · calm
              high-density · subtle depth · rounded but not cute
   Reference: Linear, Notion, Things 3
   ================================================================ */"""

new_section_start = """/* ================================================================
   GRADIENT DESIGN SYSTEM — NavoPath Default Theme
   ================================================================
   Aesthetic: gradient · frosted glass · structured · calm
              high-density · subtle depth · rounded but not cute
   Reference: Linear, Notion, Things 3, macOS Sonoma
   ================================================================ */"""

content = content.replace(old_section_start, new_section_start)

# Replace all --sf- token references with --gf-
content = content.replace('var(--sf-radius, 10px)', 'var(--gf-radius, 10px)')
content = content.replace('var(--sf-radius-sm, 8px)', 'var(--gf-radius-sm, 8px)')
content = content.replace('var(--sf-radius-xs, 6px)', 'var(--gf-radius-xs, 6px)')
content = content.replace('var(--sf-shadow)', 'var(--gf-shadow)')
content = content.replace('var(--sf-shadow-sm)', 'var(--gf-shadow-sm)')
content = content.replace('var(--sf-shadow-hover)', 'var(--gf-shadow-hover)')
content = content.replace('var(--sf-shadow-active)', 'var(--gf-shadow-active)')
content = content.replace('var(--sf-transition)', 'var(--gf-transition)')
content = content.replace('var(--sf-border)', 'var(--gf-border)')

# Replace background: #fff with frosted glass in the Gradient section only
# We need to find the gradient section and do replacements within it
gradient_marker = "GRADIENT DESIGN SYSTEM"
neumorphic_end_marker = ".theme-neumorphic .dayflow-icon"

# Find the start of the gradient section
grad_start = content.find(gradient_marker)
if grad_start == -1:
    print("ERROR: Could not find gradient section marker")
    exit(1)

# Find the end of the file (gradient section goes to end)
grad_section = content[grad_start:]

# In the gradient section, replace specific patterns
# Pattern 1: "background: #fff;" → frosted glass (for panels/cards)
# But we need to be smart - some should be more opaque, some less

# For panels (heavier glass): background: rgba(255,255,255,0.72) + backdrop-filter
panel_classes = [
    '.df-candidate-panel', '.df-timeline-panel', '.df-drawer', '.df-ai-panel',
    '.df-source', '.task-edit-panel', '.compact-form-panel', '.settings-card',
    '.note-card', '.focus-panel', '.calendar-large', '.day-agenda', '.tree-board',
    '.matrix-board', '.add-panel', '.df-utility-panel', '.df-card-popover',
    '.df-ai-panel', '.focus-hero', '.wizard-summary'
]

# For cards (medium glass): background: rgba(255,255,255,0.82)
card_classes = [
    '.df-task-card', '.mini-task-card', '.planning-task-card', '.matrix-task-card',
    '.ai-task-item', '.wizard-choice-card', '.wizard-type-btn', '.tree-category-node',
    '.tree-project-node', '.df-time-block', '.event-pill', '.note-card'
]

# For small elements (light glass): background: rgba(255,255,255,0.6)
light_classes = [
    '.df-quick-add', '.day-cell', '.df-month-cell', '.mini-month-grid button',
    '.planning-stat-chip', '.today-count', '.df-status', '.quick-prompt-chip',
    '.df-month-task', '.df-all-day-bar', '.df-toast'
]

# General replacements in gradient section for common patterns
# 1. Panels: background: #fff; → frosted glass
replacements = [
    # Panel-level components: heavy frosted glass
    ('background: #fff;\n  border: 1px solid #E5E7EB;\n  border-radius: var(--gf-radius, 10px);\n  box-shadow: var(--gf-shadow);\n  transition: var(--gf-transition);',
     'background: rgba(255,255,255,0.72);\n  backdrop-filter: blur(16px) saturate(1.2);\n  -webkit-backdrop-filter: blur(16px) saturate(1.2);\n  border: 1px solid rgba(255,255,255,0.5);\n  border-radius: var(--gf-radius, 10px);\n  box-shadow: var(--gf-shadow);\n  transition: var(--gf-transition);'),
    
    # Card-level: medium frosted glass
    ('background: #fff;\n  border: 1px solid #E5E7EB;\n  border-radius: var(--gf-radius-sm, 8px);\n  box-shadow: var(--gf-shadow-sm);\n  transition: var(--gf-transition);',
     'background: rgba(255,255,255,0.82);\n  backdrop-filter: blur(8px);\n  -webkit-backdrop-filter: blur(8px);\n  border: 1px solid rgba(255,255,255,0.4);\n  border-radius: var(--gf-radius-sm, 8px);\n  box-shadow: var(--gf-shadow-sm);\n  transition: var(--gf-transition);'),
]

for old, new in replacements:
    grad_section = grad_section.replace(old, new)

# More targeted replacements for remaining #fff backgrounds
# Simple "background: #fff;" on its own line (not part of multi-line block)
# These are hover states, focus states, etc.
grad_section = grad_section.replace('background: #fff;\n  border: 1px solid #E5E7EB;\n  border-radius: var(--gf-radius, 10px);\n  box-shadow: var(--gf-shadow-sm);',
    'background: rgba(255,255,255,0.78);\n  backdrop-filter: blur(12px) saturate(1.1);\n  -webkit-backdrop-filter: blur(12px) saturate(1.1);\n  border: 1px solid rgba(255,255,255,0.5);\n  border-radius: var(--gf-radius, 10px);\n  box-shadow: var(--gf-shadow-sm);')

# Replace remaining isolated "background: #fff;" in gradient section
# These are typically hover/focus states that should be slightly more opaque
grad_section = grad_section.replace('background: #fff;', 'background: rgba(255,255,255,0.88);')

# Replace border: 1px solid #E5E7EB → glass-friendly borders
grad_section = grad_section.replace('border: 1px solid #E5E7EB;', 'border: 1px solid rgba(255,255,255,0.4);')

# Replace border: 1px solid #D1D5DB → stronger glass border
grad_section = grad_section.replace('border: 1px solid #D1D5DB;', 'border: 1px solid rgba(255,255,255,0.6);')

# Replace border: 1px solid #F3F4F6 → very subtle glass border
grad_section = grad_section.replace('border: 1px solid #F3F4F6;', 'border: 1px solid rgba(255,255,255,0.3);')

# Replace background: #F9FAFB (subtle surfaces) → semi-transparent
grad_section = grad_section.replace('background: #F9FAFB;', 'background: rgba(255,255,255,0.55);')

# Replace background: #F3F4F6 (even more subtle) → more transparent
grad_section = grad_section.replace('background: #F3F4F6;', 'background: rgba(255,255,255,0.45);')

# Replace background: #FAFAFA → light glass
grad_section = grad_section.replace('background: #FAFAFA;', 'background: rgba(255,255,255,0.6);')

# Task edit panel - special treatment for side panel
grad_section = grad_section.replace(
    'background: rgba(255,255,255,0.88);\n  border: 1px solid rgba(255,255,255,0.4);\n  border-radius: 14px 0 0 14px;\n  box-shadow: -4px 0 16px rgba(0,0,0,.06);',
    'background: rgba(255,255,255,0.82) !important;\n  backdrop-filter: blur(20px) saturate(1.3) !important;\n  -webkit-backdrop-filter: blur(20px) saturate(1.3) !important;\n  border: 1px solid rgba(255,255,255,0.5) !important;\n  border-radius: 14px 0 0 14px;\n  box-shadow: -4px 0 24px rgba(0,0,0,.08);'
)

# Utility panel - heavy glass
grad_section = grad_section.replace(
    'background: rgba(255,255,255,0.88);\n  border: 1px solid rgba(255,255,255,0.4);\n  border-radius: 12px;\n  box-shadow: 0 8px 24px rgba(0,0,0,.08);',
    'background: rgba(255,255,255,0.78) !important;\n  backdrop-filter: blur(20px) saturate(1.3) !important;\n  -webkit-backdrop-filter: blur(20px) saturate(1.3) !important;\n  border: 1px solid rgba(255,255,255,0.5) !important;\n  border-radius: 14px;\n  box-shadow: 0 8px 32px rgba(0,0,0,.08);'
)

# User menu - heavy glass
grad_section = grad_section.replace(
    'background: rgba(255,255,255,0.88);\n  border: 1px solid rgba(255,255,255,0.4);\n  border-radius: var(--gf-radius, 10px);\n  box-shadow: 0 8px 24px rgba(0,0,0,.1);',
    'background: rgba(255,255,255,0.82) !important;\n  backdrop-filter: blur(20px) saturate(1.3) !important;\n  -webkit-backdrop-filter: blur(20px) saturate(1.3) !important;\n  border: 1px solid rgba(255,255,255,0.5) !important;\n  border-radius: var(--gf-radius, 10px);\n  box-shadow: 0 8px 32px rgba(0,0,0,.1);'
)

# df-execute and df-planning-shell - keep gradient but enhance
grad_section = grad_section.replace(
    'background:\n    radial-gradient(circle at 72% 8%, color-mix(in srgb, var(--mode-primary) 8%, transparent), transparent 30%),\n    linear-gradient(135deg, var(--mode-bg-a) 0%, var(--mode-bg-b) 46%, var(--mode-bg-c) 100%);',
    'background:\n    radial-gradient(ellipse at 72% 8%, color-mix(in srgb, var(--mode-primary) 18%, transparent), transparent 45%),\n    radial-gradient(ellipse at 20% 90%, color-mix(in srgb, var(--mode-primary) 10%, transparent), transparent 45%),\n    linear-gradient(145deg, var(--mode-bg-a) 0%, var(--mode-bg-b) 50%, var(--mode-bg-c) 100%);'
)

grad_section = grad_section.replace(
    'background:\n    radial-gradient(circle at 28% 8%, color-mix(in srgb, var(--mode-primary) 8%, transparent), transparent 30%),\n    linear-gradient(135deg, var(--mode-bg-a) 0%, var(--mode-bg-b) 46%, var(--mode-bg-c) 100%);',
    'background:\n    radial-gradient(ellipse at 28% 8%, color-mix(in srgb, var(--mode-primary) 18%, transparent), transparent 45%),\n    radial-gradient(ellipse at 80% 90%, color-mix(in srgb, var(--mode-primary) 10%, transparent), transparent 45%),\n    linear-gradient(145deg, var(--mode-bg-a) 0%, var(--mode-bg-b) 50%, var(--mode-bg-c) 100%);'
)

# no-theme-gradient override at the end
grad_section = grad_section.replace(
    'background: #FFFFFF;\n}',
    'background: linear-gradient(145deg, #eef1f5, #e8ecf1, #eaecf2);\n}'
)

# Update the preview swatch for the default style
grad_section = grad_section.replace(
    '.df-ui-style-preview.sf {\n  background: #fff;\n  border: 1px solid #E5E7EB;\n  box-shadow: 0 1px 3px rgba(0,0,0,.06);\n}',
    '.df-ui-style-preview.sf {\n  background: linear-gradient(145deg, #eef1f5, #e8ecf1, #eaecf2);\n  border: 1px solid rgba(255,255,255,0.5);\n  box-shadow: 0 1px 3px rgba(0,0,0,.06);\n}'
)

# Reconstruct the file
content = content[:grad_start] + grad_section

with open(css_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done! Gradient frosted glass conversion complete.")
