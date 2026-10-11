/**
 * Unit tests for the configuration layer — `npm run test:unit` (node:test, no device needed).
 *
 * The modules are TypeScript in a CommonJS project, so they are loaded through the project's own
 * ts-node register: the real parsing path gets asserted, not a copy of it.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'commonjs' } });

const { buildConfig, validateConfig, parseAppiumUrl, describeAppSource, DEFAULTS } =
  require('../../src/support/config.ts');

test('defaults match the documented configuration', () => {
  const config = buildConfig({});
  assert.equal(config.appium.serverUrl, 'http://127.0.0.1:4723');
  assert.equal(config.appium.hostname, '127.0.0.1');
  assert.equal(config.appium.port, 4723);
  assert.equal(config.appium.path, '/');
  assert.equal(config.appium.platformName, 'Android');
  assert.equal(config.appium.platformVersion, '');
  assert.equal(config.appium.deviceName, '');
  assert.equal(config.appium.automationName, 'UiAutomator2');
  assert.equal(config.appium.udid, '');
  assert.equal(config.appium.app, '');
  assert.equal(config.appium.appPackage, 'com.swaglabsmobileapp');
  assert.equal(config.appium.appActivity, '.MainActivity');
  assert.equal(config.appium.newCommandTimeout, 120);
  assert.equal(config.appium.implicitTimeoutMs, 5000);
  assert.equal(config.test.username, 'standard_user');
  assert.equal(config.test.password, 'secret_sauce');
  assert.equal(config.artifactsDir, 'test-results');
});

test('the exported defaults stay in step with DEFAULTS', () => {
  const config = buildConfig({});
  assert.equal(config.appium.serverUrl, DEFAULTS.APPIUM_SERVER_URL);
  assert.equal(config.appium.appPackage, DEFAULTS.APP_PACKAGE);
  assert.equal(config.appium.appActivity, DEFAULTS.APP_ACTIVITY);
  assert.equal(config.appium.automationName, DEFAULTS.AUTOMATION_NAME);
  assert.equal(config.test.username, DEFAULTS.TEST_USERNAME);
  assert.equal(config.test.password, DEFAULTS.TEST_PASSWORD);
});

test('environment overrides win over defaults', () => {
  const config = buildConfig({
    APPIUM_SERVER_URL: 'http://10.0.0.5:8443',
    APPIUM_PATH: '/wd/hub',
    PLATFORM_VERSION: '13',
    DEVICE_NAME: 'Pixel 7',
    UDID: 'emulator-5554',
    NEW_COMMAND_TIMEOUT: '90',
    IMPLICIT_TIMEOUT_MS: '2500',
    APPIUM_APP_PACKAGE: 'com.example.shop',
    APPIUM_APP_ACTIVITY: '.ShopActivity',
    TEST_USERNAME: 'problem_user',
    TEST_PASSWORD: 'other_sauce',
    ARTIFACTS_DIR: 'out/artifacts',
    APPIUM_APP_URL: 'https://example.test/app.apk',
  });
  assert.equal(config.appium.hostname, '10.0.0.5');
  assert.equal(config.appium.port, 8443);
  assert.equal(config.appium.path, '/wd/hub');
  assert.equal(config.appium.platformVersion, '13');
  assert.equal(config.appium.deviceName, 'Pixel 7');
  assert.equal(config.appium.udid, 'emulator-5554');
  assert.equal(config.appium.newCommandTimeout, 90);
  assert.equal(config.appium.implicitTimeoutMs, 2500);
  assert.equal(config.appium.appPackage, 'com.example.shop');
  assert.equal(config.appium.appActivity, '.ShopActivity');
  assert.equal(config.test.username, 'problem_user');
  assert.equal(config.test.password, 'other_sauce');
  assert.equal(config.artifactsDir, 'out/artifacts');
  assert.equal(config.appium.app, 'https://example.test/app.apk');
});

test('a local APK path wins over the remote URL when the file exists', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'appium-testing-'));
  const apk = path.join(dir, 'sample.apk');
  fs.writeFileSync(apk, 'not really an apk');
  try {
    const config = buildConfig({ APPIUM_APP_PATH: apk, APPIUM_APP_URL: 'https://example.test/app.apk' });
    assert.equal(config.appium.app, apk);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a missing APK path falls back to the remote URL', () => {
  const config = buildConfig({
    APPIUM_APP_PATH: '/no/such/file.apk',
    APPIUM_APP_URL: 'https://example.test/app.apk',
  });
  assert.equal(config.appium.app, 'https://example.test/app.apk');
});

test('parseAppiumUrl accepts host:port without a scheme and keeps a sub-path', () => {
  assert.deepEqual(parseAppiumUrl('appium.example.com:4444'), {
    hostname: 'appium.example.com',
    port: 4444,
    path: '/',
  });
  assert.deepEqual(parseAppiumUrl('http://appium.example.com:8443/wd/hub'), {
    hostname: 'appium.example.com',
    port: 8443,
    path: '/wd/hub',
  });
});

test('an unparseable APPIUM_SERVER_URL fails fast, naming the variable', () => {
  assert.throws(() => buildConfig({ APPIUM_SERVER_URL: 'http://[unclosed' }), /APPIUM_SERVER_URL/);
});

test('validateConfig accepts the defaults and rejects a zero timeout', () => {
  assert.doesNotThrow(() => validateConfig(buildConfig({})));
  assert.throws(() => validateConfig(buildConfig({ NEW_COMMAND_TIMEOUT: '0' })), /NEW_COMMAND_TIMEOUT/);
  assert.throws(() => validateConfig(buildConfig({ IMPLICIT_TIMEOUT_MS: '0' })), /IMPLICIT_TIMEOUT_MS/);
});

test('describeAppSource labels the three app sources', () => {
  assert.match(describeAppSource(''), /already installed/);
  assert.match(describeAppSource('https://example.test/app.apk'), /build from/);
  assert.match(describeAppSource('/tmp/sample.apk'), /local APK/);
});
