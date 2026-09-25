"""
Make the app icons (home-screen icon, PWA icons) from static/logo.png.
Python standard library only:  python tools/make_icons.py

The logo is placed on a white square (iPhone shows transparent icon pixels as black).
"""
import math
import os
import struct
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
STATIC = os.path.join(HERE, "..", "static")
SRC = os.path.join(STATIC, "logo.png")
OUT = os.path.join(STATIC, "icons")

# (file name, canvas size, share of the canvas the logo may fill)
ICONS = [
    ("apple-touch-icon.png", 180, 0.80),
    ("icon-192.png", 192, 0.80),
    ("icon-512.png", 512, 0.80),
    # maskable icons are cropped to a circle by Android: keep the logo inside the middle 80% circle
    ("icon-maskable-512.png", 512, 0.58),
]


def read_png(path):
    data = open(path, "rb").read()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("not a PNG")
    pos, idat, ihdr = 8, b"", None
    while pos < len(data):
        n, kind = struct.unpack(">I4s", data[pos:pos + 8])
        body = data[pos + 8:pos + 8 + n]
        if kind == b"IHDR":
            ihdr = struct.unpack(">IIBBBBB", body)
        elif kind == b"IDAT":
            idat += body
        pos += 12 + n
    w, h, depth, ctype, _, _, interlace = ihdr
    if depth != 8 or interlace != 0 or ctype not in (2, 6):
        raise ValueError("only 8-bit non-interlaced RGB/RGBA PNGs are supported")
    bpp = 4 if ctype == 6 else 3
    raw = zlib.decompress(idat)
    stride = w * bpp
    rows, prev, i = [], bytearray(stride), 0
    for _ in range(h):
        ft = raw[i]
        line = bytearray(raw[i + 1:i + 1 + stride])
        i += 1 + stride
        for x in range(stride):
            a = line[x - bpp] if x >= bpp else 0
            b = prev[x]
            c = prev[x - bpp] if x >= bpp else 0
            if ft == 1:
                line[x] = (line[x] + a) & 255
            elif ft == 2:
                line[x] = (line[x] + b) & 255
            elif ft == 3:
                line[x] = (line[x] + ((a + b) >> 1)) & 255
            elif ft == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                line[x] = (line[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        rows.append(line)
        prev = line
    # flatten onto white, as floats 0..1
    img = []
    for line in rows:
        out = []
        for x in range(w):
            px = line[x * bpp:x * bpp + bpp]
            al = px[3] / 255.0 if bpp == 4 else 1.0
            out.append(tuple((px[k] / 255.0) * al + (1.0 - al) for k in range(3)))
        img.append(out)
    return w, h, img


def lanczos(x, a=3):
    if x == 0:
        return 1.0
    if -a < x < a:
        px = math.pi * x
        return a * math.sin(px) * math.sin(px / a) / (px * px)
    return 0.0


def resample_1d(line, new_len):
    """Resize one row/column of RGB pixels with a Lanczos-3 filter (anti-aliased when shrinking)."""
    old_len = len(line)
    scale = old_len / new_len
    support = 3 * max(scale, 1.0)
    out = []
    for i in range(new_len):
        center = (i + 0.5) * scale
        lo, hi = int(math.floor(center - support)), int(math.ceil(center + support))
        acc, wsum = [0.0, 0.0, 0.0], 0.0
        for j in range(lo, hi + 1):
            wgt = lanczos((j + 0.5 - center) / max(scale, 1.0))
            if wgt == 0:
                continue
            p = line[min(max(j, 0), old_len - 1)]
            acc[0] += p[0] * wgt
            acc[1] += p[1] * wgt
            acc[2] += p[2] * wgt
            wsum += wgt
        out.append(tuple(min(1.0, max(0.0, c / wsum)) for c in acc))
    return out


def resize(img, w, h, nw, nh):
    rows = [resample_1d(r, nw) for r in img]
    cols = [resample_1d([rows[y][x] for y in range(h)], nh) for x in range(nw)]
    return [[cols[x][y] for x in range(nw)] for y in range(nh)]


def write_png(path, size, pixels):
    raw = bytearray()
    for row in pixels:
        raw.append(0)
        for r, g, b in row:
            raw += bytes((int(round(r * 255)), int(round(g * 255)), int(round(b * 255))))

    def chunk(kind, body):
        return struct.pack(">I", len(body)) + kind + body + struct.pack(">I", zlib.crc32(kind + body) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)


def main():
    w, h, img = read_png(SRC)
    os.makedirs(OUT, exist_ok=True)
    for name, size, share in ICONS:
        fit = size * share
        k = min(fit / w, fit / h)
        nw, nh = max(1, round(w * k)), max(1, round(h * k))
        logo = resize(img, w, h, nw, nh)
        canvas = [[(1.0, 1.0, 1.0)] * size for _ in range(size)]
        ox, oy = (size - nw) // 2, (size - nh) // 2
        for y in range(nh):
            canvas[oy + y] = canvas[oy + y][:ox] + logo[y] + canvas[oy + y][ox + nw:]
        write_png(os.path.join(OUT, name), size, canvas)
        print("wrote", name, f"{size}x{size}")


if __name__ == "__main__":
    main()
