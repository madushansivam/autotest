#!/usr/bin/env python3
"""
Generate Figure 1 (architecture diagram) and Figure 2 (ER diagram)
as clean PNG images for the AutoTest final report.
Source for Figure 1: run-pipeline.js lines 16-120, server.js lines 13-54
Source for Figure 2: db.js lines 5-32
"""

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch
import matplotlib.patheffects as pe
import os

OUT = '/home/madushan/Project/autotest/report_assets'
os.makedirs(OUT, exist_ok=True)

# ══════════════════════════════════════════════════════════════════════
# FIGURE 1 — ARCHITECTURE DIAGRAM
# ══════════════════════════════════════════════════════════════════════

fig1, ax = plt.subplots(figsize=(14, 18))
ax.set_xlim(0, 14)
ax.set_ylim(0, 18)
ax.axis('off')
fig1.patch.set_facecolor('#FAFAFA')

def box(ax, x, y, w, h, label, sublabel=None, color='#2563EB', textcolor='white',
        fontsize=11, style='round,pad=0.1', lw=1.5, bg=None):
    fc = bg if bg else color
    rect = FancyBboxPatch((x, y), w, h, boxstyle=style,
                          facecolor=fc, edgecolor=color, linewidth=lw)
    ax.add_patch(rect)
    cy = y + h/2 + (0.15 if sublabel else 0)
    ax.text(x + w/2, cy, label, ha='center', va='center',
            fontsize=fontsize, fontweight='bold', color=textcolor, wrap=True,
            multialignment='center')
    if sublabel:
        ax.text(x + w/2, y + h/2 - 0.28, sublabel, ha='center', va='center',
                fontsize=8.5, color=textcolor, style='italic', multialignment='center')

def extbox(ax, x, y, w, h, label, sublabel=None):
    """External system — dashed border"""
    rect = FancyBboxPatch((x, y), w, h, boxstyle='round,pad=0.1',
                          facecolor='#F0F9FF', edgecolor='#60A5FA',
                          linewidth=1.5, linestyle='--')
    ax.add_patch(rect)
    cy = y + h/2 + (0.15 if sublabel else 0)
    ax.text(x + w/2, cy, label, ha='center', va='center',
            fontsize=10, fontweight='bold', color='#1E40AF', multialignment='center')
    if sublabel:
        ax.text(x + w/2, y + h/2 - 0.28, sublabel, ha='center', va='center',
                fontsize=8, color='#3B82F6', style='italic', multialignment='center')

def arr(ax, x1, y1, x2, y2, label='', color='#374151', lw=1.5):
    ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
                arrowprops=dict(arrowstyle='->', color=color, lw=lw,
                                connectionstyle='arc3,rad=0.0'))
    if label:
        mx, my = (x1+x2)/2, (y1+y2)/2
        ax.text(mx + 0.1, my, label, fontsize=8, color='#6B7280', ha='left', va='center')

# Title
ax.text(7, 17.5, 'AutoTest — System Architecture', ha='center', va='center',
        fontsize=15, fontweight='bold', color='#111827')
ax.text(7, 17.1, 'Source: server.js (lines 13–54), run-pipeline.js (lines 16–120)',
        ha='center', va='center', fontsize=9, color='#6B7280', style='italic')

# ── User / Dashboard ─────────────────────────────────────────────
box(ax, 4.5, 15.8, 5, 0.9, 'User (Browser)', 'public/index.html — Vanilla JS Dashboard',
    color='#374151', bg='#F3F4F6', textcolor='#111827')

# ── Express Server ───────────────────────────────────────────────
box(ax, 3.5, 14.0, 7, 1.2, 'Express Server  ·  server.js',
    'POST /api/crawl  ·  GET /api/crawls  ·  DELETE /api/crawls/:id',
    color='#1D4ED8', bg='#1E40AF')

arr(ax, 7, 15.8, 7, 15.2, 'POST /api/crawl (url)')
arr(ax, 6.5, 14.0, 6.5, 12.85, '', '#6B7280')  # down to isUnsafeUrl

# ── isUnsafeUrl ──────────────────────────────────────────────────
box(ax, 4.5, 13.25, 5, 0.75, 'isUnsafeUrl(url)',
    'Rejects: non-http(s), localhost, private IP ranges',
    color='#92400E', bg='#FEF3C7', textcolor='#78350F')

# reject arrow
ax.annotate('', xy=(11, 13.6), xytext=(9.5, 13.6),
            arrowprops=dict(arrowstyle='->', color='#DC2626', lw=1.5))
ax.text(11.1, 13.6, '400 Bad\nRequest', fontsize=8.5, color='#DC2626', va='center')

arr(ax, 7, 13.25, 7, 12.1, 'passes')

# ── runFullPipeline container ────────────────────────────────────
pipeline_box = FancyBboxPatch((1.5, 4.5), 11, 7.5, boxstyle='round,pad=0.15',
                               facecolor='#EFF6FF', edgecolor='#3B82F6', linewidth=2)
ax.add_patch(pipeline_box)
ax.text(7, 12.15, 'runFullPipeline(url)  ·  run-pipeline.js', ha='center',
        fontsize=10, fontweight='bold', color='#1D4ED8')

