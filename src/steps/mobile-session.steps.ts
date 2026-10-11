/**
 * Step definitions for the Appium session-health feature: negotiated capabilities, the identity
 * of the app under test, a clean terminate/relaunch, and the device context the session reports.
 */

import { Given, Then, When } from '@cucumber/cucumber';
import { LoginPage } from '../pages/login.page';
import { config } from '../support/config';
import { deviceContext, relaunchApp, sessionCapabilities } from '../support/driver';
import type { MobileWorld } from '../support/world';

Given('an Appium session is open against the configured Appium server', async function (this: MobileWorld) {
  if (!this.driver) throw new Error('No Appium session — the Before hook did not run');
  const context = await deviceContext(this.driver);
  this.attachArtifact('session', {
    serverUrl: config.appium.serverUrl,
    device: context.deviceName,
    platform: `${context.platformName} ${context.platformVersion}`,
    package: context.appPackage,
  });
});

Then('the session reports the platform {string} and the automation engine {string}',
  async function (this: MobileWorld, platform: string, automation: string) {
    const capabilities = await sessionCapabilities(this.driver);
    const observedPlatform = String(capabilities.platformName ?? capabilities['appium:platformName'] ?? '');
    const observedAutomation = String(
      capabilities['appium:automationName'] ?? capabilities.automationName ?? '');
    this.attachArtifact('session capabilities', {
      platformName: observedPlatform,
      automationName: observedAutomation,
      deviceName: capabilities.deviceName ?? null,
      platformVersion: capabilities.platformVersion ?? null,
      appium: config.appium.serverUrl,
    });
    if (observedPlatform.toLowerCase() !== platform.toLowerCase()) {
      throw new Error(`Expected platformName "${platform}", got "${observedPlatform}"`);
    }
    if (observedAutomation.toLowerCase() !== automation.toLowerCase()) {
      throw new Error(`Expected automationName "${automation}", got "${observedAutomation}"`);
    }
  });

Then('the current package is {string}', async function (this: MobileWorld, expected: string) {
  const context = await deviceContext(this.driver);
  this.attachArtifact('app identity', context);
  if (context.appPackage !== expected) {
    throw new Error(`Expected the app under test to be "${expected}", got "${context.appPackage}"`);
  }
  if (!context.appActivity.includes('MainActivity')) {
    throw new Error(`Expected the Swag Labs main activity, got "${context.appActivity}"`);
  }
});

When('I terminate and relaunch the app', async function (this: MobileWorld) {
  await relaunchApp(this.driver);
  const context = await deviceContext(this.driver);
  this.attachArtifact('relaunch', { appPackage: context.appPackage, appActivity: context.appActivity });
});

Then('the device information is attached to the report', async function (this: MobileWorld) {
  const context = await deviceContext(this.driver);
  this.attachArtifact('device information', context);
  this.attachArtifact('appium endpoint', { serverUrl: config.appium.serverUrl, app: config.appium.app });

  // What this step is about: the session is still alive, still on the configured app, and the
  // sign-in screen is reachable — without re-asserting anything another scenario already covers.
  if (context.appPackage !== config.appium.appPackage) {
    throw new Error(`The session is driving "${context.appPackage}", expected "${config.appium.appPackage}"`);
  }
  if (!(await new LoginPage(this.driver).isVisible(20_000))) {
    throw new Error('The Swag Labs sign-in screen never came back after the relaunch');
  }
});
