"""Create a portable public edition from checked EN/ZH sources. No GUI source is copied."""
from pathlib import Path
import argparse
import hashlib
import json
import os
import re
import subprocess
import zipfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "static/manuals"
STYLE = """<style>
@page{size:Letter;margin:.8in}html{font:11pt/1.4 Arial,'PingFang SC',sans-serif;color:#171717;background:white}body{max-width:76rem;margin:1rem auto;padding:0 1rem}h1,h2,h3{color:black;break-after:avoid}a,code{overflow-wrap:anywhere}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:10pt Menlo,monospace}table{width:100%;table-layout:fixed;border-collapse:collapse}td,th{border:1px solid #ddd;padding:.3em;vertical-align:top;overflow-wrap:anywhere}tr{break-inside:avoid}math{font-size:1em}.math.display{display:block;margin:1em 0;overflow-x:auto}@media print{body{margin:0;padding:0;max-width:none}a{color:inherit;text-decoration:none}thead{display:table-header-group}.math.display{overflow:visible}}
</style>"""


# Shared checked reflow logic from the companion format builder.
MATH_NS = "http://www.w3.org/1998/Math/MathML"
ET.register_namespace("", MATH_NS)


def _math_local(node):
    return node.tag.rsplit("}", 1)[-1]


def _math_tokens(node):
    """Ordered presentation leaves, including original operator attributes."""
    return [(_math_local(n), tuple(sorted(n.attrib.items())), n.text or "")
            for n in node.iter() if len(n) == 0]


def _math_signed_terms(children):
    terms, current, fences = [], [], []
    pairs = {")": "(", "]": "[", "}": "{"}
    equalities = 0
    for child in children:
        operator = "".join(child.itertext()) if _math_local(child) == "mo" else None
        if operator in pairs:
            if not fences or fences.pop() != pairs[operator]: return None
        if not fences and operator in (",", ";"): return None
        if not fences and operator in ("=", "≡", "≈"):
            equalities += 1
            if equalities > 1: return None
        if operator in ("+", "−", "-") and not fences and current:
            terms.append(current); current = []
        current.append(child)
        if operator in ("(", "[", "{"): fences.append(operator)
    if fences: return None
    if current: terms.append(current)
    if any(not any(_math_local(n) != "mo" for n in term) for term in terms): return None
    return terms


