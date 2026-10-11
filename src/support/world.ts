/**
 * The Cucumber world for the mobile suite: one object per scenario holding the Appium session,
 * the scenario metadata and the artifacts a step wants to show up in the report.
 */

import { setWorldConstructor, World, type IWorldOptions } from '@cucumber/cucumber';
import { slugify } from './artifacts';
import type { MobileDriver } from './driver';

/** A text/JSON artifact a step queued for the report; the AfterStep hook attaches and clears it. */
export interface PendingArtifact {
  fileName: string;
  mediaType: string;
  content: string;
}

export class MobileWorld extends World {
  /** Appium session for the scenario (opened in the Before hook). */
  driver!: MobileDriver;

  scenarioName = '';
  featureName = '';
  scenarioTags: string[] = [];

  /** Small scratch space shared between the steps of one scenario. */
  context: Record<string, unknown> = {};

  /** Artifacts a step wants in the report; buffered here, flushed after the step. */
  pendingArtifacts: PendingArtifact[] = [];

  constructor(options: IWorldOptions) {
    super(options);
  }

  /**
   * Queue JSON or text evidence for the step currently running. The AfterStep hook attaches it to
   * the Cucumber report under a readable file name.
   *
   * Named `attachArtifact` on purpose: Cucumber's own `World.attach` is its attachment channel.
   */
  attachArtifact(label: string, content: unknown, mediaType = 'application/json'): void {
    this.pendingArtifacts.push({
      fileName: `${slugify(label, 40)}.${mediaType.includes('json') ? 'json' : 'txt'}`,
      mediaType,
      content: typeof content === 'string' ? content : JSON.stringify(content, null, 2),
    });
  }
}

setWorldConstructor(MobileWorld);
