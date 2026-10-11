/**
 * Appium session management — the only place a session is opened, driven or closed.
 *
 * Everything device-shaped lives here: capabilities, waits, screenshots, the UI hierarchy and the
 * "relaunch the app under test" routine. Page objects and step definitions talk to these helpers
 * instead of the raw WebdriverIO client, so a capability change is a single edit.
 */

import { remote } from 'webdriverio';
import { config } from './config';

export type MobileDriver = Awaited<ReturnType<typeof remote>>;

/** How long a session may take to open on a cold emulator; also the Cucumber step budget. */
export const SESSION_CONNECT_TIMEOUT_MS = 120_000;

export interface DeviceContext {
  deviceName: string;
  platformName: string;
  platformVersion: string;
  appPackage: string;
  appActivity: string;
}

/** Set once a session has installed the build, so later sessions skip `appium:app`. */
let appInstalledInThisProcess = false;

export function markAppInstalled(): void {
  appInstalledInThisProcess = true;
}

/**
 * Capabilities for Appium 3.x — every non-standard capability carries the `appium:` prefix.
 *
 * `deviceName`, `platformVersion` and `udid` are only sent when configured: left empty they mean
 * "let Appium pick a device", which is what a single-attached-device machine wants.
 */
export function buildCapabilities(): Record<string, unknown> {
  const capabilities: Record<string, unknown> = {
    platformName: config.appium.platformName,
    'appium:automationName': config.appium.automationName,
    'appium:appPackage': config.appium.appPackage,
    'appium:appActivity': config.appium.appActivity,
    'appium:newCommandTimeout': config.appium.newCommandTimeout,
    'appium:autoGrantPermissions': true,
    'appium:forceAppLaunch': true,
    'appium:adbExecTimeout': 60_000,
    'appium:uiautomator2ServerInstallTimeout': 120_000,
    'appium:uiautomator2ServerLaunchTimeout': 90_000,
    'appium:androidInstallTimeout': 120_000,
    // Pin the reset strategy: every session starts the app under test with its data cleared, so a
    // scenario never inherits a cart or a session from the scenario before it.
    'appium:noReset': false,
  };

  if (config.appium.deviceName) capabilities['appium:deviceName'] = config.appium.deviceName;
  if (config.appium.platformVersion) capabilities['appium:platformVersion'] = config.appium.platformVersion;
  if (config.appium.udid) capabilities['appium:udid'] = config.appium.udid;

  // `appium:app` is only sent when a build is configured. A device that already carries the app
  // under test does not need a URL handed to Appium — getting one makes Appium reinstall the
  // package and restart the instrumentation for nothing.
  if (config.appium.app) {
    // Install once per process: the first session points Appium at the build; later sessions start
    // the (now installed) package with its data reset — a clean app per scenario without paying
    // for a re-install every time.
    if (!appInstalledInThisProcess) {
      capabilities['appium:app'] = config.appium.app;
    }
  }
  return capabilities;
}

export async function createSession(): Promise<MobileDriver> {
  const driver = await remote({
    hostname: config.appium.hostname,
    port: config.appium.port,
    path: config.appium.path,
    capabilities: buildCapabilities(),
    logLevel: 'warn',
    connectionRetryCount: 2,
    connectionRetryTimeout: SESSION_CONNECT_TIMEOUT_MS,
  });
  driver.setTimeouts(config.appium.implicitTimeoutMs);
  markAppInstalled();
  return driver;
}

export async function closeSession(driver: MobileDriver | undefined): Promise<void> {
  if (!driver) return;
  try {
    await driver.deleteSession();
  } catch (error) {
    console.warn(`[appium-testing] could not close the session cleanly: ${(error as Error).message}`);
  }
}

/** PNG screenshot as a buffer (WebdriverIO hands back base64). */
export async function screenshot(driver: MobileDriver): Promise<Buffer> {
  const base64 = await driver.takeScreenshot();
  return Buffer.from(base64, 'base64');
}

export function uiHierarchy(driver: MobileDriver): Promise<string> {
  return driver.getPageSource();
}

