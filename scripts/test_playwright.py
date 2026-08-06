from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)
    page = browser.new_page()

    page.goto("https://www.morningbrew.com/issues/macy-s-vs-amazon")

    # Keep the browser open for inspection
    page.wait_for_timeout(30000)

    print(page.title())

    browser.close()