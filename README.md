# Rynova Browser 1.1.0 Beta 1 — source release

**Internal team testing only. Not a production-certified binary.** This is a distinct Electron/Chromium browser shell, not the earlier Chromium launcher. Electron embeds Chromium; it is **not CEF**. It requires internet to download Electron when building. No executable runtime or prebuilt `.deb` is included in this ZIP.

## Build on Debian/Ubuntu/RyanOS (64-bit x86)
Install Node.js 20+ and npm on the build machine. Run `./build-linux.sh`. The output `.deb` and `.AppImage` are generated under `dist/`. Install the `.deb` with `sudo apt install ./dist/rynova-browser_*.deb` (use actual generated filename). Debian APT resolves declared shared-library dependencies from configured repositories. AppImage still needs compatible host kernel/glibc/FUSE setup. Fedora/Arch packages are not provided.

## Features
Branded futuristic UI, multiple tabs, address/search, back/forward/reload/home, Ctrl+T/W/L/D/R, bookmarks, persistent history, downloads, private app profile, Chromium sandbox, site permissions denied by default, default-deny popups with new tabs, basic domain-based ad/tracker blocking toggle, cookie/cache/history clear, and About/version screen. No Rynova analytics or advertising.

## Known limitations / beta cautions
- Blocking is a small static domain list; not equivalent to uBlock Origin and cannot guarantee ad-free YouTube or other sites. It may cause site breakage. No exception UI yet.
- No full settings UI, password-manager audit, auto-updater, background tab suspension, session restore, per-site permissions UI, or comprehensive browsing security review. Do not use for sensitive banking until audited.
- This is a separate Electron runtime and can use **more** RAM than system Chromium. The 2 GB ASUS X205TA may struggle. Hardware compatibility is unverified.
- Linux `.deb` package dependencies are declared; building requires network access. Engine security updates require releasing a new Electron version; this beta does not self-update.
- Chromium web contents may overlay the custom panel for settings on non-home tabs; use a blank home tab for panel access in this beta.
- Electron does not guarantee all proprietary codecs/DRM services. YouTube playback and ChatGPT need device testing.

## Security
Never run with `--no-sandbox`; do not install npm dependencies as root. The app disables node integration in web content, enables context isolation and sandbox, blocks non-http navigation, and denies site permissions by default. The internal UI is loaded from local files and has a strict CSP.
