'use strict';
/**
 * Render the existing Settings list on the application's own canvas.
 * Each row is exposed as a Recorder target, exactly like CC's My Car controls.
 * This avoids relying on a native HMI action button which did not receive input.
 */
const { listSheet } = require('./sheet');

module.exports = function createSettingsCanvas(settings, version, onDone) {
    const sh = listSheet(settings, 'Settings', { version });
    return {
        draw(cv, theme) {
            const targets = sh.draw(cv, theme);
            targets.forEach((target, index) => {
                if (target.h <= 0) return;
                cv.target(target.x, target.y, target.w, target.h, () => {
                    const result = target.act();
                    if (result === 'close') onDone();
                }, 'settings-canvas-' + index, 10);
            });
            cv.scroll = true;
        },
        scroll(delta) {
            if (sh.scroll) sh.scroll(delta);
            return true;
        },
    };
};
