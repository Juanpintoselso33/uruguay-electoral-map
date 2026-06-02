import { chromium } from 'playwright';

const URL = process.argv[2] || 'http://localhost:4323/nacionales-2019/montevideo';
const CLICK = process.argv[3] === 'click';
const OUT = process.argv[4] || 'C:/Users/trico/AppData/Local/Temp/pw-out.png';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
const logs = [];
page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));
page.on('response', r => { if (r.status() >= 400) logs.push(`[${r.status()}] ${r.url()}`); });

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForSelector('.maplibregl-canvas', { timeout: 15000 }).catch(()=>{});
await page.waitForTimeout(8000);

async function state(tag) {
  const s = await page.evaluate(() => {
    const btn = document.querySelector('.level-sel__btn--circuito');
    const map = window.__mlMap || null;
    let srcFeat = null, srcId = null;
    return {
      btnText: btn?.textContent?.trim() ?? null,
      btnActive: btn?.classList.contains('level-sel__btn--activo') ?? null,
      btnDisabled: btn?.classList.contains('level-sel__btn--disabled') ?? null,
      url: location.href,
    };
  });
  console.log(`-- ${tag}:`, JSON.stringify(s));
  return s;
}
await state('preload');

if (CLICK) {
  const btn = await page.$('.level-sel__btn--circuito');
  if (btn) { await btn.click(); await page.waitForTimeout(3000); }
  await state('after-click');
}

await page.screenshot({ path: OUT, fullPage: true });
console.log('--- console logs (últimos 25) ---');
console.log(logs.slice(-25).join('\n'));
await browser.close();