# Stage 1: Crawl
box(ax, 2.5, 10.3, 9, 1.4, 'Stage 1: scanPage()',
    'Playwright (headless Chromium) — extract buttons / inputs / links\nTag each element safe:true/false via safe-mode.config.json',
    color='#065F46', bg='#ECFDF5', textcolor='#064E3B', fontsize=9.5)

# Stage 2: Generate Test Cases
box(ax, 2.5, 8.4, 9, 1.5, 'Stage 2: generateTestCases()',
    'HuggingFace Inference API — meta-llama/Llama-3.1-8B-Instruct\nInput: page data JSON  →  Output: [{description, confidence}] × 3–5\nRetry up to 3× on malformed JSON',
    color='#5B21B6', bg='#F5F3FF', textcolor='#4C1D95', fontsize=9.5)

# Stage 3: Generate Scripts
box(ax, 2.5, 6.4, 9, 1.6, 'Stage 3: generateScript()  (per test case)',
    'HuggingFace Inference API (same model)\nInput: test case description + page data JSON\nOutput: Playwright JS function body\nRetry up to 3× on suspicious output',
    color='#5B21B6', bg='#F5F3FF', textcolor='#4C1D95', fontsize=9.5)

# Stage 4: Execute
box(ax, 2.5, 4.7, 9, 1.4, 'Stage 4: executeTest()  (per test case)',
    'Playwright (headless Chromium)\nCompile script via AsyncFunction  →  Navigate  →  Run\nClassify: pass | fail (assertion_failed) | crash (runtime_error) | skipped',
    color='#065F46', bg='#ECFDF5', textcolor='#064E3B', fontsize=9.5)

# Arrows between stages
for y1, y2 in [(10.3, 9.9), (8.4, 8.0), (6.4, 6.0)]:
    arr(ax, 7, y1, 7, y2, '')

# ── SQLite ───────────────────────────────────────────────────────
box(ax, 4.5, 3.0, 5, 1.3, 'SQLite: autotest.db',
    'Tables: crawls · test_cases · test_results',
    color='#7C3AED', bg='#7C3AED')

arr(ax, 7, 4.7, 7, 4.3, 'Write results')

# ── Dashboard reads back ─────────────────────────────────────────
ax.annotate('', xy=(4.0, 15.8), xytext=(4.0, 3.65),
            arrowprops=dict(arrowstyle='->', color='#6B7280', lw=1.5,
                            connectionstyle='arc3,rad=0.0'))
ax.text(3.75, 10, 'GET /api/crawls\nGET /api/crawls/:id\nDELETE /api/crawls/:id',
        ha='center', fontsize=8, color='#6B7280', rotation=90, va='center')

ax.text(7, 0.4, 'Figure 1: AutoTest system architecture. Dashed-border boxes denote external systems.',
        ha='center', va='center', fontsize=9.5, color='#374151',
        style='italic',
        bbox=dict(boxstyle='round,pad=0.3', facecolor='#F9FAFB', edgecolor='#D1D5DB'))

plt.tight_layout(pad=0.5)
plt.savefig(f'{OUT}/figure1_architecture.png', dpi=150, bbox_inches='tight',
            facecolor='#FAFAFA')
plt.close()
print('✓ Figure 1 saved: figure1_architecture.png')


# ══════════════════════════════════════════════════════════════════════
# FIGURE 2 — ER DIAGRAM
# Source: db.js lines 5-32
# ══════════════════════════════════════════════════════════════════════

fig2, ax2 = plt.subplots(figsize=(13, 10))
ax2.set_xlim(0, 13)
ax2.set_ylim(0, 10)
ax2.axis('off')
fig2.patch.set_facecolor('#FAFAFA')

ax2.text(6.5, 9.6, 'AutoTest — SQLite Schema (db.js)', ha='center',
         fontsize=14, fontweight='bold', color='#111827')
ax2.text(6.5, 9.25, 'Source: db.js lines 5–32', ha='center',
         fontsize=9, color='#6B7280', style='italic')

def er_table(ax, x, y, title, rows, pk_row=0, fk_rows=None, w=3.8, row_h=0.42):
    fk_rows = fk_rows or []
    header_h = 0.55
    total_h = header_h + len(rows) * row_h
    # Header
    hr = FancyBboxPatch((x, y + total_h - header_h), w, header_h,
                         boxstyle='round,pad=0.05', facecolor='#1E40AF', edgecolor='#1E40AF')
    ax.add_patch(hr)
    ax.text(x + w/2, y + total_h - header_h/2, title, ha='center', va='center',
            fontsize=11, fontweight='bold', color='white')
    # Rows
    for i, (col, typ) in enumerate(rows):
        ry = y + total_h - header_h - (i+1)*row_h
        is_pk = (i == pk_row)
        is_fk = (i in fk_rows)
        bg = '#FEF9C3' if is_pk else ('#EDE9FE' if is_fk else 'white')
        ec = '#1E40AF'
        rb = FancyBboxPatch((x, ry), w, row_h, boxstyle='square,pad=0',
                             facecolor=bg, edgecolor='#CBD5E1', linewidth=0.8)
        ax.add_patch(rb)
        prefix = '🔑 ' if is_pk else ('FK  ' if is_fk else '     ')
        ax.text(x + 0.15, ry + row_h/2, prefix + col, ha='left', va='center',
                fontsize=9, color='#111827', fontweight='bold' if is_pk else 'normal')
        ax.text(x + w - 0.1, ry + row_h/2, typ, ha='right', va='center',
                fontsize=8.5, color='#6B7280')
    return x + w/2, y + total_h - header_h  # centre-top for FK arrows

