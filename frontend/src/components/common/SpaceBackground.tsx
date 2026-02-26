import { useEffect, useRef } from 'react';

export function SpaceBackground(): React.JSX.Element {
    const ref = useRef<HTMLDivElement>(null);

    // Shooting stars
    useEffect(() => {
        const container = ref.current;
        if (!container) return;

        function spawnStar(): void {
            if (!container) return;
            const star = document.createElement('div');
            star.className = 'shooting-star';

            const angle = 200 + Math.random() * 140;
            const startX = Math.random() * 120 - 10;
            const startY = Math.random() * 40 - 10;
            const dist = 300 + Math.random() * 400;
            const duration = 1.2 + Math.random() * 1.2;
            const tail = 80 + Math.random() * 120;

            star.style.left = `${startX}%`;
            star.style.top = `${startY}%`;
            star.style.setProperty('--angle', `${angle}deg`);
            star.style.setProperty('--dist', `${dist}px`);
            star.style.setProperty('--tail', `${tail}px`);
            star.style.animationDuration = `${duration}s`;

            container.appendChild(star);
            star.addEventListener('animationend', () => star.remove());
        }

        let timer: ReturnType<typeof setTimeout>;
        function scheduleNext(): void {
            const delay = 8000 + Math.random() * 6000;
            timer = setTimeout(() => {
                spawnStar();
                scheduleNext();
            }, delay);
        }
        timer = setTimeout(() => {
            spawnStar();
            scheduleNext();
        }, 2000);

        return () => clearTimeout(timer);
    }, []);

    // UFO fly-by
    useEffect(() => {
        const container = ref.current;
        if (!container) return;

        function spawnUFO(): void {
            if (!container) return;
            const ufo = document.createElement('div');
            ufo.className = 'ufo';

            const fromLeft = Math.random() > 0.5;
            const startY = 10 + Math.random() * 60;
            const drift = -30 + Math.random() * 60;
            const duration = 3 + Math.random() * 2;

            ufo.style.top = `${startY}%`;
            ufo.style.setProperty('--drift', `${drift}px`);
            ufo.style.animationDuration = `${duration}s`;

            if (fromLeft) {
                ufo.style.left = '-60px';
                ufo.style.setProperty('--travel', `${window.innerWidth + 120}px`);
            } else {
                ufo.style.left = `${window.innerWidth + 60}px`;
                ufo.style.setProperty('--travel', `${-(window.innerWidth + 120)}px`);
            }

            container.appendChild(ufo);
            ufo.addEventListener('animationend', () => ufo.remove());
        }

        let ufoTimer: ReturnType<typeof setTimeout>;
        function scheduleUFO(): void {
            ufoTimer = setTimeout(() => {
                spawnUFO();
                scheduleUFO();
            }, 55000 + Math.random() * 10000);
        }
        ufoTimer = setTimeout(() => {
            spawnUFO();
            scheduleUFO();
        }, 30000);

        return () => clearTimeout(ufoTimer);
    }, []);

    return (
        <div className="space-bg" ref={ref} aria-hidden="true">
            <div className="space-bg__nebula space-bg__nebula--1" />
            <div className="space-bg__nebula space-bg__nebula--2" />
            <div className="space-bg__nebula space-bg__nebula--3" />
            <div className="space-bg__nebula space-bg__nebula--4" />
            <div className="space-bg__galaxy" />
            <div className="space-bg__planet space-bg__planet--gas-giant" />
            <div className="space-bg__planet space-bg__planet--ringed" />
            <div className="space-bg__planet space-bg__planet--distant" />
            <div className="space-bg__stars space-bg__stars--sm" />
            <div className="space-bg__stars space-bg__stars--md" />
            <div className="space-bg__stars space-bg__stars--lg" />
            <div className="space-bg__stars space-bg__stars--twinkle-a" />
            <div className="space-bg__stars space-bg__stars--twinkle-b" />
        </div>
    );
}
