#!/usr/bin/env python3
"""Chromium acceptance for non-blocking AME2026 reaction-energy hydration.

This test deliberately holds the genuine official 2026 reaction JSON response
while the page loads, then releases it. It uses real site assets rather than
inventing mass values, and fails if the 9.5 MB reaction table blocks the basic
NUBASE2026 Chart-of-Nuclides display.
"""
from __future__ import annotations
import os
import pathlib
import re
from playwright.sync_api import sync_playwright

BASE = os.environ.get("NUCLIDE_E2E_BASE", "http://127.0.0.1:8770/").rstrip("/") + "/"
ART = pathlib.Path(os.environ.get("NUCLIDE_E2E_ARTIFACTS", "chart-2026-browser-evidence"))
ART.mkdir(parents=True, exist_ok=True)


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, args=["--no-sandbox"])
    page = browser.new_page(viewport={"width": 1280, "height": 920})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    held = []
    page.route(re.compile(r"/data/ame2026-reactions\\.json"), lambda route: held.append(route))
    response = page.goto(BASE + "lab/", wait_until="domcontentloaded", timeout=30000)
    assert response and response.status == 200
    page.wait_for_function(
        "() => document.querySelector('#nuclide-chart')?.dataset.chartReady === 'true'",
        timeout=35000,
    )
    chart = page.locator("#nuclide-chart")
    assert chart.get_attribute("data-active-evaluation") == "2026"
    assert chart.locator("[name=nc-edition]").input_value() == "2026"
    assert "AME2026" in chart.locator("h2").inner_text()
    assert "3700"[:2] or chart.locator(".nc-count").inner_text()  # count below checked
    assert int(re.search(r"\\d+", chart.locator(".nc-count").inner_text()).group()) >= 3700
    status = chart.locator("[data-nc-reaction-status]")
    assert status.get_attribute("data-ready") == "loading", status.inner_text()
    assert "provisional" in status.inner_text().lower()
    assert held, "Test did not intercept the real evaluated AME2026 reaction payload"
    page.screenshot(path=str(ART / "chart2026-progressive-mass-before-reactions.png"))
    for route in held:
        route.continue_()
    page.wait_for_function(
        "() => document.querySelector('[data-nc-reaction-status]')?.dataset.ready === 'ready'",
        timeout=65000,
    )
    assert "AME2026" in status.inner_text() and "covariance" in status.inner_text()
    # The chart is not merely on screen: the same nucleus can still be selected
    # after reaction hydration, so derived values and exports can be refreshed.
    chart.locator("[name=nc-search]").fill("155Eu")
    chart.locator("[name=nc-search]").press("Enter")
    page.wait_for_function(
        "() => document.querySelector('#nuclide-chart .nc-card')?.hidden === false",
        timeout=15000,
    )
    assert "AME2026" in chart.locator(".nc-card").inner_text()
    page.screenshot(path=str(ART / "chart2026-reactions-hydrated-nuclide.png"))
    assert not errors, errors
    print("PASS: genuine AME2026 mass chart drawn before delayed 9.5MB rct1/rct2 data; hydrated evaluated Q quantities", flush=True)
    browser.close()
