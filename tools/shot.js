// node tools/shot.js <ширина> <имя> [высота] — скриншоты первого экрана и всей страницы
const { chromium } = require('C:/claude/marina-site/node_modules/playwright-core');
(async () => {
  const [, , w = '1440', name = 'desk', h] = process.argv;
  const height = +(h || (+w < 600 ? 844 : 900));
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const ctx = await b.newContext({ viewport: { width: +w, height }, deviceScaleFactor: +w < 600 ? 2 : 1 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('requestfailed', (r) => errs.push('fail ' + r.url()));
  await p.goto('http://localhost:8770/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(2600);
  await p.screenshot({ path: `tools/shots/${name}_top.png` });
  const H = await p.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < H; y += 500) { await p.evaluate((y) => scrollTo(0, y), y); await p.waitForTimeout(80); }
  await p.evaluate(() => scrollTo(0, 0));
  await p.waitForTimeout(500);
  await p.screenshot({ path: `tools/shots/${name}_full.png`, fullPage: true });
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  console.log(name, 'H=' + H, 'overflowX=' + overflow, errs.length ? 'ERR: ' + errs.join(' | ') : 'no errors');
  await b.close();
})();
