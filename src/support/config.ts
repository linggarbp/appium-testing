/**
 * Configuration for the suite — one place that reads every environment variable, so the driver,
 * the hooks and the step definitions agree on the same defaults.
 *
 * Values come from the environment. A local `.env` (copied from `.env.example`) is loaded when
 * present; plain environment variables work just as well, which is how CI and remote runs
 * configure the suite.
 */

import * as fs from 'fs';
import * as path from 'path';

try {
  // Optional by design: a checked-out `.env` is convenient locally and simply absent elsewhere.
  require('dotenv').config({ quiet: true });
} catch {
  /* dotenv stays optional */
}

export type Env = Record<string, string | undefined>;

export function readString(env: Env, name: string, fallback = ''): string {
  const value = env[name];
  return value === undefined || value === '' ? fallback : value;
}

export function readInt(env: Env, name: string, fallback: number): number {
  const parsed = Number.parseInt(readString(env, name), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Break the Appium endpoint into the host/port/path parts WebdriverIO wants. */
export function parseAppiumUrl(raw: string): { hostname: string; port: number; path: string } {
  let url: URL;
  try {
    url = new URL(raw.includes('://') ? raw : `http://${raw}`);
  } catch (error) {
    throw new Error(`APPIUM_SERVER_URL is not a valid URL: "${raw}" (${(error as Error).message})`);
  }
  if (!url.hostname) {
    throw new Error(`APPIUM_SERVER_URL has no host: "${raw}"`);
  }
  return {
    hostname: url.hostname,
    port: url.port ? Number(url.port) : 4723,
    path: url.pathname && url.pathname !== '' ? url.pathname : '/',
  };
}

export interface AppiumSettings {
  /** As configured — what gets logged and attached to reports. */
  serverUrl: string;
  hostname: string;
  port: number;
  path: string;
  platformName: string;
  platformVersion: string;
  deviceName: string;
  automationName: string;
  udid: string;
  /** Build to install before the session starts, or '' to use the package already on the device. */
  app: string;
  appPackage: string;
  appActivity: string;
  newCommandTimeout: number;
  implicitTimeoutMs: number;
}

export interface TestSettings {
  username: string;
  password: string;
}

export interface SuiteConfig {
  appium: AppiumSettings;
  test: TestSettings;
  artifactsDir: string;
}

export const DEFAULTS = {
  APPIUM_SERVER_URL: 'http://127.0.0.1:4723',
  PLATFORM_NAME: 'Android',
  AUTOMATION_NAME: 'UiAutomator2',
  APP_PACKAGE: 'com.swaglabsmobileapp',
  APP_ACTIVITY: '.MainActivity',
  TEST_USERNAME: 'standard_user',
  TEST_PASSWORD: 'secret_sauce',
  NEW_COMMAND_TIMEOUT: 120,
  IMPLICIT_TIMEOUT_MS: 5_000,
  ARTIFACTS_DIR: 'test-results',
} as const;

/**
 * `APPIUM_APP_PATH` (a local .apk, same-host Appium only) is preferred when the file exists;
 * otherwise `APPIUM_APP_URL` (a remote build Appium downloads); otherwise no build is handed to
 * Appium and the package already installed on the device is used.
 */
function resolveApp(env: Env): string {
  const localPath = readString(env, 'APPIUM_APP_PATH');
  if (localPath && fs.existsSync(localPath)) return path.resolve(localPath);
  return readString(env, 'APPIUM_APP_URL');
}

/** Pure: the whole suite configuration, derived from an environment object. */
export function buildConfig(env: Env = process.env): SuiteConfig {
  const serverUrl = readString(env, 'APPIUM_SERVER_URL', DEFAULTS.APPIUM_SERVER_URL);
  const parsed = parseAppiumUrl(serverUrl);
  return {
    appium: {
      serverUrl,
      hostname: parsed.hostname,
      port: parsed.port,
      path: readString(env, 'APPIUM_PATH', parsed.path),
      platformName: readString(env, 'PLATFORM_NAME', DEFAULTS.PLATFORM_NAME),
      platformVersion: readString(env, 'PLATFORM_VERSION'),
      deviceName: readString(env, 'DEVICE_NAME'),
      automationName: readString(env, 'AUTOMATION_NAME', DEFAULTS.AUTOMATION_NAME),
      udid: readString(env, 'UDID'),
      app: resolveApp(env),
      appPackage: readString(env, 'APPIUM_APP_PACKAGE', DEFAULTS.APP_PACKAGE),
      appActivity: readString(env, 'APPIUM_APP_ACTIVITY', DEFAULTS.APP_ACTIVITY),
      newCommandTimeout: readInt(env, 'NEW_COMMAND_TIMEOUT', DEFAULTS.NEW_COMMAND_TIMEOUT),
      implicitTimeoutMs: readInt(env, 'IMPLICIT_TIMEOUT_MS', DEFAULTS.IMPLICIT_TIMEOUT_MS),
    },
    test: {
      username: readString(env, 'TEST_USERNAME', DEFAULTS.TEST_USERNAME),
      password: readString(env, 'TEST_PASSWORD', DEFAULTS.TEST_PASSWORD),
    },
    artifactsDir: readString(env, 'ARTIFACTS_DIR', DEFAULTS.ARTIFACTS_DIR),
  };
}

/** Fail fast on a configuration that would otherwise surface as a confusing timeout mid-run. */
export function validateConfig(input: SuiteConfig): SuiteConfig {
  const problems: string[] = [];
  if (!input.appium.serverUrl) problems.push('APPIUM_SERVER_URL must not be empty');
  if (!Number.isFinite(input.appium.newCommandTimeout) || input.appium.newCommandTimeout <= 0) {
    problems.push('NEW_COMMAND_TIMEOUT must be a positive number of seconds');
  }
  if (!Number.isFinite(input.appium.implicitTimeoutMs) || input.appium.implicitTimeoutMs <= 0) {
    problems.push('IMPLICIT_TIMEOUT_MS must be a positive number of milliseconds');
  }
  if (!input.appium.appPackage) problems.push('APPIUM_APP_PACKAGE must not be empty');
  if (!input.appium.appActivity) problems.push('APPIUM_APP_ACTIVITY must not be empty');
  if (!input.artifactsDir) problems.push('ARTIFACTS_DIR must not be empty');
  if (problems.length > 0) {
    throw new Error(`Invalid configuration:\n  - ${problems.join('\n  - ')}`);
  }
  return input;
}

/** Where the app under test comes from, in one line (logging only). */
export function describeAppSource(app: string): string {
  if (!app) return 'the package already installed on the device';
  if (/^https?:\/\//i.test(app)) return `build from ${app}`;
  return `local APK ${app}`;
}

/** The configuration every module shares; validated once at load. */
export const config: SuiteConfig = validateConfig(buildConfig());
