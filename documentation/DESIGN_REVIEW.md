# Website design review — 28 September 2026

## Implemented
- Rebuilt the landing page around a real-time WebGL security-camera scene made from Three.js geometry, plus a wide interactive product concept.
- Original Evision logo retained; separate Product, How it works, Deploy, Downloads, About us and Contact routes.
- Four selectable concept panels: camera organization, recording path allocation, playback range export and scoped access.
- The hero camera is rendered in WebGL and responds to pointer position. The interface walkthrough uses restrained CSS perspective. Reduced-motion users receive a static WebGL frame and a static walkthrough.
- Architectural linework is illustrative. No camera footage, detections or live-device claims.
- Public capability copy comes from the verified feature catalog.

## Verification performed
- Complete npm run test:all passed: lint, 16 automated test groups, build, two-port form/owner browser checks, responsive/public browser checks and content audit.
- Public pages checked at 1440, 1280, 1024, 768, 480, 390 and 320 pixels.
- 16 axe scans returned zero violations after fixing homepage number contrast.
- Panel visibility and selected state verified for all four interactive modes.
- Desktop and mobile homepage and desktop contact screenshots inspected after the final geometry and layout changes.
- Local preview returned HTTP 200 with the new heading and stylesheet.
- Core checkout remained unchanged.

## Limits
These checks do not establish that every possible issue is absent or that the visual design meets the user's taste.
The live release endpoint returned HTTP 503 at verification. Release-mirror publication/access remains pending.
No GitHub push or production deployment was performed. SMTP and Google Sheets production delivery remain unverified.
