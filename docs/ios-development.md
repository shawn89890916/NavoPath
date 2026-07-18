# NavoPath iOS development

NavoPath's iOS app uses Capacitor to package the existing React/Vite application in a native `WKWebView`. The shared web code remains the source of truth for product behavior and portrait UI.

## What can be done on Windows

- Build and test the complete web application.
- Preview the phone layout from a browser or an iPhone on the same network.
- Update Capacitor configuration and native project files.
- Sync the latest web build into the committed Xcode project.

Run a LAN-accessible preview:

```powershell
npm run mobile:preview
```

Open the printed network URL on an iPhone. This previews the responsive UI, but not iOS-only APIs such as the native status bar.

Sync a production web build into the iOS project:

```powershell
npm run ios:sync
npm run ios:check
```

The sync command also normalizes Windows path separators in the generated Swift package so the project remains valid on macOS.

## What requires macOS

Capacitor 8 requires Xcode 26 or newer to build its iOS 15+ target. On a Mac:

```bash
npm ci
npm run ios:sync
npm run ios:open
```

In Xcode, select the `App` target, choose an Apple Developer Team under **Signing & Capabilities**, confirm the `com.navopath.app` bundle identifier, and run on a simulator or connected iPhone.

The app is intentionally portrait-only for the first iOS release. It uses the real iPhone safe areas instead of the rounded device frame used by browser previews.

## Before TestFlight

- Confirm that `com.navopath.app` is the final bundle identifier before creating the App Store Connect record.
- Replace the development app icon with an App Store-valid, fully opaque NavoPath composition approved for iOS.
- Test Supabase authentication and session restoration on a physical iPhone.
- Add native local notifications before relying on timer completion alerts.
- Verify backup and CSV export through the iOS share sheet; browser-style downloads are not a final native export experience.
- Complete App Store privacy details and review the generated privacy manifest before archive upload.
