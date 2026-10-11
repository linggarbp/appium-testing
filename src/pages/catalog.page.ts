/**
 * Product catalog of the Swag Labs demo app — where a successful sign-in lands.
 *
 * The page is addressed the way the app exposes itself: the "PRODUCTS" header a user reads, the
 * `test-ADD TO CART` hooks the demo shop ships for automation, and the cart badge in the header.
 * The catalog renders A–Z by default, so the first "ADD TO CART" button on screen belongs to the
 * first product in the list.
 */

import { byAccessibilityId, byText, isDisplayed, type MobileDriver } from '../support/driver';

export const PRODUCTS_TITLE = 'PRODUCTS';
export const ADD_TO_CART = 'test-ADD TO CART';
export const CART_BUTTON = 'test-Cart';

export class CatalogPage {
  constructor(private readonly driver: MobileDriver) {}

  /** The "PRODUCTS" header — the catalog is on screen. */
  async isVisible(timeoutMs = 20_000): Promise<boolean> {
    return isDisplayed(this.driver, byText(PRODUCTS_TITLE), timeoutMs);
  }

  /** Product titles currently rendered, read from the view hierarchy (deduplicated). */
  async productNames(): Promise<string[]> {
    const textViews = await this.driver.$$('android=new UiSelector().className("android.widget.TextView")');
    const names: string[] = [];
    for (const view of textViews) {
      const text = (await view.getText()) ?? '';
      if (text.startsWith('Sauce Labs')) names.push(text);
    }
    return [...new Set(names)];
  }

  /** Tap the first "ADD TO CART" button; returns which product it belongs to ('' if undetermined). */
  async addFirstProductToCart(timeoutMs = 15_000): Promise<string> {
    await this.driver.waitUntil(
      async () => {
        // v9's chainable array exposes `length` as a promise — await it explicitly.
        const buttons = await this.driver.$$(byAccessibilityId(ADD_TO_CART));
        return (await buttons.length) > 0;
      },
      {
        timeout: timeoutMs,
        interval: 500,
        timeoutMsg: 'No "ADD TO CART" button on screen — the catalog did not render',
      },
    );
    const [names, buttons] = await Promise.all([
      this.productNames(),
      this.driver.$$(byAccessibilityId(ADD_TO_CART)),
    ]);
    await buttons[0].waitForDisplayed({ timeout: timeoutMs });
    await buttons[0].click();
    return names[0] ?? '';
  }

  /** Text of the cart badge (`''` when the cart is empty and no badge is rendered). */
  async cartBadgeCount(): Promise<string> {
    const cart = await this.driver.$(byAccessibilityId(CART_BUTTON));
    if (!(await cart.isExisting())) {
      throw new Error('No cart button on screen — the catalog did not render');
    }
    const badge = await cart.$('android=new UiSelector().className("android.widget.TextView")');
    if (!(await badge.isExisting())) return '';
    return ((await badge.getText()) ?? '').trim();
  }

  /** The badge text once it reads `expected`, falling back to the last observed value on timeout. */
  async waitForCartBadge(expected: string, timeoutMs = 10_000): Promise<string> {
    try {
      await this.driver.waitUntil(
        async () => (await this.cartBadgeCount()) === expected,
        { timeout: timeoutMs, interval: 500, timeoutMsg: `cart badge never showed "${expected}"` },
      );
    } catch {
      /* fall through: the caller asserts and reports the observed value */
    }
    return this.cartBadgeCount();
  }
}
