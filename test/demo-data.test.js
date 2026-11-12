import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildDemoData, renderDemoData } from '../scripts/build-demo-data.mjs';

test('demo data is generated from the current rules and templates', () => {
  const onDisk = readFileSync(new URL('../public/demo-data.js', import.meta.url), 'utf8');
  assert.equal(onDisk, renderDemoData(), 'public/demo-data.js is stale: run npm run demo-data');
});

test('demo scenarios use the real safety decisions and cover every language', () => {
  const { scenarios, languages } = buildDemoData();
  assert.equal(scenarios.quake.action, 'check_building');
  assert.equal(scenarios.tsunami.action, 'high_ground_now');
  assert.equal(scenarios.tsunami.shelterLayer, 'skhb05');
  assert.equal(scenarios.typhoon.action, 'evacuate_now');
  for (const sc of Object.values(scenarios)) {
    for (const l of Object.keys(languages)) {
      assert.ok(sc.stage1[l], `${sc.hazard} first alert in ${l}`);
      assert.ok(sc.guidance[l].steps.length >= 2, `${sc.hazard} next steps in ${l}`);
    }
  }
  // The demo's next steps are really in each language, not English fallbacks.
  assert.notEqual(scenarios.tsunami.guidance.vi.title, scenarios.tsunami.guidance.en.title);
});
