/**
 * Step definitions for the Swag Labs smoke feature.
 *
 * Steps leave the interesting facts on the report (`attachArtifact`), which the AfterStep hook
 * attaches to the Cucumber report — so a green run still shows what the device actually displayed.
 */

import { Given, Then, When } from '@cucumber/cucumber';
import { CatalogPage } from '../pages/catalog.page';
import { LoginPage } from '../pages/login.page';
import { config, describeAppSource } from '../support/config';
import { deviceContext } from '../support/driver';
import type { MobileWorld } from '../support/world';

Given('the Swag Labs app is open on its sign-in screen', async function (this: MobileWorld) {
  if (!this.driver) throw new Error('No Appium session — the Before hook did not run');
  const context = await deviceContext(this.driver);
  this.attachArtifact('device session', {
    device: context.deviceName,
    platform: `${context.platformName} ${context.platformVersion}`,
    appium: config.appium.serverUrl,
    app: describeAppSource(config.appium.app),
  });

  // The app opens on its sign-in screen; wait for it once so every scenario starts from a known
  // state instead of racing the app's cold start.
  const login = new LoginPage(this.driver);
  if (!(await login.isVisible())) {
    throw new Error('The Swag Labs app did not reach its sign-in screen');
  }
});

Then('the Swag Labs sign-in screen is visible', async function (this: MobileWorld) {
  const visible = await new LoginPage(this.driver).isVisible();
  this.attachArtifact('sign-in screen', { visible });
  if (!visible) throw new Error('No username field on screen — the app is not on its sign-in screen');
});

When('I sign in as the standard user', async function (this: MobileWorld) {
  const { username, password } = config.test;
  // The password itself never reaches the report — only where it came from.
  this.attachArtifact('credentials', { username, password: '(from TEST_PASSWORD)' });
  await new LoginPage(this.driver).signIn(username, password);
});

When('I sign in as {string} with password {string}', async function (this: MobileWorld, username: string, password: string) {
  this.attachArtifact('credentials', {
    username,
    password: password === config.test.password ? '(configured test password)' : '(deliberately not the configured password)',
  });
  await new LoginPage(this.driver).signIn(username, password);
});

Then('the PRODUCTS page shows its title', async function (this: MobileWorld) {
  const catalog = new CatalogPage(this.driver);
  const titleVisible = await catalog.isVisible();
  const products = await catalog.productNames();
  this.attachArtifact('catalog', { titleVisible, products });
  if (!titleVisible) throw new Error('The PRODUCTS title never appeared — the sign-in did not reach the catalog');
  if (products.length < 2) {
    throw new Error(`Expected the inventory list, saw only: ${products.join(', ') || '(no product titles)'}`);
  }
});

When('I add the first product to the cart', async function (this: MobileWorld) {
  const product = await new CatalogPage(this.driver).addFirstProductToCart();
  this.attachArtifact('add to cart', { product: product || '(first product)' });
});

Then('the cart badge shows {string}', async function (this: MobileWorld, expected: string) {
  const badge = await new CatalogPage(this.driver).waitForCartBadge(expected);
  this.attachArtifact('cart badge', { expected, observed: badge || null });
  if (badge !== expected) {
    throw new Error(`Expected the cart badge to show "${expected}", observed "${badge || '(none)'}"`);
  }
});

Then('the app reports that the credentials do not match', async function (this: MobileWorld) {
  const message = await new LoginPage(this.driver).errorText();
  this.attachArtifact('sign-in error', { message });
  if (!message) throw new Error('The app accepted a wrong password (no error message on screen)');
  if (!/do not match/i.test(message)) throw new Error(`Unexpected error text: "${message}"`);
});
