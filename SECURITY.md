# Security Notes

MOTIF is a fully client-side application. There is no server, no database, no
authentication, and no user account system. This file is an honest assessment
of the small surface that exists.

## What the app does

- Runs entirely in the browser. All audio is synthesized locally with the Web
  Audio API. No audio input (microphone or otherwise) is ever requested.
- Makes zero network requests at runtime: fonts are self-hosted, no analytics,
  no external scripts, no API calls.
- Stores three things in `localStorage`: saved mixes, the last session
  (scene, layer mix, volume), and the theme preference. All values are written
  by the app itself.

## Threat model

**XSS.** Saved-mix names are the only free-text input. They are rendered
exclusively through React's text escaping, never as HTML, and never evaluated.
No `innerHTML`, `dangerouslySetInnerHTML`, or `eval` exists in the codebase.

**Injection.** Not applicable: no SQL, no shell, no command execution. There is
no backend to inject into.

**Secrets.** The repository contains no secrets, keys, or credentials. There is
nothing environment-specific to leak; deployment is a static build.

**Supply chain.** The runtime dependency set is `react` and `react-dom` only.
Dev dependencies are the Vite, TypeScript, ESLint, Vitest, and Playwright
toolchains. `npm audit` results are checked in CI; updates are reviewed weekly
through Dependabot with majors held back.

**Cookies and tracking.** None. The app sets no cookies and loads no trackers.

**Permissions.** The app requests no permissions: no microphone, no camera, no
location, no notifications. Optional vibration on play/pause uses the
non-prompting `navigator.vibrate` API where supported and is wrapped so that
unsupported browsers silently ignore it.

**Data ownership.** Saved mixes never leave the device. Clearing site data
removes them permanently; there is no recovery because there is no server copy.

## Residual risks accepted

- `localStorage` content is readable by any script running on the origin. On
  this static origin, the only scripts are the app bundle itself.
- Browser extensions running on the page can observe or modify local state.
  That is true of every client-side app and is out of the app's control.

## Reporting

Open a GitHub issue for anything you find. There is no bounty program; this is
a small, open, client-only project.
