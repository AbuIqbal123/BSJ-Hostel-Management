# iOS end-to-end tests

Drives the real app on an iOS simulator with [TesterArmy e2e](https://e2e.tester.army/docs) (Apache-2.0). It sits beside the API smoke checks and doesn't replace them. Only macOS can run it.

- `tests/resident.e2e.ts`: sign in, Home, Pass, Permissions, plan an ordinary outing, Settings, change password, a History list that pages, a History failure that retries, and Guest stays (upcoming, then Show older).
- `tests/staff.e2e.ts`: warden Home, Out now (Ordinary, Permission, and Late), Requests; gate Scan by pass code.
- The runner starts `scripts/serve-api.sh`, a throwaway API on `127.0.0.1:8010` with a fresh SQLite hall, the dev accounts and mock SMS. Passwords are read from its seed output at fill time, never from the repo or the environment.
- Every step is a plain locator except one, tagged `agent`: the iOS date and time pickers in "plan an ordinary outing". That step uses your SuperGrok login or a local Ollama model, never an API key. Once it passes, it's recorded in `.e2e/cache/` and replays with no model call. Commit the cache.
- No hosted devices (Limrun, EAS, Kernel). Telemetry is off.

## One-time Mac setup

1. Install Xcode from the App Store. Then:
   ```sh
   sudo xcode-select -s /Applications/Xcode.app
   sudo xcodebuild -license accept
   xcodebuild -runFirstLaunch
   xcodebuild -downloadPlatform iOS        # the iOS simulator runtime
   ```
2. Install the tools: `brew install node@22 cocoapods python@3.14`. You need Node 22.22.3 or newer (or 24.8+) and Python 3.14, as in CI.
3. Pick a simulator: run `xcrun simctl list devices available | grep iPhone`. The suite uses `iPhone 17`; for another one, `export BSJ_E2E_SIMULATOR="<name>"`.

## Passwords

Nothing is committed. Each password comes from an env var when it's set, otherwise from the scratch hall's seed output (`$TMPDIR/bsj-e2e/seed-accounts.txt`, mode 600):

| Account | Env var |
| - | - |
| resident `24-GLLB-118` | `E2E_RESIDENT_PASSWORD` |
| gate `gate.fatima` | `E2E_GATE_PASSWORD` |
| warden `warden.sara` | `E2E_WARDEN_PASSWORD` |

These are dev-seed accounts that exist only in the scratch SQLite database. Never point the suite at Render or Turso, and never put real accounts' passwords here.

## Each run

```sh
export E2E_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1
# 1. Release build on the simulator, pointed at the scratch API (no signing, no Metro)
cd mobile && npm ci
EXPO_PUBLIC_API_URL=http://127.0.0.1:8010 npx expo run:ios --configuration Release --device "iPhone 17"
# 2. Tests
cd ../e2e && npm ci
npx agent-device doctor                  # the iOS rows must be green
npm run test:no-ai                       # every test except the one agent step
npx e2e login spacexai                   # once: SuperGrok device code
npm test                                 # the full suite; records the agent step on its first pass
```

To use Ollama instead of SuperGrok, run `brew install ollama && ollama pull qwen3:8b`, then `BSJ_E2E_MODEL=ollama:qwen3:8b npm test`.

Rebuild the app (step 1) after mobile changes. Reports go to `.e2e/` (gitignored, apart from `.e2e/cache/`). If the iOS runner wedges, run `npx agent-device daemon stop` and reboot the simulator.

Selectors are React Native `testID`s (`tab-<route>`, `scan-code`) and accessibility labels the app already has.