# ── crawls table ─────────────────────────────────────────────────
crawls_rows = [
    ('id',         'INTEGER PK'),
    ('url',        'TEXT NOT NULL'),
    ('crawled_at', 'TEXT NOT NULL'),
    ('raw_json',   'TEXT NOT NULL'),
]
er_table(ax2, 0.5, 3.5, 'crawls', crawls_rows, pk_row=0)

# ── test_cases table ─────────────────────────────────────────────
tc_rows = [
    ('id',          'INTEGER PK'),
    ('crawl_id',    'INTEGER FK → crawls(id)'),
    ('description', 'TEXT NOT NULL'),
    ('confidence',  "TEXT NOT NULL"),
    ('script',      'TEXT (nullable)'),
    ('created_at',  'TEXT NOT NULL'),
]
er_table(ax2, 4.6, 2.0, 'test_cases', tc_rows, pk_row=0, fk_rows=[1])

# ── test_results table ───────────────────────────────────────────
tr_rows = [
    ('id',               'INTEGER PK'),
    ('test_case_id',     'INTEGER FK → test_cases(id)'),
    ('result',           "TEXT NOT NULL"),
    ('failure_category', 'TEXT (nullable)'),
    ('error',            'TEXT (nullable)'),
    ('executed_at',      'TEXT NOT NULL'),
]
er_table(ax2, 8.7, 1.2, 'test_results', tr_rows, pk_row=0, fk_rows=[1])

# ── Relationship lines ───────────────────────────────────────────
# crawls 1 —< test_cases
ax2.annotate('', xy=(4.6, 5.07), xytext=(4.3, 5.07),
             arrowprops=dict(arrowstyle='->', color='#374151', lw=1.8))
ax2.plot([4.3, 4.3], [5.07, 7.1], color='#374151', lw=1.8)   # up
ax2.plot([2.3, 4.3], [7.1, 7.1], color='#374151', lw=1.8)    # across
ax2.plot([2.3, 2.3], [5.1, 7.1], color='#374151', lw=1.8)    # down to crawls right
ax2.text(3.0, 7.3, '1', fontsize=11, color='#374151', fontweight='bold')
ax2.text(4.35, 5.3, '*', fontsize=14, color='#374151', fontweight='bold')

# test_cases 1 —< test_results
ax2.annotate('', xy=(8.7, 4.22), xytext=(8.4, 4.22),
             arrowprops=dict(arrowstyle='->', color='#374151', lw=1.8))
ax2.plot([8.4, 8.4], [4.22, 7.4], color='#374151', lw=1.8)
ax2.plot([6.4, 8.4], [7.4, 7.4], color='#374151', lw=1.8)
ax2.plot([6.4, 6.4], [4.22, 7.4], color='#374151', lw=1.8)
ax2.text(7.1, 7.6, '1', fontsize=11, color='#374151', fontweight='bold')
ax2.text(8.45, 4.45, '*', fontsize=14, color='#374151', fontweight='bold')

# Legend
legend_items = [
    mpatches.Patch(facecolor='#FEF9C3', edgecolor='#CBD5E1', label='Primary Key (PK)'),
    mpatches.Patch(facecolor='#EDE9FE', edgecolor='#CBD5E1', label='Foreign Key (FK)'),
    mpatches.Patch(facecolor='white',   edgecolor='#CBD5E1', label='Regular column'),
]
ax2.legend(handles=legend_items, loc='lower right', fontsize=9,
           framealpha=0.95, edgecolor='#CBD5E1')

# Value note
ax2.text(0.5, 0.55,
         "confidence values: 'structural' | 'behavioral' | 'unvalidated'\n"
         "result values: 'pass' | 'fail' | 'crash' | 'skipped'\n"
         "failure_category values: 'runtime_error' | 'assertion_failed' | 'syntax_error' (NULL for pass/skipped)",
         fontsize=8.5, color='#374151',
         bbox=dict(boxstyle='round,pad=0.4', facecolor='#F9FAFB', edgecolor='#D1D5DB'))

ax2.text(6.5, 0.15, 'Figure 2: SQLite schema. All timestamps stored as ISO 8601 TEXT strings.',
         ha='center', fontsize=9.5, color='#374151', style='italic')

plt.tight_layout(pad=0.5)
plt.savefig(f'{OUT}/figure2_er_diagram.png', dpi=150, bbox_inches='tight',
            facecolor='#FAFAFA')
plt.close()
print('✓ Figure 2 saved: figure2_er_diagram.png')

print('\nAll diagrams generated.')
