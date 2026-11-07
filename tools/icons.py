# Иконки сайта из tools/src-icon.png (фигура на прозрачном фоне).
# Запуск из корня проекта: python tools/icons.py
from PIL import Image, ImageDraw

src = Image.open('tools/src-icon.png').convert('RGBA')
INK = (22, 23, 31, 255)
HEAD = (470, 130, 990, 650)   # голова крупно — для вкладки и логотипа
BUST = (300, 90, 1100, 890)   # голова и плечи — для больших иконок


def tile(box, size, pad=0.06, circle=True):
    S = size * 4
    m = Image.new('L', (S, S), 0)
    d = ImageDraw.Draw(m)
    if circle:
        d.ellipse((0, 0, S - 1, S - 1), fill=255)
    else:
        d.rounded_rectangle((0, 0, S - 1, S - 1), radius=int(S * .22), fill=255)
    base = Image.new('RGBA', (S, S), INK)
    fig = src.crop(box).resize((int(S * (1 - pad * 2)),) * 2, Image.LANCZOS)
    base.alpha_composite(fig, (int(S * pad), int(S * pad * 1.6)))
    out = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    out.paste(base, (0, 0), m)
    return out.resize((size, size), Image.LANCZOS)


tile(HEAD, 32).save('favicon-32.png', optimize=True)
tile(HEAD, 64).save('favicon.png', optimize=True)
tile(HEAD, 48).save('favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
tile(HEAD, 96).save('img/logo.png', optimize=True)
tile(BUST, 180, pad=0.02, circle=False).convert('RGB').save('img/apple-touch-icon.png', optimize=True)
tile(BUST, 192, pad=0.02, circle=False).save('img/icon-192.png', optimize=True)
tile(BUST, 512, pad=0.02, circle=False).save('img/icon-512.png', optimize=True)
print('иконки готовы')
