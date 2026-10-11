@mobile
Feature: Appium session health
  What an operator checks when a device or an Appium server starts misbehaving: the session that
  was negotiated against the configured endpoint, the identity of the app under test, a clean
  terminate/relaunch, and the device context the running session reports.

  Background:
    Given an Appium session is open against the configured Appium server

  @session @regression
  Scenario: SES-001 Session capabilities report the Android platform and the UiAutomator2 engine
    Then the session reports the platform "Android" and the automation engine "UiAutomator2"

  @session @regression
  Scenario: SES-002 The session drives the configured Swag Labs package
    Then the current package is "com.swaglabsmobileapp"

  @session @regression
  Scenario: SES-003 Terminate and relaunch keeps the session usable
    When I terminate and relaunch the app
    Then the Swag Labs sign-in screen is visible

  @session @regression
  Scenario: SES-004 The device context is attached to the report
    Then the device information is attached to the report
