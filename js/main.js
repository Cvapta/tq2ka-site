/* tq2ka.ru — интерактив
   тема (системная + кнопка) · шапка и прогресс · меню · появление · пластинка со звуком и волной ·
   блики на фото · искры за курсором · магнитные кнопки · параллакс ·
   радуга на CD · плеер (data-audio) · пасхалка «йцукен» (q w e r t y) */

(() => {
  'use strict';

  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const css = (name) => getComputedStyle(root).getPropertyValue(name).trim();

  /* ───────── Тема: по умолчанию системная ───────── */
  const sysDark = matchMedia('(prefers-color-scheme: dark)');
  const themeBtn = $('[data-theme-toggle]');
  const metaColor = $('meta[name="theme-color"]');
  const isDark = () => (root.dataset.theme ? root.dataset.theme === 'dark' : sysDark.matches);

  function paintTheme() {
    const dark = isDark();
    root.classList.toggle('is-dark', dark);
    if (themeBtn) {
      themeBtn.setAttribute('aria-pressed', String(dark));
      themeBtn.setAttribute('aria-label', dark ? 'Светлая тема' : 'Тёмная тема');
    }
    if (metaColor) metaColor.content = dark ? '#0f1016' : '#f7f7fa';
  }
  function setTheme(next) {
    // выбрали то же, что в системе — снова следуем системе
    if (next === (sysDark.matches ? 'dark' : 'light')) {
      delete root.dataset.theme;
      try { localStorage.removeItem('tq2ka-theme'); } catch (e) { /* приватный режим */ }
    } else {
      root.dataset.theme = next;
      try { localStorage.setItem('tq2ka-theme', next); } catch (e) { /* приватный режим */ }
    }
    paintTheme();
  }
  paintTheme();
  sysDark.addEventListener?.('change', paintTheme);

  themeBtn?.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    if (!document.startViewTransition || reduceMotion.matches) { setTheme(next); return; }
    const r = themeBtn.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const vt = document.startViewTransition(() => setTheme(next));
    vt.ready.then(() => {
      root.animate(
        { clipPath: [`circle(0 at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] },
        { duration: 650, easing: 'cubic-bezier(.4,0,.2,1)', pseudoElement: '::view-transition-new(root)' }
      );
    });
  });

  /* ───────── Шапка, прогресс, активный пункт ───────── */
  const header = $('[data-header]');
  const bar = $('.progress i');
  let lastY = scrollY;
  let menuOpen = false;

  function onScroll() {
    const y = scrollY;
    const max = document.documentElement.scrollHeight - innerHeight;
    bar?.style.setProperty('--p', max > 0 ? (y / max).toFixed(4) : 0);
    header?.classList.toggle('is-scrolled', y > 10);
    if (!menuOpen) header?.classList.toggle('is-hidden', y > 320 && y > lastY + 2);
    if (y < lastY - 2) header?.classList.remove('is-hidden');
    lastY = y;
  }

  const navLinks = $$('.nav a');
  const sections = navLinks.map((a) => $(a.getAttribute('href'))).filter(Boolean);
  const navIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      navLinks.forEach((a) => a.toggleAttribute('aria-current', a.getAttribute('href') === '#' + en.target.id));
      navLinks.forEach((a) => { if (a.hasAttribute('aria-current')) a.setAttribute('aria-current', 'true'); });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach((s) => navIO.observe(s));

  /* ───────── Мобильное меню ───────── */
  const burger = $('[data-burger]');
  const menu = $('[data-menu]');
  function toggleMenu(open) {
    menuOpen = open;
    menu.hidden = !open;
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    document.body.style.overflow = open ? 'hidden' : '';
    header.classList.remove('is-hidden');
    if (open) $('a', menu)?.focus();
  }
  burger?.addEventListener('click', () => toggleMenu(!menuOpen));
  $$('a', menu || document.createElement('div')).forEach((a) => a.addEventListener('click', () => toggleMenu(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuOpen) { toggleMenu(false); burger.focus(); } });

  /* ───────── Появление при прокрутке ───────── */
  const revIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('in'); revIO.unobserve(en.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  $$('[data-reveal]').forEach((el) => revIO.observe(el));

  /* ───────── Пластинка: крутишь — играет песня, волна бежит от неё влево ─────────
     1 оборот в секунду = обычная скорость и тон; быстрее — выше и быстрее, назад — задом наперёд.
     Отпустил — крутится по инерции и замедляется, потом снова медленное вращение «мотора». */
  const deck = $('[data-turntable]');
  if (deck) {
    const spinEl = $('.badge__spin', deck);
    const hint = $('.badge__hint', deck);
    const hero = $('.hero');
    const waveCv = $('.hero__wave');
    const wctx = waveCv.getContext('2d');
    const NORMAL = 360;                          // °/с — обычная скорость песни
    const IDLE = reduceMotion.matches ? 0 : 18;  // медленное вращение в покое, °/с
    const DEFAULT_HINT = hint ? hint.textContent : '';

    let angle = 0, vel = IDLE, holding = false, keyDir = 0;
    let lastA = 0, lastT = 0, lastMove = 0;
    let active = false;     // звук включён: крутят рукой или пластинка ещё крутится по инерции
    let audio = null;
    let loading = null;

    function ensureAudio() {
      if (audio) { if (audio.ctx.state !== 'running') audio.ctx.resume(); return loading; }
      if (loading) return loading;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      const ctx = new AC({ latencyHint: 'interactive' });
      ctx.resume(); // в обработчике жеста — иначе браузер не даст звук
      loading = (async () => {
        const res = await fetch(deck.dataset.src);
        const buf = await ctx.decodeAudioData(await res.arrayBuffer());
        const gain = ctx.createGain();
        gain.gain.value = 0;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        gain.connect(analyser);
        analyser.connect(ctx.destination);
        let setRate;
        if (ctx.audioWorklet) {
          await ctx.audioWorklet.addModule('js/turntable-worklet.js');
          const node = new AudioWorkletNode(ctx, 'turntable', { numberOfInputs: 0, outputChannelCount: [2] });
          const left = buf.getChannelData(0).slice();
          const right = buf.numberOfChannels > 1 ? buf.getChannelData(1).slice() : null;
          node.port.postMessage({ left, right, sampleRate: buf.sampleRate }, right ? [left.buffer, right.buffer] : [left.buffer]);
          node.connect(gain);
          const p = node.parameters.get('rate');
          setRate = (r) => p.setTargetAtTime(r, ctx.currentTime, 0.025);
        } else {
          // запасной вариант без AudioWorklet: играет только вперёд
          const node = ctx.createBufferSource();
          node.buffer = buf;
          node.loop = true;
          node.playbackRate.value = 0.001;
          node.connect(gain);
          node.start();
          setRate = (r) => node.playbackRate.setTargetAtTime(Math.max(Math.abs(r), 0.001), ctx.currentTime, 0.025);
        }
        audio = { ctx, gain, analyser, data: new Float32Array(analyser.fftSize), setRate };
        return audio;
      })().catch((err) => {
        console.warn('пластинка: звук не загрузился', err);
        loading = null;
        return null;
      });
      return loading;
    }

    // прогреваем кэш, когда мышь только подлетает к пластинке
    deck.addEventListener('pointerenter', () => { fetch(deck.dataset.src).catch(() => {}); }, { once: true });

    const geom = () => {
      const r = deck.getBoundingClientRect();
      return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    };
    const wrap = (d) => ((d % 360) + 540) % 360 - 180;

    function grab() {
      document.dispatchEvent(new CustomEvent('tq:scratch'));
      ensureAudio();
      active = true;
      wake();
    }

    deck.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      deck.setPointerCapture(e.pointerId);
      const { cx, cy } = geom();
      holding = true;
      deck.classList.add('is-grabbing');
      lastA = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
      lastT = e.timeStamp;
      lastMove = performance.now();
      vel = 0; // рука останавливает пластинку
      grab();
    });
    deck.addEventListener('pointermove', (e) => {
      if (!holding) return;
      const { cx, cy } = geom();
      const dx = e.clientX - cx, dy = e.clientY - cy;
      const a = Math.atan2(dy, dx) * 180 / Math.PI;
      const dt = Math.max((e.timeStamp - lastT) / 1000, 0.004);
      if (Math.hypot(dx, dy) > 8) { // у самой оси угол скачет — пропускаем
        const d = wrap(a - lastA);
        angle += d;
        vel += (d / dt - vel) * (1 - Math.exp(-dt / 0.07));
      }
      lastA = a;
      lastT = e.timeStamp;
      lastMove = performance.now();
    });
    const release = (e) => {
      if (!holding) return;
      holding = false;
      deck.classList.remove('is-grabbing');
      try { deck.releasePointerCapture(e.pointerId); } catch (_) { /* уже отпущен */ }
    };
    deck.addEventListener('pointerup', release);
    deck.addEventListener('pointercancel', release);

    // клавиатура: стрелки крутят вперёд/назад, Enter/пробел — толчок
    deck.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        keyDir = e.key === 'ArrowRight' ? 1 : -1;
        grab();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        vel = Math.max(vel, 0) + 540;
        grab();
      }
    });
    deck.addEventListener('keyup', (e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') keyDir = 0; });
    deck.addEventListener('blur', () => { keyDir = 0; });

    // ── волна ──
    let W = 0, H = 0, wdpr = 1, rgb = [46, 98, 240], rgbAt = -1e9;
    const toRgb = (hex) => {
      const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
      return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [46, 98, 240];
    };
    const hist = []; // [время, амплитуда 0..1, фаза] — что пластинка «излучила» в каждый кадр
    let ph = 0, level = 0;
    function sizeWave() {
      wdpr = Math.min(devicePixelRatio || 1, 2);
      W = waveCv.clientWidth; H = waveCv.clientHeight;
      waveCv.width = Math.round(W * wdpr);
      waveCv.height = Math.round(H * wdpr);
    }
    sizeWave();
    new ResizeObserver(sizeWave).observe(waveCv);

    function drawWave(now) {
      wctx.setTransform(wdpr, 0, 0, wdpr, 0, 0);
      wctx.clearRect(0, 0, W, H);
      let any = false;
      for (let i = 0; i < hist.length; i++) if (hist[i][1] > 0.01) { any = true; break; }
      if (!any || hist.length < 2) return false;

      const hr = waveCv.getBoundingClientRect(), dr = deck.getBoundingClientRect();
      const r = dr.width / 2;
      const sx = dr.left - hr.left + r * 0.06; // левый край пластинки
      const sy = dr.top - hr.top + r;
      const maxA = Math.min(64, r * 0.6);
      const C = Math.max(360, W * 0.42);      // скорость бега волны, px/с
      if (now - rgbAt > 500) { rgb = toRgb(css('--blue')); rgbAt = now; }

      // прозрачность по громкости: тихие участки не видны, линия есть только там, где звук
      const grad = wctx.createLinearGradient(sx, 0, 0, 0);
      let lastStop = -1;
      wctx.beginPath();
      let j = hist.length - 2, started = false;
      for (let x = sx; x >= -6; x -= 3) {
        const d = sx - x;
        const te = now - (d / C) * 1000;
        while (j > 0 && hist[j][0] > te) j--;
        if (hist[j][0] > te) break; // дальше — то, что было до истории
        const h0 = hist[j], h1 = hist[j + 1];
        const f = Math.min(1, Math.max(0, (te - h0[0]) / ((h1[0] - h0[0]) || 1)));
        const a = h0[1] + (h1[1] - h0[1]) * f;
        const p = h0[2] + (h1[2] - h0[2]) * f;
        const env = Math.min(1, d / 36);
        const y = sy + maxA * a * env * (Math.sin(p) + 0.28 * Math.sin(2.1 * p + 0.7)) / 1.28;
        if (!started) { wctx.moveTo(x, y); started = true; } else wctx.lineTo(x, y);
        const stop = Math.min(1, d / Math.max(sx, 1));
        if (stop - lastStop > 0.012) {
          grad.addColorStop(stop, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${Math.min(1, a / 0.1).toFixed(3)})`);
          lastStop = stop;
        }
      }
      if (lastStop < 1) grad.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
      wctx.lineWidth = 2.4;
      wctx.lineCap = 'round';
      wctx.lineJoin = 'round';
      wctx.strokeStyle = grad;
      wctx.shadowColor = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},.9)`;
      wctx.shadowBlur = 10;
      wctx.stroke();
      wctx.shadowBlur = 0;
      return true;
    }

    // ── главный цикл ──
    let raf = 0, lastF = 0, heroVisible = true;
    function frame(now) {
      const dt = lastF ? Math.min((now - lastF) / 1000, 0.05) : 0.016;
      lastF = now;

      if (keyDir) {
        vel += (keyDir * NORMAL - vel) * (1 - Math.exp(-dt / 0.15));
        angle += vel * dt;
      } else if (holding) {
        if (now - lastMove > 50) vel *= Math.exp(-dt / 0.05); // держат неподвижно — стоит
      } else {
        if (active) {
          vel *= Math.exp(-dt * 0.45);                                  // трение
          vel -= Math.sign(vel) * Math.min(Math.abs(vel), 16 * dt);
          if (Math.abs(vel) < 40) active = false;
        } else {
          vel += (IDLE - vel) * (1 - Math.exp(-dt / 0.8));              // мотор
        }
        angle += vel * dt;
      }
      if (holding || keyDir) active = true;
      angle %= 360;
      spinEl.style.rotate = angle.toFixed(2) + 'deg';

      const rate = active ? Math.max(-4, Math.min(4, vel / NORMAL)) : 0;
      if (audio) {
        audio.setRate(rate);
        audio.gain.gain.setTargetAtTime(active ? Math.min(1, Math.abs(rate) / 0.12) : 0, audio.ctx.currentTime, 0.04);
        audio.analyser.getFloatTimeDomainData(audio.data);
        let sum = 0;
        for (let i = 0; i < audio.data.length; i++) sum += audio.data[i] * audio.data[i];
        level += (Math.sqrt(sum / audio.data.length) - level) * (1 - Math.exp(-dt / 0.06));
      } else {
        level *= Math.exp(-dt / 0.1);
      }

      if (hint) {
        let t = DEFAULT_HINT;
        if (active && !audio && loading) t = 'секунду…';
        else if (active && Math.abs(rate) > 0.03) t = (rate < 0 ? '◂ ' : '') + '×' + Math.abs(rate).toFixed(2);
        else if (active) t = 'крути!';
        if (hint.textContent !== t) hint.textContent = t;
      }

      ph += dt * Math.PI * 2 * (1.4 + 2.4 * Math.abs(rate));
      hist.push([now, Math.min(1, level * 5), ph]);
      while (hist.length > 2 && now - hist[0][0] > 4500) hist.shift();
      return drawWave(now);
    }
    function loop(now) {
      const energy = frame(now);
      const keep = active || energy || (heroVisible && !document.hidden && IDLE > 0);
      raf = keep ? requestAnimationFrame(loop) : 0;
      if (!raf) lastF = 0;
    }
    function wake() { if (!raf) raf = requestAnimationFrame(loop); }

    new IntersectionObserver(([en]) => { heroVisible = en.isIntersecting; wake(); }).observe(hero);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        holding = false; keyDir = 0; active = false;
        if (audio) audio.gain.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.02);
      } else wake();
    });
    wake();
  }

  /* ───────── Блики на алмазной фигуре ───────── */
  const gem = $('#gem');
  const pts = window.TQ_SPARKLES || [];
  if (gem && pts.length) {
    const clip = $('.gem__clip', gem);
    const img = $('img', gem);
    const cv = $('.gem__fire', gem);
    const ctx = cv.getContext('2d');
    const SRC = 1086, HEIGHT = 0.5;

    const sprIdx = pts.map((p) => (p[4] < 0.4 ? 0 : 1 + Math.floor(p[4] * 50) % 5));
    const normals = pts.map(([, , , ang, hue]) => {
      const tilt = 0.14 + 0.6 * ((hue * 7.31) % 1);
      const nx = Math.cos(ang) * tilt, ny = Math.sin(ang) * tilt;
      const k = 1 / Math.hypot(nx, ny, 1);
      return [nx * k, ny * k, k];
    });

    const sprites = [null, 200, 330, 48, 175, 265].map((hue) => {
      const S = 128, m = S / 2;
      const c = document.createElement('canvas');
      c.width = c.height = S;
      const g = c.getContext('2d');
      const tint = (l, a) => (hue === null ? `rgba(255,255,255,${a})` : `hsla(${hue},100%,${l}%,${a})`);
      const rg = g.createRadialGradient(m, m, 0, m, m, m * 0.42);
      rg.addColorStop(0, 'rgba(255,255,255,1)');
      rg.addColorStop(0.1, tint(86, 0.95));
      rg.addColorStop(0.42, tint(66, 0.4));
      rg.addColorStop(1, tint(70, 0));
      g.fillStyle = rg;
      g.fillRect(0, 0, S, S);
      g.globalCompositeOperation = 'lighter';
      const ray = (angle, len, w, a) => {
        g.save(); g.translate(m, m); g.rotate(angle);
        const lg = g.createLinearGradient(-len, 0, len, 0);
        lg.addColorStop(0, 'rgba(255,255,255,0)');
        lg.addColorStop(0.5, `rgba(255,255,255,${a})`);
        lg.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = lg;
        g.beginPath(); g.moveTo(-len, 0); g.lineTo(0, -w); g.lineTo(len, 0); g.lineTo(0, w); g.closePath(); g.fill();
        g.restore();
      };
      const t = 0.21;
      ray(t, m, 2.2, 1); ray(t + Math.PI / 2, m * 0.9, 2.2, 1);
      ray(t + Math.PI / 4, m * 0.46, 1.4, 0.6); ray(t - Math.PI / 4, m * 0.46, 1.4, 0.6);
      if (hue !== null) {
        g.globalAlpha = 0.5;
        g.globalCompositeOperation = 'source-atop';
        const cg = g.createRadialGradient(m, m, m * 0.08, m, m, m);
        cg.addColorStop(0, 'rgba(255,255,255,0)');
        cg.addColorStop(0.35, `hsla(${hue},100%,70%,1)`);
        cg.addColorStop(0.7, `hsla(${(hue + 60) % 360},100%,70%,1)`);
        cg.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = cg; g.fillRect(0, 0, S, S);
      }
      return c;
    });

    let W = 0, H = 0, dpr = 1, fit = { s: 1, ox: 0, oy: 0 };
    function resize() {
      W = clip.clientWidth; H = clip.clientHeight;
      dpr = Math.min(devicePixelRatio || 1, 2);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      const [px, py] = getComputedStyle(img).objectPosition.split(' ').map((v) => parseFloat(v) / 100);
      const s = Math.max(W / SRC, H / SRC);
      fit = { s, ox: (W - SRC * s) * (isNaN(px) ? 0.5 : px), oy: (H - SRC * s) * (isNaN(py) ? 0.5 : py) };
      if (!running) draw(performance.now());
    }

    const light = { x: -0.45, y: 0.2 };
    const pointer = { x: 0, y: 0, active: false, last: 0 };
    let t0 = performance.now();
    const scrollTilt = () => Math.min(scrollY / (innerHeight || 1), 1.2) * 0.7;
    const idle = (t) => ({
      x: 0.55 + 0.42 * Math.sin(t / 1000 * 0.31),
      y: 0.42 + 0.3 * Math.sin(t / 1000 * 0.19 + 1.2) + scrollTilt(),
    });

    function step(t) {
      const since = t - t0;
      let target;
      if (pointer.active && t - pointer.last < 2500) target = { x: pointer.x, y: pointer.y + scrollTilt() * 0.4 };
      else { pointer.active = false; target = idle(t); }
      if (since < 1900) {
        const e = 1 - Math.pow(1 - since / 1900, 3);
        light.x = -0.45 + (target.x + 0.45) * e;
        light.y = 0.15 + (target.y - 0.15) * e;
      } else {
        light.x += (target.x - light.x) * 0.09;
        light.y += (target.y - light.y) * 0.09;
      }
    }

    function draw(t) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      const base = Math.max(W, H) / 640;
      const tw = t / 1000;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i], n = normals[i];
        let lx = light.x - p[0], ly = light.y - p[1], lz = HEIGHT;
        const ll = Math.hypot(lx, ly, lz);
        lx /= ll; ly /= ll; lz /= ll;
        const hx = lx, hy = ly, hz = lz + 1;
        const d = (n[0] * hx + n[1] * hy + n[2] * hz) / Math.hypot(hx, hy, hz);
        if (d < 0.965) continue;
        let I = Math.pow(d, 150) * (0.5 + 0.5 * p[2]);
        I *= 0.86 + 0.14 * Math.sin(tw * 9 + i * 1.7);
        if (I < 0.04) continue;
        const x = fit.ox + p[0] * SRC * fit.s, y = fit.oy + p[1] * SRC * fit.s;
        if (x < -40 || y < -40 || x > W + 40 || y > H + 40) continue;
        const size = (34 + 76 * p[2]) * base * (0.4 + 0.8 * I);
        ctx.globalAlpha = Math.min(1, I * 1.4);
        ctx.drawImage(sprites[sprIdx[i]], x - size / 2, y - size / 2, size, size);
      }
      ctx.globalAlpha = 1;
    }

    let running = false, visible = true, raf = 0;
    const loop = (t) => { step(t); draw(t); raf = requestAnimationFrame(loop); };
    function sync() {
      const should = visible && !document.hidden && !reduceMotion.matches;
      if (should && !running) { running = true; raf = requestAnimationFrame(loop); }
      if (!should && running) { running = false; cancelAnimationFrame(raf); }
    }

    $('.hero')?.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      const r = clip.getBoundingClientRect();
      const s = SRC * fit.s;
      pointer.x = (e.clientX - r.left - fit.ox) / s;
      pointer.y = (e.clientY - r.top - fit.oy) / s;
      pointer.active = true;
      pointer.last = performance.now();
      if (!running) { light.x = pointer.x; light.y = pointer.y; draw(pointer.last); }
    });

    new IntersectionObserver(([en]) => { visible = en.isIntersecting; sync(); }).observe(gem);
    document.addEventListener('visibilitychange', sync);
    reduceMotion.addEventListener?.('change', sync);
    new ResizeObserver(resize).observe(clip);

    const start = () => {
      resize();
      t0 = performance.now();
      if (reduceMotion.matches) { Object.assign(light, idle(0)); draw(0); }
      cv.classList.add('is-on');
      sync();
    };
    if (img.complete && img.naturalWidth) start(); else img.addEventListener('load', start, { once: true });
  }

  /* ───────── Искры за курсором ───────── */
  const trail = $('.trail');
  if (trail && finePointer.matches && !reduceMotion.matches) {
    const g = trail.getContext('2d');
    const parts = [];
    let tw = 0, th = 0, tdpr = 1, rafT = 0, lx = -999, ly = -999;
    const size = () => {
      tdpr = Math.min(devicePixelRatio || 1, 2);
      tw = innerWidth; th = innerHeight;
      trail.width = tw * tdpr; trail.height = th * tdpr;
    };
    size();
    addEventListener('resize', size);
    const colors = () => [css('--pink'), css('--blue'), css('--gold')];
    let palette = colors();
    sysDark.addEventListener?.('change', () => { palette = colors(); });
    themeBtn?.addEventListener('click', () => setTimeout(() => { palette = colors(); }, 50));

    function starPath(x, y, r) {
      g.beginPath();
      g.moveTo(x, y - r);
      g.quadraticCurveTo(x, y, x + r, y);
      g.quadraticCurveTo(x, y, x, y + r);
      g.quadraticCurveTo(x, y, x - r, y);
      g.quadraticCurveTo(x, y, x, y - r);
      g.fill();
    }
    function tick(t) {
      g.setTransform(tdpr, 0, 0, tdpr, 0, 0);
      g.clearRect(0, 0, tw, th);
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        const k = (t - p.t0) / p.life;
        if (k >= 1) { parts.splice(i, 1); continue; }
        p.x += p.vx; p.y += p.vy; p.vy += 0.03;
        g.globalAlpha = 1 - k;
        g.fillStyle = p.c;
        starPath(p.x, p.y, p.r * (1 - k * 0.6));
      }
      g.globalAlpha = 1;
      rafT = parts.length ? requestAnimationFrame(tick) : 0;
    }
    addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      if (Math.hypot(e.clientX - lx, e.clientY - ly) < 16) return;
      lx = e.clientX; ly = e.clientY;
      if (parts.length > 70) parts.shift();
      parts.push({
        x: lx + (Math.random() - 0.5) * 10, y: ly + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 0.6, vy: -0.2 - Math.random() * 0.4,
        r: 4 + Math.random() * 6, c: palette[(Math.random() * 3) | 0],
        t0: performance.now(), life: 650 + Math.random() * 400,
      });
      if (!rafT) rafT = requestAnimationFrame(tick);
    }, { passive: true });
  }

  /* ───────── Магнитные кнопки ───────── */
  if (finePointer.matches && !reduceMotion.matches) {
    $$('[data-magnetic]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        el.style.transition = 'transform .15s ease-out, background-color .25s, color .25s';
        el.style.transform = `translate(${dx * 0.18}px, ${dy * 0.3}px)`;
      });
      el.addEventListener('pointerleave', () => {
        el.style.transition = 'transform .6s cubic-bezier(.2,.7,.2,1), background-color .25s, color .25s';
        el.style.transform = '';
      });
    });
  }

  /* ───────── Параллакс и вращение дисков от прокрутки ───────── */
  const para = $$('[data-parallax]');
  const spins = $$('[data-spin]');
  let ticking = false;
  function onFrame() {
    ticking = false;
    onScroll();
    if (reduceMotion.matches) return;
    const y = scrollY;
    if (y < innerHeight * 1.5) para.forEach((el) => { el.style.translate = `0 ${(y * parseFloat(el.dataset.parallax)).toFixed(1)}px`; });
    spins.forEach((el) => { el.style.rotate = `${(y * 0.12).toFixed(1)}deg`; });
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onFrame); } }, { passive: true });
  onFrame();

  /* ───────── Радуга на CD за курсором ───────── */
  $$('.release').forEach((rel) => {
    const disc = $('.disc', rel), kase = $('.release__case', rel);
    if (!disc || !kase) return;
    rel.addEventListener('pointermove', (e) => {
      const r = kase.getBoundingClientRect();
      const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
      disc.style.setProperty('--a', `${(fx * 140 + fy * 60 - 40).toFixed(1)}deg`);
    });
  });

  /* ───────── Плеер ───────── */
  const playable = $$('.release[data-audio]').filter((r) => r.dataset.audio.trim());
  if (playable.length) {
    const audio = new Audio();
    audio.preload = 'none';
    let current = null;
    const ICON = '<svg class="i-play" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 3.2v13.6L16.5 10z" fill="currentColor"/></svg>' +
                 '<svg class="i-pause" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 3h3.4v14H5zM11.6 3H15v14h-3.4z" fill="currentColor"/></svg>';
    const setState = (rel, playing) => {
      rel.classList.toggle('is-playing', playing);
      const b = $('.release__play', rel);
      const name = $('.release__name', rel).textContent.trim();
      b.setAttribute('aria-label', (playing ? 'Пауза: ' : 'Слушать: ') + name);
      b.setAttribute('aria-pressed', String(playing));
    };
    playable.forEach((rel) => {
      const kase = $('.release__case', rel);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'release__play';
      btn.innerHTML = ICON;
      const pr = document.createElement('span');
      pr.className = 'release__progress';
      pr.innerHTML = '<i></i>';
      kase.append(btn, pr);
      setState(rel, false);
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (current === rel) { if (audio.paused) audio.play(); else audio.pause(); return; }
        if (current) setState(current, false);
        current = rel;
        audio.src = rel.dataset.audio;
        audio.play().catch(() => setState(rel, false));
      });
    });
    document.addEventListener('tq:scratch', () => { if (!audio.paused) audio.pause(); });
    audio.addEventListener('play', () => current && setState(current, true));
    audio.addEventListener('pause', () => current && setState(current, false));
    audio.addEventListener('ended', () => { if (current) { setState(current, false); $('.release__progress', current).style.setProperty('--p', 0); } });
    audio.addEventListener('timeupdate', () => {
      if (current && audio.duration) $('.release__progress', current).style.setProperty('--p', (audio.currentTime / audio.duration).toFixed(4));
    });
  }

  /* ───────── йцукен ───────── */
  const SEQ = ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY'];
  let pos = 0;
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    pos = e.code === SEQ[pos] ? pos + 1 : (e.code === SEQ[0] ? 1 : 0);
    if (pos < SEQ.length) return;
    pos = 0;
    const rel = $('#ytsuken');
    if (!rel) return;
    rel.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'center' });
    rel.classList.remove('is-summoned');
    void rel.offsetWidth;
    rel.classList.add('is-summoned');
    setTimeout(() => rel.classList.remove('is-summoned'), 3200);
  });
})();
