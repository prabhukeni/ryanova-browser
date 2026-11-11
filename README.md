# Ryanova Browser

**Version: 1.1.0-beta.6**

Ryanova is a Chromium-based Linux desktop browser built with Electron, featuring integrated privacy controls.

## Features

- Strict Privacy Shield enabled by default
- Strict, Balanced and Standard protection modes
- Per-tab privacy controls
- Tracker blocking and Privacy Dashboard
- Clean Links to remove supported tracking parameters
- Private Tabs with isolated browsing storage
- Automatic update detection and SHA256-verified AppImage downloads

## Download

Get Linux installers from the [GitHub Releases](https://github.com/prabhukeni/ryanova-browser/releases) page.

| Package | Supported systems |
|---|---|
| `.deb` | Ubuntu, Debian and compatible Linux distributions |
| `.AppImage` | Compatible x86_64 Linux distributions |
| `.tar.gz` | Source-code archive |

## Install on Ubuntu or Debian

Download the `.deb` package, open a terminal in its directory and run:

    sudo apt install ./Ryanova*.deb

## Run the AppImage

Download the AppImage, open a terminal in its directory and run:

    chmod +x Ryanova*.AppImage
    ./Ryanova*.AppImage

## Build from source

Requires Node.js, npm and a supported Linux build environment.

    git clone https://github.com/prabhukeni/ryanova-browser.git
    cd ryanova-browser
    npm ci
    npm start

To build Linux installers:

    npm run dist:linux

The resulting packages are placed in `dist/`.

## Privacy and security

Ryanova includes browser-level tracking protection. These features do not guarantee anonymity or eliminate every form of tracking.

## Automatic updates

Ryanova can detect new GitHub releases and download verified updates. Automatic AppImage replacement is supported when running from an appropriate writable location.

## Beta notice

Ryanova is beta software. Some features and websites may have compatibility limitations.

## Project

Maintained by IGILE Technologies India Pvt. Ltd.

Repository: https://github.com/prabhukeni/ryanova-browser
