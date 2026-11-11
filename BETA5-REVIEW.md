# Ryanova beta.5 — code review and verification

## Implemented
- Strict Privacy Shield default for every newly opened tab.
- Balanced and Standard per-tab policies; changing policy reloads only the selected tab.
- Categorized blocking events for known advertising, analytics, and social-tracker hosts.
- Strict mode strips third-party Cookie request headers and Set-Cookie response headers on subresource requests.
- Tracking-link cleanup for common marketing query parameters.
- Privacy Dashboard reports observed blocked requests, removed parameters and restricted response cookies per tab.
- Private Tabs use distinct non-persistent Electron session partitions and do not write browsing history.
- Existing updater retained, version changed to 1.1.0-beta.5.

## Review findings / limits
1. This is a limited domain blocklist, not a comprehensive anti-tracking engine. No fingerprinting resistance, Tor, VPN, DNS protection or anonymity claim.
2. Third-party detection uses hostname/subdomain comparison, not a public-suffix or First-Party Sets implementation. Some legitimate embedded login or payment flows may break in Strict.
3. Cookie header interception is a defense-in-depth restriction; it does not guarantee blocking all cookie/storage tracking paths, such as JavaScript APIs or other storage channels.
4. Clean Links covers direct URL entry and navigation events, but not every possible server redirect or dynamically modified address.
5. Private sessions are in-memory Electron partitions. Downloads and explicitly saved bookmarks may persist. Network, ISP, websites and the operating system may still retain activity.
6. No GUI integration tests or real-site compatibility tests could be executed in this build environment.
7. beta.4 → beta.5 updater end-to-end installation remains unverified; test with a packaged beta.4 install and beta.5 GitHub release.
8. Existing beta.4 updater SHA256 checks verify file integrity but do not independently authenticate the publisher.

## Verified
- `node --check` on main.js, preload.js, privacy.js, ui/app.js and ui/overlay.js.
- `node --test tests/privacy.test.js`: 4 tests passed.
- package.json and package-lock.json both use beta.5.

## Recommended before public distribution
- Test at least 10 popular sites including login, payment, video and file download workflows under each protection level.
- Verify Strict does not leak cookies on cross-site subresource requests using DevTools network inspection.
- Verify private-tab history isolation and storage clearing after closing the tab.
- Test both DEB and AppImage packaging and actual updater installation.
- Commission a browser-specific security review; do not advertise banking-grade security or ultimate anonymity yet.
