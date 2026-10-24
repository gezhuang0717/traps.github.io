#!/usr/bin/env python3
"""Publication gate: private source repository  →  public deployment repository.

    PRIVATE SOURCE REPOSITORY (this repo)
        ├── site.py check                 data files valid
        ├── privacy/public-content check  nothing private in content/, data/ or the built site
        ├── facility geo validation       identities, coordinate evidence, ranges
        ├── Hugo build                    live theme → public/
        ├── link check                    every internal link/asset in public/ resolves
        └── inspect generated public/     only web files, size limits, no source leftovers
                 │
                 ▼
          publication gate                all checks PASS + explicit --approve
                 │
                 ▼
    PUBLIC DEPLOYMENT REPOSITORY  gezhuang0717.github.io  (built HTML only)

Usage
    python3 tools/publish.py check                 # all checks, builds public/, writes gate report
    python3 tools/publish.py push --approve        # checks again, then pushes public/ as ONE commit  (two-repository mode only)
    python3 tools/publish.py push --approve --dry-run  (two-repository mode only)
Options for push:  --repo URL (default https://github.com/gezhuang0717/gezhuang0717.github.io)
                   --token-env NAME (CI: env var holding a token with contents:write on the public repo)
                   --fresh  (start the public history again with a single commit)
Commits to the public repository carry only the owner's name and a dated message.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import html
import html.parser
import ipaddress
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.parse
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
REPORT = ROOT / "public-gate-report.json"
PUBLIC_REPO = "https://github.com/gezhuang0717/gezhuang0717.github.io"
OWNER_NAME, OWNER_EMAIL = "Zhuang Ge", "gezhuang0717@users.noreply.github.com"
SITE_URL = "https://gezhuang0717.github.io/"

# ── privacy rules ────────────────────────────────────────────────────────────
ALLOWED_EMAILS = {"zhuang.z.ge@jyu.fi", "z.ge@gsi.de", "zhuang@ribf.riken.jp",  # public on INSPIRE
                  "gezhuang0717@gmail.com", "gezhuang2020@gmail.com"}  # owner: feedback & corrections
PRIVATE_PATTERNS = {  # regex → reason
    r"(?i)co-authored-by|claude-session|generated with \[?claude": "tool attribution",
    r"/Volumes/|/Users/[A-Za-z]|/home/claude|/mnt/user-data|PSSD": "local file path",
    r"(?i)beam[- ]time proposal|as spokesperson|PAC (meeting|proposal)": "proposal / PAC material",
    r"(?i)\b(salary|personal identity code|henkilötunnus|passport no)": "personal data",
    r"(?<![\w.])\+\d{1,3}[ -]?\(?\d{1,4}\)?[ -]?\d{2,4}[ -]?\d{3,4}(?![\w.])|[Tt][Ee][Ll]:\+?\d": "phone number",
    r"(?i)(€|eur)\s?\d{1,3}([ ,.]\d{3})+|\d{1,3}([ ,.]\d{3})+\s?(€|eur\b)": "money amount",
    r"(?i)github\.com/gezhuang0717": "personal GitHub link (keep private)",
    r"(?i)\bCONFIDENTIAL\b|\bDO NOT PUBLISH\b|\bINTERNAL ONLY\b": "confidential marker",
}
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
WEB_SUFFIXES = {".html", ".xml", ".css", ".js", ".json", ".geojson", ".txt", ".csv", ".tsv", ".svg", ".png", ".jpg", ".jpeg",
                ".gif", ".webp", ".avif", ".ico", ".mp4", ".webm", ".woff", ".woff2", ".ttf", ".webmanifest",
                ".pdf", ".map", ""}
FORBIDDEN_NAMES = re.compile(r"(?i)(manual|handoff|changelog|audit|snapshot|\.bundle$|\.docx$|\.tex$|\.py$|\.ya?ml$|\.toml$|\.md$|\.env$|\.git/)")
MAX_FILE_MB, MAX_SITE_MB = 50, 900
TEXT_SUFFIXES = {".html", ".xml", ".css", ".js", ".json", ".txt", ".csv", ".tsv", ".svg", ".webmanifest"}

# Owner-approved public editions, 24 October 2026. This is an exact asset
# allowlist, not an exception to privacy checks or the general source-file ban.
MANUAL_FAMILIES = ("MASS_FILTER_EQUATIONS", "CYCLOTRON_COMPARE", "MATHIEU_STABILITY")
MANUAL_FORMATS = ("md", "html", "tex", "docx", "pdf")
MANUAL_FILES = {f"{family}_{lang}.{ext}" for family in MANUAL_FAMILIES
                for lang in ("EN", "ZH") for ext in MANUAL_FORMATS}
MANUAL_MANIFESTS = {"MANIFEST.json": {"MASS_FILTER_EQUATIONS"},
                    "MODULE_GUIDES_MANIFEST.json": {"CYCLOTRON_COMPARE", "MATHIEU_STABILITY"}}
MANUAL_NAMES = MANUAL_FILES | MANUAL_MANIFESTS.keys()
# Separate exact owner approval for the public synthetic King-example guide.
PUBLIC_TEXT_FILES = {"data/research-examples/king/README.md"}
MANUAL_PAGE = re.compile(r"^(?:(?:en|zh|zh-hans|fi|de|ja|fr)/)?manuals/index\.html$")
MANUAL_PRIVATE = {
    r"(?i)\b(?:file|smb|codex|plugin)://|/(?:private|root|mnt|var|tmp)/|[A-Z]:[\\/]Users[\\/]|/home/[^\s/]+/": "private path / local URI",
    r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----|\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|(?:AKIA|ASIA)[A-Z0-9]{16})\b": "credential material",
    r"(?i)\b(?:api[_-]?key|access[_-]?token|client[_-]?secret|password)\s*[:=]\s*[\"']?[A-Za-z0-9_./+\-=]{12,}": "credential assignment",
}


def approved_manual(rel):
    """Only direct files in public/manuals; translated index pages are separate."""
    return rel.startswith("manuals/") and rel.count("/") == 1 and rel[8:] in MANUAL_NAMES


def manual_text(path, text, rel, hits):
    # Decode entity/URL escapes as well as visible text, including XML rel targets.
    text = html.unescape(text)
    for _ in range(2):
        text = urllib.parse.unquote(text)
    scan_text(path, text, rel, hits)
    for pattern, reason in MANUAL_PRIVATE.items():
        if re.search(pattern, text):
            hits.append(f"{rel}: {reason}")
    for url in re.findall(r"https?://[^\s<>\"']+", text, re.I):
        try:
            parsed = urllib.parse.urlsplit(url)
            host = parsed.hostname or ""
            private = host.lower() in ("localhost", "localhost.localdomain") or host.lower().endswith(".local")
            try:
                private = private or not ipaddress.ip_address(host).is_global
            except ValueError:
                pass
            if parsed.username is not None or parsed.password is not None or private:
                hits.append(f"{rel}: private or credential-bearing URL")
        except ValueError:
            hits.append(f"{rel}: malformed URL")


def public_readme(path, rel, hits):
    try:
        if path.is_symlink() or path.stat().st_size > 8_000_000:
            raise ValueError("README is symlinked or exceeds bounded text inspection")
        manual_text(path, path.read_text(encoding="utf-8"), rel, hits)
    except (OSError, UnicodeError, ValueError) as exc:
        hits.append(f"{rel}: public README inspection failed: {exc}")


def manual_docx(path, rel, hits):
    """Inspect all text, metadata and relationships, not just visible paragraphs."""
    try:
        with zipfile.ZipFile(path) as archive:
            entries = archive.infolist()
            if len(entries) > 2000 or sum(e.file_size for e in entries) > 64 * 2**20:
                raise ValueError("DOCX expansion exceeds bounded text package")
            names = [e.filename for e in entries]
            if len(names) != len(set(names)) or "word/document.xml" not in names or "[Content_Types].xml" not in names:
                raise ValueError("DOCX package structure is invalid")
            for entry in entries:
                name = entry.filename
                if entry.is_dir():
                    continue
                if entry.flag_bits & 1 or name.startswith("/") or ".." in Path(name).parts or not name.endswith((".xml", ".rels")):
                    raise ValueError("DOCX contains encrypted, binary, embedded or unknown content")
                raw = archive.read(entry).decode("utf-8")
                if "<!DOCTYPE" in raw.upper() or "<!ENTITY" in raw.upper():
                    raise ValueError("DOCX XML entity declarations are not allowed")
                tree = ET.fromstring(raw)
                manual_text(path, raw, f"{rel}!{name}", hits)
                manual_text(path, "".join(tree.itertext()), f"{rel}!{name} text", hits)
                for node in tree.iter():
                    for attribute in node.attrib.values():
                        manual_text(path, attribute, f"{rel}!{name} attribute", hits)
                if re.search(r"macroEnabled|vbaProject|attachedTemplate|oleObject|externalLink", raw, re.I):
                    raise ValueError("DOCX active or external embedded content is not allowed")
    except Exception as exc:
        hits.append(f"{rel}: DOCX inspection failed: {type(exc).__name__}: {exc}")


def manual_pdf(path, rel, hits):
    """Fail closed on unreadable/image-only PDFs; inspect text and the object graph.

    Current approved editions are vector text, with no raster pages/attachments.
    This privacy check is separate from the recorded all-page glyph/layout QA.
    """
    try:
        from pypdf import PdfReader
        from pypdf.generic import IndirectObject, StreamObject, TextStringObject, ByteStringObject
        reader = PdfReader(str(path), strict=True)
        if reader.is_encrypted or not 1 <= len(reader.pages) <= 500:
            raise ValueError("PDF is encrypted, empty or exceeds 500 pages")
        extracted = []
        for index, page in enumerate(reader.pages, 1):
            text = page.extract_text() or ""
            extracted.append(text)
            manual_text(path, text, f"{rel} page {index}", hits)
        if not "".join(extracted).strip():
            raise ValueError("PDF has no inspectable text")
        visited, budget = set(), [0]
        def walk(obj):
            budget[0] += 1
            if budget[0] > 500000:
                raise ValueError("PDF object graph exceeds bounded inspection")
            if isinstance(obj, IndirectObject):
                key = (obj.idnum, obj.generation)
                if key in visited:
                    return
                visited.add(key); return walk(obj.get_object())
            if isinstance(obj, (TextStringObject, ByteStringObject, str, bytes)):
                text = obj.decode("utf-8", errors="replace") if isinstance(obj, bytes) else str(obj)
                manual_text(path, text, f"{rel} metadata/object", hits)
            elif isinstance(obj, dict):
                if any(k in obj for k in ("/JavaScript", "/JS", "/AA", "/OpenAction", "/EmbeddedFiles", "/EF", "/AcroForm")):
                    raise ValueError("PDF active content or attachments are not allowed")
                if str(obj.get("/S", "")) in ("/JavaScript", "/Launch", "/GoToR", "/SubmitForm", "/ImportData", "/Rendition"):
                    raise ValueError("PDF external/active action is not allowed")
                if str(obj.get("/Subtype", "")) == "/Image":
                    raise ValueError("PDF raster content requires separate reviewed approval")
                for key, value in obj.items():
                    walk(key); walk(value)
                if isinstance(obj, StreamObject) and (str(obj.get("/Type", "")) == "/Metadata" or str(obj.get("/Subtype", "")) == "/XML"):
                    data = obj.get_data()
                    if len(data) > 8_000_000:
                        raise ValueError("PDF metadata exceeds bounded inspection")
                    manual_text(path, data.decode("utf-8", errors="replace"), f"{rel} XMP metadata", hits)
            elif isinstance(obj, (list, tuple)):
                for value in obj:
                    walk(value)
        walk(reader.trailer)
    except Exception as exc:
        hits.append(f"{rel}: PDF inspection failed: {type(exc).__name__}: {exc}")


def check_manual_directory(directory, rel_prefix, hits, source=False):
    """Exact approved names plus privacy and manifest identity, without a build."""
    if not directory.exists():
        return
    if directory.is_symlink():
        hits.append(f"{rel_prefix}: symlinked manual directory is not allowed"); return
    files, listed = {}, set()
    for path in directory.rglob("*"):
        if source and (path.name.startswith("._") or path.name == ".DS_Store"):
            continue  # ExFAT metadata is not a published asset; inspect_public rejects it.
        if path.is_symlink():
            hits.append(f"{rel_prefix}: symlinked manual asset is not allowed"); continue
        if path.is_dir():
            continue
        if not source and path.parent == directory and path.name == "index.html":
            continue  # Hugo's public manual access page, scanned by the general gate.
        rel = f"{rel_prefix}/{path.relative_to(directory).as_posix()}"
        if path.is_symlink() or path.parent != directory or path.name not in MANUAL_NAMES:
            hits.append(f"{rel}: unapproved public manual asset"); continue
        files[path.name] = path
        if path.stat().st_size > MAX_FILE_MB * 2**20:
            hits.append(f"{rel}: manual exceeds file-size limit"); continue
        if path.suffix == ".docx":
            manual_docx(path, rel, hits)
        elif path.suffix == ".pdf":
            manual_pdf(path, rel, hits)
        else:
            try:
                manual_text(path, path.read_text(encoding="utf-8"), rel, hits)
            except (UnicodeError, OSError) as exc:
                hits.append(f"{rel}: text manual is unreadable: {exc}")
    for name, families in MANUAL_MANIFESTS.items():
        path = files.get(name)
        if path is None:
            continue
        try:
            doc = json.loads(path.read_text())
            entries = doc.get("files", []) if name == "MANIFEST.json" else [f for guide in doc["guides"] for f in guide["files"]]
            if not entries:
                raise ValueError("manifest is empty")
            for item in entries:
                asset = item["name"]
                if asset not in MANUAL_FILES or not any(asset.startswith(family + "_") for family in families) or asset in listed:
                    raise ValueError("manifest has unknown, duplicate or wrong-family asset")
                listed.add(asset)
                if asset not in files:
                    raise ValueError("manifest names a missing asset: " + asset)
                payload = files[asset].read_bytes()
                if item["bytes"] != len(payload) or item["sha256"] != hashlib.sha256(payload).hexdigest():
                    raise ValueError("manifest hash/bytes mismatch: " + asset)
        except (ValueError, TypeError, KeyError, OSError) as exc:
            hits.append(f"{rel_prefix}/{name}: invalid manual manifest: {exc}")
    for name in files.keys() - MANUAL_MANIFESTS.keys() - listed:
        hits.append(f"{rel_prefix}/{name}: manual is not listed in its approved manifest")


class Gate:
    def __init__(self):
        self.results: list[dict] = []

    def record(self, name, ok, detail="", items=None):
        self.results.append({"check": name, "status": "PASS" if ok else "FAIL", "detail": detail,
                             "items": (items or [])[:50]})
        mark = "PASS" if ok else "FAIL"
        print(f"  [{mark}] {name}" + (f" — {detail}" if detail else ""))
        for it in (items or [])[:12]:
            print(f"         · {it}")
        return ok

    @property
    def ok(self):
        return all(r["status"] == "PASS" for r in self.results)


def run(cmd, **kw):
    return subprocess.run(cmd, cwd=kw.pop("cwd", ROOT), text=True, capture_output=True, **kw)


def live_theme():
    import yaml
    return yaml.safe_load((ROOT / "site.yaml").read_text())["live_theme"]


# ── individual checks ───────────────────────────────────────────────────────
def check_data(g):
    r = run([sys.executable, "tools/site.py", "check"])
    return g.record("site.py check", r.returncode == 0, (r.stdout.strip().splitlines() or [r.stderr.strip()])[-1])


def scan_text(path: Path, text: str, rel: str, hits: list):
    for pat, why in PRIVATE_PATTERNS.items():
        for m in re.finditer(pat, text):
            hits.append(f"{rel}: {why}: “{m.group(0)[:60]}”")
            break
    for m in EMAIL_RE.finditer(text):
        e = m.group(0).lower()
        if e not in ALLOWED_EMAILS and not e.endswith((".png", ".jpg", ".svg", ".webp")) and "example" not in e \
                and not re.search(r"@\d+x\.", e):
            hits.append(f"{rel}: e-mail address “{e}”")
            break


def check_privacy_sources(g):
    hits = []
    check_manual_directory(ROOT / "static/manuals", "static/manuals", hits, source=True)
    for base in ("content", "data", "static", "layouts", "site.yaml"):
        p = ROOT / base
        files = [p] if p.is_file() else [f for f in p.rglob("*") if f.is_file()]
        for f in files:
            if f.is_relative_to(ROOT / "static/manuals"):
                continue  # exact allowlist and all approved formats checked above
            if f.suffix.lower() not in {".md", ".yaml", ".yml", ".json", ".html", ".js", ".css", ".toml", ".txt", ".csv", ".tsv", ".gotmpl"}:
                continue
            if f.stat().st_size > 8_000_000:
                continue
            rel = str(f.relative_to(ROOT))
            if rel.startswith(("data/facilities/", "static/data/facilities", "static/vendor/")):
                continue  # third-party / source-registry records: checked in the built site instead
            if rel.removeprefix("static/") in PUBLIC_TEXT_FILES and rel.startswith("static/"):
                public_readme(f, rel, hits)
            else:
                scan_text(f, f.read_text(errors="ignore"), rel, hits)
    return g.record("privacy/public-content check (sources)", not hits, f"{len(hits)} finding(s)", hits)


def check_geo(g):
    r = run([sys.executable, "tools/maintenance.py", "facility-check"])
    ok = r.returncode == 0
    doc = json.loads((ROOT / "data/facilities/facilities.json").read_text())
    bad = []
    for f in doc["facilities"]:
        lat, lon = f.get("latitude"), f.get("longitude")
        if lat is None:
            if f.get("coordinate_verified"):
                bad.append(f"{f['id']}: verified flag without coordinates")
            continue
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            bad.append(f"{f['id']}: coordinates out of range")
        if not f.get("coordinate_source"):
            bad.append(f"{f['id']}: pin without coordinate_source")
    mapped = sum(1 for f in doc["facilities"] if f.get("latitude") is not None)
    detail = f"{len(doc['facilities'])} records, {mapped} pins" + ("" if ok else f"; facility-check: {(r.stdout + r.stderr).strip()[-200:]}")
    return g.record("facility geo validation", ok and not bad, detail, bad)


def build(g, base_url):
    theme = live_theme()
    if PUBLIC.exists():
        shutil.rmtree(PUBLIC)
    run([sys.executable, "tools/site.py", "config"])
    run([sys.executable, "tools/maintenance.py", "facilities-build"])
    r = run(["hugo", "--minify", "--configDir", f"sites/{theme}", "--themesDir", "themes",
             "--destination", str(PUBLIC), "--baseURL", base_url, "--cleanDestinationDir"])
    ok = r.returncode == 0 and (PUBLIC / "index.html").exists()
    if ok and (ROOT / "builds/react/index.html").exists():
        shutil.copytree(ROOT / "builds/react", PUBLIC / "react", dirs_exist_ok=True)
    pages = sum(1 for _ in PUBLIC.rglob("index.html")) if ok else 0
    return g.record("Hugo build", ok, f"theme {theme}, {pages} pages" if ok else (r.stderr or r.stdout)[-400:])


class Links(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []

    def handle_starttag(self, tag, attrs):
        for k, v in attrs:
            if v and k in ("href", "src", "poster") and tag in ("a", "link", "script", "img", "source", "video", "iframe"):
                self.urls.append(v)
            if v and k == "srcset" and not v.startswith("data:"):
                self.urls.extend(part.strip().split()[0] for part in v.split(",") if part.strip())


def check_links(g, base_url):
    base_path = urllib.parse.urlparse(base_url).path or "/"
    missing, external = [], set()
    for f in list(PUBLIC.rglob("*.html")) + list(PUBLIC.rglob("*.css")):
        p = Links()
        try:
            text = f.read_text(errors="ignore")
            if f.suffix == ".css":
                text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
                p.urls = re.findall(r"url\(\s*[\"']?([^\"')]+)", text)
            else:
                p.feed(text)
        except Exception:
            continue
        for u in p.urls:
            if u.startswith(("mailto:", "tel:", "javascript:", "data:", "#")):
                continue
            pu = urllib.parse.urlparse(u)
            if (pu.scheme in ("http", "https") or pu.netloc) and not u.startswith(base_url):
                external.add(u)
                continue
            path = urllib.parse.unquote(pu.path if pu.scheme else u.split("#")[0].split("?")[0])
            if u.startswith(base_url):
                path = "/" + path[len(base_path):] if path.startswith(base_path) else path
            if not path:
                continue
            if path.startswith("/"):
                target = PUBLIC / path.lstrip("/")
                if base_path != "/" and path.startswith(base_path):
                    target = PUBLIC / path[len(base_path):]
            else:
                target = (f.parent / path)
            if target.is_dir() or path.endswith("/"):
                target = target / "index.html"
            if not target.exists():
                missing.append(f"{f.relative_to(PUBLIC)} → {u}")
    missing = sorted(set(missing))
    return g.record("link check (internal)", not missing, f"{len(missing)} broken, {len(external)} external links not fetched", missing)


def inspect_public(g):
    bad, total = [], 0
    hits = []
    check_manual_directory(PUBLIC / "manuals", "public/manuals", hits)
    for f in PUBLIC.rglob("*"):
        if not f.is_file():
            continue
        rel = str(f.relative_to(PUBLIC))
        size = f.stat().st_size
        total += size
        approved = approved_manual(rel)
        text_approved = rel in PUBLIC_TEXT_FILES
        if "manuals" in Path(rel).parts and not approved and not MANUAL_PAGE.fullmatch(rel):
            bad.append(f"{rel}: unapproved public manual asset")
        if not approved and not text_approved and f.suffix.lower() not in WEB_SUFFIXES:
            bad.append(f"{rel}: unexpected file type")
        if not approved and not text_approved and FORBIDDEN_NAMES.search(rel) and not rel.endswith(".html"):
            bad.append(f"{rel}: source or private file name")
        if size > MAX_FILE_MB * 2**20:
            bad.append(f"{rel}: {size / 2**20:.0f} MB > {MAX_FILE_MB} MB")
        if text_approved:
            public_readme(f, "public/" + rel, hits)
        elif not approved and f.suffix.lower() in TEXT_SUFFIXES and size < 8_000_000 and not rel.startswith("vendor/"):
            scan_text(f, f.read_text(errors="ignore"), "public/" + rel, hits)
    if total > MAX_SITE_MB * 2**20:
        bad.append(f"site is {total / 2**20:.0f} MB > {MAX_SITE_MB} MB")
    g.record("inspect generated public/ (files)", not bad, f"{total / 2**20:.1f} MB", bad)
    return g.record("privacy/public-content check (built site)", not hits, f"{len(hits)} finding(s)", hits)


def run_gate(base_url=SITE_URL) -> Gate:
    g = Gate()
    print("Publication gate")
    check_data(g)
    check_privacy_sources(g)
    check_geo(g)
    if build(g, base_url):
        check_links(g, base_url)
        inspect_public(g)
    rev = run(["git", "rev-parse", "--short", "HEAD"]).stdout.strip()
    REPORT.write_text(json.dumps({"checked_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
                                  "source_commit": rev, "base_url": base_url, "gate": "OPEN" if g.ok else "CLOSED",
                                  "results": g.results}, indent=1, ensure_ascii=False))
    print(f"\nGate {'OPEN — ready to publish' if g.ok else 'CLOSED — fix the FAIL items above'}  (report: {REPORT.name})")
    return g


def push(a):
    g = run_gate(a.base_url)
    if not g.ok:
        sys.exit(1)
    if not a.approve:
        sys.exit("Gate open. Re-run with --approve to publish.")
    repo = a.repo
    tok = os.environ.get(a.token_env or "", "")
    if tok:
        repo = repo.replace("https://", f"https://x-access-token:{tok}@")
    work = Path(tempfile.mkdtemp(prefix="zg-publish-"))
    env = dict(os.environ, GIT_AUTHOR_NAME=OWNER_NAME, GIT_AUTHOR_EMAIL=OWNER_EMAIL,
               GIT_COMMITTER_NAME=OWNER_NAME, GIT_COMMITTER_EMAIL=OWNER_EMAIL)
    git = lambda *c, **k: subprocess.run(["git", *c], cwd=work, text=True, capture_output=True, env=env, **k)
    if a.fresh or git("clone", "--depth", "1", repo, ".").returncode != 0:
        shutil.rmtree(work); work.mkdir()
        git("init", "-q", "-b", "main"); git("remote", "add", "origin", repo)
        a.fresh = True
    for item in work.iterdir():
        if item.name != ".git":
            shutil.rmtree(item) if item.is_dir() else item.unlink()
    shutil.copytree(PUBLIC, work, dirs_exist_ok=True)
    (work / ".nojekyll").write_text("")
    wf = work / ".github/workflows"; wf.mkdir(parents=True, exist_ok=True)
    shutil.copy(ROOT / "deploy/pages.yml", wf / "pages.yml")
    (work / "README.md").write_text("# gezhuang0717.github.io\n\nPublished website of Zhuang Ge — "
                                    "https://gezhuang0717.github.io\n\nThis repository holds only the generated site.\n")
    git("add", "-A")
    if git("diff", "--cached", "--quiet").returncode == 0:
        print("Public site already up to date."); return
    stamp = dt.datetime.now().strftime("%Y-%m-%d %H:%M")
    git("commit", "-q", "-m", f"Site update {stamp}")
    print(git("log", "--oneline", "-1").stdout.strip())
    if a.dry_run:
        print(f"Dry run: not pushed. Inspect {work}"); return
    r = git("push", *(["--force"] if a.fresh else []), "origin", "HEAD:main")
    print((r.stdout + r.stderr).strip().replace(tok, "***") if tok else (r.stdout + r.stderr).strip())
    sys.exit(r.returncode)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("check"); c.add_argument("--base-url", default=SITE_URL)
    c = sub.add_parser("links"); c.add_argument("--base-url", default=SITE_URL)
    sub.add_parser("manuals", help="inspect approved static/manuals assets and manifests without building")
    s = sub.add_parser("push")
    s.add_argument("--approve", action="store_true"); s.add_argument("--dry-run", action="store_true")
    s.add_argument("--fresh", action="store_true"); s.add_argument("--repo", default=PUBLIC_REPO)
    s.add_argument("--token-env"); s.add_argument("--base-url", default=SITE_URL)
    a = p.parse_args()
    if a.cmd == "check":
        sys.exit(0 if run_gate(a.base_url).ok else 1)
    if a.cmd == "manuals":
        g = Gate(); hits = []
        check_manual_directory(ROOT / "static/manuals", "static/manuals", hits, source=True)
        for rel in PUBLIC_TEXT_FILES:
            path = ROOT / "static" / rel
            if path.exists():
                public_readme(path, "static/" + rel, hits)
        g.record("approved public manuals (all present formats)", not hits, f"{len(hits)} finding(s)", hits)
        sys.exit(0 if g.ok else 1)
    if a.cmd == "links":
        g = Gate(); check_links(g, a.base_url)
        sys.exit(0 if g.ok else 1)
    push(a)


if __name__ == "__main__":
    main()
