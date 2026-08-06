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
The deployed default is the live Vercel backend (`market-sig-server.vercel.app`).

## Deploy

### GitHub Pages (frontend)

Pushes to `main` build the site via `.github/workflows/pages.yml` and publish
it to `https://exwayz.github.io/market-sig/`.

1. In the repo: **Settings → Pages → Build and deployment → Source**:
   select **GitHub Actions**.
2. The backend URL is baked into `src/api.js` by default; an optional
   repository variable named **`VITE_API`** (Settings → Secrets and
   variables → Actions → Variables) overrides it.
3. Push to `main` (or run the workflow manually).

Live: `https://exwayz.github.io/market-sig/` → `https://market-sig-server.vercel.app`

Local test of the exact production build:

```bash
VITE_BASE=/market-sig/ VITE_API=https://market-sig-server.vercel.app npm run build
npx vite preview
```

### Backend

Deployed to Vercel (`market-sig-server` project). The API is stateless: it
serves the committed JSON files under `data/`, refreshed hourly by the GitHub
Actions `collect-market-data` workflow. See the `market-sig-server` repo.


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
