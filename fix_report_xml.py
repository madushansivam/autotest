#!/usr/bin/env python3
"""
AutoTest Final Report — XML-level fix script.
Fixes Issues 1, 3, and 4 directly in XML.
Issue 2 (TOC calculation) is verified to already be populated.
"""

import re, shutil, os, copy
from lxml import etree

SRC  = '/home/madushan/Project/autotest/AutoTest_Working_Copy.docx'
WORK = '/tmp/docx_work'
EXTRACTED = f'{WORK}/docx_extracted'
DOC_XML = f'{EXTRACTED}/word/document.xml'
OUT_DOCX = '/home/madushan/Project/autotest/AutoTest_Final_Fixed.docx'

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
ns = {'w': W}

def qtag(local): return f'{{{W}}}{local}'

def get_text(elem):
    return ''.join((t.text or '') for t in elem.iter(qtag('t')))

# ── Load XML ────────────────────────────────────────────────────
tree = etree.parse(DOC_XML)
root = tree.getroot()
body = root.find('.//w:body', ns)
paras = body.findall('w:p', ns)
print(f"Loaded: {len(paras)} paragraphs")

# ══════════════════════════════════════════════════════════════════
# ISSUE 1 — Remove false-positive sentence from Abstract (para #12)
# ══════════════════════════════════════════════════════════════════
print("\n── Issue 1: Removing false-positive sentence from Abstract ──")

FALSE_POS_SENTENCE = (
    "A separate finding - a test that returned a false positive by iterating "
    "zero times over a hallucinated selector - was identified through manual "
    "result review rather than automated detection, and is discussed as an open "
    "limitation rather than a solved capability."
)

p12 = paras[12]
runs = p12.findall('.//w:r', ns)
print(f"  Para #12 runs: {len(runs)}")

# The abstract is one long run — modify the w:t text directly
for r in runs:
    for t_elem in r.findall('w:t', ns):
        if t_elem.text and 'false positive' in t_elem.text:
            original = t_elem.text
            # Remove the false-positive sentence
            # It follows "AI-generated test code. " and precedes "The principal..."
            # Strategy: replace the sentence + surrounding whitespace
            target = " A separate finding - a test that returned a false positive by iterating zero times over a hallucinated selector - was identified through manual result review rather than automated detection, and is discussed as an open limitation rather than a solved capability."
            if target in t_elem.text:
                t_elem.text = t_elem.text.replace(target, '')
                print(f"  ✓ Removed false-positive sentence (variant 1)")
            else:
                # Try without leading space
                target2 = "A separate finding - a test that returned a false positive by iterating zero times over a hallucinated selector - was identified through manual result review rather than automated detection, and is discussed as an open limitation rather than a solved capability. "
                if target2 in t_elem.text:
                    t_elem.text = t_elem.text.replace(target2, '')
                    print(f"  ✓ Removed false-positive sentence (variant 2)")
                else:
                    # Regex approach - more flexible
                    pattern = r'\s*A separate finding\s*-[^.]+hallucinated selector[^.]+\.\s*'
                    new_text, n = re.subn(pattern, ' ', t_elem.text, flags=re.DOTALL)
                    if n > 0:
                        t_elem.text = new_text.strip()
                        # Re-add trailing space if needed
                        print(f"  ✓ Removed false-positive sentence (regex, {n} replacements)")
                    else:
                        print(f"  ✗ Could not remove sentence — manual inspection needed")
                        print(f"    Text snippet: {t_elem.text[500:700]}")

# Verify removal
abstract_text = get_text(p12)
if 'false positive' not in abstract_text and 'iterating zero' not in abstract_text:
    print(f"  ✓ VERIFIED: false-positive sentence absent from abstract")
    print(f"  Abstract now ends with: ...{abstract_text[-200:]}")
else:
    print(f"  ✗ STILL PRESENT: {abstract_text[abstract_text.find('false positive')-20:abstract_text.find('false positive')+100]}")


# ══════════════════════════════════════════════════════════════════
# ISSUE 2 — Verify TOC is already populated
# ══════════════════════════════════════════════════════════════════
print("\n── Issue 2: TOC population check ──")

# Find the main TOC field and check it has content between separate and end
with open(DOC_XML, 'r', encoding='utf-8') as f:
    raw = f.read()

