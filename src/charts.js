/**
 * Lightweight dependency-free canvas charts.
 * Handles HiDPI, hover crosshairs, tooltips, and multiple series.
 */

const COLORS = {
  red: "#b91c1c",
  green: "#16a34a",
  fg: "#e6e6e6",
  dim: "#8F8F8F",
  border: "#303030",
  grid: "rgba(142,142,142,0.12)",
};

function setupCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: rect.width, h: rect.height };
}

function drawGrid(ctx, w, h, pad) {
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 1; i < 4; i++) {
    const y = pad.top + (h - pad.top - pad.bottom) * (i / 4);
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
  }
  ctx.stroke();
}

function niceTicks(min, max, count = 5) {
  const span = max - min;
  if (span <= 0) return [min];
  const step = Math.pow(10, Math.floor(Math.log10(span / count)));
  const err = (span / count) / step;
  const niceStep = step * (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1);
  const out = [];
  for (let v = Math.ceil(min / niceStep) * niceStep; v <= max + niceStep * 0.01; v += niceStep) {
    out.push(v);
  }
  return out;
}

/**
 * Multi-series line chart.
 * series: [{ points: [{x, y}] , color, dashed, width, fill }]
 * labels: { x: (x) => string, y: (y) => string }
 */
export function lineChart(canvas, { series, labels = {}, baseline, pad = { top: 12, right: 12, bottom: 22, left: 52 } }) {
  let hoverIndex = null;
  let allPoints = [];

  const draw = () => {
    const { ctx, w, h } = setupCanvas(canvas);
    ctx.clearRect(0, 0, w, h);
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;
    if (plotW <= 0 || plotH <= 0) return;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    allPoints = [];
    for (const s of series) {
      for (const p of s.points) {
        if (p.y == null || Number.isNaN(p.y)) continue;
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      }
    }
    if (minX === Infinity) return;
    if (baseline != null) { minY = Math.min(minY, baseline); maxY = Math.max(maxY, baseline); }
    if (maxY - minY < 1e-9) { minY -= 1; maxY += 1; }

    const xOf = (x) => pad.left + ((x - minX) / (maxX - minX || 1)) * plotW;
    const yOf = (y) => pad.top + plotH - ((y - minY) / (maxY - minY)) * plotH;

    drawGrid(ctx, w, h, pad);

    // Y axis labels
    ctx.fillStyle = COLORS.dim;
    ctx.font = '10px "Fira Code", monospace';
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (const t of niceTicks(minY, maxY)) {
      const y = yOf(t);
      ctx.fillText(labels.y ? labels.y(t) : t.toFixed(2), pad.left - 6, y);
    }

    // X axis labels
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const n = allPoints.filter((p) => p.seriesIdx === 0).length;
    if (n > 0) {
      const step = Math.max(1, Math.floor(n / 6));
      let i = 0;
      for (const p of allPoints) {
        if (p.seriesIdx === 0 && i % step === 0 && labels.x) {
          ctx.fillText(labels.x(p.x), xOf(p.x), h - pad.bottom + 6);
        }
        i++;
      }
    }

    // Series lines
    for (const s of series) {
      ctx.strokeStyle = s.color || COLORS.fg;
      ctx.lineWidth = s.width || 1.5;
      ctx.setLineDash(s.dashed ? [4, 3] : []);
      ctx.beginPath();
      let started = false;
      for (const p of s.points) {
        if (p.y == null || Number.isNaN(p.y)) { started = false; continue; }
        const x = xOf(p.x);
        const y = yOf(p.y);
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Fill under main series
      if (s.fill) {
        ctx.lineTo(xOf(s.points[s.points.length - 1].x), pad.top + plotH);
        ctx.lineTo(xOf(s.points[0].x), pad.top + plotH);
        ctx.closePath();
        const g = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
        g.addColorStop(0, s.fillTop || "rgba(185,28,28,0.28)");
        g.addColorStop(1, s.fillBottom || "rgba(185,28,28,0)");
        ctx.fillStyle = g;
        ctx.fill();
      }
    }

    // Baseline
    if (baseline != null) {
      ctx.strokeStyle = COLORS.border;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(pad.left, yOf(baseline));
      ctx.lineTo(w - pad.right, yOf(baseline));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Hover point
    if (hoverIndex != null) {
      const h = allPoints.find((p) => p.seriesIdx === 0 && p.idx === hoverIndex);
      if (h) {
        ctx.strokeStyle = COLORS.dim;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(xOf(h.x), pad.top);
        ctx.lineTo(xOf(h.x), pad.top + plotH);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(xOf(h.x), yOf(h.y), 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  const onMove = (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const main = allPoints.filter((p) => p.seriesIdx === 0);
    if (!main.length) return;
    const minX = main[0].x, maxX = main[main.length - 1].x;
    const frac = (mx - pad.left) / (rect.width - pad.left - pad.right);
    const targetX = minX + frac * (maxX - minX);
    let best = 0, bestD = Infinity;
    main.forEach((p, i) => {
      const d = Math.abs(p.x - targetX);
      if (d < bestD) { bestD = d; best = i; }
    });
    hoverIndex = best;
    draw();
    canvas.dispatchEvent(new CustomEvent("charthover", {
      detail: { point: main[best], series: series.map((s) => s.points[best]) },
    }));
  };

  const onLeave = () => {
    hoverIndex = null;
    draw();
    canvas.dispatchEvent(new CustomEvent("chartleave"));
  };

  canvas.onmousemove = onMove;
  canvas.onmouseleave = onLeave;
  canvas.chartRedraw = draw;
  draw();
}

/** Bar chart for volume. */
export function barChart(canvas, { values, color = "rgba(185,28,28,0.6)", labels = {}, pad = { top: 8, right: 8, bottom: 20, left: 46 } }) {
  let hoverIndex = null;

  const draw = () => {
    const { ctx, w, h } = setupCanvas(canvas);
    ctx.clearRect(0, 0, w, h);
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;
    if (plotW <= 0 || plotH <= 0) return;

    const maxV = Math.max(...values.map((v) => v.y), 1);
    const xOf = (i) => pad.left + ((i + 0.5) / values.length) * plotW;
    const yOf = (v) => pad.top + plotH - (v / maxV) * plotH;
    const barW = Math.max(1, (plotW / values.length) * 0.7);

    drawGrid(ctx, w, h, pad);

    ctx.fillStyle = COLORS.dim;
    ctx.font = '10px "Fira Code", monospace';
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (const t of niceTicks(0, maxV)) {
      ctx.fillText(labels.y ? labels.y(t) : Math.round(t).toString(), pad.left - 6, yOf(t));
    }

    values.forEach((v, i) => {
      const x = xOf(i) - barW / 2;
      const y = yOf(v.y);
      ctx.fillStyle = hoverIndex === i ? (color || "#fff") : (color || COLORS.fg);
      ctx.fillRect(x, y, barW, pad.top + plotH - y);
    });

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const step = Math.max(1, Math.floor(values.length / 6));
    values.forEach((v, i) => {
      if (i % step === 0 && labels.x) {
        ctx.fillStyle = COLORS.dim;
        ctx.fillText(labels.x(v.x), xOf(i), h - pad.bottom + 6);
      }
    });
  };

  const onMove = (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const frac = (mx - pad.left) / (rect.width - pad.left - pad.right);
    const idx = Math.max(0, Math.min(values.length - 1, Math.floor(frac * values.length)));
    hoverIndex = idx;
    draw();
    canvas.dispatchEvent(new CustomEvent("charthover", { detail: { point: values[idx] } }));
  };

  const onLeave = () => {
    hoverIndex = null;
    draw();
    canvas.dispatchEvent(new CustomEvent("chartleave"));
  };

  canvas.onmousemove = onMove;
  canvas.onmouseleave = onLeave;
  canvas.chartRedraw = draw;
  draw();
}
