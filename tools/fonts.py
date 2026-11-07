# Скачивает woff2 (только cyrillic + latin) из tools/gf.css и пишет css/fonts.css
import re, os, hashlib, subprocess

css = open('tools/gf.css', encoding='utf-8').read()
blocks = re.findall(r'/\* ([\w-]+) \*/\s*@font-face \{(.*?)\}', css, re.S)
out = []
seen = {}
for subset, body in blocks:
    if subset not in ('cyrillic', 'latin'):
        continue
    fam = re.search(r"font-family: '([^']+)'", body).group(1)
    style = re.search(r'font-style: (\w+)', body).group(1)
    weight = re.search(r'font-weight: ([\d ]+)', body).group(1)
    url = re.search(r'url\((https://[^)]+)\)', body).group(1)
    rng = re.search(r'unicode-range: ([^;]+);', body).group(1)
    if url not in seen:
        name = '%s-%s-%s.woff2' % (fam.lower().replace(' ', '-'), subset, hashlib.md5(url.encode()).hexdigest()[:6])
        subprocess.run(['curl', '-s', '--ssl-no-revoke', url, '-o', 'fonts/' + name], check=True)
        seen[url] = name
    out.append(
        "@font-face{font-family:'%s';font-style:%s;font-weight:%s;font-display:swap;"
        "src:url(../fonts/%s) format('woff2');unicode-range:%s}" % (fam, style, weight, seen[url], rng)
    )
open('css/fonts.css', 'w', encoding='utf-8').write('\n'.join(out) + '\n')
print(len(out), 'faces,', len(seen), 'files')