# Check for hyperlink entries in the main TOC (the one at pos ~28778)
toc_links = re.findall(r'w:anchor="__RefHeading', raw)
print(f"  TOC hyperlink anchors found: {len(toc_links)}")
if len(toc_links) > 0:
    print(f"  ✓ Main TOC is already populated with {len(toc_links)} entries")
    # Sample a few entries
    for m in re.finditer(r'w:tooltip="([^"]+)"', raw[:50000]):
        print(f"    Entry: '{m.group(1)}'")
else:
    print(f"  ✗ Main TOC appears empty")


# ══════════════════════════════════════════════════════════════════
# ISSUE 3 — List of Figures: use Fallback approach
# (Replace empty TOC field with static list; delete List of Tables)
# ══════════════════════════════════════════════════════════════════
print("\n── Issue 3: List of Figures (static) + Delete List of Tables ──")

# The 4 figure captions (from our earlier inspection):
FIGURE_CAPTIONS = [
    "Figure 1: AutoTest system architecture (run-pipeline.js, server.js). Dashed-border boxes denote external systems.",
    "Figure 2: SQLite database schema (db.js lines 5–32). All timestamps stored as ISO 8601 TEXT strings.",
    "Figure 3: AutoTest dashboard — URL input form and crawl history panel showing one run for https://demo.playwright.dev/todomvc (2 pass, 1 fail, 0 crash).",
    "Figure 4: Detail view for crawl #1 — three generated test cases with results. Two tests passed; one failed due to a strict-mode locator ambiguity.",
]

def make_text_para(style_val, text, font_name=None, font_size_halfpts=None):
    """Create a minimal <w:p> element with given style and text."""
    p = etree.Element(qtag('p'))
    pPr = etree.SubElement(p, qtag('pPr'))
    pStyle = etree.SubElement(pPr, qtag('pStyle'))
    pStyle.set(qtag('val'), style_val)
    if text:
        r = etree.SubElement(p, qtag('r'))
        if font_name or font_size_halfpts:
            rPr = etree.SubElement(r, qtag('rPr'))
            if font_name:
                rFonts = etree.SubElement(rPr, qtag('rFonts'))
                rFonts.set(qtag('ascii'), font_name)
                rFonts.set(qtag('hAnsi'), font_name)
            if font_size_halfpts:
                sz = etree.SubElement(rPr, qtag('sz'))
                sz.set(qtag('val'), str(font_size_halfpts))
        t = etree.SubElement(r, qtag('t'))
        t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
        t.text = text
    return p

# Re-parse with lxml for structural modifications
tree2 = etree.parse(DOC_XML)
root2 = tree2.getroot()
body2 = root2.find('.//w:body', ns)
# Get all direct children of body (includes p, tbl, sdt, sectPr etc.)
all_children = list(body2)

# Find para indices by re-querying
def get_para_index(body, target_idx):
    """Get the i-th <w:p> element that is a direct child of body."""
    count = 0
    for child in body:
        if child.tag == qtag('p'):
            if count == target_idx:
                return child
            count += 1
    return None

# We need to find the elements by content since indices may shift
def find_para_by_text(body, needle):
    """Find first w:p in body (direct child) containing needle text."""
    for child in body:
        if child.tag == qtag('p'):
            txt = get_text(child)
            if needle in txt:
                return child
    return None

def find_para_with_instr(body, instr_needle):
    """Find first w:p in body (direct child) whose instrText contains needle."""
    for child in body:
        if child.tag == qtag('p'):
            for instr in child.iter(qtag('instrText')):
                if instr.text and instr_needle in instr.text:
                    return child
    return None

def find_sdt_with_instr(body, instr_needle):
    """Find first w:sdt in body (direct child) whose instrText contains needle."""
    for child in body:
        if child.tag in (qtag('sdt'), qtag('p')):
            for instr in child.iter(qtag('instrText')):
                if instr.text and instr_needle in instr.text:
                    return child
    return None

# ── Replace List of Figures field with static entries ──────────
lof_heading = find_para_by_text(body2, 'List of Figures')
lof_field_para = find_para_with_instr(body2, 'Figure')

