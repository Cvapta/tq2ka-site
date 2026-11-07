# Готовит картинки сайта и точки бликов для героя.
# Запуск: python tools/prep.py  (из корня проекта)
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

T = 'tools/'
OUT = 'img/'

# --- аватар ---
av = Image.open(T + 'src-avatar.png').convert('RGB')
av.save(OUT + 'tq2ka.webp', quality=84, method=6)
av.resize((1200, 1200), Image.LANCZOS)  # не апскейлим, просто проверка
av.save(OUT + 'tq2ka.jpg', quality=84, optimize=True, progressive=True)
av.resize((640, 640), Image.LANCZOS).save(OUT + 'tq2ka-640.webp', quality=82, method=6)

# og:image 1200x630: фигура справа, слева платиновый фон с местом под текст не нужен — просто кадр
og = Image.new('RGB', (1200, 630), (231, 234, 238))
crop = av.resize((630, 630), Image.LANCZOS)
og.paste(crop, (570, 0))
og.save(OUT + 'og.jpg', quality=86, optimize=True)

# иконки: лицо фигуры
face = av.crop((520, 150, 900, 530))
face.resize((180, 180), Image.LANCZOS).save(OUT + 'apple-touch-icon.png', optimize=True)
face.resize((64, 64), Image.LANCZOS).save('favicon.png', optimize=True)

# --- обложки ---
covers = {
    'saint-s': 'src-saint-s.png',
    'hava-nagila': 'src-hava.png',
    'ytsuken': 'src-ytsuken.jpg',
    'almaz': 'src-almaz.png',
}
for name, src in covers.items():
    im = Image.open(T + src).convert('RGB')
    im.save(OUT + name + '.webp', quality=92, method=6)
    im.save(OUT + name + '.jpg', quality=92, optimize=True)

# --- точки бликов на кристалле ---
a = np.asarray(av).astype(np.float32) / 255.0
r, g, b = a[..., 0], a[..., 1], a[..., 2]
lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
mx = a.max(-1)
mn = a.min(-1)
sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)

H, W = lum.shape
# грубый полигон фигуры (в координатах исходника 1086x1086)
poly = [
    (560, 40), (700, 30), (850, 60), (930, 160), (940, 300), (900, 420),
    (860, 470), (980, 560), (1020, 700), (1030, 1086), (430, 1086),
    (410, 980), (300, 1086), (210, 1086), (220, 960), (300, 860),
    (400, 640), (470, 520), (600, 470), (560, 400), (540, 250),
]
mask_img = Image.new('L', (W, H), 0)
ImageDraw.Draw(mask_img).polygon(poly, fill=255)
mask = np.asarray(mask_img) > 0

# локальные максимумы яркости
from PIL import ImageFilter as F
lum_img = Image.fromarray((lum * 255).astype(np.uint8))
mx_img = lum_img.filter(F.MaxFilter(11))
is_max = np.asarray(lum_img) == np.asarray(mx_img)

cand = is_max & mask & (lum > 0.86) & (sat < 0.16)
ys, xs = np.nonzero(cand)
vals = lum[ys, xs]
order = np.argsort(-vals)

pts = []
min_d2 = 18 ** 2
for i in order:
    x, y = int(xs[i]), int(ys[i])
    if all((x - px) ** 2 + (y - py) ** 2 >= min_d2 for px, py, _ in pts):
        pts.append((x, y, float(vals[i])))
    if len(pts) >= 220:
        break

print('points:', len(pts))

rng = np.random.default_rng(7)
data = []
for x, y, v in pts:
    data.append([
        round(x / W, 4), round(y / H, 4),
        round((v - 0.86) / 0.14, 3),            # сила блика 0..1
        round(float(rng.uniform(0, 6.2832)), 3), # «нормаль» грани
        round(float(rng.uniform(0, 1)), 3),      # оттенок огня
    ])

with open('js/sparkles.js', 'w', encoding='utf-8') as f:
    f.write('// Сгенерировано tools/prep.py: [x, y, сила, угол грани, оттенок]\n')
    f.write('window.TQ_SPARKLES = ' + json.dumps(data, separators=(',', ':')) + ';\n')

# отладочная картинка
dbg = av.copy()
d = ImageDraw.Draw(dbg)
d.polygon(poly, outline=(255, 0, 80))
for x, y, v in pts:
    d.ellipse((x - 6, y - 6, x + 6, y + 6), outline=(255, 0, 80), width=2)
dbg.resize((760, 760)).save(T + 'debug-sparkles.png')
