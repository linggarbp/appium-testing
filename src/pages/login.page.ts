/**
 * Sign-in screen of the Swag Labs demo app (`com.swaglabsmobileapp/.MainActivity`).
 *
 * The fields are addressed by the content descriptions the app itself ships for automation
 * (`test-Username`, `test-Password`, `test-LOGIN`): resource ids and layout change between app
 * builds, the test hooks do not.
 */

import { byAccessibilityId, isDisplayed, tap, type MobileDriver } from '../support/driver';

export const USERNAME_FIELD = 'test-Username';
export const PASSWORD_FIELD = 'test-Password';
export const LOGIN_BUTTON = 'test-LOGIN';

export class LoginPage {
  constructor(private readonly driver: MobileDriver) {}

  async isVisible(timeoutMs = 15_000): Promise<boolean> {
    return isDisplayed(this.driver, byAccessibilityId(USERNAME_FIELD), timeoutMs);
  }

  async signIn(username: string, password: string): Promise<void> {
    await this.fill(USERNAME_FIELD, username);
    await this.fill(PASSWORD_FIELD, password);
    await tap(this.driver, byAccessibilityId(LOGIN_BUTTON));
  }

  /** The error banner a rejected sign-in shows (`''` when the sign-in was accepted). */
  async errorText(): Promise<string> {
    const element = await this.driver.$('android=new UiSelector().textContains("do not match")');
    return (await element.isExisting()) ? ((await element.getText()) ?? '') : '';
  }

  private async fill(accessibilityId: string, value: string): Promise<void> {
    const field = await this.driver.$(byAccessibilityId(accessibilityId));
    await field.waitForDisplayed({ timeout: 15_000 });
    await field.clearValue();
    await field.setValue(value);
  }
}