if not lof_field_para:
    # Try sdt
    lof_field_para = find_sdt_with_instr(body2, 'Figure')

print(f"  List of Figures heading para found: {lof_heading is not None}")
print(f"  LoF field para found: {lof_field_para is not None}")

if lof_field_para is not None:
    parent = lof_field_para.getparent()
    idx = list(parent).index(lof_field_para)
    # Replace the TOC field paragraph with 4 static caption lines
    parent.remove(lof_field_para)
    # Insert static lines at the same position (reversed so first ends up on top)
    for cap in reversed(FIGURE_CAPTIONS):
        new_p = make_text_para('Normal', cap)
        parent.insert(idx, new_p)
    print(f"  ✓ Replaced LoF TOC field with {len(FIGURE_CAPTIONS)} static entries")
else:
    print(f"  ✗ LoF field para not found — skipping")

# ── Delete List of Tables heading + its TOC field ──────────────
lot_heading = find_para_by_text(body2, 'List of Tables')
lot_field = find_para_with_instr(body2, 'Table')
if not lot_field:
    lot_field = find_sdt_with_instr(body2, 'Table')

if lot_heading is not None:
    lot_heading.getparent().remove(lot_heading)
    print(f"  ✓ Deleted 'List of Tables' heading")
else:
    print(f"  ✗ 'List of Tables' heading not found")

if lot_field is not None:
    lot_field.getparent().remove(lot_field)
    print(f"  ✓ Deleted LoT TOC field paragraph")
else:
    print(f"  ✗ LoT field para not found")

# Also remove any blank paragraph between the heading and field if it exists
# (it was between them - clean up)


# ══════════════════════════════════════════════════════════════════
# ISSUE 4 — Monospace font for all Appendix B code listing runs
# ══════════════════════════════════════════════════════════════════
print("\n── Issue 4: Monospace font for Appendix B code listings ──")

# Code paragraph ranges identified:
# Listing B.1 prose intro: 305-306 (keep normal — they're descriptive prose)
# Listing B.1 code: 307-327
# Listing B.2 prose intro: 329-330
# Listing B.2 code: 331-340
# Listing B.3 prose intro: 342-343
# Listing B.3 code: 344-350

# We'll identify code paragraphs by being between Listing X header and the next
# Listing/Appendix section. We apply Courier only to the CODE lines, not the
# "Listing B.X — ..." header or the "Sent to..." descriptive lines.
#
# Code lines (need Courier): everything that starts with spaces, or known code patterns.
# Prose lines (keep normal): "Listing B.1 —...", "The scanPage()...", "Sent to...", "Executed after..."

PROSE_MARKERS = [
    "Listing B.1", "Listing B.2", "Listing B.3",
    "The scanPage() function uses",
    "Sent to meta-llama",
    "Executed after each generated script",
    "The following code listings",
]

def is_prose_line(txt):
    for marker in PROSE_MARKERS:
        if txt.strip().startswith(marker):
            return True
    return False

def apply_courier_to_para(p_elem):
    """Ensure every run in this paragraph has Courier New 9pt."""
    for r in p_elem.iter(qtag('r')):
        rPr = r.find(qtag('rPr'))
        if rPr is None:
            rPr = etree.Element(qtag('rPr'))
            r.insert(0, rPr)
        # rFonts
        rFonts = rPr.find(qtag('rFonts'))
        if rFonts is None:
            rFonts = etree.SubElement(rPr, qtag('rFonts'))
        rFonts.set(qtag('ascii'), 'Courier New')
        rFonts.set(qtag('hAnsi'), 'Courier New')
        # sz (9pt = 18 half-points)
        sz = rPr.find(qtag('sz'))
        if sz is None:
            sz = etree.SubElement(rPr, qtag('sz'))
        sz.set(qtag('val'), '18')
        # szCs
        szCs = rPr.find(qtag('szCs'))
        if szCs is None:
            szCs = etree.SubElement(rPr, qtag('szCs'))
        szCs.set(qtag('val'), '18')

# Work through all direct children of body2 looking for the code listing region
in_appendix_b = False
in_code_block = False
courier_applied = 0
code_paras_found = []

