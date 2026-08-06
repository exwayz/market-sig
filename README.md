# market-sig

Real-time market signals dashboard for the War Era in-game economy.
Dark resolver-style UI: composite market index, breadth gauge, 23 tradable
commodities scored across a 7-level buy/hold/sell scale, plus a live trade
ticker.

## Stack

- Vite 6 + vanilla JS/HTML/CSS (no framework, no UI libs)
- Lightweight dependency-free canvas charts (HiDPI, hover tooltips)
- Talks to the `market-sig-server` REST API (proxy at `/api` in dev)

## Run

Requires the backend at `http://localhost:8787` (see `market-sig-server`).

```bash
npm install
npm run dev      # http://localhost:5173, proxies /api to :8787
npm run build    # production bundle to dist/
```

Point at a remote server with `VITE_API=https://host` (override base URL).

## Pages / features

- **Market view** — composite index chart (30d daily + intraday tail),
  breadth bull/neutral/bear counts, sortable/filterable commodities table
  (price, 1d/7d change, spread, order-book pressure bar, RSI, 3d volume,
  confidence track, signal badge).
- **Item detail modal** — click any row: 30d price chart with SMA5/SMA20,
  daily volume bars, signal component breakdown (trend/RSI/pressure/volume/
  intraday), order-book depth summary, score/confidence/liquidity stats.
- **Ticker view** — recent matched trades from the collector feed.
- 60s auto-refresh with localStorage caching and force-refresh button.

## Signal scale

| Score | Signal | Range |
|---|---|---|
| +0.55+ | Strong Buy | ▲ |
| +0.25 | Buy | ↗ |
| +0.08 | Accumulate | ↗ |
| -0.08..+0.08 | Hold | · |
| -0.25 | Reduce | ↘ |
| -0.55 | Sell | ▼ |
| -0.55- | Strong Sell | ▼ |

Composite score = 0.30 trend + 0.20 RSI + 0.18 order-book pressure +
0.22 volume + 0.10 intraday momentum. Confidence blends liquidity score,
component agreement, and history quality.
