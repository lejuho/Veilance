import { useEffect, useRef } from 'react';

type Star = {
  x: number;
  y: number;
  z: number;
  r: number;
  tw: number;
  sp: number;
  hue: number;
};

type Meteor = { x: number; y: number; vx: number; vy: number; life: number };

export function Sky() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0;
    let h = 0;
    let raf = 0;
    let stars: Star[] = [];
    let meteor: Meteor | null = null;
    let t = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.floor((w * h) / 2200);
      stars = Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        z: 0.2 + Math.random() * 0.8,
        r: 0.35 + Math.random() * 1.7,
        tw: Math.random() * Math.PI * 2,
        sp: 0.08 + Math.random() * 0.38,
        hue: Math.random() < 0.18 ? 1 : 0,
      }));
    };

    const spawnMeteor = () => {
      meteor = {
        x: Math.random() * w * 0.75,
        y: Math.random() * h * 0.32,
        vx: 6 + Math.random() * 6,
        vy: 2.6 + Math.random() * 2.4,
        life: 1,
      };
    };

    const draw = () => {
      t += 1;
      ctx.fillStyle = '#030806';
      ctx.fillRect(0, 0, w, h);

      const drift = reduce ? 0 : Math.sin(t * 0.0022);
      const g = ctx.createRadialGradient(
        w * (0.2 + drift * 0.04),
        h * 0.1,
        12,
        w * 0.38,
        h * 0.42,
        Math.max(w, h) * 0.95,
      );
      g.addColorStop(0, 'rgba(40, 110, 72, 0.34)');
      g.addColorStop(0.4, 'rgba(10, 32, 24, 0.38)');
      g.addColorStop(1, 'rgba(2, 6, 8, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      const g2 = ctx.createRadialGradient(
        w * (0.82 - drift * 0.03),
        h * 0.78,
        8,
        w * 0.68,
        h * 0.72,
        w * 0.55,
      );
      g2.addColorStop(0, 'rgba(61, 220, 151, 0.1)');
      g2.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, w, h);

      for (const s of stars) {
        if (!reduce) {
          s.x += s.sp * s.z * 0.22;
          s.y += s.sp * s.z * 0.04;
          if (s.x > w + 4) s.x = -4;
          if (s.y > h + 4) s.y = -4;
          s.tw += 0.02 + s.z * 0.012;
        }
        const a = 0.22 + 0.78 * (0.5 + 0.5 * Math.sin(s.tw));
        const fill = s.hue
          ? `rgba(125, 255, 196, ${a * s.z})`
          : `rgba(220, 255, 236, ${a * s.z})`;
        ctx.beginPath();
        ctx.fillStyle = fill;
        ctx.arc(s.x, s.y, s.r * s.z, 0, Math.PI * 2);
        ctx.fill();
        if (s.z > 0.7 && a > 0.72) {
          ctx.beginPath();
          ctx.fillStyle = `rgba(61, 220, 151, ${0.16 * a})`;
          ctx.arc(s.x, s.y, s.r * s.z * 3.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = `rgba(232, 255, 244, ${0.35 * a})`;
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(s.x - s.r * 4, s.y);
          ctx.lineTo(s.x + s.r * 4, s.y);
          ctx.moveTo(s.x, s.y - s.r * 4);
          ctx.lineTo(s.x, s.y + s.r * 4);
          ctx.stroke();
        }
      }

      if (!reduce) {
        if (!meteor && t % 360 === 90) spawnMeteor();
        if (meteor) {
          meteor.x += meteor.vx;
          meteor.y += meteor.vy;
          meteor.life -= 0.014;
          ctx.strokeStyle = `rgba(190, 255, 220, ${Math.max(0, meteor.life)})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(meteor.x, meteor.y);
          ctx.lineTo(meteor.x - meteor.vx * 7, meteor.y - meteor.vy * 7);
          ctx.stroke();
          if (meteor.life <= 0 || meteor.x > w || meteor.y > h) meteor = null;
        }
      }

      raf = requestAnimationFrame(draw);
    };

    resize();
    draw();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="lp-sky" aria-hidden>
      <canvas ref={ref} className="lp-sky-canvas" />
      <div className="lp-ore" />
      <div className="lp-veil" />
    </div>
  );
}
