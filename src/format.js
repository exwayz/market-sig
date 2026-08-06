export const fmt = {
  num(v, digits = 3) {
    if (v == null || Number.isNaN(v)) return "—";
    return Number(v).toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits,
    });
  },

  price(v, digits = 3) {
    if (v == null || Number.isNaN(v)) return "—";
    if (Math.abs(v) >= 1000) return Number(v).toLocaleString("en-US", { maximumFractionDigits: 1 });
    if (Math.abs(v) >= 10) return Number(v).toFixed(2);
    return Number(v).toFixed(digits);
  },

  pct(v, digits = 2) {
    if (v == null || Number.isNaN(v)) return "—";
    const s = v > 0 ? "+" : "";
    return `${s}${Number(v).toFixed(digits)}%`;
  },

  signed(v, digits = 3) {
    if (v == null || Number.isNaN(v)) return "—";
    const s = v > 0 ? "+" : "";
    return `${s}${Number(v).toFixed(digits)}`;
  },

  int(v) {
    if (v == null || Number.isNaN(v)) return "—";
    return Number(v).toLocaleString("en-US");
  },

  time(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  },

  date(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  },
};

export function signClass(v) {
  if (v == null || Number.isNaN(v)) return "num-flat";
  if (v > 0.0001) return "num-pos";
  if (v < -0.0001) return "num-neg";
  return "num-flat";
}

export function signalBadgeClass(sig) {
  if (sig > 0) return `sig-badge sig-${sig}`;
  if (sig < 0) return `sig-badge sig-neg-${Math.abs(sig)}`;
  return "sig-badge sig-0";
}

export function signalArrow(sig) {
  if (sig >= 2) return "▲";
  if (sig === 1) return "↗";
  if (sig === 0) return "·";
  if (sig === -1) return "↘";
  return "▼";
}