for child in body2:
    if child.tag != qtag('p'):
        continue
    txt = get_text(child)
    style_elem = child.find('.//w:pStyle', ns)
    style = style_elem.get(qtag('val')) if style_elem is not None else 'Normal'

    # Detect entry into Appendix B
    if 'Appendix B' in txt and 'Heading' in style:
        in_appendix_b = True
        in_code_block = False
        continue

    # Stop if we hit Appendix C or a new top-level heading after B
    if in_appendix_b and 'Heading1' in style and 'Appendix B' not in txt and txt.strip():
        in_appendix_b = False
        break

    if not in_appendix_b:
        continue

    # Detect start/end of code blocks within Appendix B
    if txt.strip().startswith('Listing B.'):
        in_code_block = True  # the header line itself is prose

    if in_code_block and txt.strip():
        if is_prose_line(txt):
            # Prose descriptor — keep as-is, skip Courier
            pass
        else:
            # Code line — apply Courier
            apply_courier_to_para(child)
            code_paras_found.append(txt[:40])
            courier_applied += 1

print(f"  ✓ Applied Courier New to {courier_applied} code paragraphs")
print(f"  Sample code lines fixed:")
for line in code_paras_found[:8]:
    print(f"    {repr(line)}")


# ══════════════════════════════════════════════════════════════════
# SAVE MODIFIED XML back into docx
# ══════════════════════════════════════════════════════════════════
print("\n── Saving ──")

# Write modified document.xml (from tree2 which has Issues 1 + 3 + 4 fixed)
# But we also applied Issue 1 to tree (the first parse). We need to merge.
# Actually: let's re-apply Issue 1 fix to tree2 as well.

# Re-apply Issue 1 to tree2
p12_v2 = None
count = 0
for child in body2:
    if child.tag == qtag('p'):
        if count == 12:
            p12_v2 = child
            break
        count += 1

if p12_v2 is not None:
    for r in p12_v2.iter(qtag('r')):
        for t_elem in r.findall(qtag('t')):
            if t_elem.text and 'false positive' in t_elem.text:
                pattern = r'\s*A separate finding\s*-[^.]+hallucinated selector[^.]+\.\s*'
                new_text, n = re.subn(pattern, ' ', t_elem.text, flags=re.DOTALL)
                if n > 0:
                    t_elem.text = new_text
                    print(f"  ✓ Issue 1 also applied to tree2 ({n} replacements)")

# Write tree2 to document.xml
with open(DOC_XML, 'wb') as f:
    tree2.write(f, xml_declaration=True, encoding='UTF-8', standalone=True)
print(f"  ✓ document.xml written")

# Repack the docx
import zipfile, os

if os.path.exists(OUT_DOCX):
    os.remove(OUT_DOCX)

with zipfile.ZipFile(SRC, 'r') as zin:
    with zipfile.ZipFile(OUT_DOCX, 'w', zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            if item.filename == 'word/document.xml':
                with open(DOC_XML, 'rb') as f:
                    zout.writestr(item, f.read())
            else:
                zout.writestr(item, zin.read(item.filename))

print(f"  ✓ Saved: {OUT_DOCX}")

# ── Final XML verification ──
print("\n── Verification ──")
with zipfile.ZipFile(OUT_DOCX, 'r') as z:
    doc_content = z.read('word/document.xml').decode('utf-8')

checks = [
    ('false positive absent', 'false positive' not in doc_content),
    ('iterating zero absent', 'iterating zero' not in doc_content),
    ('hallucinated selector absent', 'hallucinated selector' not in doc_content),
    ('Main TOC entries present', 'RefHeading' in doc_content),
    ('LoF static entries present', 'Figure 1: AutoTest system' in doc_content),
    ('LoT heading absent', False),  # will check below
    ('Courier New in code', doc_content.count('Courier New') > 50),
]

# Check LoT
tree_check = etree.fromstring(doc_content.encode('utf-8'))
body_check = tree_check.find('.//{%s}body' % W)
lot_gone = True
for child in body_check:
    txt = get_text(child)
    if txt.strip() == 'List of Tables':
        lot_gone = False
        break
checks[5] = ('LoT heading absent', lot_gone)

for name, result in checks:
    print(f"  {'✓' if result else '✗'} {name}")

print(f"\n  Courier New occurrences: {doc_content.count('Courier New')}")
print(f"\nDone.")
