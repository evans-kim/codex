"""In-process browser smoke test for the static app.

The execution environment blocks Chromium navigation by policy, so this test
loads the same source files into an about:blank page. ES modules are flattened
only for the test harness, local SVG assets are embedded as data URIs, and a
small in-memory localStorage implementation replaces the unavailable opaque-
origin storage. Production files are exercised without changing their logic.
"""
from __future__ import annotations

import base64
import re
from pathlib import Path

from playwright.sync_api import Page, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "test-results"
OUTPUT.mkdir(exist_ok=True)


def data_uri(path: Path) -> str:
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:image/svg+xml;base64,{encoded}"


def build_browser_harness() -> str:
    source_paths = [
        ROOT / "js/menu-options.js",
        ROOT / "js/menu-catalog-a.js",
        ROOT / "js/menu-catalog-b.js",
        ROOT / "js/menus.js",
        ROOT / "js/recommendation.js",
        ROOT / "js/storage.js",
        ROOT / "js/app-context.js",
        ROOT / "js/app-view.js",
        ROOT / "js/app-actions.js",
        ROOT / "js/app.js",
    ]
    sources = [path.read_text(encoding="utf-8") for path in source_paths]

    flattened: list[str] = []
    for source in sources:
        source = re.sub(r"import\s*\{.*?\}\s*from\s*['\"].*?['\"];\s*", "", source, flags=re.S)
        source = re.sub(r"import\s*['\"].*?['\"];\s*", "", source, flags=re.S)
        source = re.sub(r"export\s*\{.*?\};\s*", "", source, flags=re.S)
        source = re.sub(r"\bexport\s+", "", source)
        flattened.append(source)

    script = "\n\n".join(flattened)

    def embed_match(match: re.Match[str]) -> str:
        relative = match.group(1)
        return data_uri(ROOT / relative)

    script = re.sub(r"\./(assets/menus/[a-z0-9-]+\.svg)", embed_match, script)
    css = "\n".join(
        (ROOT / path).read_text(encoding="utf-8")
        for path in ["styles/base.css", "styles/content.css", "styles/overlays.css", "styles/responsive.css"]
    )

    return f"""<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>{css}</style></head><body><div id="app"></div><script>{script}</script></body></html>"""


def install_storage(page: Page) -> None:
    page.evaluate(
        """
        Object.defineProperty(window, 'localStorage', {
          configurable: true,
          value: {
            _data: Object.create(null),
            getItem(key) { return Object.prototype.hasOwnProperty.call(this._data, key) ? this._data[key] : null; },
            setItem(key, value) { this._data[key] = String(value); },
            removeItem(key) { delete this._data[key]; },
            clear() { this._data = Object.create(null); }
          }
        });
        Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
        """
    )


def load_app(page: Page) -> None:
    install_storage(page)
    page.set_content(build_browser_harness(), wait_until="load")
    page.get_by_role("button", name="오늘의 저녁 고르기").wait_for()


def run_flow(page: Page, screenshot_name: str) -> None:
    console_errors: list[str] = []
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)

    load_app(page)
    page.get_by_role("button", name="오늘의 저녁 고르기").click()
    page.get_by_role("button", name="조금 지쳤어요 따뜻하게 충전하고 싶어요").click()
    page.get_by_role("button", name="다음").click()
    page.get_by_role("button", name="많이 지쳤어요 따뜻하고 부담 적은 게 좋아요").click()
    page.get_by_role("button", name="다음").click()
    page.get_by_role("button", name="따뜻한").click()
    page.get_by_role("button", name="담백한").click()
    page.get_by_role("button", name="다음").click()
    page.get_by_role("button", name="배달시켜 먹기").click()
    page.get_by_role("button", name="메뉴 추천받기").click()

    page.locator(".featured-menu-card").wait_for()
    assert page.locator(".alternative-card").count() == 2
    assert page.locator(".featured-image-wrap img").evaluate("img => img.complete && img.naturalWidth > 0")

    page.get_by_role("button", name="이걸로 먹을래요").click()
    page.get_by_role("heading", name=re.compile("으로 정했어요")).wait_for()
    assert page.evaluate("JSON.parse(localStorage.getItem('yeobo-dinner:v1')).history.length") == 1
    page.screenshot(path=str(OUTPUT / screenshot_name), full_page=True)

    assert not console_errors, f"browser console errors: {console_errors}"


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        headless=True,
        executable_path="/usr/bin/chromium",
        args=["--no-sandbox", "--disable-gpu"],
    )

    mobile = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1)
    run_flow(mobile.new_page(), "mobile-result.png")
    mobile.close()

    desktop = browser.new_context(viewport={"width": 1440, "height": 1000})
    page = desktop.new_page()
    load_app(page)
    page.get_by_role("button", name="오늘은 그냥 골라줘").click()
    page.locator(".featured-menu-card").wait_for()
    assert page.locator(".alternative-card").count() == 2
    page.screenshot(path=str(OUTPUT / "desktop-quick.png"), full_page=True)
    desktop.close()
    browser.close()

print("browser smoke test passed")
