# AuraCare — Blank-Slate Hair, Face & Body Studio (v2.4)

Fixes profile persistence so updating or switching steps/tabs never erases your selections:
- Normalizes `state.profile` and `state.shoppingPrefs` cleanly on every load and save.
- Auto-saves text inputs on `input` / `blur` as well as when toggling chips or clicking Save.
- Keeps `index.html` and `public/index.html` identical so Vercel deploys the exact latest version.

## Deploy to Vercel
1. Push this folder to your GitHub repository.
2. Import into **Vercel** and set `GROQ_API_KEY` in **Settings -> Environment Variables**.
3. Deploy and open in **Safari on iPhone -> Share -> Add to Home Screen**.
