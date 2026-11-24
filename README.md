# AuraCare — Blank-Slate Hair, Face & Body Studio (v2.9)

**What's new in v2.9:** barcode scans now save the product's ingredient list and front image from Open Beauty Facts / Open Food Facts (via `fetchBeautyProduct`). The Stash tab shows a thumbnail and a tap-to-open Ingredients section, duplicate barcodes are skipped, product text is HTML-escaped before display, and ingredient lists (capped at 600 characters, no image URLs) are passed to the AI so routine and shopping advice can use them. The service worker cache name was bumped to `auracare-blank-v2-9` so installed Home Screen copies pick up the update. Saved data is preserved.


Thoroughly debugged scanner and API pipeline for iOS Safari / Home Screen PWAs:
1. **iOS Safari Live Camera + Fallback Chain (`index.html` & `public/index.html`):**
   - Uses a direct `navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } })` stream on a `<video playsinline autoplay muted>` element—avoiding wrapper camera-device enum quirks in iOS Safari and installed PWAs.
   - Runs native `BarcodeDetector` (when available) alongside `html5-qrcode` frame/canvas decoding (`scanFile` / canvas decode) so both live 1D/QR barcodes and uploaded/captured barcode photos work reliably.
   - Includes **Snap Label / Barcode Photo** (`📷 Snap Label / Barcode`) powered by Groq Vision (`qwen/qwen3.8-27b`) and queries both Open Beauty Facts (`v2` and `v0`) plus Open Food Facts (`v2`) when a barcode number is scanned or typed.
2. **Hardened API & Error Reporting (`api/analyze.js`):**
   - Never crashes with `JSON.parse` errors on non-JSON or `<think>`-wrapped responses; strips `<think>` blocks and markdown fences cleanly and returns readable errors if Groq rejects a request.

## Deploy to Vercel
1. Extract the zip and push all files to your GitHub repository (`KadijaLRT/auracare`).
2. Redeploy in **Vercel** with `GROQ_API_KEY` set in **Settings -> Environment Variables**.
3. Open your live Vercel URL in **Safari on iPhone -> Share -> Add to Home Screen**.
