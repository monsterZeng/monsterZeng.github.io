// 首页 hero：粒子沿“双漩涡 + 噪声”流场运动，留下发光拖尾
(function () {
  let stop = null;

  function start(canvas) {
    const ctx = canvas.getContext("2d");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w, h, particles, t = 0, raf = 0;

    // 两个漩涡中心（相对坐标），一顺一逆
    const vortices = [
      { x: 0.68, y: 0.32, s: 1 },
      { x: 0.86, y: 0.88, s: -1 },
    ];

    function resize() {
      const r = canvas.getBoundingClientRect();
      w = r.width; h = r.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#05060f"; ctx.fillRect(0, 0, w, h);
      const n = Math.round(Math.min(2600, (w * h) / 450));
      particles = Array.from({ length: n }, spawn);
    }

    function spawn() {
      return { x: Math.random() * w, y: Math.random() * h, life: 60 + Math.random() * 240 };
    }

    function field(x, y) {
      let vx = 0, vy = 0;
      const m = Math.max(w, h);
      for (const v of vortices) {
        const dx = x - v.x * w, dy = y - v.y * h;
        const d2 = (dx * dx + dy * dy) / (m * m) + 0.002;
        const k = 1 / d2;
        // 切向旋转 + 微弱向心
        vx += (-dy * v.s - dx * 0.35) * k / m;
        vy += (dx * v.s - dy * 0.35) * k / m;
      }
      // 平滑噪声扰动，让流线弯曲
      const a = Math.sin(x * 0.004 + t * 0.6) + Math.cos(y * 0.005 - t * 0.4);
      vx += Math.cos(a * 1.6) * 0.9 + 0.35;
      vy += Math.sin(a * 1.6) * 0.9;
      const len = Math.hypot(vx, vy) || 1;
      const sp = Math.min(len, 3.2);
      return [vx / len * sp, vy / len * sp];
    }

    function frame() {
      t += 0.004;
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(5, 6, 15, 0.045)";
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      ctx.lineWidth = 1.1;
      for (const p of particles) {
        const [vx, vy] = field(p.x, p.y);
        const nx = p.x + vx, ny = p.y + vy;
        // 颜色随位置在 靛蓝 → 青 → 品红 之间过渡
        const hue = 200 + 110 * (0.5 + 0.5 * Math.sin(p.x / w * 3 + p.y / h * 2 + t * 2));
        ctx.strokeStyle = `hsla(${hue}, 95%, 64%, 0.6)`;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(nx, ny); ctx.stroke();
        p.x = nx; p.y = ny;
        if (--p.life < 0 || nx < -10 || nx > w + 10 || ny < -10 || ny > h + 10) Object.assign(p, spawn());
      }
      if (!canvas.isConnected) return cleanup();
      raf = requestAnimationFrame(frame);
    }

    function cleanup() {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    }

    function warm(n) { for (let i = 0; i < n; i++) { frame(); cancelAnimationFrame(raf); } }
    resize(); warm(reduce ? 400 : 120);
    const onResize = () => { resize(); warm(120); };
    window.addEventListener("resize", onResize);
    if (!reduce) raf = requestAnimationFrame(frame);
    return cleanup;
  }

  // 兼容 instant navigation：每次换页检查一次
  document$.subscribe(() => {
    if (stop) { stop(); stop = null; }
    const c = document.querySelector(".nv-hero__canvas");
    if (c) stop = start(c);
  });
})();
