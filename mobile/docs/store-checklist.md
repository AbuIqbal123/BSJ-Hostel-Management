# Store checklist

Begum Sultan Jahan Hall, version 1.0.0. Bundle and package `com.abuiqbal.bsjhall`.

## Ready in the project

- [x] Listing copy: `docs/app-store-listing-copy.md` and `docs/play-store-listing-copy.md`
- [x] EAS metadata draft: `store.config.json` (do not push until the URLs below exist)
- [x] Home screen icon, dark icon, splash, favicon, and Android adaptive icon use the hall's AMU seal
- [x] Splash plugin is configured in `app.json` (`imageWidth` 112, paper `#F2F4F0`, dark paper `#121A16`)
- [x] Export compliance: `ITSAppUsesNonExemptEncryption` is false
- [x] Production API: `eas.json` sets `EXPO_PUBLIC_API_URL` to `https://bsj-hostel-api.onrender.com`
- [x] A release build without that variable still uses the same Render host. Expo Go still uses the laptop.
- [x] Render was answering on 4 October 2026: `/health` returned ok, `/ready` returned ready with `user_version` 15
- [x] Play feature graphic: `docs/play-store-assets/feature-graphic-1024x500.png` (1024×500)
- [x] Production profile uses remote version numbers and increments the build number

## Still to do before the stores

- [ ] Public privacy policy URL (the in-app policy is dated 3 October 2026, and it is not on the web)
- [ ] Public support URL
- [ ] App Privacy form in App Store Connect, matching the listing copy
- [ ] Play Data safety form
- [ ] A resident account for App Review
- [ ] iPhone 6.9 inch screenshots, 1320×2868, three to five screens
- [ ] iPad 13 inch screenshots, 2064×2752, because `supportsTablet` is true
- [ ] Play phone screenshots
- [ ] Apple Developer and Play Console account steps that only you can finish
- [ ] New production binary, then submit

## Screenshots

Not captured. A store set needs a Release simulator build, and that build was not run in this pass. The icon and splash change only appears after the next production binary. Expo Go will not show the new home screen icon.

## Next commands

From `mobile/`:

```bash
npx tsc --noEmit
npx eas-cli@latest build -p ios --profile production
npx eas-cli@latest submit -p ios --profile production --latest
```

Do not use the development or preview profile for TestFlight. After the first binary is accepted, `eas metadata:push` can wait until the privacy and support URLs are real.
