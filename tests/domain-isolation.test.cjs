const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const publicHtml = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');

const helperStart = html.indexOf('const CATEGORY_DOMAIN = Object.freeze');
const helperEnd = html.indexOf('function createBlankState()', helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'domain guard helpers exist');
const helperSource = html.slice(helperStart, helperEnd);
const sanitizeStart = html.indexOf('function cleanFalseStashLackNote');
const sanitizeEnd = html.indexOf('function ensureNonEmptySteps', sanitizeStart);
assert.ok(sanitizeStart >= 0 && sanitizeEnd > sanitizeStart, 'routine sanitizer exists');
const sanitizerSource = html.slice(sanitizeStart, sanitizeEnd);

function helpers(inventory = []) {
  const context = { state: { inventory }, console };
  vm.createContext(context);
  vm.runInContext(`${helperSource}\n${sanitizerSource}\nglobalThis.api = { CATEGORY_DOMAIN, canonicalProductDomain, productMatchesRoutineRole, findOwnedRoutineProduct, normalizeProductClassification, sanitizeRoutineStepAssignments };`, context);
  return context.api;
}

test('canonical categories cannot cross hair, face, and body domains', () => {
  const h = helpers();
  assert.equal(h.canonicalProductDomain({ domain: 'skin', category: 'Face Cleanser' }), 'skin');
  assert.equal(h.canonicalProductDomain({ domain: 'hair', category: 'Face Cleanser' }), null);
  assert.equal(h.canonicalProductDomain({ domain: 'body', category: 'Face Cleanser' }), null);
  assert.equal(h.canonicalProductDomain({ domain: 'body', category: 'Body Lotion / Cream' }), 'body');
  assert.equal(h.canonicalProductDomain({ domain: 'hair', category: 'Shampoo' }), 'hair');
});

test('unknown and ambiguous scan results remain unclassified', () => {
  const h = helpers();
  assert.equal(h.normalizeProductClassification('hair', 'Other', null).domain, 'unclassified');
  assert.equal(h.normalizeProductClassification('skin', 'Body Lotion / Cream', null).domain, 'body');
  assert.equal(h.normalizeProductClassification('skin', 'Moisturizer', null).domain, 'unclassified');
  assert.equal(h.normalizeProductClassification('hair', 'Moisturizer', null).domain, 'hair');
});

test('stash lookup requires both the correct domain and the correct routine role', () => {
  const stash = [
    { name: 'Facial Cleanser', domain: 'skin', category: 'Face Cleanser' },
    { name: 'Hair Shampoo', domain: 'hair', category: 'Shampoo' },
    { name: 'Body Wash', domain: 'body', category: 'Body Wash / Bar Soap' },
    { name: 'Face Serum', domain: 'skin', category: 'Face Treatment' }
  ];
  const h = helpers(stash);
  assert.equal(h.findOwnedRoutineProduct('hair', 'cleanse', stash).name, 'Hair Shampoo');
  assert.equal(h.findOwnedRoutineProduct('skin', 'cleanse', stash).name, 'Facial Cleanser');
  assert.equal(h.findOwnedRoutineProduct('body', 'cleanse', stash).name, 'Body Wash');
  assert.equal(h.findOwnedRoutineProduct('skin', 'moisturize', stash), null);
});

test('AI product assignments are replaced with the matching stash role', () => {
  const stash = [
    { name: 'Face Cleanser', domain: 'skin', category: 'Face Cleanser' },
    { name: 'Body Lotion', domain: 'body', category: 'Body Lotion / Cream' },
    { name: 'Hair Shampoo', domain: 'hair', category: 'Shampoo' }
  ];
  const h = helpers(stash);
  const hair = h.sanitizeRoutineStepAssignments(
    [{ step: 'Wash day — cleanse', detail: 'Cleanse the scalp.', productUsed: 'Face Cleanser' }],
    'hair',
    [{ step: 'Wash day — cleanse', detail: 'Cleanse the scalp.', productUsed: 'Not in stash', essential: true }]
  );
  assert.equal(hair[0].productUsed, 'Hair Shampoo (From Stash)');
  const face = h.sanitizeRoutineStepAssignments(
    [{ step: 'Face — cleanse', detail: 'Cleanse gently.', productUsed: 'Body Lotion' }],
    'skin',
    [{ step: 'Face — cleanse', detail: 'Cleanse gently.', productUsed: 'Not in stash', essential: true }]
  );
  assert.equal(face[0].productUsed, 'Face Cleanser (From Stash)');
  const body = h.sanitizeRoutineStepAssignments(
    [{ step: 'Body — moisturize', detail: 'Moisturize damp skin.', productUsed: 'Face Cleanser' }],
    'body',
    [{ step: 'Body — moisturize', detail: 'Moisturize damp skin.', productUsed: 'Not in stash', essential: true }]
  );
  assert.equal(body[0].productUsed, 'Body Lotion (From Stash)');
});

test('the retired owned-products panel is absent and both entry points match', () => {
  assert.equal(/YOUR PRODUCTS CONSIDERED FOR THIS ROUTINE/i.test(html), false);
  assert.equal(/Your products considered for this routine/i.test(html), false);
  assert.equal(publicHtml, html);
});
