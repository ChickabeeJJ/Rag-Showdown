// Usage: serve the repo on :8123, then  NODE_PATH=$(npm root -g) node tools/pass-drag.js
// Checks the event pass drag: follow, throw with momentum, rubber band and spring back, no claim on drag, click still claims, wheel scrolls, bottom columns line up.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const mock = require('fs').readFileSync(require('path').join(__dirname, 'crazygames-mock.js'), 'utf8');
  await p.route('https://sdk.crazygames.com/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: mock }));
  await p.goto('http://localhost:8123/?t=' + Date.now());
  await p.waitForFunction(() => typeof UI !== 'undefined' && UI.fightOn, null, { timeout: 15000 });
  await p.evaluate(() => { Events.addTokens(650); UI._openEvent(); });
  await p.waitForTimeout(900);
  await p.evaluate(() => document.querySelector('.ev-track').scrollIntoView({ block: 'center' }));
  await p.waitForTimeout(300);
  const box = await p.locator('.ev-tiers-wrap').boundingBox();
  const sl = () => p.evaluate(() => Math.round(document.querySelector('.ev-tiers-wrap').scrollLeft));
  const claimed = () => p.evaluate(() => Events.state().claimed.length);
  const out = {};
  out.start = await sl(); const c0 = await claimed();
  // a quick throw to the left from over a CLAIM button
  const y = box.y + box.height * 0.85;
  await p.mouse.move(box.x + 700, y); await p.mouse.down();
  for (let i = 1; i <= 8; i++) { await p.mouse.move(box.x + 700 - i * 40, y); await p.waitForTimeout(12); }
  await p.mouse.up();
  out.atRelease = await sl();
  await p.waitForTimeout(700);
  out.afterGlide = await sl();
  out.claimedByDrag = (await claimed()) - c0;
  // drag past the start: rubber band, then spring back
  await p.evaluate(() => { document.querySelector('.ev-tiers-wrap').scrollLeft = 0; });
  await p.mouse.move(box.x + 200, y); await p.mouse.down();
  for (let i = 1; i <= 6; i++) { await p.mouse.move(box.x + 200 + i * 40, y); await p.waitForTimeout(16); }
  out.stretch = await p.evaluate(() => document.querySelector('.ev-tiers').style.transform);
  await p.mouse.up(); await p.waitForTimeout(700);
  out.afterSpring = await p.evaluate(() => document.querySelector('.ev-tiers').style.transform || 'none');
  // a plain click still claims
  const c1 = await claimed();
  await p.locator('[data-claim]').first().click();
  await p.waitForTimeout(300);
  out.clickClaims = (await claimed()) - c1;
  // the wheel scrolls it sideways
  await p.evaluate(() => { document.querySelector('.ev-tiers-wrap') && (document.querySelector('.ev-tiers-wrap').scrollLeft = 0); });
  const b2 = await p.locator('.ev-tiers-wrap').boundingBox();
  await p.mouse.move(b2.x + 300, b2.y + 60); await p.mouse.wheel(0, 400); await p.waitForTimeout(600);
  out.wheel = await sl();
  // the two bottom columns end on the same line
  out.bottoms = await p.evaluate(() => { const a = document.querySelector('.ev-chals').getBoundingClientRect(), s = document.querySelector('.ev-side').getBoundingClientRect(), n = document.querySelector('.ev-next').getBoundingClientRect(); return [Math.round(a.bottom), Math.round(s.bottom), Math.round(n.bottom)]; });
  await p.evaluate(() => { document.querySelectorAll('#event, #event *').forEach(e => { e.scrollTop = 9999; }); });
  await p.waitForTimeout(300);
  
  console.log(JSON.stringify(out), errs);
  await b.close();
})();
