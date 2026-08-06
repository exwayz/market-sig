import { api } from "./api.js";
import { fmt, signClass, signalBadgeClass, signalArrow } from "./format.js";
import { lineChart, barChart } from "./charts.js";

const $ = (id) => document.getElementById(id);

const els = {
  status: $("status-line"),
  refresh: $("btn-refresh"),
  indexValue: $("index-value"),
  indexChange: $("index-change"),
  breadthBull: $("breadth-bullish"),
  breadthNeutral: $("breadth-neutral"),
  breadthBear: $("breadth-bearish"),
  breadthFillBull: $("breadth-fill-bull"),
  breadthFillNeutral: $("breadth-fill-neutral"),
  breadthFillBear: $("breadth-fill-bear"),
  indexChart: $("index-chart"),
  search: $("search-input"),
  clearFilter: $("btn-clear-filter"),
  signalFilter: $("signal-filter"),
  itemsBody: $("items-body"),
  tickerBody: $("ticker-body"),
  viewMarket: $("view-market"),
  viewTicker: $("view-ticker"),
  detailOverlay: $("detail-overlay"),
  detailModal: $("detail-modal"),
};

let items = [];
let sort = { key: "signal", dir: -1 };
let currentView = "market";
let selectedCode = null;
let refreshTimer = null;

// ── Status line ──────────────────────────────────────────────────
function setStatus(text, cls) {
  els.status.textContent = text;
  els.status.className = "subtitle " + (cls || "");
}

async function refreshMeta() {
  try {
    const meta = await api.meta();
    const last = meta.collectedAt ? new Date(meta.collectedAt) : null;
    const rel = last ? humanize(Date.now() - last.getTime()) : "never";
    setStatus(
      `${meta.tradedCount} commodities tracked · last collection ${rel} ago · ${meta.market.bullish}↑ / ${meta.market.neutral}· / ${meta.market.bearish}↓`,
      "ok",
    );
  } catch (e) {
    setStatus(`signal server unreachable — ${e.message}`, "err");
  }
}