/**
 * The capabilities the session was actually created with.
 *
 * Measured against Appium 3.7: `GET /session/{id}/appium/capabilities` answers
 * `{ capabilities: { … } }`, and WebdriverIO v9 returns that envelope as-is — while the older
 * `getSession()` payload nested them the same way. Both are unwrapped here so callers can read
 * `platformName`/`automationName` directly.
 */
export async function sessionCapabilities(driver: MobileDriver): Promise<Record<string, unknown>> {
  const unwrap = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object') return {};
    const envelope = value as { capabilities?: unknown };
    return (envelope.capabilities && typeof envelope.capabilities === 'object'
      ? envelope.capabilities as Record<string, unknown>
      : value as Record<string, unknown>);
  };

  const extended = driver as unknown as { getAppiumSessionCapabilities?: () => Promise<unknown> };
  if (typeof extended.getAppiumSessionCapabilities === 'function') {
    try {
      const capabilities = unwrap(await extended.getAppiumSessionCapabilities());
      if (Object.keys(capabilities).length > 0) return capabilities;
    } catch {
      /* fall through to the legacy shape */
    }
  }
  return unwrap(await driver.getSession().catch(() => null));
}

export async function deviceContext(driver: MobileDriver): Promise<DeviceContext> {
  const [capabilities, currentPackage, currentActivity] = await Promise.all([
    sessionCapabilities(driver),
    driver.getCurrentPackage().catch(() => config.appium.appPackage),
    driver.getCurrentActivity().catch(() => config.appium.appActivity),
  ]);
  return {
    deviceName: String(capabilities.deviceName ?? config.appium.deviceName ?? 'unknown'),
    platformName: String(capabilities.platformName ?? config.appium.platformName),
    platformVersion: String(capabilities.platformVersion ?? 'unknown'),
    appPackage: String(currentPackage),
    appActivity: String(currentActivity),
  };
}

/** Terminate + activate: the app-under-test restart an operator means by "relaunch". */
export async function relaunchApp(driver: MobileDriver): Promise<void> {
  await driver.terminateApp(config.appium.appPackage);
  await driver.activateApp(config.appium.appPackage);
}

/**
 * Accessibility-id selector (`~test-Username`) — the stable way into the Swag Labs app, which
 * ships `test-*` content descriptions for exactly this purpose: resource ids and layout change
 * between builds, the test hooks do not.
 */
export function byAccessibilityId(id: string): string {
  return `~${id}`;
}

/** Text selector, for elements addressed by the label a user reads (`PRODUCTS`, `ADD TO CART`). */
export function byText(text: string): string {
  return `android=new UiSelector().text("${text}")`;
}

export async function isDisplayed(driver: MobileDriver, selector: string, timeoutMs = 5000): Promise<boolean> {
  try {
    const element = await driver.$(selector);
    await element.waitForDisplayed({ timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

/**
 * Bring an entry on screen before touching it.
 *
 * A lookup for something below the fold answers "not displayed" rather than scrolling, so the
 * list is scrolled with UiAutomator's own `UiScrollable` first. This is the difference between a
 * suite that only passes on a tall device and one that passes on the device it was given.
 */
export async function ensureVisible(driver: MobileDriver, accessibilityId: string, timeoutMs = 15_000): Promise<void> {
  if (await isDisplayed(driver, byAccessibilityId(accessibilityId), 1_500)) return;
  const scrollable = `android=new UiScrollable(new UiSelector().scrollable(true))`
    + `.scrollIntoView(new UiSelector().description("${accessibilityId}"))`;
  const element = await driver.$(scrollable);
  await element.waitForDisplayed({ timeout: timeoutMs });
}

export async function tap(driver: MobileDriver, selector: string, timeoutMs = 10_000): Promise<void> {
  const element = await driver.$(selector);
  await element.waitForDisplayed({ timeout: timeoutMs });
  await element.click();
}

export async function back(driver: MobileDriver): Promise<void> {
  await driver.back();
}

/** How many text entries are on screen right now (`android.widget.TextView` nodes). */
export async function listEntryCount(driver: MobileDriver): Promise<number> {
  const entries = await driver.$$('android=new UiSelector().className("android.widget.TextView")');
  return entries.length;
}