def wrap_html_math(text, terms_per_row=3, minimum_terms=5):
    """Reflow only top-level signed display sums; preserve all leaves and TeX annotations."""
    stats = {"wrapped": 0, "original_tex": [], "rows": [], "tokens_preserved": True,
             "annotations_preserved": True}
    def replace(match):
        original = match.group()
        math = ET.fromstring(original)
        if math.get("display") != "block": return original
        semantics = next((n for n in math if _math_local(n) == "semantics"), None)
        if semantics is None: return original
        presentation = next((n for n in semantics if _math_local(n) != "annotation"), None)
        if presentation is None or _math_local(presentation) != "mrow": return original
        if presentation.text and presentation.text.strip(): return original
        terms = _math_signed_terms(list(presentation))
        if terms is None or len(terms) < minimum_terms: return original
        annotations = [(dict(n.attrib), n.text) for n in semantics if _math_local(n) == "annotation"]
        tex = next((n.text for n in semantics if n.get("encoding") == "application/x-tex"), None)
        if not tex: return original
        before = _math_tokens(presentation)
        table = ET.Element("{" + MATH_NS + "}mtable", columnalign="left", rowspacing="0.35em", displaystyle="true", scriptlevel="0")
        for offset in range(0, len(terms), terms_per_row):
            row = ET.SubElement(table, "{" + MATH_NS + "}mtr")
            cell = ET.SubElement(row, "{" + MATH_NS + "}mtd", columnalign="left")
            group = ET.SubElement(cell, "{" + MATH_NS + "}mrow")
            for term in terms[offset:offset + terms_per_row]:
                for child in term: group.append(child)
        assert before == _math_tokens(table), "Presentation token/operator sequence changed"
        semantics.remove(presentation); semantics.insert(0, table)
        assert annotations == [(dict(n.attrib), n.text) for n in semantics if _math_local(n) == "annotation"]
        stats["wrapped"] += 1; stats["original_tex"].append(tex.strip())
        stats["rows"].append({"terms": len(terms), "rows": (len(terms) + terms_per_row - 1) // terms_per_row})
        return ET.tostring(math, encoding="unicode", short_empty_elements=True)
    result = re.sub(r"<math\b[^>]*>.*?</math>", replace, text, flags=re.S)
    assert len(re.findall(r"<math(?:\s|>)", text)) == len(re.findall(r"<math(?:\s|>)", result))
    return result, stats


def _tex_signed_terms(text):
    terms, start, stack = [], 0, []
    pairs = {")": "(", "]": "[", "}": "{"}
    i = 0
    while i < len(text):
        char = text[i]
        # Escaped delimiters/commands cannot be top-level signs.
        if char == "\\":
            i += 1
            if i < len(text) and text[i].isalpha():
                while i < len(text) and text[i].isalpha(): i += 1
                continue
            i += 1; continue
        if char in pairs:
            if not stack or stack.pop() != pairs[char]: return None
        elif char in "([{": stack.append(char)
        elif char in "+-" and not stack and text[start:i].strip():
            terms.append(text[start:i]); start = i
        i += 1
    if stack: return None
    if text[start:].strip(): terms.append(text[start:])
    return terms


def wrap_tex_sums(text, original_tex, terms_per_row=3):
    """Wrap the exact same verified display sums, never arbitrary/nested TeX expressions."""
    normalize = lambda value: re.sub(r"\s+", "", value)
    requested = {normalize(value): value for value in original_tex}
    wrapped = []
    def replace(match):
        body = match.group(1).strip()
        if normalize(body) not in requested: return match.group()
        terms = _tex_signed_terms(body)
        if terms is None or len(terms) < 5: return match.group()
        lines = ["".join(terms[i:i + terms_per_row]).strip() for i in range(0, len(terms), terms_per_row)]
        assert normalize("".join(lines)) == normalize(body), "TeX token/operator sequence changed"
        wrapped.append(normalize(body))
        aligned = "\\begin{aligned}\n" + " \\\\\n".join("& " + line for line in lines) + "\n\\end{aligned}"
        return "\\[\n" + aligned + "\n\\]"
    result = re.sub(r"\\\[(.*?)\\\]", replace, text, flags=re.S)
    missing = set(requested) - set(wrapped)
    assert not missing, "Verified HTML sums absent from TeX: " + str(len(missing))
    return result, {"wrapped": len(wrapped), "tokens_preserved": True, "terms_per_row": terms_per_row}



def math_tokens(text):
    return re.findall(r"\$\$.*?\$\$|\$[^$\n]+\$", text, re.S)


def portable(text, lang, source_hash):
    repository_url = r"https?://(?:www\.)?github\.com/gezhuang0717(?:/[^\s)]*)?"
    # Portable module labels below retain implementation identity; a personal
    # repository profile is not a public scientific-data citation.
    text = re.sub(r"\s*·\s*\[[^\]]+\]\(" + repository_url + r"\)", "", text, flags=re.I)
    text = re.sub(r"\[([^\]]+)\]\(" + repository_url + r"\)", lambda m: m[1], text, flags=re.I)
    def repository_label(match):
        parts = match[0].split("github.com/", 1)[-1].split("/")
        for kind in ("blob", "tree"):
            if kind in parts:
                return "/".join(parts[parts.index(kind)+2:]) or "website modules"
        return "website modules"
    text = re.sub(repository_url, repository_label, text, flags=re.I)
    text = re.sub(r"\[([^\]]+)\]\((?:file://|/(?:Volumes|Users)/)[^)]*\)", lambda m: m[1], text)
    def path_label(match):
        path = match[0]
        if "/website/" in path:
            return path.split("/website/", 1)[1]
        if re.search(r"/TRAPLAB[^/]+/", path):
            return "companion/" + re.split(r"/TRAPLAB[^/]+/", path, maxsplit=1)[1]
        return Path(path).name
    text = re.sub(r"(?:file://)?/(?:Volumes|Users)/[^\s`)>]+", path_label, text)
    text = re.sub(r"^cd [^\n]*$", "", text, flags=re.M)
    text = text.replace("This batch builds private Markdown and Word documents only.", "This public edition provides portable Markdown, editable Word equations, offline MathML HTML and standalone TeX source.")
    text = text.replace("Full source SHA256 values are in inventory-delivery.json; generated-file hashes and command return codes are in build-validation.json.", "Module names identify implementation entry points; the companion application is installed and run locally. Public-edition file hashes are listed in MANIFEST.json.")
    note = ("\nPublic edition 2026-10-24. Open a terminal in the separately installed companion application folder before running its commands. Module labels identify its entry points and are not download links. Equations and official references are preserved from the checked source edition. Canonical Markdown SHA-256: `" if lang == "EN" else "\n公开版 2026-10-24。执行配套应用命令前，请先在已单独安装的应用目录打开终端。模块名称用于定位入口，不是下载链接。方程及官方文献保留自已核对的源版本。源 Markdown SHA-256：`") + source_hash + "`.\n"
    end = text.find("\n---", 4) if text.startswith("---\n") else -1
    pos = text.find("\n", end + 1) + 1 if end >= 0 else 0
    text = text[:pos] + note + text[pos:]
    if re.search(r"/Volumes|/Users|file://|github\.com/gezhuang0717", text, re.I):
        raise ValueError("Private path remains")
    return text


def polish(path, lang):
    from docx import Document
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    from docx.shared import Pt, RGBColor
    doc = Document(path)
    for style in doc.styles:
        if style.type != 1:
            continue
        style.font.name = "Arial"
        style.font.color.rgb = RGBColor(0, 0, 0)
        if style.name in ("Normal", "Body Text", "First Paragraph", "Source Code"):
            style.font.size = Pt(11)
        if style.name in ("Source Code", "Verbatim Char"):
            style.font.name = "Menlo"
        fonts = style.element.get_or_add_rPr().find(qn("w:rFonts"))
        if fonts is None:
            fonts = OxmlElement("w:rFonts"); style.element.get_or_add_rPr().append(fonts)
        fonts.set(qn("w:eastAsia"), "PingFang SC")
        for border in style.element.xpath(".//w:pBdr"):
            border.getparent().remove(border)
    doc.core_properties.author = "TrapLab documentation"
    doc.core_properties.last_modified_by = "TrapLab documentation"
    doc.save(path)


def pages():
    labels = {
      "en": ("Manuals and examples", "Mass filter equations", "English and Chinese editions cover equations, units, uncertainty, data sources and the website workflow. The companion application runs locally.", "King plot examples"),
      "zh": ("手册与示例", "质量滤波方程", "英文与中文手册包含方程、单位、不确定度、数据来源及网页操作。配套应用在本地运行。", "King 图示例"),
      "fi": ("Oppaat ja esimerkit", "Massasuodattimien yhtälöt", "Englannin- ja kiinankieliset oppaat kattavat yhtälöt, yksiköt, epävarmuudet, lähteet ja verkkotyökalun käytön. Oheissovellus toimii paikallisesti.", "King-kuvaajan esimerkit"),
      "de": ("Handbücher und Beispiele", "Gleichungen der Massenfilter", "Englische und chinesische Ausgaben erläutern Gleichungen, Einheiten, Unsicherheiten, Datenquellen und die Webseite. Die Begleitanwendung läuft lokal.", "King-Diagramm Beispiele"),
      "ja": ("手引きと例", "質量フィルターの方程式", "英語版と中国語版で方程式、単位、不確かさ、出典、ウェブ操作を説明します。関連アプリはローカルで実行します。", "King プロットの例"),
      "fr": ("Manuels et exemples", "Équations des filtres de masse", "Les éditions anglaise et chinoise décrivent équations, unités, incertitudes, sources et utilisation du site. L’application associée fonctionne localement.", "Exemples de diagrammes de King")}
    edition_names = {"en": ("English", "Chinese"), "zh": ("英文", "中文"), "fi": ("Englanti", "Kiina"), "de": ("Englisch", "Chinesisch"), "ja": ("英語", "中国語"), "fr": ("Anglais", "Chinois")}
    module_titles = {"en": ("Mathieu stability", "Cyclotron frequency comparison"), "zh": ("Mathieu 稳定性", "回旋频率比较"), "fi": ("Mathieu-vakaus", "Syklotronitaajuuksien vertailu"), "de": ("Mathieu-Stabilität", "Vergleich der Zyklotronfrequenzen"), "ja": ("Mathieu 安定性", "サイクロトロン周波数の比較"), "fr": ("Stabilité de Mathieu", "Comparaison des fréquences cyclotron")}
    example_notes = {
      "en": "All five datasets are synthetic training examples, not measurements.",
      "zh": "以下五组数据均为合成练习示例，不是实验测量。",
      "fi": "Kaikki viisi aineistoa ovat synteettisiä harjoitusesimerkkejä, eivät mittauksia.",
      "de": "Alle fünf Datensätze sind synthetische Übungsbeispiele, keine Messungen.",
      "ja": "5組すべてが学習用の合成データで、実測値ではありません。",
      "fr": "Les cinq jeux de données sont des exemples synthétiques d’apprentissage, pas des mesures."}
    for lang, (title, heading, intro, king) in labels.items():
        text = '---\ntitle: "' + title + '"\n---\n\n' + intro + '\n\n## ' + heading + '\n\n'
        for code, name in zip(("EN", "ZH"), edition_names[lang]):
            links = []
            for ext in ["html", "pdf", "docx", "tex", "md"]:
                file = "MASS_FILTER_EQUATIONS_" + code + "." + ext
                if (OUT / file).is_file():
                    links.append('{{< manual-download "manuals/' + file + '" "' + ext.upper() + '" >}}')
            text += name + ': ' + ' · '.join(links) + '\n\n'
        for kind, module_title in zip(("MATHIEU_STABILITY", "CYCLOTRON_COMPARE"), module_titles[lang]):
            rows = []
            for code, name in zip(("EN", "ZH"), edition_names[lang]):
                links = []
                for ext in ("html", "pdf", "docx", "tex", "md"):
                    filename = kind + "_" + code + "." + ext
                    if (OUT / filename).is_file():
                        links.append('{{< manual-download "manuals/' + filename + '" "' + ext.upper() + '" >}}')
                if links: rows.append(name + ': ' + ' · '.join(links))
            if rows: text += '## ' + module_title + '\n\n' + '\n\n'.join(rows) + '\n\n'
        text += '## ' + king + '\n\n' + example_notes[lang] + '\n\n'
        for case in ["correlated", "heteroscedastic", "exact-x", "ols", "curved"]:
            text += case + ': ' + ' · '.join('{{< manual-download "data/research-examples/king/' + case + '.' + ext + '" "' + ext.upper() + '" >}}' for ext in ['csv', 'txt', 'json']) + '\n\n'
        text += '{{< manual-download "data/research-examples/king/README.md" "README EN / 中文" >}}\n'
        (ROOT / "content" / lang / "manuals.md").write_text(text)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path)
    parser.add_argument("--pandoc", default="pandoc")
    parser.add_argument("--data-dir", type=Path)
    parser.add_argument("--reference-doc", type=Path)
    parser.add_argument("--pages-only", action="store_true")
    parser.add_argument("--formats-only", action="store_true", help="Preserve separately maintained manual landing pages")
    args = parser.parse_args()
    if args.pages_only:
        pages(); return
    if not args.source_dir:
        parser.error("--source-dir is required")
    OUT.mkdir(exist_ok=True)
    manifest = {"edition": "2026-10-24", "equations_per_edition": 190, "files": [], "pdf_pipeline": "Browser vector printing of offline HTML; distinct from compiling TeX. TeX compilation is not claimed here.", "visual_review": "Owner prohibits saved manual screenshots; structural math/font/privacy checks do not establish Word page-layout acceptance."}
    for lang in ["EN", "ZH"]:
        source = args.source_dir / ("MASS_FILTER_EQUATIONS_" + lang + ".md")
        raw = source.read_text(); sha = hashlib.sha256(source.read_bytes()).hexdigest()
        text = portable(raw, lang, sha)
        assert math_tokens(raw) == math_tokens(text), "Equations changed"
        md = OUT / source.name; md.write_text(text)
        for ext, target in [("html", "html5"), ("tex", "latex"), ("docx", "docx")]:
            output = md.with_suffix("." + ext)
            command = [args.pandoc, str(md), "--from=markdown+tex_math_dollars", "--to=" + target, "--standalone"]
            if args.data_dir: command += ["--data-dir=" + str(args.data_dir)]
            if ext == "docx":
                if args.reference_doc: command += ["--reference-doc=" + str(args.reference_doc)]
                command += ["--output=" + str(output)]
            elif ext == "html": command += ["--mathml"]
            else:
                command += ["--pdf-engine=xelatex", "--variable=fontsize:11pt", "--variable=papersize:letter", "--variable=geometry:margin=0.8in", "--variable=mainfont:Arial", "--variable=monofont:Menlo"]
                if lang == "ZH": command += ["--variable=CJKmainfont:PingFang SC"]
            result = subprocess.run(command, capture_output=True, check=True, timeout=50)
            if ext == "docx": polish(output, lang)
            else:
                rendered = result.stdout.decode()
                if ext == "html":
                    rendered = re.sub(r"<!--\[if lt IE 9\]>.*?<!\[endif\]-->", "", rendered, flags=re.S).replace("</head>", STYLE + "</head>")
                    assert len(re.findall(r"<math(?:\s|>)", rendered)) == 190
                    assert "<script" not in rendered.lower() and "mathjax" not in rendered.lower()
                    rendered, layout = wrap_html_math(rendered)
                    manifest.setdefault("math_layout", {})[lang] = layout
                elif ext == "tex":
                    rendered, texlayout = wrap_tex_sums(rendered, manifest["math_layout"][lang]["original_tex"])
                    manifest["math_layout"][lang]["tex"] = texlayout
                output.write_text(rendered)
        for path in [md, md.with_suffix('.html'), md.with_suffix('.tex'), md.with_suffix('.docx')]:
            if path.suffix == '.docx':
                with zipfile.ZipFile(path) as archive:
                    payload = b'\n'.join(archive.read(n) for n in archive.namelist() if n.endswith('.xml') or n.endswith('.rels'))
                    assert payload.count(b'<m:oMath>') == 190
            else: payload = path.read_bytes()
            assert not re.search(rb'/Volumes|/Users|file://|github\.com/gezhuang0717', payload, re.I)
            manifest['files'].append({'name':path.name,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'source_sha256':sha})
    (OUT / 'MANIFEST.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')
    if not args.formats_only:
        pages()


if __name__ == "__main__": main()
