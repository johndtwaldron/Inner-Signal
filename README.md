# Inner Signal

A local-first, private listening room for personal meditation, affirmation and hypnosis media. The working Mac prototype indexes files in place, plays them in the browser, supports a persistent queue, and runs image slideshows. It does not upload, copy, rename, or alter the media library.

## Current media inventory

The latest verified library contains 38 playable recordings across the root folder, the relaxation subfolder and shortcut folders. MP3 and MP4 filenames are indexed regardless of whether they are inside a subfolder. One Google Docs pointer is intentionally ignored. No image files were present in the media folder at the time of indexing.

The interface includes original AI-generated Inner Signal and relaxation artwork plus the supplied Mirror Dance Lodge image. Recordings inherit their collection artwork; unknown collections fall back to the default Inner Signal cover. **Find visual ideas** opens a focused Google Images search for the selected collection, but the app does not scrape or copy third-party images automatically.

The canonical future iPhone source is the configured [Google Drive meditation folder](https://drive.google.com/drive/folders/1oEXzLFWZQxgXXvjZUGSErxJze_amg4EJ?usp=drive_link). The saved online collection is the configured [YouTube playlist](https://youtube.com/playlist?list=PLigOQIYm3Ub9rLYotDp3cBQUYhYlkP3DI&si=Icunyd8kH7N6XGxc).

## Run on the Mac

Python 3.11 or newer is recommended.

For the simplest launch, double-click `start_mac.command` in Finder. On the first run, macOS may ask you to confirm opening it, and setup takes a minute. Leave its Terminal window open while using Inner Signal; close it or press Control-C to stop the app. The launcher exposes the app only to devices that can reach the Mac on the same local network.

For a manual launch:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload
```

Open <http://127.0.0.1:8000>. The default media folder is already configured for the original Mac. To use another folder:

The first library scan may take several seconds when Google Drive needs to make cloud-backed files available. Later page loads use the in-memory index; choose **Refresh library** after adding files.

```bash
export INNER_SIGNAL_MEDIA_ROOT="/absolute/path/to/media"
uvicorn app.main:app --reload
```

The browser interface works at phone width, but the Mac service must be running. With the Mac and iPhone on the same trusted Wi-Fi, open `http://192.168.0.72:8000` in iPhone Safari. The address may change after the router or Mac restarts; run `ipconfig getifaddr en0` on the Mac to find the current value. There is no sign-in layer in this local-network prototype, so stop the launcher or return to `--host 127.0.0.1` on an untrusted network.

The local-network URL uses plain HTTP. Library browsing and streaming work, but iPhone Safari may restrict service-worker/offline-cache behavior outside HTTPS. Reliable offline downloads are therefore part of the hosted-PWA/native stages rather than something to depend on during this Mac-served test.

## What works

- recursive local indexing for MP3, M4A, AAC, WAV, FLAC, OGG, MP4, MOV, WebM and common images
- follows valid file and folder shortcuts without copying or moving their targets
- metadata for title, collection, file size and duration when readable
- local audio playback without a cloud API, including audio-only playback of MP4 containers
- search and collection filters
- queue stored in browser local storage
- shuffle plus repeat-off, repeat-all and repeat-one playback modes
- automatic filename, folder, duration and metadata tags
- automatic collections for loose root files: Hypnosis & Sleep, Mindfulness & Calm, Confidence & Self-Worth, Motivation & Reprogramming, Healing & Integration and Personal Recordings
- local nap, one-hour and eight-hour queue generation from a plain-language mood description
- an optional locally saved link to a private YouTube playlist
- a Mobile Safari/Home Screen badge and collision-free three-row mobile player
- slideshow from indexed images or temporary image selection
- original neon-purple, jet-black and gold collection artwork with fallback covers
- automatic collection covers on every library refresh: a cover/artwork image inside a subfolder wins, otherwise its first image is used; PNG is preferred when duplicate PNG/AVIF artwork exists
- image indexing for PNG, JPG/JPEG, WebP, AVIF, GIF and HEIC files
- per-recording offline downloads with live percentage progress and removal
- offline-library storage usage, allowance and percentage reporting
- installable PWA shell and responsive mobile layout
- FastAPI health, library, re-index and protected-ID media routes
- pytest unit/API coverage, Playwright browser test and GitHub Actions CI

## Tests

```bash
ruff check .
pytest -m "not e2e"
playwright install chromium
pytest -m e2e
```

Tests use fake local media and never access the personal folder in GitHub Actions.

## Privacy and limitations

The app runs locally and has no analytics, account, remote database, paid API, transcription service, or AI service. The selected image list is session-only. Queue IDs persist in the current browser. The service exposes media to devices that can reach it, so bind it to `127.0.0.1` unless deliberately testing on a trusted LAN.

The PWA caches the interface plus only the recordings explicitly marked Offline. The Mac version otherwise relies on the locally synced Google Drive folder, which means Drive for desktop should make desired source files available offline.

The Offline control now explicitly stores selected recordings in the PWA media cache and shows download progress. The storage screen separates downloaded-audio size from total web-app usage. Browser storage can still be evicted under device pressure, so this is a working prototype rather than the final iPhone guarantee.

### Automatic understanding

The current version makes zero-effort recommendations from filenames, folder names, durations and embedded metadata. This is useful immediately but cannot reliably understand an ambiguously named recording such as `RPReplay_Final1711184061.MP4`.

The next content-aware stage is fully local transcription on the Mac: extract audio with FFmpeg, transcribe it with a locally installed Whisper-compatible model, then save transcripts, summaries and themes in a private SQLite index. That can run as a background indexing job after Refresh Library and requires no paid API. It is intentionally not enabled yet because the initial model download is large and transcribing this library may take considerable time and storage.

The YouTube field stores only the playlist URL in browser storage. It opens the official YouTube page and relies on the user's existing Google login. It does not download, extract or merge YouTube audio into the local queue.

## Path to an iPhone app

1. **Mobile web validation:** use the responsive UI from Safari on the same trusted network and refine touch interactions.
2. **Installable PWA trial:** host only the static shell over HTTPS and add explicit offline-download storage. iOS PWA storage and background-audio behaviour should be tested before committing to this route.
3. **Native packaging (recommended):** retain the FastAPI indexing/transcription service as an optional Mac companion, then package the frontend with Capacitor or rebuild the listening surface in SwiftUI. Use native iOS file storage and AVFoundation for reliable background and lock-screen playback.
4. **Drive access:** add Google OAuth and Drive API access in the iPhone app, list the configured folder by its ID, follow Drive shortcuts, and copy user-selected downloads into app-private storage. Download progress should come from bytes received versus Drive metadata size, with pause/cancel/retry support. Do not depend on the Mac path on iPhone.
5. **Native storage reporting:** sum the app-private audio directory for exact Inner Signal usage; query total and available device capacity; display downloaded audio, other app data, free space and the app's percentage of total capacity. Check sufficient capacity before starting large downloads.
6. **Intelligence later:** add local transcription on the Mac (for example, Whisper-compatible local tooling) and store transcripts/tags as portable JSON or SQLite. Recommendations can begin as deterministic rules and remain free/local; an opt-in AI provider can be added later.
7. **Distribution:** test through Xcode on a personal device, then use TestFlight or the App Store when ready. Apple developer signing may eventually involve Apple's developer-program fee; it is not needed for this Mac prototype.

## Portfolio story

Inner Signal demonstrates Python/FastAPI API design, secure path handling, media indexing, responsive PWA design, local-first privacy, pytest, Playwright, CI/CD and a staged native-mobile architecture. The repository deliberately separates personal media from source control.
A private, local-first listening room. The repository contains application code and bundled default artwork only; personal meditation media stays outside Git and is sourced from the configured local folder or, in the hosted version, Google Drive.

## GitHub Pages

The `Deploy GitHub Pages` workflow publishes the static PWA shell from `static/`. GitHub Pages cannot run FastAPI, so the hosted build does not use the Mac `/api` endpoints. The next hosted milestone is browser-based Google OAuth with the read-only Drive scope, after creating a Google Cloud Web OAuth client for the final Pages URL. Never commit a client secret, access token, refresh token, or personal audio file.
