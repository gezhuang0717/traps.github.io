"""Bounded text, glyph, page-box and privacy QA. Does not render or rewrite PDFs."""
from pathlib import Path
import argparse
import hashlib
import json
import logging
import re

import pdfplumber
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'static/manuals'
STEMS = [kind + '_' + lang for kind in ('MASS_FILTER_EQUATIONS', 'MATHIEU_STABILITY', 'CYCLOTRON_COMPARE') for lang in ('EN', 'ZH')]
PRIVATE = re.compile(r'/Volumes/|/Users/|file://|github\.com/gezhuang0717', re.I)
logging.getLogger('pdfminer').setLevel(logging.ERROR)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def inspect(path):
    reader = PdfReader(str(path))
    metadata = str(dict(reader.metadata or {}))
    root = reader.trailer['/Root']
    if root.get('/Metadata'):
        metadata += root['/Metadata'].get_object().get_data().decode('utf-8', 'replace')
    names = root.get('/Names')
    names = names.get_object() if names else {}
    embedded = bool(names.get('/EmbeddedFiles'))
    annotations = []
    for page in reader.pages:
        for item in page.get('/Annots', []):
            value = item.get_object()
            action = value.get('/A')
            if action: annotations.append(str(dict(action.get_object())))
    text_parts, page_reports, bad_examples = [], [], []
    with pdfplumber.open(path) as pdf:
        for index, page in enumerate(pdf.pages, 1):
            text = page.extract_text() or ''
            text_parts.append(text)
            outside = []
            for c in page.chars:
                if c['x0'] < -1 or c['x1'] > page.width + 1 or c['top'] < -1 or c['bottom'] > page.height + 1:
                    outside.append(c)
            if outside:
                bad_examples += [dict(page=index, text=c['text'], x0=c['x0'], x1=c['x1'], top=c['top'], bottom=c['bottom']) for c in outside[:3]]
            page_reports.append(dict(page=index, width_pt=page.width, height_pt=page.height, text_characters=len(text), glyphs=len(page.chars), outside_glyphs=len(outside)))
            page.close()
    text = '\n'.join(text_parts)
    private_count = len(PRIVATE.findall(text + metadata + '\n'.join(annotations)))
    qa = dict(method='pdfplumber text/glyph/page bounds and pypdf metadata/URI/attachment scan; no raster or all-page visual QA',
              text_characters=len(text), glyphs=sum(p['glyphs'] for p in page_reports),
              out_of_bounds_glyphs=sum(p['outside_glyphs'] for p in page_reports),
              replacement_or_null_characters=text.count('\ufffd') + text.count('\x00'),
              unmapped_cid_tokens=len(re.findall(r'\(cid:\d+\)', text)),
              empty_text_pages=sum(p['text_characters'] == 0 for p in page_reports),
              private_token_matches=private_count, embedded_files=embedded,
              page_boxes_pt=sorted({(p['width_pt'], p['height_pt']) for p in page_reports}))
    qa['status'] = 'pass' if not any(qa[k] for k in ('out_of_bounds_glyphs', 'replacement_or_null_characters', 'unmapped_cid_tokens', 'empty_text_pages', 'private_token_matches', 'embedded_files')) else 'needs-review'
    result = dict(name=path.name, bytes=path.stat().st_size, sha256=digest(path), pages=len(reader.pages), source_html_sha256=digest(path.with_suffix('.html')), qa=qa)
    return result, dict(file=path.name, page_details=page_reports, out_of_bounds_examples=bad_examples[:12])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--report', type=Path)
    parser.add_argument('--update-manifests', action='store_true')
    args = parser.parse_args()
    records, details = [], []
    for stem in STEMS:
        record, detail = inspect(OUT / (stem + '.pdf'))
        records.append(record); details.append(detail)
        print(record['name'], record['pages'], 'pages', record['qa']['status'], flush=True)
    report = dict(edition='2026-10-24', evidence='Current public PDFs; root confirmed current matching HTML print inputs. No TeX compile or visual-page acceptance claim.', files=records, details=details)
    if args.report: args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    if args.update_manifests:
        assert all(r['qa']['status'] == 'pass' for r in records), 'Review reported PDF defects before manifest acceptance'
        mass = OUT / 'MANIFEST.json'; data = json.loads(mass.read_text())
        data['files'] = [r for r in data['files'] if not r['name'].endswith('.pdf')] + [r for r in records if r['name'].startswith('MASS_FILTER_')]
        data['pdf_review'] = report['evidence']; mass.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
        modules = OUT / 'MODULE_GUIDES_MANIFEST.json'; data = json.loads(modules.read_text())
        for guide in data['guides']:
            guide['files'] = [r for r in guide['files'] if not r['name'].endswith('.pdf')] + [r for r in records if r['name'] == guide['name'] + '.pdf']
        data['pdf_review'] = report['evidence']; modules.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')


if __name__ == '__main__': main()
