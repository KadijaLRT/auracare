# AuraCare — Blank-Slate Hair, Face & Body Studio (v2.21)

Minimizes API token consumption across both the client (`index.html` / `public/index.html`) and serverless API (`api/analyze.js`):
- Strips empty/blank profile fields (`compactProfileForApi`) and caps stash items in prompts to the top 20/15 compact entries.
- Compresses label scan photos to `512px` (`0.72` JPEG) and check-in photos to `640px` (`0.75` JPEG) to cut vision token usage.
- Caches identical check-in and store-match requests in memory (`clientApiCache`) so repeated clicks cost 0 tokens.
- Tightens prompt wording and caps `max_tokens` (`450` for label scans, `650` for shop recs, `700` for routines).
