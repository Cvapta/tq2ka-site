// Проверка интерактива: блики за курсором, выезд диска, плеер (тестовый mp3), пасхалка qwerty
const { chromium } = require('C:/claude/marina-site/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  // подсовываем тестовый звук первому релизу до запуска скриптов
  await p.route('http://localhost:8770/', async (route) => {
    const r = await route.fetch();
    let html = await r.text();
    html = html.replace('id="saint-s" data-audio=""', 'id="saint-s" data-audio="audio/_test.mp3"');
    route.fulfill({ response: r, body: html });
  });
  await p.goto('http://localhost:8770/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(2300);

  // 1. блики при разных положениях курсора
  const box = await p.locator('#gem').boundingBox();
  const spots = [[0.2, 0.2], [0.8, 0.3], [0.6, 0.9]];
  for (let i = 0; i < spots.length; i++) {
    await p.mouse.move(box.x + box.width * spots[i][0], box.y + box.height * spots[i][1], { steps: 8 });
    await p.waitForTimeout(900);
    await p.screenshot({ path: `tools/shots/light${i}.png`, clip: { x: box.x + 300, y: 0, width: 560, height: 900 } });
  }
  const lit = await p.evaluate(() => {
    const c = document.querySelector('.hero__fire');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) n++;
    return n;
  });
  console.log('пикселей бликов на холсте:', lit);

  // 2. наведение на релиз + плеер
  await p.locator('#saint-s').scrollIntoViewIfNeeded();
  const cover = p.locator('#saint-s .release__cover');
  await cover.hover();
  await p.waitForTimeout(900);
  const playBtn = p.locator('#saint-s .release__play');
  console.log('кнопка плеера видна:', await playBtn.isVisible(), await playBtn.getAttribute('aria-label'));
  await playBtn.click();
  await p.waitForTimeout(1500);
  const st = await p.evaluate(() => {
    const r = document.getElementById('saint-s');
    return { playing: r.classList.contains('is-playing'), p: r.querySelector('.release__progress').style.getPropertyValue('--p'), label: r.querySelector('.release__play').getAttribute('aria-label') };
  });
  console.log('плеер:', JSON.stringify(st));
  await p.screenshot({ path: 'tools/shots/playing.png', clip: await p.locator('#saint-s').boundingBox() });
  await playBtn.click();
  await p.waitForTimeout(300);
  console.log('после паузы is-playing =', await p.evaluate(() => document.getElementById('saint-s').classList.contains('is-playing')));

  // 3. пасхалка
  await p.mouse.move(5, 5);
  for (const k of ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY']) await p.keyboard.press(k);
  await p.waitForTimeout(1300);
  console.log('йцукен вызван:', await p.evaluate(() => document.getElementById('ytsuken').classList.contains('is-summoned')));
  await p.screenshot({ path: 'tools/shots/ytsuken.png' });

  // 4. фокус с клавиатуры
  await p.evaluate(() => scrollTo(0, 0));
  await p.keyboard.press('Tab');
  await p.keyboard.press('Tab');
  await p.waitForTimeout(300);
  await p.screenshot({ path: 'tools/shots/focus.png', clip: { x: 0, y: 0, width: 600, height: 260 } });

  console.log(errs.length ? 'ERR: ' + errs.join(' | ') : 'ошибок нет');
  await b.close();
})();
