/* tq2ka.ru
   1. Блики на алмазной фигуре: каждая точка — грань со своей нормалью,
      вспыхивает, когда «свет» (курсор / прокрутка / медленный дрейф) отражается в зрителя.
   2. Радуга на CD следует за курсором.
   3. Плеер — для релизов с data-audio.
   4. Пасхалка: q w e r t y (в русской раскладке это й ц у к е н). */

(() => {
  'use strict';

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  /* ───────── 1. Блики ───────── */
  const fig = document.getElementById('gem');
  const pts = window.TQ_SPARKLES || [];

  if (fig && pts.length) {
    const cv = fig.querySelector('canvas');
    const ctx = cv.getContext('2d');
    const SRC = 1086;          // сторона исходника
    const POS_X = 0.62, POS_Y = 0.5; // как object-position в CSS
    const HEIGHT = 0.5;        // высота источника света над снимком

    // нормали граней: наклон 8–36° в случайную сторону
    // какой спрайт у точки: ~40% белые, остальные с цветным ореолом
    const sprIdx = pts.map((p) => (p[4] < 0.4 ? 0 : 1 + Math.floor(p[4] * 50) % 5));
    const normals = pts.map(([, , , ang, hue]) => {
      const tilt = 0.14 + 0.6 * ((hue * 7.31) % 1);
      const nx = Math.cos(ang) * tilt, ny = Math.sin(ang) * tilt;
      const k = 1 / Math.hypot(nx, ny, 1);
      return [nx * k, ny * k, k];
    });

    // спрайты: белое ядро, цветной ореол («огонь» алмаза), лучи звезды
    const HUES = [null, 200, 330, 48, 175, 265];
    const sprites = HUES.map(makeSprite);
    function makeSprite(hue) {
      const S = 128, m = S / 2;
      const c = document.createElement('canvas');
      c.width = c.height = S;
      const g = c.getContext('2d');
      const tint = (l, a) => hue === null ? `rgba(255,255,255,${a})` : `hsla(${hue},100%,${l}%,${a})`;
      const rg = g.createRadialGradient(m, m, 0, m, m, m * 0.42);
      rg.addColorStop(0, 'rgba(255,255,255,1)');
      rg.addColorStop(0.1, tint(86, 0.95));
      rg.addColorStop(0.42, tint(66, 0.4));
      rg.addColorStop(1, tint(70, 0));
      g.fillStyle = rg;
      g.fillRect(0, 0, S, S);
      g.globalCompositeOperation = 'lighter';
      const ray = (angle, len, w, a) => {
        g.save();
        g.translate(m, m);
        g.rotate(angle);
        const lg = g.createLinearGradient(-len, 0, len, 0);
        lg.addColorStop(0, 'rgba(255,255,255,0)');
        lg.addColorStop(0.5, `rgba(255,255,255,${a})`);
        lg.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = lg;
        g.beginPath();
        g.moveTo(-len, 0); g.lineTo(0, -w); g.lineTo(len, 0); g.lineTo(0, w);
        g.closePath();
        g.fill();
        g.restore();
      };
      const tilt = 0.21; // лёгкий наклон креста, как у фильтра-звёздочки
      ray(tilt, m, 2.2, 1);
      ray(tilt + Math.PI / 2, m * 0.9, 2.2, 1);
      ray(tilt + Math.PI / 4, m * 0.46, 1.4, 0.6);
      ray(tilt - Math.PI / 4, m * 0.46, 1.4, 0.6);
      if (hue !== null) { // цветная кайма лучей — дисперсия
        g.globalAlpha = 0.5;
        g.globalCompositeOperation = 'source-atop';
        const cg = g.createRadialGradient(m, m, m * 0.08, m, m, m);
        cg.addColorStop(0, 'rgba(255,255,255,0)');
        cg.addColorStop(0.35, `hsla(${hue},100%,70%,1)`);
        cg.addColorStop(0.7, `hsla(${(hue + 60) % 360},100%,70%,1)`);
        cg.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = cg;
        g.fillRect(0, 0, S, S);
      }
      return c;
    }

    let W = 0, H = 0, dpr = 1, fit = { s: 1, ox: 0, oy: 0 };
    function resize() {
      const r = fig.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width; H = r.height;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      const s = Math.max(W / SRC, H / SRC);
      fit = { s, ox: (W - SRC * s) * POS_X, oy: (H - SRC * s) * POS_Y };
      if (!running) draw(performance.now());
    }

    // свет в координатах снимка (0..1)
    const light = { x: -0.4, y: 0.2 };
    const pointer = { x: 0, y: 0, active: false, last: 0 };
    let t0 = performance.now();

    function idleLight(t) {
      const s = t / 1000;
      return {
        x: 0.55 + 0.42 * Math.sin(s * 0.31),
        y: 0.42 + 0.3 * Math.sin(s * 0.19 + 1.2) + scrollTilt(),
      };
    }
    function scrollTilt() {
      return Math.min(window.scrollY / (window.innerHeight || 1), 1.2) * 0.7;
    }

    function step(t) {
      const since = t - t0;
      let target;
      if (pointer.active && t - pointer.last < 2500) {
        target = { x: pointer.x, y: pointer.y + scrollTilt() * 0.4 };
      } else {
        pointer.active = false;
        target = idleLight(t);
      }
      if (since < 1900 && !reduceMotion.matches) {
        // первая загрузка: свет проходит по фигуре слева направо
        const k = since / 1900;
        const e = 1 - Math.pow(1 - k, 3);
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
      const base = Math.max(W, H) / 760; // масштаб размера звёзд
      const tw = t / 1000;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const n = normals[i];
        let lx = light.x - p[0], ly = light.y - p[1], lz = HEIGHT;
        const ll = Math.hypot(lx, ly, lz);
        lx /= ll; ly /= ll; lz /= ll;
        // полувектор между светом и взглядом (взгляд = 0,0,1)
        let hx = lx, hy = ly, hz = lz + 1;
        const hl = Math.hypot(hx, hy, hz);
        const d = (n[0] * hx + n[1] * hy + n[2] * hz) / hl;
        if (d < 0.965) continue;
        let I = Math.pow(d, 150) * (0.5 + 0.5 * p[2]);
        I *= 0.86 + 0.14 * Math.sin(tw * 9 + i * 1.7);
        if (I < 0.04) continue;
        const x = fit.ox + p[0] * SRC * fit.s;
        const y = fit.oy + p[1] * SRC * fit.s;
        if (x < -40 || y < -40 || x > W + 40 || y > H + 40) continue;
        const size = (34 + 76 * p[2]) * base * (0.4 + 0.8 * I);
        ctx.globalAlpha = Math.min(1, I * 1.4);
        ctx.drawImage(sprites[sprIdx[i]], x - size / 2, y - size / 2, size, size);
      }
      ctx.globalAlpha = 1;
    }

    let running = false, visible = true, raf = 0;
    function loop(t) {
      step(t);
      draw(t);
      raf = requestAnimationFrame(loop);
    }
    function sync() {
      const should = visible && !document.hidden && !reduceMotion.matches;
      if (should && !running) { running = true; raf = requestAnimationFrame(loop); }
      if (!should && running) { running = false; cancelAnimationFrame(raf); }
    }

    // курсор где угодно в первом экране управляет светом
    const hero = fig.closest('.hero') || fig;
    hero.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      const r = fig.getBoundingClientRect();
      const s = SRC * fit.s;
      pointer.x = (e.clientX - r.left - fit.ox) / s;
      pointer.y = (e.clientY - r.top - fit.oy) / s;
      pointer.active = true;
      pointer.last = performance.now();
      if (!running) { // reduced motion: перерисовать кадр без анимации
        light.x = pointer.x; light.y = pointer.y;
        draw(pointer.last);
      }
    });

    new IntersectionObserver(([en]) => { visible = en.isIntersecting; sync(); }).observe(fig);
    document.addEventListener('visibilitychange', sync);
    reduceMotion.addEventListener?.('change', sync);
    new ResizeObserver(resize).observe(fig);

    const start = () => {
      resize();
      t0 = performance.now();
      if (reduceMotion.matches) {
        Object.assign(light, idleLight(0));
        draw(0);
      }
      cv.classList.add('is-on');
      sync();
    };
    const img = fig.querySelector('img');
    if (img.complete && img.naturalWidth) start();
    else img.addEventListener('load', start, { once: true });
  }

  /* ───────── 2. Радуга CD за курсором ───────── */
  document.querySelectorAll('.release').forEach((rel) => {
    const disc = rel.querySelector('.disc');
    const kase = rel.querySelector('.release__case');
    if (!disc || !kase) return;
    rel.addEventListener('pointermove', (e) => {
      const r = kase.getBoundingClientRect();
      const fx = (e.clientX - r.left) / r.width;
      const fy = (e.clientY - r.top) / r.height;
      disc.style.setProperty('--a', `${(fx * 140 + fy * 60 - 40).toFixed(1)}deg`);
    });
  });

  /* ───────── 3. Плеер ───────── */
  const releases = [...document.querySelectorAll('.release[data-audio]')]
    .filter((r) => r.dataset.audio.trim());
  if (releases.length) {
    const audio = new Audio();
    audio.preload = 'none';
    let current = null;

    const ICON = '<svg class="i-play" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 3.2v13.6L16.5 10z" fill="currentColor"/></svg>' +
                 '<svg class="i-pause" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 3h3.4v14H5zM11.6 3H15v14h-3.4z" fill="currentColor"/></svg>';

    const setState = (rel, playing) => {
      rel.classList.toggle('is-playing', playing);
      const b = rel.querySelector('.release__play');
      const name = rel.querySelector('.release__name').textContent.trim();
      b.setAttribute('aria-label', (playing ? 'Пауза: ' : 'Слушать: ') + name);
      b.setAttribute('aria-pressed', String(playing));
    };

    releases.forEach((rel) => {
      const kase = rel.querySelector('.release__case');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'release__play';
      btn.innerHTML = ICON;
      const bar = document.createElement('span');
      bar.className = 'release__progress';
      bar.innerHTML = '<i></i>';
      kase.append(btn, bar);
      setState(rel, false);

      btn.addEventListener('click', () => {
        if (current === rel) {
          if (audio.paused) audio.play(); else audio.pause();
          return;
        }
        if (current) { setState(current, false); current.style.removeProperty('--p'); }
        current = rel;
        audio.src = rel.dataset.audio;
        audio.play().catch(() => setState(rel, false));
      });
    });

    audio.addEventListener('play', () => current && setState(current, true));
    audio.addEventListener('pause', () => current && setState(current, false));
    audio.addEventListener('ended', () => { if (current) { setState(current, false); current.querySelector('.release__progress').style.setProperty('--p', 0); } });
    audio.addEventListener('timeupdate', () => {
      if (!current || !audio.duration) return;
      current.querySelector('.release__progress').style.setProperty('--p', (audio.currentTime / audio.duration).toFixed(4));
    });
  }

  /* ───────── 4. йцукен ───────── */
  const SEQ = ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY'];
  let pos = 0;
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    pos = e.code === SEQ[pos] ? pos + 1 : (e.code === SEQ[0] ? 1 : 0);
    if (pos < SEQ.length) return;
    pos = 0;
    const rel = document.getElementById('ytsuken');
    if (!rel) return;
    rel.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'center' });
    rel.classList.remove('is-summoned');
    void rel.offsetWidth;
    rel.classList.add('is-summoned');
    setTimeout(() => rel.classList.remove('is-summoned'), 3200);
  });
})();
