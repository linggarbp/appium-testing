/**
 * Cucumber lifecycle for the mobile suite.
 *
 *   Before     → open the Appium session and log the device context once per scenario
 *   AfterStep  → attach the text artifacts a step queued to the Cucumber report
 *   After      → on failure, capture a screenshot + the UI hierarchy XML under ARTIFACTS_DIR and
 *                attach both to the report; always close the session
 *
 * The teardown path never throws: a dead device must not mask the test result.
 */

import { After, AfterAll, AfterStep, Before, BeforeAll, setDefaultTimeout, Status } from '@cucumber/cucumber';
import { writeFileSync } from 'fs';
import { basename, resolve } from 'path';
import { artifactFile, ensureDir } from './artifacts';
import { config, describeAppSource } from './config';
import {
  closeSession,
  createSession,
  deviceContext,
  screenshot,
  uiHierarchy,
  SESSION_CONNECT_TIMEOUT_MS,
} from './driver';
import type { MobileWorld } from './world';

// Cucumber's default step/hook timeout is 5 s — shorter than opening a session on a cold emulator,
// which is exactly how a first run on a fresh device fails.
setDefaultTimeout(SESSION_CONNECT_TIMEOUT_MS);

/** Failure artifacts written this process (reported once in AfterAll). */
let failureArtifacts = 0;

BeforeAll(function () {
  console.log(`[appium-testing] Appium ${config.appium.serverUrl}`
    + ` · app: ${describeAppSource(config.appium.app)}`
    + ` · artifacts: ${config.artifactsDir}/`);
});

Before(async function (this: MobileWorld, { pickle }) {
  this.scenarioName = pickle.name;
  this.featureName = pickle.uri.split('/').pop()?.replace('.feature', '') ?? '';
  this.scenarioTags = pickle.tags.map((tag) => tag.name.replace(/^@/, ''));
  this.context = {};
  this.pendingArtifacts = [];

  this.driver = await createSession();
  console.log(`   └─ Appium session created for "${this.scenarioName}"`);

  try {
    const context = await deviceContext(this.driver);
    console.log(`   └─ device ${context.deviceName} · ${context.platformName} ${context.platformVersion}`
      + ` · ${context.appPackage}/${context.appActivity}`);
  } catch (error) {
    console.warn(`   └─ device context unavailable: ${(error as Error).message}`);
  }
});

AfterStep(async function (this: MobileWorld) {
  const queued = this.pendingArtifacts;
  this.pendingArtifacts = [];
  for (const artifact of queued) {
    this.attach(artifact.content, { mediaType: artifact.mediaType, fileName: artifact.fileName });
  }
});

After(async function (this: MobileWorld, { result }) {
  if (this.driver && result?.status === Status.FAILED) {
    await captureFailureArtifacts(this);
  }
  await closeSession(this.driver);
});

AfterAll(function () {
  if (failureArtifacts > 0) {
    console.log(`[appium-testing] ${failureArtifacts} failure artifact(s) written to ${config.artifactsDir}/`);
  }
});

/** Screenshot + UI hierarchy, saved under ARTIFACTS_DIR and attached to the report. Best-effort. */
async function captureFailureArtifacts(world: MobileWorld): Promise<void> {
  const dir = ensureDir(resolve(process.cwd(), config.artifactsDir));
  const stem = `${world.featureName}-${world.scenarioName}`;

  try {
    const png = await screenshot(world.driver);
    const file = artifactFile(dir, stem, 'png');
    writeFileSync(file, png);
    world.attach(png, { mediaType: 'image/png', fileName: basename(file) });
    failureArtifacts += 1;
  } catch (error) {
    console.warn(`[appium-testing] screenshot capture failed: ${(error as Error).message}`);
  }

  try {
    const hierarchy = await uiHierarchy(world.driver);
    const file = artifactFile(dir, stem, 'xml');
    writeFileSync(file, hierarchy);
    world.attach(hierarchy, { mediaType: 'application/xml', fileName: basename(file) });
    failureArtifacts += 1;
  } catch (error) {
    console.warn(`[appium-testing] UI hierarchy capture failed: ${(error as Error).message}`);
  }
}
