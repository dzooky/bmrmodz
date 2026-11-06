'use strict';

/**
 * DPF Status
 *
 * Initial read-only app scaffold.
 * No diagnostic requests or vehicle signals are enabled until the DDE
 * parameters and their supported read-only access path are verified.
 */
const mgu = require('./kit/mgu');

const W = 1600;
const H = 520;

mgu.run({
    async start(ctx) {
        const { ui, log } = ctx;

        function render() {
            const theme = ctx.theme();
            const cv = ctx.canvas(W, H).clear(theme.bg);

            cv.text('DPF STATUS', 64, 100, 34, theme.text, {
                font: 'bold',
                spacing: 2
            });

            cv.text('READ-ONLY MONITOR', 64, 155, 20, theme.dim, {
                font: 'bold',
                spacing: 1.5
            });

            cv.text('DPF signal mapping is not configured yet.', 64, 255, 28, theme.text);
            cv.text('Waiting for verified DDE parameters.', 64, 305, 22, theme.dim);

            cv.text('No regeneration, fault clearing or vehicle control functions.', 64, 455, 18, theme.dim);

            return ui.image('MAIN_GFX', cv);
        }

        ctx.loop('MAIN', 4, render);
        render()
            .then(() => log.info('DPF Status first frame rendered'))
            .catch((e) => log.warn('DPF Status first render: ' + e));
    }
});
