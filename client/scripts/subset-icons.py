#!/usr/bin/env python3
"""Regenerate src/assets/material-symbols-subset.woff2.

The full `material-symbols/material-symbols-outlined.woff2` from npm is ~4 MB (all 3600+ icons)
and was the single biggest asset on first load. This produces a subset containing ONLY the icons
this app actually references (~310), cutting it to ~300 KB.

Run from the client/ directory after adding/removing any icon:
    python scripts/subset-icons.py

Requires: pip install fonttools brotli

How it works: Material Symbols renders an icon from its literal name via a required ligature
([m,e,e,t,i,n,g,_,r,o,o,m] -> the meeting_room glyph). Two things make a naive subset fail:
  1. `pyftsubset --text=<names>` alone re-adds EVERY icon, because fontTools' ligature closure is
     component-based: once the base letters are present it pulls in every icon's ligature.
  2. The output glyph is NOT reliably named after the icon (e.g. `location_on` / `laptop` map to a
     codepoint-named glyph). So we can't detect "is this a real icon" by glyph-name equality.
So we SHAPE each candidate name through the font's ligatures to find its real output glyph, prune
the GSUB ligature table to just those glyphs, THEN subset. Icon names are discovered from quoted
string literals and material-symbols span text — the only two ways an icon reaches the DOM here.
If you ever build an icon name some other way (template literal, server data), add it to
EXTRA_ICONS below.
"""
import os, re, subprocess, sys
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src")
FONT_IN = os.path.join(ROOT, "node_modules", "material-symbols", "material-symbols-outlined.woff2")
OUT_DIR = os.path.join(SRC, "assets")
FONT_OUT = os.path.join(OUT_DIR, "material-symbols-subset.woff2")
TMP = os.path.join(OUT_DIR, "_pruned.ttf")

# Escape hatch for any icon referenced in a way the regexes below can't see.
EXTRA_ICONS: list[str] = []

# ── 1. Collect candidate icon names from source (2+ chars — catches short ones like `tv`) ─────
quoted_re = re.compile(r"""['"]([a-z][a-z0-9_]+)['"]""")
span_re = re.compile(r">\s*([a-z][a-z0-9_]+)\s*</span>")
tokens = set(EXTRA_ICONS)
for root, _dirs, files in os.walk(SRC):
    for f in files:
        if f.endswith((".ts", ".tsx", ".js", ".jsx")):
            text = open(os.path.join(root, f), encoding="utf-8").read()
            tokens.update(quoted_re.findall(text))
            tokens.update(span_re.findall(text))

font = TTFont(FONT_IN)
cmap = font.getBestCmap()

# Build the ligature map: first_glyph -> [(component_glyphs_after_first, output_glyph), ...]
ligmap = {}
for lk in font["GSUB"].table.LookupList.Lookup:
    for st in [(s.ExtSubTable if lk.LookupType == 7 else s) for s in lk.SubTable]:
        if st.__class__.__name__ == "LigatureSubst":
            for first, lst in st.ligatures.items():
                for lg in lst:
                    ligmap.setdefault(first, []).append((lg.Component, lg.LigGlyph))


def shape_to_single_glyph(name):
    """Return the single output glyph a name collapses to, or None if it isn't one icon."""
    glyphs = [cmap.get(ord(c)) for c in name]
    if any(g is None for g in glyphs):
        return None
    i, out = 0, []
    while i < len(glyphs):
        matched = None
        for comps, outg in ligmap.get(glyphs[i], []):
            if glyphs[i + 1:i + 1 + len(comps)] == comps:
                matched = (len(comps) + 1, outg); break
        if matched:
            out.append(matched[1]); i += matched[0]
        else:
            out.append(glyphs[i]); i += 1
    return out[0] if len(out) == 1 else None

# ── 2. Detect real icons by SHAPING (not by glyph-name equality) ──────────────────────────────
icon_names = []          # names whose ligature we must keep (feed to --text so closure retains it)
keep_glyphs = set()      # the actual output glyphs to preserve
for t in sorted(tokens):
    g = shape_to_single_glyph(t)
    if g is not None:
        icon_names.append(t)
        keep_glyphs.add(g)
print(f"{len(tokens)} candidate tokens -> {len(icon_names)} real icons ({len(keep_glyphs)} glyphs)")

# ── 3. Prune GSUB ligatures down to only the icons we keep ────────────────────────────────────
def prune(lookup):
    for st in lookup.SubTable:
        sub = st.ExtSubTable if lookup.LookupType == 7 else st
        if sub.__class__.__name__ != "LigatureSubst":
            continue
        for first, ligs in list(sub.ligatures.items()):
            kept = [lg for lg in ligs if lg.LigGlyph in keep_glyphs]
            if kept:
                sub.ligatures[first] = kept
            else:
                del sub.ligatures[first]

for lk in font["GSUB"].table.LookupList.Lookup:
    prune(lk)
font.save(TMP)

# ── 4. Normal subset (closure ON) — only our icons + their letters survive ────────────────────
os.makedirs(OUT_DIR, exist_ok=True)
text_file = os.path.join(OUT_DIR, "_icon_text.txt")
letters = "abcdefghijklmnopqrstuvwxyz0123456789_ "
open(text_file, "w", encoding="utf-8").write(letters + "\n" + " ".join(icon_names))

subprocess.run([
    sys.executable, "-m", "fontTools.subset", TMP,
    f"--output-file={FONT_OUT}",
    "--flavor=woff2",
    "--layout-features=liga,rlig,rclt,dlig,ccmp",
    f"--text-file={text_file}",
    "--no-hinting",
    "--desubroutinize",
    "--drop-tables+=DSIG",
], check=True)
os.remove(TMP)
os.remove(text_file)

before, after = os.path.getsize(FONT_IN), os.path.getsize(FONT_OUT)
print(f"Font: {before/1024/1024:.2f} MB -> {after/1024:.1f} KB  ({after/before*100:.1f}%)")
