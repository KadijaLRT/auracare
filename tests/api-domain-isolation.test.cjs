const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const apiSource = fs.readFileSync(path.join(__dirname, '..', 'api', 'analyze.js'), 'utf8');
const start = apiSource.indexOf('const CATEGORY_DOMAIN = Object.freeze');
const end = apiSource.indexOf('const SERVER_CATALOG = [', start);
assert.ok(start >= 0 && end > start, 'API category/domain guard helpers exist');
const context = {};
vm.createContext(context);
vm.runInContext(`${apiSource.slice(start, end)}\nglobalThis.domainApi = { CATEGORY_DOMAIN, normalizeInventoryDomain, normalizeRecommendation };`, context);
const api = context.domainApi;

test('API normalizes conflicting stash metadata to unclassified', () => {
  assert.equal(api.normalizeInventoryDomain({ name: 'Face Wash', domain: 'hair', category: 'Face Cleanser' }).domain, 'unclassified');
  assert.equal(api.normalizeInventoryDomain({ name: 'Body Lotion', domain: 'body', category: 'Body Lotion / Cream' }).domain, 'body');
  assert.equal(api.normalizeInventoryDomain({ name: 'Face Cream', domain: 'skin', category: 'Moisturizer' }).domain, 'unclassified');
});

test('API rejects recommendations whose category does not belong to their domain', () => {
  assert.equal(api.normalizeRecommendation({ name: 'Face Cleanser', domain: 'hair', category: 'Face Cleanser' }), null);
  assert.equal(api.normalizeRecommendation({ name: 'Hair Shampoo', domain: 'hair', category: 'Shampoo' }).domain, 'hair');
  assert.equal(api.normalizeRecommendation({ name: 'Body Lotion', domain: 'body', category: 'Body Lotion / Cream' }).domain, 'body');
});

test('API applies category/domain validation to routine gaps and both shopping model paths', () => {
  assert.match(apiSource, /CATEGORY_DOMAIN\[String\(item\.category \|\| ''\)\.trim\(\)\] !== item\.domain/);
  assert.equal((apiSource.match(/map\(normalizeRecommendation\)\.filter\(Boolean\)/g) || []).length, 2);
  assert.match(apiSource, /ambiguousLegacyMoisturizer/);
});
