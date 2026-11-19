'use strict';

const { Canvas, withAlpha } = require('./kit/canvas');
const { setImage } = require('./kit/record');
const textures = new Map();
let nextId = 0x434400;

// Rasterize small controls with extra samples so their outlines stay smooth on MGU.
function controlTexture(cv, theme, gpu, key, signature, x, y, width, height, draw) {
    const native = !!(gpu && gpu.ready && gpu.native);
    if (native && !(gpu.info && gpu.info.pixmaps)) return false;

    let texture = textures.get(key);
    if (!texture) {
        texture = { id: nextId++ };
        textures.set(key, texture);
    }
    const revision = JSON.stringify([theme.bg, signature, width, height]);
    if (texture.revision !== revision) {
        const scale = 3;
        const surface = new Canvas(width * scale, height * scale).clear(theme.bg);
        surface.fillRect(0, 0, surface.w, surface.h, withAlpha('#b4bccc', 0.07));
        const pen = {
            polyline: (points, thickness, color) =>
                surface.polyline(points.map(([px, py]) => [px * scale, py * scale]), thickness * scale, color),
            arc: (cx, cy, inner, outer, start, end, color) =>
                surface.arc(cx * scale, cy * scale, inner * scale, outer * scale, start, end, color),
            roundRect: (left, top, w, h, radius, color) =>
                surface.roundRect(left * scale, top * scale, w * scale, h * scale, radius * scale, color),
            strokeRoundRect: (left, top, w, h, radius, thickness, color) =>
                surface.strokeRoundRect(left * scale, top * scale, w * scale, h * scale,
                    radius * scale, thickness * scale, color),
            text: (label, px, py, size, color, options) =>
                surface.text(label, px * scale, py * scale, size * scale, color, options),
        };
        draw(pen);
        const pixels = Buffer.alloc(width * height * 4);
        for (let py = 0; py < height; py++) {
            for (let px = 0; px < width; px++) {
                const offset = (py * width + px) * 4;
                for (let channel = 0; channel < 3; channel++) {
                    let sum = 0;
                    for (let dy = 0; dy < scale; dy++) {
                        for (let dx = 0; dx < scale; dx++) {
                            sum += surface.d[((py * scale + dy) * surface.w + px * scale + dx) * 4 + channel];
                        }
                    }
                    pixels[offset + channel] = Math.round(sum / (scale * scale));
                }
                pixels[offset + 3] = 255;
            }
        }
        setImage(texture.id, width, height, pixels);
        texture.revision = revision;
    }
    cv.image(texture.id, x, y, width, height, native);
    return true;
}

module.exports = controlTexture;
