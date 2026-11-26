const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const publicApp = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');

test('Routines has separate accessible Hair, Face/Skin, and Body tabs', () => {
  for (const domain of ['hair', 'skin', 'body']) {
    assert.match(app, new RegExp('id="routine-domain-tab-' + domain + '"'));
    assert.match(app, new RegExp('id="routine-domain-panel-' + domain + '"'));
    assert.match(app, new RegExp('aria-controls="routine-domain-panel-' + domain + '"'));
  }
});

test('domain tab selection shows only the selected routine panel', () => {
  assert.match(app, /function setRoutineDomainTab\(domain\)/);
  assert.match(app, /document\.querySelectorAll\("\.routine-domain-panel"\)/);
  assert.match(app, /panel\.classList\.toggle\("hidden", panel\.id !==/);
  assert.match(app, /setRoutineDomainTab\(activeRoutineDomain\)/);
});

test('empty domains show guidance rather than a blank panel', () => {
  assert.match(app, /No hair routine is currently selected/);
  assert.match(app, /No face routine is currently selected/);
  assert.match(app, /No body routine is currently selected/);
});

test('root and public app entrypoints remain synchronized', () => {
  assert.equal(app, publicApp);
});
