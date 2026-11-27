const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'api', 'analyze.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const publicApp = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');

test('Groq key absence does not block local routines or catalog recommendations', () => {
  assert.match(api, /if \(!apiKey\).*AI provider is not configured/s);
  assert.doesNotMatch(api, /if \(!apiKey\) \{\s*return res\.status\(500\)/);
  assert.match(api, /buildFallbackRoutine\([\s\S]*?providerFallback: true/);
  assert.match(api, /buildFallbackShopRecs\([\s\S]*?providerFallback: true/);
});

test('recommendations are filtered to the requested care domain', () => {
  assert.match(api, /function recommendationDomainForFocus/);
  assert.match(api, /function filterRecommendationsForFocus/);
  assert.match(api, /filterRecommendationsForFocus\(parsed\.recommendations, focusArea\)/);
  assert.match(app, /function filterShopRecommendationsForFocus/);
  assert.match(app, /filterShopRecommendationsForFocus\(completeRecommendedBrandSets\(domainScopedRecommendations\), payload\.shoppingPrefs\.focusArea\)/);
});

test('shop results explain when Groq fallback is active', () => {
  assert.match(app, /Groq is rate-limited or unavailable/);
  assert.match(app, /data\.meta\?\.providerFallback/);
});

test('root and public app entrypoints stay synchronized', () => {
  assert.equal(app, publicApp);
});
