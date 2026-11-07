// node tools/shot.js <ширина> <имя> [light|dark] [url] — первый экран и вся страница
const { chromium } = require('C:/claude/marina-site/node_modules/playwright-core');
(async () => {
  const [, , w = '1440', name = 'desk', scheme = 'light', url = 'http://localhost:8770/'] = process.argv;
  const height = +w < 600 ? 844 : 900;
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const ctx = await b.newContext({ viewport: { width: +w, height }, deviceScaleFactor: +w < 600 ? 2 : 1, colorScheme: scheme });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('requestfailed', (r) => errs.push('fail ' + r.url()));
  p.on('response', (r) => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); });
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.waitForTimeout(2800);
  await p.screenshot({ path: `tools/shots/${name}_top.png` });
  const H = await p.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < H; y += 400) { await p.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), y); await p.waitForTimeout(90); }
  await p.waitForTimeout(1000);
  await p.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await p.waitForTimeout(600);
  await p.screenshot({ path: `tools/shots/${name}_full.png`, fullPage: true });
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  console.log(name, scheme, 'H=' + H, 'overflowX=' + overflow, errs.length ? 'ERR: ' + errs.join(' | ') : 'no errors');
  await b.close();
})();
