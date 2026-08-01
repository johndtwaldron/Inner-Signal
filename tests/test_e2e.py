import pytest
from playwright.sync_api import Page, expect


@pytest.mark.e2e
def test_library_and_queue(page: Page, live_server_url):
    page.goto(live_server_url)
    expect(page.get_by_role("heading", name="Inner Signal")).to_be_visible()
    first_card = page.locator(".card").first
    expect(first_card).to_be_visible()
    first_card.get_by_role("button", name="Add to queue").click()
    expect(page.locator("#queue-count")).to_have_text("1")


@pytest.mark.e2e
def test_next_advances_across_library(page: Page, live_server_url):
    page.goto(live_server_url)
    cards = page.locator('[data-testid="media-card"]')
    assert cards.count() == 2
    first_card = cards.nth(0)
    first_title = first_card.locator("h3").inner_text()
    first_card.locator("[data-play]").click()
    expect(page.locator("#now-title")).to_have_text(first_title)
    page.locator("#next").click()
    expect(page.locator("#now-title")).not_to_have_text(first_title)
