"""Exact public-manual exception must not disable source or binary privacy gates."""
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import zipfile

import pytest
from pypdf import PdfWriter
from pypdf.generic import (ArrayObject, DecodedStreamObject, DictionaryObject,
                          FloatObject, NameObject, TextStringObject)

SPEC = importlib.util.spec_from_file_location("publication_manual_gate", Path(__file__).resolve().parents[1] / "tools/publish.py")
P = importlib.util.module_from_spec(SPEC); SPEC.loader.exec_module(P)


def docx(path, text="Published scientific manual", relationship=None, metadata=None, binary=False):
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>')
        z.writestr("word/document.xml", '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>' + text + '</w:t></w:r></w:p></w:body></w:document>')
        if relationship:
            z.writestr("word/_rels/document.xml.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="hyperlink" TargetMode="External" Target="' + relationship + '"/></Relationships>')
        if metadata:
            z.writestr("docProps/custom.xml", '<properties>' + metadata + '</properties>')
        if binary:
            z.writestr("word/embeddings/hidden.bin", b"unreviewed embedded content")


def pdf(path, text="Published scientific manual", metadata=None, uri=None, attachment=False, encrypted=False):
    writer = PdfWriter(); page = writer.add_blank_page(300, 200)
    font = DictionaryObject({NameObject("/Type"): NameObject("/Font"), NameObject("/Subtype"): NameObject("/Type1"), NameObject("/BaseFont"): NameObject("/Helvetica")})
    page[NameObject("/Resources")] = DictionaryObject({NameObject("/Font"): DictionaryObject({NameObject("/F1"): writer._add_object(font)})})
    stream = DecodedStreamObject(); stream.set_data(("BT /F1 12 Tf 20 100 Td (" + text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)") + ") Tj ET").encode())
    page[NameObject("/Contents")] = writer._add_object(stream)
    if metadata: writer.add_metadata({"/Subject": metadata})
    if uri:
        action = DictionaryObject({NameObject("/S"): NameObject("/URI"), NameObject("/URI"): TextStringObject(uri)})
        annotation = DictionaryObject({NameObject("/Type"): NameObject("/Annot"), NameObject("/Subtype"): NameObject("/Link"), NameObject("/Rect"): ArrayObject([FloatObject(n) for n in [0, 0, 50, 50]]), NameObject("/A"): action})
        page[NameObject("/Annots")] = ArrayObject([writer._add_object(annotation)])
    if attachment: writer.add_attachment("hidden.txt", b"unreviewed content")
    if encrypted: writer.encrypt("test password")
    with path.open("wb") as out: writer.write(out)


def manifests(directory):
    def entries(families):
        return [dict(name=f.name, bytes=f.stat().st_size, sha256=hashlib.sha256(f.read_bytes()).hexdigest()) for f in directory.iterdir() if f.name in P.MANUAL_FILES and any(f.name.startswith(name + "_") for name in families)]
    mass = entries(["MASS_FILTER_EQUATIONS"])
    module = entries(["CYCLOTRON_COMPARE", "MATHIEU_STABILITY"])
    if mass: (directory / "MANIFEST.json").write_text(json.dumps({"files": mass}))
    if module: (directory / "MODULE_GUIDES_MANIFEST.json").write_text(json.dumps({"guides": [{"files": module}]}))


def check(directory, source=True):
    hits = []; P.check_manual_directory(directory, "static/manuals" if source else "public/manuals", hits, source=source); return hits


class HugoTree(type(Path())):
    """Model the Linux/Hugo artifact without ExFAT's automatic sidecar files.

    The explicit metadata test below uses ordinary Path and proves published
    sidecars remain rejected; this fixture does not weaken the production gate.
    """
    def rglob(self, pattern):
        return (p for p in super().rglob(pattern) if not p.name.startswith("._"))


def test_only_exact_three_bilingual_families_five_formats_and_two_manifests_are_allowed(tmp_path, monkeypatch):
    directory = tmp_path / "static/manuals"; directory.mkdir(parents=True)
    for name in P.MANUAL_FILES:
        target = directory / name
        if target.suffix == ".docx": docx(target)
        elif target.suffix == ".pdf": pdf(target)
        else: target.write_text("Published scientific equations. https://doi.org/10.1088/1674-1137/abddb0")
    manifests(directory)
    assert len([p for p in directory.iterdir() if p.name in P.MANUAL_NAMES]) == 32 and check(directory) == []
    monkeypatch.setattr(P, "ROOT", tmp_path)
    g = P.Gate(); assert P.check_privacy_sources(g) and g.ok
    public = tmp_path / "public"; shutil.copytree(directory, public / "manuals")
    (public / "manuals/index.html").write_text("<p>Choose an actual manual.</p>")
    monkeypatch.setattr(P, "PUBLIC", HugoTree(public))
    g = P.Gate(); assert P.inspect_public(g) and g.ok
    assert not P.approved_manual("manuals/UNKNOWN_EN.md")
    assert not P.approved_manual("manuals/nested/MASS_FILTER_EQUATIONS_EN.md")
    assert not P.approved_manual("docs/MASS_FILTER_EQUATIONS_EN.md")


@pytest.mark.parametrize("name", ["README.md", "private_notes.html", "MASS_FILTER_EQUATIONS_FR.md", "OTHER_EN.pdf", "nested/MASS_FILTER_EQUATIONS_EN.md"])
def test_unknown_manual_or_nested_asset_is_not_whitelisted(tmp_path, name):
    target = tmp_path / name; target.parent.mkdir(parents=True, exist_ok=True); target.write_text("Even innocent text needs an exact approved asset name.")
    assert any("unapproved" in hit for hit in check(tmp_path))


@pytest.mark.parametrize("text", ["/Volumes/Private/source.py", "file:///Users/test/local", "https://github.com/gezhuang0717/gui", "https://github.com%2fgezhuang0717/gui", "https://localhost:8789/manual", "http://192.168.1.2/private", "https://user:secret@example.org/data", "api_key=abcdefghijklmno123456789", "ghp_abcdefghijklmnopqrstuvwxyz123456789"])
def test_approved_text_and_manifest_cannot_bypass_privacy(tmp_path, text):
    (tmp_path / "CYCLOTRON_COMPARE_EN.md").write_text(text)
    manifests(tmp_path)
    assert check(tmp_path)


@pytest.mark.parametrize("where", ["split_text", "relationship", "metadata", "embedding"])
def test_docx_visible_split_runs_metadata_links_and_embeddings_are_inspected(tmp_path, where):
    path = tmp_path / "MASS_FILTER_EQUATIONS_EN.docx"
    kwargs = {"text": "/Vol</w:t></w:r><w:r><w:t>umes/private"} if where == "split_text" else {"relationship": "file:///Users/test/private"} if where == "relationship" else {"metadata": "https://github.com/gezhuang0717/private"} if where == "metadata" else {"binary": True}
    docx(path, **kwargs); manifests(tmp_path)
    assert check(tmp_path)


@pytest.mark.parametrize("where", ["text", "metadata", "link", "attachment", "encrypted"])
def test_pdf_text_metadata_uris_attachments_and_encryption_are_not_a_binary_bypass(tmp_path, where):
    path = tmp_path / "MATHIEU_STABILITY_EN.pdf"
    kwargs = {"text": "/Users/test/private"} if where == "text" else {"metadata": "github.com/gezhuang0717/private"} if where == "metadata" else {"uri": "file:///Volumes/private"} if where == "link" else {"attachment": True} if where == "attachment" else {"encrypted": True}
    pdf(path, **kwargs); manifests(tmp_path)
    assert check(tmp_path)


def test_missing_stale_wrong_family_manifests_fail_and_missing_future_formats_are_not_promised(tmp_path):
    path = tmp_path / "CYCLOTRON_COMPARE_EN.md"; path.write_text("One available edition")
    assert any("not listed" in hit for hit in check(tmp_path))
    manifests(tmp_path); assert check(tmp_path) == []  # no invented PDF/file required
    path.write_text("changed after manifest")
    assert any("mismatch" in hit for hit in check(tmp_path))
    manifests(tmp_path)
    module = json.loads((tmp_path / "MODULE_GUIDES_MANIFEST.json").read_text())
    (tmp_path / "MANIFEST.json").write_text(json.dumps({"files": module["guides"][0]["files"]}))
    assert any("wrong-family" in hit for hit in check(tmp_path))


def test_general_source_file_ban_and_private_rules_are_preserved(tmp_path, monkeypatch):
    public = tmp_path / "public"; public.mkdir()
    (public / "handoff.md").write_text("internal source")
    (public / "other.tex").write_text("unapproved source")
    (public / "manuals").mkdir(); (public / "manuals/unknown.html").write_text("unapproved manual")
    monkeypatch.setattr(P, "PUBLIC", public)
    g = P.Gate(); assert not P.inspect_public(g) and not g.ok
    assert any("source or private" in item for result in g.results for item in result["items"])
    assert P.PRIVATE_PATTERNS[r"(?i)github\.com/gezhuang0717"]


def test_source_appledouble_is_not_a_published_exception(tmp_path, monkeypatch):
    source = tmp_path / "static/manuals"; source.mkdir(parents=True)
    (source / "._MASS_FILTER_EQUATIONS_EN.md").write_bytes(b"filesystem metadata")
    assert check(source) == []
    public = tmp_path / "public"; shutil.copytree(source, public / "manuals")
    monkeypatch.setattr(P, "PUBLIC", public)
    g = P.Gate(); assert not P.inspect_public(g)


def test_only_exact_public_king_readme_is_allowed_and_receives_strict_privacy(tmp_path, monkeypatch):
    public = tmp_path / "public"; directory = public / "data/research-examples/king"; directory.mkdir(parents=True)
    readme = directory / "README.md"; readme.write_text("Synthetic teaching inputs; not measurements.")
    monkeypatch.setattr(P, "PUBLIC", HugoTree(public))
    g = P.Gate(); assert P.inspect_public(g) and g.ok
    assert "data/research-examples/king/readme.md" not in P.PUBLIC_TEXT_FILES
    neighbor = directory / "neighbor_readme.md"; neighbor.write_text("Same directory is not a blanket exception.")
    g = P.Gate(); P.inspect_public(g)
    assert not g.ok and any("neighbor_readme.md" in item for result in g.results for item in result["items"])
    hits = []; P.public_readme(readme, "public/data/research-examples/king/README.md", hits); assert hits == []
    readme.write_text("api_key=abcdefghijklmnopqrstuv123456")
    hits = []; P.public_readme(readme, "public/data/research-examples/king/README.md", hits)
    assert any("credential" in hit for hit in hits)
