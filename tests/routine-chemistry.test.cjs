const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'api', 'analyze.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const start = api.indexOf('function buildIngredientCompatibilityReview(');
const end = api.indexOf('function buildFallbackRoutine(', start);
assert.ok(start >= 0 && end > start, 'compatibility helper must exist in API');
const helperSource = api.slice(start, end);
const reviewIngredients = new Function(helperSource + '; return buildIngredientCompatibilityReview;')();

test('verified retinoid and exfoliating acid are flagged for separate use', () => {
  const result = reviewIngredients([
    { name: 'Retinoid serum', domain: 'skin', ingredientsVerified: true, ingredients: ['Water', 'Retinol'] },
    { name: 'AHA toner', domain: 'skin', ingredientsVerified: true, ingredients: ['Water', 'Glycolic Acid'] }
  ]);
  assert.equal(result.status, 'caution');
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0].message, /separate nights/i);
});

test('unverified partial ingredients never trigger a false compatibility claim', () => {
  const result = reviewIngredients([
    { name: 'Unknown serum', domain: 'skin', keyIngredients: ['Retinol'], ingredientsVerified: false }
  ]);
  assert.equal(result.status, 'partially_unverified');
  assert.equal(result.warnings.length, 0);
  assert.deepEqual(result.unverifiedProducts, ['Unknown serum']);
});

test('benzoyl peroxide and L-ascorbic acid are flagged for separated applications', () => {
  const result = reviewIngredients([
    { name: 'Acne wash', domain: 'skin', ingredientsVerified: true, ingredients: ['Benzoyl Peroxide'] },
    { name: 'Vitamin C serum', domain: 'skin', ingredientsVerified: true, ingredients: ['L-Ascorbic Acid'] }
  ]);
  assert.ok(result.warnings.some(w => /oxidize/i.test(w.message)));
});

test('multiple exfoliating products receive a stacking caution', () => {
  const result = reviewIngredients([
    { name: 'AHA', domain: 'skin', ingredientsVerified: true, ingredients: ['Lactic Acid'] },
    { name: 'BHA', domain: 'skin', ingredientsVerified: true, ingredients: ['Salicylic Acid'] }
  ]);
  assert.ok(result.warnings.some(w => /stacking/i.test(w.message)));
});

test('face AM fallback separates moisturizer and broad-spectrum sunscreen', () => {
  const faceBlock = api.slice(api.indexOf('skinRoutine: faceSelected'), api.indexOf('bodyRoutine: bodySelected'));
  assert.match(faceBlock, /AM — moisturize/);
  assert.match(faceBlock, /AM — broad-spectrum sunscreen/);
  assert.doesNotMatch(faceBlock, /moisturize and protect/);
});

test('body care has distinct treatment and sunscreen product domains', () => {
  assert.match(api, /'Body Treatment':'body'/);
  assert.match(api, /'Body Sunscreen':'body'/);
  assert.match(app, /"Body Treatment":"body"/);
  assert.match(app, /"Body Sunscreen":"body"/);
  assert.match(app, /Daytime — protect exposed areas/);
});

test('routine UI states when complete ingredient lists are not verified', () => {
  assert.match(app, /Formula compatibility for these products cannot be confirmed from the product name alone/);
});
