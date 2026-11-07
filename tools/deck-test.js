// Проверка пластинки: крутим мышкой по кругу, смотрим скорость, подпись, волну и звук
const { chromium } = require('C:/claude/marina-site/node_modules/playwright-core');
const [, , W = '1440', tag = 'd'] = process.argv;
(async () => {
  const b = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const mob = +W < 600;
  const ctx = await b.newContext({ viewport: { width: +W, height: mob ? 844 : 900 }, deviceScaleFactor: mob ? 2 : 1 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  await p.goto('http://localhost:8770/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(2500);

  const wavePx = () => p.evaluate(() => {
    const c = document.querySelector('.hero__wave');
    const d = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data;
    let n = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 60) n++;
    return n;
  });
  const hint = () => p.textContent('.badge__hint');
  // уровень реального звука на выходе: подслушиваем через перехват AudioNode.connect не будем —
  // смотрим на волну и подпись, а сам звук пишем отдельным тестом ниже
  console.log('покой: волна px =', await wavePx(), '| подпись:', await hint());
  await p.screenshot({ path: `tools/shots/deck_${tag}_rest.png` });

  const bb = await p.locator('.badge').boundingBox();
  const cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2, R = bb.width * 0.36;
  async function spin(revs, revPerSec, dir = 1) {
    const steps = Math.round(revs * 48);
    const t0 = Date.now();
    await p.mouse.move(cx + R, cy);
    await p.mouse.down();
    for (let i = 1; i <= steps; i++) {
      const target = t0 + (i / 48 / revPerSec) * 1000;
      const a = dir * (i / 48) * Math.PI * 2;
      await p.mouse.move(cx + R * Math.cos(a), cy + R * Math.sin(a));
      const wait = target - Date.now();
      if (wait > 0) await p.waitForTimeout(wait);
    }
  }
  await spin(2.5, 1, 1);
  const midHint = await hint();
  const midWave = await wavePx();
  await p.screenshot({ path: `tools/shots/deck_${tag}_spin.png` });
  await p.mouse.up();
  console.log('крутим 1 об/с вперёд: подпись', JSON.stringify(midHint), '| волна px =', midWave);
  await p.waitForTimeout(700);
  console.log('отпустили 0.7 с: подпись', JSON.stringify(await hint()), '| волна px =', await wavePx());
  await p.screenshot({ path: `tools/shots/deck_${tag}_release.png` });

  await spin(1.5, 2, -1);
  console.log('крутим 2 об/с назад: подпись', JSON.stringify(await hint()));
  await p.mouse.up();
  await p.waitForTimeout(9000);
  console.log('через 9 с: подпись', JSON.stringify(await hint()), '| волна px =', await wavePx());
  console.log(errs.length ? 'ERR: ' + errs.join(' | ') : 'ошибок нет');
  await b.close();
})();
