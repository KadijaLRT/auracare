# AuraCare — Hair, Face & Body Studio (v2.31)

Line-by-line debugging & hardening fixes:
- Escaped apostrophes and backslashes in inline `onclick` handlers (`renderChipGroup`, `toggleTrigger`, `setHairState`, `toggleStorePref`) so names like `Aunt Jackie's` never break inline JS string literals.
- Passed `roleHint` for body cleanse/moisture steps in `buildLocalCheckinFallback`.
- Hardened `sanitizeJsonString` in `api/analyze.js` to escape invalid backslash sequences before `JSON.parse` and increased routine `max_tokens` cap to `850` (`safeMaxTokens` max `950`) to avoid truncated JSON responses.
