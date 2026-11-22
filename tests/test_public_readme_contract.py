"""Keep the public root README concise and separate from private science manuals.

The public site has its own editable content and documentation in normal source
files; private engineering notes, backup manifests and detailed methods belong
outside this public repository. This test validates README content at CI time
without accessing private repositories or contacting a network service.
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
README = ROOT / "README.md"


def test_public_readme_restored_to_compact_academic_template():
    text = README.read_text(encoding="utf-8")
    assert text.startswith("# traps.github.io\n")
    assert "One set of content, three interchangeable themes." in text
    assert "https://gezhuang0717.github.io/traps.github.io/" in text
    assert "The website manual" in text or "Detailed website manuals" in text
    assert 1000 <= len(text) < 3000, "Public README must remain a short introduction"


def test_detailed_private_science_content_not_in_root_readme():
    text = README.read_text(encoding="utf-8")
    # Do not prevent the public site from hosting reviewed scientific learning
    # pages; only stop the root README becoming a private research manual again.
    patterns = [
        r"(?i)website_manuals",
        r"(?i)backups/traps",
        r"(?i)private[_/-]data",
        r"(?i)RFQ\\s+(?:cooler|mass.?filter|workbench|ion.?guide)",
        r"(?i)(?:native\\s+)?SIMION",
        r"(?i)EPICS|MCS6|TDC",
        r"(?i)electron.?gun|UCx|photofission",
        r"(?i)calibration\\s+(?:subtabs|covariance|workflow)",
        r"(?i)\\b(?:secret|password|token|api[_-]?key)\\s*[:=]",
        r"-----BEGIN (?:OPENSSH|RSA|PRIVATE) KEY-----",
    ]
    for pattern in patterns:
        assert not re.search(pattern, text), f"Unexpected private-style README content: {pattern}"
