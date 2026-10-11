# appium-testing

[![CI](https://github.com/linggarbp/appium-testing/actions/workflows/ci.yml/badge.svg)](https://github.com/linggarbp/appium-testing/actions/workflows/ci.yml)

Mobile end-to-end test framework for Android: **Cucumber (Gherkin) + WebdriverIO v9 + Appium 3**
in TypeScript, driving the public **Swag Labs** sample app (`com.swaglabsmobileapp`) — Sauce Labs'
open-source demo shop — so anyone with an emulator can reproduce a run.

The point of this repository is the framework, not the app: a session abstraction that keeps
capabilities, waits and device helpers in one place; page objects and step definitions that read
like the feature files they bind; and failure evidence captured automatically into `test-results/`
and attached to the Cucumber report.

## Features

- **BDD with Cucumber** — scenarios live in Gherkin, tagged `@smoke` / `@regression` / `@session`,
  with a fast smoke subset suitable for every commit.
- **One session abstraction** — `src/support/driver.ts` owns capabilities, session lifecycle,
  waits, screenshots, the UI hierarchy and app relaunch; nothing else talks to the raw
  WebdriverIO client, so a capability change is a single edit.
- **Artifacts on failure, not on everything** — a failing scenario writes a PNG screenshot and the
  UI hierarchy XML under `test-results/` and attaches both to the report; green runs stay quiet.
- **Device-agnostic configuration** — every knob is an environment variable with a sane default,
  and a `.env` file is optional. Point `APPIUM_SERVER_URL` at a local server, a container, or a
  remote device farm; leave device fields blank and Appium picks the attached device.
- **Correct on fresh hardware** — the build under test can be installed from a URL at run time,
  installed exactly once per process (not once per scenario), and every session starts the app
  with its data reset, so scenarios never inherit cart or session state from each other.
- **Quality gates that work without a device** — type-check, unit tests and a Cucumber dry-run
  (every step bound) all run in CI.

## Tech stack

| Layer | Choice |
|---|---|
| Test runner | Cucumber 12 (Gherkin, hooks, retry) |
| Device driver | WebdriverIO 9 |
| Device server | Appium 3 with the UiAutomator2 driver |
| Language | TypeScript 5, run through ts-node (no build step) |
| Unit tests | `node:test` (no extra test framework) |
| CI | GitHub Actions, Node 20 |

## Prerequisites

- **Node.js 20+**
- **Android SDK and a device** — an emulator or a USB device with USB debugging enabled;
  `adb devices` must list it.
- **Appium 3** with the UiAutomator2 driver:

  ```bash
  npm install -g appium
  appium driver install uiautomator2
  ```

## Getting the app under test

The suite drives **Swag Labs**, Sauce Labs' open-source demo shop. The Android APK is public:

- Releases: <https://github.com/saucelabs/sample-app-mobile/releases>
  (the Android asset is named `Android.SauceLabs.Mobile.Sample.app.<version>.apk`; 2.7.1 is the
  latest published release)

Two ways to get it onto the device:

1. **Let Appium install it** — set `APPIUM_APP_URL` to the APK URL (for example the pinned release
   link below) and the first session of a run downloads and installs it:

   ```
   https://github.com/saucelabs/sample-app-mobile/releases/download/2.7.1/Android.SauceLabs.Mobile.Sample.app.2.7.1.apk
   ```

2. **Install it yourself** — `adb install Android.SauceLabs.Mobile.Sample.app.2.7.1.apk`, or point
   `APPIUM_APP_PATH` at the local file when Appium runs on the same machine.

The app's demo login is public: `standard_user` / `secret_sauce`.

## Quick start

```bash
# 1. install dependencies
npm install

# 2. configure — the defaults target a local Appium and the app already installed on the device
cp .env.example .env

# 3. start Appium (a device must already be attached — check with `adb devices`)
appium --port 4723

# 4. run the fast subset
npm run test:smoke
```

## Commands

| Command | What it does |
|---|---|
| `npm test` | Run every scenario against the configured device |
| `npm run test:smoke` | Fast subset (`@smoke`): session, sign-in, catalog, cart |
| `npm run test:regression` | Full regression set (`@regression`) |
| `npx cucumber-js --dry-run` | Verify every Gherkin step is bound — no device needed |
| `npm run test:unit` | Unit tests for configuration and helpers (`node:test`) |
| `npm run lint` / `npm run typecheck` | Type-check the suite (`tsc --noEmit`) |
| `npx cucumber-js --name "SMK-002"` | Run a single scenario by name |
| `npm run clean` | Remove `test-results/` |

Reports are written to `test-results/` (`cucumber-report.html` and `cucumber-report.json`), next to
the failure artifacts.

## Project structure

```
features/            Gherkin — mobile-smoke (sign-in, catalog, cart) and mobile-session (health)
src/support/         configuration, Appium session abstraction, Cucumber hooks, world, artifacts
src/pages/           page objects — the Swag Labs sign-in screen and product catalog
src/steps/           step definitions binding every feature line
test/unit/           node:test coverage for config parsing and helpers (no device needed)
test-results/        Cucumber HTML/JSON reports + failure artifacts (gitignored)
```

## Configuration

Every value is an environment variable; `.env.example` documents the same table.

| Variable | Default | Purpose |
|---|---|---|
| `APPIUM_SERVER_URL` | `http://127.0.0.1:4723` | Appium server endpoint (local, container, or farm) |
| `APPIUM_PATH` | URL path, else `/` | WebDriver base path for prefixed Appium setups |
| `PLATFORM_NAME` | `Android` | `platformName` capability |
| `PLATFORM_VERSION` | blank (auto) | Pinned via `appium:platformVersion` when set |
| `DEVICE_NAME` | blank (auto) | Pinned via `appium:deviceName` when set |
| `AUTOMATION_NAME` | `UiAutomator2` | Appium automation engine |
| `UDID` | blank (auto) | Target one device when several are attached |
| `APPIUM_APP_PACKAGE` | `com.swaglabsmobileapp` | App under test |
| `APPIUM_APP_ACTIVITY` | `.MainActivity` | Launch activity |
| `APPIUM_APP_PATH` | blank | Local `.apk` (same-host Appium); wins over the URL when the file exists |
| `APPIUM_APP_URL` | blank | Remote `.apk` Appium downloads and installs on the first session |
| `NEW_COMMAND_TIMEOUT` | `120` | `appium:newCommandTimeout`, in seconds |
| `IMPLICIT_TIMEOUT_MS` | `5000` | Default element wait |
| `TEST_USERNAME` | `standard_user` | User the smoke scenarios sign in with |
| `TEST_PASSWORD` | `secret_sauce` | Public demo password of the sample app |
| `ARTIFACTS_DIR` | `test-results` | Where reports and failure artifacts are written |
| `RETRIES` | `1` | Cucumber retries for `@flaky` scenarios (`0` disables) |

## Running against an emulator and Appium in Docker

The suite only needs a reachable Appium server, so both halves can live in containers:

```bash
# Android emulator with an adb bridge (port 5555)
docker run --rm -d --name android-emulator \
  -p 5554:5554 -p 5555:5555 \
  -e EMULATOR_DEVICE="Samsung Galaxy S10" \
  budtmo/docker-android:emulator_11.0

# Appium 3 with the UiAutomator2 driver (port 4723)
docker run --rm -d --name appium -p 4723:4723 appium/appium:latest

# Point the suite at the pair — Appium installs the build on the way in
APPIUM_SERVER_URL=http://127.0.0.1:4723 \
APPIUM_APP_URL=https://github.com/saucelabs/sample-app-mobile/releases/download/2.7.1/Android.SauceLabs.Mobile.Sample.app.2.7.1.apk \
npm run test:smoke
```

Honest caveats: container images and Android versions move quickly, so check the emulator image's
own documentation, and if Appium cannot see the emulator, run `adb connect <host>:5555` first. A
remote device farm needs no special support — point `APPIUM_SERVER_URL` at it and keep
`APPIUM_APP_URL` set so the build gets installed on the remote device.

## Continuous integration

`.github/workflows/ci.yml` runs the gates that do not need a device, on Node 20:

```bash
npm ci
npm run lint               # tsc --noEmit
npx cucumber-js --dry-run  # every step bound, 0 undefined
npm run test:unit          # node:test
```

Real device execution is out of scope for GitHub-hosted runners: use a self-hosted runner with an
emulator, or point a scheduled run at a device farm through `APPIUM_SERVER_URL`.

## Limitations

- **Android only.** The driver stack (UiAutomator2) and the selectors (`UiSelector`) are Android;
  iOS would need an XCUITest counterpart.
- **One session per scenario.** Scenario isolation at the cost of run time; group scenarios when
  suite duration matters more than independence.
- **The app is reset between sessions** (`noReset=false`), which keeps scenarios deterministic but
  adds an app start per scenario on slow emulators.
- **Screenshot and UI hierarchy are captured on failure only** — cheap by default, enough to debug
  what the device was showing.

## License

[MIT](LICENSE) © 2026 Linggar Bhakti Pratama