function humanize(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.round(m / 60)}h`;
}

// ── Index chart ──────────────────────────────────────────────────
async function renderIndex() {
  try {
    const hist = await api.indexHistory();
    const daily = (hist.daily || []).map((p) => ({ x: new Date(p.date).getTime(), y: p.value }));
    const intraday = (hist.intraday || []).map((p) => ({ x: p.ts, y: p.value }));

    // Merge daily + intraday tail into one continuous series
    const series = [...daily];
    if (intraday.length) {
      const lastDaily = daily[daily.length - 1];
      const merged = [];
      if (lastDaily) merged.push({ x: lastDaily.x, y: lastDaily.y });
      merged.push(...intraday.map((p, i) => ({
        x: p.x,
        y: i === 0 && merged.length === 1 ? merged[0].y : p.y,
      })));
      series.push(...merged);
    }

    const clean = series.filter((p) => p.y != null);
    if (!clean.length) {
      els.indexValue.textContent = "—";
      return;
    }

    const last = clean[clean.length - 1].y;
    const first = clean[0].y;
    const change = ((last - first) / first) * 100;

    els.indexValue.textContent = last.toFixed(2);
    els.indexChange.textContent = `${fmt.signed(change, 2)}% · 30d`;
    els.indexChange.className = "index-change " + signClass(change);

    lineChart(els.indexChart, {
      series: [
        {
          points: clean,
          color: change >= 0 ? "#16a34a" : "#b91c1c",
          width: 2,
          fill: true,
          fillTop: change >= 0 ? "rgba(22,163,74,0.20)" : "rgba(185,28,28,0.24)",
          fillBottom: "rgba(0,0,0,0)",
        },
      ],
      labels: {
        x: (x) => fmt.date(new Date(x).toISOString()),
        y: (v) => v.toFixed(1),
      },
      pad: { top: 12, right: 10, bottom: 22, left: 46 },
    });
  } catch (e) {
    els.indexValue.textContent = "—";
    els.indexChart.getContext("2d").clearRect(0, 0, els.indexChart.width, els.indexChart.height);
  }
}

// ── Breadth ──────────────────────────────────────────────────────
function renderBreadth() {
  const counts = { pos: 0, neu: 0, neg: 0 };
  for (const it of items) {
    if (it.signal > 0) counts.pos++;
    else if (it.signal < 0) counts.neg++;
    else counts.neu++;
  }
  const total = items.length || 1;
  els.breadthBull.firstChild.textContent = counts.pos;
  els.breadthNeutral.firstChild.textContent = counts.neu;
  els.breadthBear.firstChild.textContent = counts.neg;
  els.breadthFillBull.style.width = `${(counts.pos / total) * 100}%`;
  els.breadthFillNeutral.style.width = `${(counts.neu / total) * 100}%`;
  els.breadthFillBear.style.width = `${(counts.neg / total) * 100}%`;
}

// ── Items table ──────────────────────────────────────────────────
function pressureSegment(imbalance) {
  if (imbalance == null) return "";
  const total = Math.max(1, Math.abs(imbalance) * 2);
  const left = imbalance >= 0 ? total : 0;
  const right = imbalance >= 0 ? 0 : total;
  return `
    <span class="pressure-bar">
      <i style="left:${imbalance >= 0 ? 50 : 50 - right * 50}%;width:${imbalance >= 0 ? left * 50 : right * 50}%;background:${imbalance >= 0 ? "#16a34a" : "#b91c1c"}"></i>
    </span>`;
}

function confidenceTrack(conf) {
  if (conf == null) return "";
  return `<span class="confidence-track"><i style="width:${Math.round(conf * 100)}%"></i></span>`;
}

function renderItems() {
  const q = els.search.value.trim().toLowerCase();
  const sig = els.signalFilter.value;
  let list = items;

  if (q) {
    list = list.filter((it) =>
      it.code.toLowerCase().includes(q) ||
      (it.rarity || "").toLowerCase().includes(q) ||
      (it.type || "").toLowerCase().includes(q),
    );
  }
  if (sig !== "") list = list.filter((it) => it.signal === Number(sig));

  list = [...list].sort((a, b) => {
    const av = a[sort.key], bv = b[sort.key];
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "string") return av.localeCompare(bv) * sort.dir;
    return (av - bv) * sort.dir;
  });

  if (!list.length) {
    els.itemsBody.innerHTML = `<tr class="empty-row"><td colspan="10">no commodities match</td></tr>`;
    return;
  }

  els.itemsBody.innerHTML = list.map((it) => `
    <tr data-code="${it.code}">
      <td class="item-code">${it.code}
        <span class="item-type" style="display:block;font-size:10px;color:var(--fg-muted)">${it.type}${it.rarity ? " · " + it.rarity : ""}</span>
      </td>
      <td>${fmt.price(it.price)}</td>
      <td class="${signClass(it.change1d)}">${fmt.signed(it.change1d, 2)}</td>
      <td class="${signClass(it.change7d)}">${fmt.signed(it.change7d, 2)}</td>
      <td>${it.spreadPct != null ? fmt.num(it.spreadPct, 2) + "%" : "—"}</td>
      <td>${pressureSegment(it.imbalance)}</td>
      <td class="${it.rsi != null && it.rsi >= 70 ? "num-neg" : it.rsi != null && it.rsi <= 30 ? "num-pos" : ""}">${it.rsi != null ? Math.round(it.rsi) : "—"}</td>
      <td>${fmt.int(it.volume3d)}</td>
      <td>${confidenceTrack(it.confidence)}</td>
      <td><span class="${signalBadgeClass(it.signal)}">${signalArrow(it.signal)} ${it.signalName}</span></td>
    </tr>
  `).join("");

  els.itemsBody.querySelectorAll("tr[data-code]").forEach((tr) => {
    tr.addEventListener("click", () => openDetail(tr.dataset.code));
  });
}

function setSort(key) {
  if (sort.key === key) sort.dir *= -1;
  else { sort.key = key; sort.dir = key === "code" ? 1 : -1; }
  document.querySelectorAll("#items-table th").forEach((th) => {
    th.classList.toggle("sorted", th.dataset.sort === sort.key);
  });
  renderItems();
}

// ── Ticker ───────────────────────────────────────────────────────
async function renderTicker(force) {
  try {
    const feed = await api.feed(60, force);
    const trades = (feed.trades || []).slice(0, 60);
    if (!trades.length) {
      els.tickerBody.innerHTML = `<tr class="empty-row"><td colspan="6">no trades captured yet — collector is warming up</td></tr>`;
      return;
    }
    els.tickerBody.innerHTML = trades.map((t) => {
      const sideCls = t.buyer_id === t.seller_id ? "num-flat" : "";
      return `
        <tr>
          <td class="item-code">${t.item_code || "—"}</td>
          <td>${fmt.int(t.quantity)}</td>
          <td>${fmt.price(t.price)}</td>
          <td>${fmt.num(t.money, 2)}</td>
          <td class="${sideCls}">${t.seller_id ? "matched" : "—"}</td>
          <td class="tick-time">${fmt.time(t.created_at)}</td>
        </tr>`;
    }).join("");
  } catch (e) {
    els.tickerBody.innerHTML = `<tr class="empty-row"><td colspan="6">feed unavailable — ${e.message}</td></tr>`;
  }
}

// ── Item detail ──────────────────────────────────────────────────
function statCard(label, value, cls) {
  return `<div class="stat-card"><div class="stat-label">${label}</div><div class="stat-value ${cls || ""}">${value}</div></div>`;
}

function compCard(label, value, score) {
  const pct = score == null ? 0 : Math.max(0, Math.min(1, Math.abs(score)));
  const cls = score == null ? "pos" : score >= 0 ? "pos" : "neg";
  return `
    <div class="component-card">
      <div class="comp-label"><span>${label}</span><span class="comp-value">${fmt.signed(score, 2)}</span></div>
      <div class="component-bar"><i class="${cls}" style="width:${(pct * 50).toFixed(1)}%"></i></div>
    </div>`;
}

async function openDetail(code) {
  selectedCode = code;
  els.detailModal.innerHTML = `<div class="modal-header"><div class="detail-title">
    <span class="detail-code">${code}</span>
    <span class="detail-meta">loading...</span></div>
    <button type="button" class="modal-close" id="detail-close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
  </div>`;
  els.detailOverlay.hidden = false;
  $("detail-close").addEventListener("click", closeDetail);
  els.detailModal.addEventListener("click", (e) => {
    if (e.target === els.detailModal) closeDetail();
  });

  try {
    const d = await api.item(code, true);
    renderDetail(d);
  } catch (e) {
    els.detailModal.innerHTML = `<div class="modal-body"><p class="error" style="color:var(--red)">failed to load ${code}: ${e.message}</p></div>`;
  }
}

function closeDetail() {
  els.detailOverlay.hidden = true;
  selectedCode = null;
}

function renderDetail(d) {
  const comps = d.components || {};
  const priceUp = d.snapshots && d.snapshots.length > 1
    ? (d.snapshots[d.snapshots.length - 1].index_price - d.snapshots[0].index_price) / d.snapshots[0].index_price * 100
    : null;

  const daily = d.daily || [];
  const priceSeries = daily.map((p) => ({ x: new Date(p.date + "T00:00:00").getTime(), y: p.avg }));
  const sma5 = movingAvg(daily.map((p) => p.avg), 5);
  const sma20 = movingAvg(daily.map((p) => p.avg), 20);

  els.detailModal.innerHTML = `
    <div class="modal-header">
      <div class="detail-title">
        <span class="detail-code">${d.code}</span>
        <span class="detail-meta">${d.type}${d.rarity ? " · " + d.rarity : ""}${d.usage ? " · " + d.usage : ""}</span>
        <span class="${signalBadgeClass(d.signal)}">${signalArrow(d.signal)} ${d.signalName}</span>
      </div>
      <button type="button" class="modal-close" id="detail-close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div class="modal-sep"></div>
    <div class="detail-stats">
      ${statCard("Score", fmt.signed(d.score, 3))}
      ${statCard("Confidence", d.confidence != null ? Math.round(d.confidence * 100) + "%" : "—")}
      ${statCard("Liquidity", d.liquidity != null ? Math.round(d.liquidity * 100) + "%" : "—")}
      ${statCard("RSI 14", comps.rsi != null ? comps.rsi : "—")}
      ${statCard("Volatility", comps.volatility != null ? comps.volatility + "%" : "—")}
      ${statCard("1d Δ", fmt.pct(comps.change1d), signClass(comps.change1d))}
      ${statCard("7d Δ", fmt.pct(comps.change7d), signClass(comps.change7d))}
      ${statCard("Vol 3d", fmt.int(d.daily.slice(-3).reduce((a, p) => a + p.quantity, 0)))}
    </div>

    <div class="detail-charts">
      <div class="detail-chart-card">
        <div class="section-label">Price · 30d avg daily</div>
        <div class="chart-wrap"><canvas id="detail-price-chart" class="chart-canvas" height="210"></canvas>
          <div class="chart-tooltip" id="price-tip"></div></div>
      </div>
      <div class="detail-chart-card">
        <div class="section-label">Volume · units per day</div>
        <div class="chart-wrap"><canvas id="detail-vol-chart" class="chart-canvas" height="140"></canvas>
          <div class="chart-tooltip" id="vol-tip"></div></div>
      </div>
    </div>

    <div class="section-label" style="padding:0 20px">Signal components</div>
    <div class="components-grid">
      ${compCard("Trend", comps.trendScore, comps.trendScore)}
      ${compCard("RSI", comps.rsiScore, comps.rsiScore)}
      ${compCard("Pressure", comps.imbalanceScore, comps.imbalanceScore)}
      ${compCard("Volume", comps.volumeScore, comps.volumeScore)}
      ${compCard("Intraday", comps.intradayScore, comps.intradayScore)}
    </div>

    <div class="section-label" style="padding:0 20px">Order book depth</div>
    <div class="depth-wrap">
      <div class="depth-side bids">
        <h4>Bids</h4>
        <div id="depth-bids"></div>
      </div>
      <div class="depth-side asks">
        <h4>Asks</h4>
        <div id="depth-asks"></div>
      </div>
    </div>
  `;

  $("detail-close").addEventListener("click", closeDetail);

  // price chart
  const series = [
    { points: priceSeries, color: "#b91c1c", width: 1.8, fill: true, fillTop: "rgba(185,28,28,0.22)", fillBottom: "rgba(0,0,0,0)" },
  ];
  if (sma5.length) {
    series.push({
      points: sma5.map((y, i) => ({ x: priceSeries[i].x, y })).filter((p) => p.y != null),
      color: "#d97706", width: 1.2, dashed: true,
    });
  }
  if (sma20.length) {
    series.push({
      points: sma20.map((y, i) => ({ x: priceSeries[i].x, y })).filter((p) => p.y != null),
      color: "#8F8F8F", width: 1.2, dashed: true,
    });
  }

  const priceTip = $("price-tip");
  lineChart($("detail-price-chart"), {
    series,
    labels: {
      x: (x) => fmt.date(new Date(x).toISOString()),
      y: (v) => fmt.price(v, 2),
    },
    pad: { top: 12, right: 10, bottom: 22, left: 54 },
  });

  // volume chart
  const volTip = $("vol-tip");
  barChart($("detail-vol-chart"), {
    values: daily.map((p) => ({ x: new Date(p.date + "T00:00:00").getTime(), y: p.quantity })),
    color: "rgba(185,28,28,0.55)",
    labels: {
      x: (x) => fmt.date(new Date(x).toISOString()),
      y: (v) => fmt.int(v),
    },
    pad: { top: 8, right: 8, bottom: 20, left: 54 },
  });

  const snap = d.snapshots || [];
  const lastSnap = snap[snap.length - 1] || {};
  renderDepth(d.code, lastSnap);

  // re-render charts after fonts/layout settle
  requestAnimationFrame(() => {
    if (window.detailChartRefs) window.detailChartRefs.forEach((c) => c.chartRedraw && c.chartRedraw());
  });
}

function movingAvg(arr, period) {
  const out = [];
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i];
    if (i >= period) sum -= arr[i - period];
    out.push(i >= period - 1 ? sum / period : null);
  }
  return out;
}

async function renderDepth(code, snap) {
  // Order book from the server isn't persisted at full depth, so we show the
  // live snapshot summary plus whatever the last snapshot captured.
  const bidsEl = $("depth-bids");
  const asksEl = $("depth-asks");
  if (!bidsEl) return;

  const bestBid = snap.best_bid ?? null;
  const bestAsk = snap.best_ask ?? null;
  const bidQty = snap.bid_quantity ?? 0;
  const askQty = snap.ask_quantity ?? 0;

  const row = (label, value) => `
    <div class="depth-row"><span>${label}</span><span class="depth-track"><i></i></span><span class="depth-price">${value}</span></div>`;

  bidsEl.innerHTML = `
    ${row("best", fmt.price(bestBid))}
    ${row("depth qty", fmt.int(bidQty))}
    ${row("depth $", fmt.int(snap.bid_money))}
  `;
  asksEl.innerHTML = `
    ${row("best", fmt.price(bestAsk))}
    ${row("depth qty", fmt.int(askQty))}
    ${row("depth $", fmt.int(snap.ask_money))}
  `;

  // scale the track fills
  const max = Math.max(bidQty, askQty, 1);
  bidsEl.querySelectorAll(".depth-track i")[1].style.width = `${(bidQty / max) * 100}%`;
  asksEl.querySelectorAll(".depth-track i")[1].style.width = `${(askQty / max) * 100}%`;
}

// ── Views ────────────────────────────────────────────────────────
function setView(view) {
  currentView = view;
  els.viewMarket.hidden = view !== "market";
  els.viewTicker.hidden = view !== "ticker";
  $("btn-market").classList.toggle("active", view === "market");
  $("btn-ticker").classList.toggle("active", view === "ticker");
}

// ── Main refresh loop ────────────────────────────────────────────
async function refreshAll(force = false) {
  els.refresh.classList.add("spinning");
  try {
    await refreshMeta();
    const data = await api.overview(force);
    items = data.items || [];
    renderBreadth();
    renderItems();
    await renderIndex();
    await renderTicker(force);
    if (selectedCode) {
      // refresh open detail quietly
      api.item(selectedCode, true).then(renderDetail).catch(() => {});
    }
  } catch (e) {
    setStatus(`error: ${e.message}`, "err");
  } finally {
    els.refresh.classList.remove("spinning");
  }
}

// ── Wire up ──────────────────────────────────────────────────────
function init() {
  document.querySelectorAll("#items-table th[data-sort]").forEach((th) => {
    th.addEventListener("click", () => setSort(th.dataset.sort));
  });
  setSort("signal");

  els.search.addEventListener("input", renderItems);
  els.signalFilter.addEventListener("change", renderItems);
  els.clearFilter.addEventListener("click", () => {
    els.search.value = "";
    els.signalFilter.value = "";
    renderItems();
  });

  els.refresh.addEventListener("click", () => refreshAll(true));

  $("btn-market").addEventListener("click", () => setView("market"));
  $("btn-ticker").addEventListener("click", () => setView("ticker"));

  // modal close on Escape / backdrop / button
  const overlay = $("modal-overlay");
  $("btn-info").addEventListener("click", () => { overlay.hidden = false; });
  $("modal-close").addEventListener("click", () => { overlay.hidden = true; });
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.hidden = true; });
  els.detailOverlay.addEventListener("click", (e) => {
    if (e.target === els.detailOverlay) closeDetail();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      overlay.hidden = true;
      closeDetail();
    }
  });

  // responsive re-draw
  window.addEventListener("resize", () => {
    if (!els.detailModal.hidden) {
      const canvases = els.detailModal.querySelectorAll("canvas");
      canvases.forEach((c) => c.chartRedraw && c.chartRedraw());
    }
    if (!els.viewMarket.hidden) renderIndex();
  });

  refreshAll(true);
  refreshTimer = setInterval(() => refreshAll(false), 60_000);
}

init();
