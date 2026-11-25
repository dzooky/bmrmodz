#!/usr/bin/env python3
"""Extend the runtime Ubuntu Sans atlases for translated app text.

Run with Pillow and the variable Ubuntu Sans font from
https://github.com/google/fonts/tree/main/ufl/ubuntusans.
"""

import argparse
import base64
import json
from pathlib import Path
import zlib

from PIL import Image, ImageDraw, ImageFont


FONTS = Path(__file__).resolve().parents[1] / 'runtime' / 'fonts'
CHARACTERS = ''.join(chr(cp) for cp in range(0xA1, 0x180) if cp != 0xAD) + 'ẞ’ȘșȚț'
CHARACTERS += ''.join(chr(cp) for cp in (*range(0x386, 0x3A2), *range(0x3A3, 0x3CF))
                      if cp not in (0x387, 0x38B, 0x38D))
FAMILIES = {
    'label': (85, 400),
    'bold': (85, 700),
    'light': (85, 300),
    'num': (75, 500),
}


def append_glyphs(size, font, characters=CHARACTERS):
    font_data = size['glyphs']
    width = size['atlasW']
    old_height = size['atlasH']
    extra = Image.new('L', (width, old_height), 0)
    x = y = row_height = 0
    for ch in characters:
        code = str(ord(ch))
        if code in font_data:
            continue
        left, top, right, bottom = font.getbbox(ch, anchor='ls')
        glyph_width, glyph_height = right - left, bottom - top
        if x + glyph_width > width:
            x, y, row_height = 0, y + row_height + 1, 0
        if y + glyph_height > extra.height:
            larger = Image.new('L', (width, max(extra.height * 2, y + glyph_height)), 0)
            larger.paste(extra, (0, 0))
            extra = larger
        ImageDraw.Draw(extra).text((x - left, y - top), ch, font=font, fill=255, anchor='ls')
        font_data[code] = [x, old_height + y, glyph_width, glyph_height, left, top, round(font.getlength(ch), 2)]
        x += glyph_width + 1
        row_height = max(row_height, glyph_height)
    if row_height:
        extra = extra.crop((0, 0, width, y + row_height + 1))
        previous = zlib.decompress(base64.b64decode(size['alpha']))
        size['atlasH'] += extra.height
        size['alpha'] = base64.b64encode(zlib.compress(previous + extra.tobytes(), 9)).decode('ascii')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('font', type=Path)
    parser.add_argument('--spritmonitor-cjk-font', type=Path,
                        help='Noto Sans SC used to fill missing Spritmonitor Chinese glyphs')
    args = parser.parse_args()
    for family, axes in FAMILIES.items():
        target = FONTS / (family + '.json')
        atlas = json.loads(target.read_text(encoding='utf-8'))
        for size in atlas['sizes']:
            if '65' not in size['glyphs']:
                continue
            font = ImageFont.truetype(str(args.font), size['size'])
            font.set_variation_by_axes(list(axes))
            append_glyphs(size, font)
        atlas['cacheKey'] = 'latin-greek-ext2'
        target.write_text(json.dumps(atlas, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

    target = FONTS.parent.parent / 'localization' / 'fonts' / 'cyrillic-ru.json'
    atlas = json.loads(target.read_text(encoding='utf-8'))
    cyrillic = 'Ёё' + ''.join(chr(cp) for cp in range(0x410, 0x450))
    cyrillic += 'ҐґЄєІіЇї’'
    for size in atlas['sizes']:
        font = ImageFont.truetype(str(args.font), size['size'])
        font.set_variation_by_axes([85, 500])
        append_glyphs(size, font, cyrillic)
    atlas['cacheKey'] = 'cyrillic-ru-uk'
    target.write_text(json.dumps(atlas, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')

    if args.spritmonitor_cjk_font:
        root = FONTS.parents[2]
        catalog = root / 'apps' / 'spritmonitor' / 'additional-locales.js'
        rows = catalog.read_text(encoding='utf-8').split('`')[1].strip().splitlines()
        chinese = ''.join(row.split('|')[3] for row in rows) + '简体中文'
        atlas = json.loads((FONTS / 'cjk.json').read_text(encoding='utf-8'))
        for size in atlas['sizes']:
            font = ImageFont.truetype(str(args.spritmonitor_cjk_font), size['size'])
            append_glyphs(size, font, sorted(set(chinese)))
        atlas['cacheKey'] = 'spritmonitor-cjk'
        target = root / 'kit' / 'localization' / 'fonts' / 'spritmonitor-cjk.json'
        target.write_text(json.dumps(atlas, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
