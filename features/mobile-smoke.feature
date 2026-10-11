@mobile
Feature: Swag Labs mobile smoke
  The app under test is Swag Labs (com.swaglabsmobileapp) — Sauce Labs' open-source demo shop and
  the reference Android app for this framework. The smoke path proves the whole stack end to end:
  an Appium session opens on the configured device, the standard user signs in, and the catalog
  reacts to a real interaction.

  Background:
    Given the Swag Labs app is open on its sign-in screen

  @smoke @regression
  Scenario: SMK-001 The standard user signs in and lands on the product catalog
    When I sign in as the standard user
    Then the PRODUCTS page shows its title

  @smoke @regression
  Scenario: SMK-002 Adding the first product updates the cart badge
    When I sign in as the standard user
    And I add the first product to the cart
    Then the cart badge shows "1"

  @regression
  Scenario: SMK-003 A wrong password is rejected with the app's error message
    When I sign in as "standard_user" with password "wrong_password"
    Then the app reports that the credentials do not match
