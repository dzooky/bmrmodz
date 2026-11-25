'use strict';

const path = require('path');
const { Canvas, withAlpha } = require('./kit/canvas');
const { makeLayer, setImage } = require('./kit/record');
const { decode, rasterRuns } = require('./png');

function artwork(file, width, height, id, mirror = false) {
    let source;
    let layer;
    let textureBackground;
    return function draw(cv, theme, gpu, x, y) {
        if (!source) source = decode(path.join(__dirname, file), width, height);
        const native = !!(gpu && gpu.ready && gpu.native);
        if (native && !(gpu.info && gpu.info.pixmaps)) {
            if (!layer) {
                layer = makeLayer(width, height, target => {
                    for (const run of rasterRuns(source, 3)) {
                        const left = mirror ? width - run.x - run.width : run.x;
                        const color = '#' + run.color.toString(16).padStart(8, '0');
                        target.fillRect(left, run.y, run.width, run.height, color);
                    }
                });
            }
            cv.blit(layer, x, y);
            return;
        }

        if (textureBackground !== theme.bg) {
            const surface = new Canvas(width, height).clear(theme.bg);
            surface.fillRect(0, 0, width, height, withAlpha('#b4bccc', 0.07));
            surface.blit(source, 0, 0);
            let pixels = Buffer.from(surface.d.buffer, surface.d.byteOffset, surface.d.length);
            if (mirror) {
                const reflected = Buffer.alloc(pixels.length);
                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        const offset = (y * width + x) * 4;
                        const mirrored = (y * width + width - 1 - x) * 4;
                        pixels.copy(reflected, mirrored, offset, offset + 4);
                    }
                }
                pixels = reflected;
            }
            setImage(id, width, height, pixels);
            textureBackground = theme.bg;
        }
        cv.image(id, x, y, width, height, native);
    };
}

module.exports = artwork;
