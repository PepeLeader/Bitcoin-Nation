import { useEffect, useRef } from 'react';

const CHARS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ₿';
const FONT_SIZE = 14;
const FADE_ALPHA = 0.05;
const COLOR = '#f7931a';

export function MatrixRain(): React.JSX.Element {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animId: number;
        let columns: number;
        let drops: number[];

        const resize = (): void => {
            const dpr = window.devicePixelRatio || 1;
            const w = canvas.offsetWidth;
            const h = canvas.offsetHeight;
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            columns = Math.floor(w / FONT_SIZE);
            drops = Array.from({ length: columns }, () =>
                Math.random() * -h / FONT_SIZE,
            );
        };

        resize();
        window.addEventListener('resize', resize);

        const charArr = [...CHARS];

        const randomChar = (): string =>
            charArr[Math.floor(Math.random() * charArr.length)] ?? '0';

        let lastTime = 0;
        const FRAME_INTERVAL = 63; // ~16 fps

        const draw = (time: number): void => {
            animId = requestAnimationFrame(draw);

            if (time - lastTime < FRAME_INTERVAL) return;
            lastTime = time;

            const w = canvas.offsetWidth;
            const h = canvas.offsetHeight;

            ctx.fillStyle = `rgba(0, 0, 0, ${FADE_ALPHA})`;
            ctx.fillRect(0, 0, w, h);

            ctx.fillStyle = COLOR;
            ctx.font = `${FONT_SIZE}px monospace`;

            for (let i = 0; i < columns; i++) {
                const x = i * FONT_SIZE;
                const drop = drops[i] ?? 0;
                const y = drop * FONT_SIZE;

                ctx.fillStyle = '#ffb44d';
                ctx.fillText(randomChar(), x, y);

                ctx.fillStyle = COLOR;
                ctx.fillText(randomChar(), x, y - FONT_SIZE);

                drops[i] = drop + 1;

                if (y > h && Math.random() > 0.975) {
                    drops[i] = 0;
                }
            }
        };

        animId = requestAnimationFrame(draw);

        return () => {
            cancelAnimationFrame(animId);
            window.removeEventListener('resize', resize);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="matrix-rain"
            aria-hidden="true"
        />
    );
}
