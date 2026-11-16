"""Bake the Chinese-only UI atlas. Usage: python kit/tools/bake_zh_cn.py /path/to/NotoSansSC.ttf
Requires Pillow. Font: google/fonts ofl/notosanssc, OFL-1.1 (see runtime/fonts/OFL-NotoSansSC.txt).
Translation by 小白151 (JackieZ123430); provenance XIAOBAI-ZHCN-20261116.
Rasterizer reused from the MIT MGU App Kit bake_fonts.py.
"""
import base64, hashlib, json, os, sys, zlib
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
FONTDIR = ''
def load(fname, var, size):
    f = ImageFont.truetype(os.path.join(FONTDIR, fname), size)
    if var:
        try:
            f.set_variation_by_axes(list(var))
        except Exception as e:  # static font
            print('  (no variations:', e, ')')
    return f


def bake(fname, var, size, charset):
    font = load(fname, var, size)
    ascent, descent = font.getmetrics()
    glyphs, imgs = {}, []
    for ch in dict.fromkeys(charset):
        try:
            bbox = font.getbbox(ch, anchor='ls')       # relative to baseline
        except Exception:
            continue
        adv = font.getlength(ch)
        w, h = max(0, bbox[2] - bbox[0]), max(0, bbox[3] - bbox[1])
        if w and h:
            im = Image.new('L', (w, h), 0)
            ImageDraw.Draw(im).text((-bbox[0], -bbox[1]), ch, font=font, fill=255, anchor='ls')
        else:
            im = None
        imgs.append((ch, im, bbox, adv))
    # shelf-pack
    W = 1024
    x = y = rowh = 0
    place = {}
    for ch, im, bbox, adv in imgs:
        if im is None:
            place[ch] = (0, 0, 0, 0)
            continue
        if x + im.width > W:
            x, y, rowh = 0, y + rowh + 1, 0
        place[ch] = (x, y, im.width, im.height)
        x += im.width + 1
        rowh = max(rowh, im.height)
    H = y + rowh + 1
    atlas = Image.new('L', (W, H), 0)
    for ch, im, bbox, adv in imgs:
        px, py, pw, ph = place[ch]
        if im is not None:
            atlas.paste(im, (px, py))
        glyphs[ord(ch)] = [px, py, pw, ph, bbox[0], bbox[1], round(adv, 2)]
    return {'size': size, 'ascent': ascent, 'descent': descent, 'atlasW': W, 'atlasH': H,
            'alpha': base64.b64encode(zlib.compress(atlas.tobytes(), 9)).decode(), 'glyphs': glyphs}


if __name__ == '__main__':
    root = Path(__file__).resolve().parents[1]
    font = Path(sys.argv[1]).resolve()
    assert hashlib.sha256(font.read_bytes()).hexdigest() == 'a3041811a78c361b1de50f953c805e0244951c21c5bd412f7232ef0d899af0da', 'unexpected font bytes'
    words = json.loads((root/'runtime/locales/zh-CN.json').read_text(encoding='utf-8'))
    credit = json.loads((root/'localization/credit.zh-CN.json').read_text(encoding='utf-8'))
    old = json.loads((root/'runtime/fonts/cjk.json').read_text(encoding='utf-8'))
    chars = set(chr(int(c)) for c in old['sizes'][0]['glyphs'])
    chars.update(''.join(words.values()))
    chars.update(''.join(str(v) for v in credit.values()))
    chars.difference_update('\n\r\t')
    size = bake(str(font), (500,), 48, ''.join(sorted(chars)))
    assert size['atlasH'] <= 4096
    atlas = {'family':'cjk','source':'Noto Sans SC (OFL-1.1)',
             'cacheKey':hashlib.sha256(json.dumps(words).encode()).hexdigest()[:16], 'sizes':[size]}
    (root/'localization/fonts/ui-zh-CN.json').write_text(json.dumps(atlas,separators=(',',':')),encoding='utf-8')
