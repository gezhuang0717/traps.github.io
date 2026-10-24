"""Guard the shared publication queue, not a simulation of GitHub Actions.

GitHub documents that the default single pending slot is replaced even when
cancel-in-progress is false. queue:max keeps up to 100 pending runs serialized:
https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency
Actual hosted scheduling/deployment still needs the next published CI run.
"""
from pathlib import Path

import yaml


WORKFLOW = Path(__file__).resolve().parents[1] / ".github/workflows/hugo.yml"


def test_pending_daily_refresh_cannot_replace_the_only_publication_slot():
    concurrency = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))["concurrency"]
    assert concurrency.get("queue") == "max", "Default single pending slot can discard a queued code push"
    assert concurrency.get("cancel-in-progress") is False, "Keep the current build/deployment running"


def test_daily_and_code_publication_remain_in_one_serial_lane():
    concurrency = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))["concurrency"]
    assert concurrency["group"] == "website-${{ github.ref }}", (
        "Splitting schedule/push groups can overlap Daily writes and Pages publication"
    )
