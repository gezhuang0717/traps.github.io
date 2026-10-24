"""Build short public guides as REVTeX source, offline MathML HTML and native Word math.

Run with --data-dir and --reference-doc for an installed Pandoc runtime. PDFs are
generated separately; this builder does not claim a TeX compilation or Word visual QA.
"""
from pathlib import Path
import argparse
import hashlib
import json
import re
import subprocess
import zipfile

from build_public_mass_manuals import math_tokens, wrap_html_math, wrap_tex_sums

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "static/manuals"
STEMS = [kind + "_" + lang for kind in ("MATHIEU_STABILITY", "CYCLOTRON_COMPARE") for lang in ("EN", "ZH")]
STYLE = """<style>
@page{size:Letter;margin:.8in}html{font:11pt/1.35 'Times New Roman','Songti SC',serif;color:#111;background:#fff}body{max-width:50rem;margin:1rem auto;padding:0 1rem}h1,h2,h3{font-weight:bold;color:#111;break-after:avoid}h1{font-size:19pt;text-align:center}h2{font-size:13pt;margin-top:1.2em}p{text-align:justify}pre,code{font-family:Menlo,monospace;font-size:9pt;overflow-wrap:anywhere}pre{white-space:pre-wrap}a{color:#222;overflow-wrap:anywhere}table{width:100%;border-collapse:collapse}td,th{padding:.3em;vertical-align:top}math{font-size:1em}.math.display{display:block;margin:.8em 0;overflow-x:auto}li{margin:.25em 0}@media print{body{max-width:none;margin:0;padding:0}a{text-decoration:none}.math.display{overflow:visible}}
</style>"""


def polish(path):
    from docx import Document
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    from docx.shared import Inches, Pt, RGBColor
    doc = Document(path)
    for section in doc.sections:
        section.page_width = Inches(8.5); section.page_height = Inches(11)
        section.top_margin = section.bottom_margin = Inches(.8)
        section.left_margin = section.right_margin = Inches(.8)
        cols = section._sectPr.find(qn('w:cols'))
        if cols is not None: cols.set(qn('w:num'), '1')
    for style in doc.styles:
        if style.type not in (1, 2): continue
        style.font.name = 'Menlo' if style.name in ('Source Code', 'Verbatim Char') else 'Times New Roman'
        style.font.color.rgb = RGBColor(0, 0, 0)
        if style.type == 1:
            style.font.size = Pt(11)
            style.paragraph_format.line_spacing = 1.08
            style.paragraph_format.space_after = Pt(6)
        if style.name == 'Title': style.font.size = Pt(19)
        if style.name == 'Heading 1': style.font.size = Pt(13)
        if style.name == 'Heading 2': style.font.size = Pt(12)
        if style.name in ('Source Code', 'Verbatim Char'): style.font.size = Pt(9)
        fonts = style.element.get_or_add_rPr().find(qn('w:rFonts'))
        if fonts is None:
            fonts = OxmlElement('w:rFonts'); style.element.get_or_add_rPr().append(fonts)
        fonts.set(qn('w:eastAsia'), 'Songti SC')
        for border in style.element.xpath('.//w:pBdr'): border.getparent().remove(border)
    doc.core_properties.author = doc.core_properties.last_modified_by = 'TrapLab documentation'
    doc.save(path)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pandoc', default='pandoc')
    parser.add_argument('--data-dir', type=Path)
    parser.add_argument('--reference-doc', type=Path)
    args = parser.parse_args()
    manifest = {'edition': '2026-10-24', 'tex_class': 'revtex4-2', 'tex_options': ['aps', 'onecolumn', '11pt'],
                'pdf_pipeline': 'Separate browser vector printing from offline HTML; TeX compilation is not claimed.',
                'word_review': 'Native equations, fonts and privacy checked. Owner prohibits saved manual screenshots; Word page-layout acceptance is not claimed.',
                'generator_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), 'guides': []}
    for stem in STEMS:
        md = OUT / (stem + '.md'); text = md.read_text()
        assert not re.search(r'/Volumes/|/Users/|file://', text)
        expected = len(math_tokens(text)); assert expected > 5
        entry = {'name': stem, 'math_elements': expected, 'source_sha256': hashlib.sha256(md.read_bytes()).hexdigest(), 'files': []}
        layout = None
        for ext, target in [('html', 'html5'), ('tex', 'latex'), ('docx', 'docx')]:
            output = md.with_suffix('.' + ext)
            cmd = [args.pandoc, str(md), '--from=markdown+tex_math_dollars', '--to=' + target, '--standalone']
            if args.data_dir: cmd.append('--data-dir=' + str(args.data_dir))
            if ext == 'html': cmd.append('--mathml')
            if ext == 'tex': cmd += ['--pdf-engine=xelatex', '--variable=mainfont:Times New Roman', '--variable=CJKmainfont:Songti SC', '--variable=monofont:Menlo']
            if ext == 'docx':
                if args.reference_doc: cmd.append('--reference-doc=' + str(args.reference_doc))
                cmd.append('--output=' + str(output))
            result = subprocess.run(cmd, check=True, capture_output=True, timeout=50)
            if ext == 'docx':
                polish(output)
                with zipfile.ZipFile(output) as archive:
                    payload = b'\n'.join(archive.read(n) for n in archive.namelist() if n.endswith(('.xml', '.rels')))
                    assert payload.count(b'<m:oMath>') == expected, (stem, expected, payload.count(b'<m:oMath>'))
            else:
                rendered = result.stdout.decode()
                if ext == 'html':
                    rendered = re.sub(r'<!--\[if lt IE 9\]>.*?<!\[endif\]-->', '', rendered, flags=re.S).replace('</head>', STYLE + '</head>')
                    rendered, layout = wrap_html_math(rendered)
                    assert len(re.findall(r'<math(?:\s|>)', rendered)) == expected
                    assert '<script' not in rendered.lower() and 'mathjax' not in rendered.lower()
                else:
                    rendered, _ = wrap_tex_sums(rendered, layout['original_tex'])
                    compact = re.sub(r'\s+', '', rendered)
                    assert '\\documentclass[aps,onecolumn,11pt]{revtex4-2}' in compact, compact[:300]
                output.write_text(rendered); payload = output.read_bytes()
            assert not re.search(rb'/Volumes/|/Users/|file://', payload)
        for path in [md] + [md.with_suffix('.' + ext) for ext in ('html', 'tex', 'docx')]:
            entry['files'].append({'name': path.name, 'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
        manifest['guides'].append(entry)
    (OUT / 'MODULE_GUIDES_MANIFEST.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({g['name']: g['math_elements'] for g in manifest['guides']}))


if __name__ == '__main__': main()
