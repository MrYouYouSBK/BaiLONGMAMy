# GAI AI 3.3.0 — Trusted Mac and local-first voice

## macOS installation and updates

- Mac release builds are now Developer ID signed, hardened, notarized by Apple and stapled before publication.
- CI rejects any publishable Mac build that is unsigned, lacks a notarization ticket or fails Gatekeeper assessment with Safari-style quarantine metadata.
- The automatic updater verifies SHA-256, bundle identity, Developer ID team and Gatekeeper notarization trust before replacing the installed app.
- The updater no longer removes macOS quarantine metadata.

## Local voice and Apple Silicon

- Always-on wake capture now uses system echo cancellation, noise suppression, automatic gain control and self-healing audio-device monitoring.
- macOS native speech enables Apple voice processing when available and keeps rolling Chinese, English and Malay recognition sessions alive.
- GAI AI can install, start, stop and connect to a local MLX-LM server on Apple Silicon, with a memory-aware model recommendation. Its one-click installer uses a pinned, SHA-256-verified overseas bootstrap and does not require preinstalled Python or Homebrew.
- Local processing remains the default; Google account actions open directly in the user's normal browser session.

## Tasks and timelines

- Timeline reminders now support one-time, daily, weekly and monthly follow-up schedules.
- Optional launch-at-login keeps wake listening and reminders available after a restart.
