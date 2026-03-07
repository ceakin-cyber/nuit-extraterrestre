// moon.js (PATCHED: illumination parsing + correct (non-negative) age)
// Drop-in replacement for your current /moon.js
(() => {
  const phaseEl = document.getElementById("moonPhase");
  const illumEl = document.getElementById("moonIllum");
  const ageEl   = document.getElementById("moonAge");
  const nextEl  = document.getElementById("moonNext");
  const discEl  = document.getElementById("moonDisc");
  const noteEl  = document.getElementById("moonNote");
  const refreshBtn = document.getElementById("moonRefresh");
  const useGeoBtn  = document.getElementById("moonUseGeo");

  if (!phaseEl || !illumEl || !ageEl || !nextEl || !discEl || !noteEl) return;

  let observer = { name: "NYC", lat: 40.7128, lon: -74.0060 };

  function ymdLocal(d = new Date()) {
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; // YYYY-M-D
  }

  function addDays(dateObj, days) {
    const d = new Date(dateObj);
    d.setDate(d.getDate() + days);
    return d;
  }

  function parseUsnoUtc(yy, mm, dd, timeStr) {
    const [H, M] = String(timeStr).split(":").map((x) => parseInt(x, 10));
    return new Date(Date.UTC(yy, mm - 1, dd, H || 0, M || 0, 0));
  }

  function fmtLocal(dt) {
    return dt.toLocaleString(undefined, {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit"
    });
  }

  function setDiscFromIllum(frac01, waxing) {
    const t = Math.max(0, Math.min(1, frac01));
    const shadowScale = 1 - t;
    const maxShift = 55;
    const shift = (t * maxShift) * (waxing ? 1 : -1);

    discEl.style.setProperty("--shadow-scale", shadowScale.toFixed(3));
    discEl.style.setProperty("--shadow-shift", `${shift.toFixed(1)}px`);
  }

  function parseFracIllum(value) {
    // USNO sometimes returns numbers OR strings; handle both.
    // Examples we handle: 0.62, "0.62", "62", "62%", "0.62%"
    if (value == null) return null;

    if (typeof value === "number") {
      if (value > 1) return Math.max(0, Math.min(1, value / 100));
      return Math.max(0, Math.min(1, value));
    }

    const s = String(value).trim();
    const num = parseFloat(s.replace("%", ""));
    if (Number.isNaN(num)) return null;

    // If it had a percent sign OR looks like 2..100 => treat as percent.
    const isPercent = s.includes("%") || num > 1;
    const frac = isPercent ? (num / 100) : num;
    return Math.max(0, Math.min(1, frac));
  }

  async function fetchJSON(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function loadUSNO() {
    const now = new Date();
    const todayStr = ymdLocal(now);

    noteEl.textContent = "alignment: acquiring ephemeris…";

    // Current phase + illumination for "today" (observer coords)
    const rsttUrl =
      `https://aa.usno.navy.mil/api/rstt/oneday?date=${encodeURIComponent(todayStr)}` +
      `&coords=${encodeURIComponent(`${observer.lat},${observer.lon}`)}`;

    // IMPORTANT: moon/phases/date returns phases starting at the given date (forward).
    // So we query from ~35 days ago to ensure we include the LAST new moon before now.
    const start = addDays(now, -35);
    const phasesStartStr = ymdLocal(start);

    // Pull plenty of events to cover last + next primary phases.
    const phasesUrl =
      `https://aa.usno.navy.mil/api/moon/phases/date?date=${encodeURIComponent(phasesStartStr)}&nump=20`;

    const [rstt, phases] = await Promise.all([fetchJSON(rsttUrl), fetchJSON(phasesUrl)]);

    // rstt/oneday -> GeoJSON properties.data.curphase + fracillum
    const data = rstt?.properties?.data;
    if (!data) throw new Error("USNO rstt payload missing properties.data");

    const curPhase = data.curphase ?? "—";
    const fracIllum = parseFracIllum(data.fracillum);

    phaseEl.textContent = String(curPhase).replaceAll("_", " ");
    illumEl.textContent = (fracIllum == null) ? "—" : `${Math.round(fracIllum * 100)}%`;

    // moon/phases/date -> phasedata[] with UT time
    const list = Array.isArray(phases?.phasedata) ? phases.phasedata : [];
    const events = list
      .map((p) => ({ phase: p.phase, dt: parseUsnoUtc(p.year, p.month, p.day, p.time) }))
      .sort((a, b) => a.dt - b.dt);

    // Find last New Moon BEFORE now, and next event AFTER now.
    const next = events.find((e) => e.dt > now) || null;
    const lastNew = [...events].reverse().find((e) => e.dt <= now && String(e.phase).toLowerCase().includes("new")) || null;

    nextEl.textContent = next ? `${next.phase} @ ${fmtLocal(next.dt)}` : "—";

    if (lastNew) {
      const ageDays = (now - lastNew.dt) / 86400000;
      ageEl.textContent = `${ageDays.toFixed(1)} days`;
    } else {
      ageEl.textContent = "—";
    }

    // Waxing/waning:
    // If next is Full or First Quarter -> likely waxing; if next is Last Quarter or New -> waning.
    const nextName = next ? String(next.phase).toLowerCase() : "";
    const waxing = nextName.includes("first") || nextName.includes("full");

    if (fracIllum != null) setDiscFromIllum(fracIllum, waxing);

    noteEl.textContent = `source: USNO • observer: ${observer.name} • updated: ${fmtLocal(new Date())}`;
  }

  async function update() {
    try {
      await loadUSNO();
    } catch (e) {
      noteEl.textContent = "alignment: signal lost (refresh to retry)";
      console.error(e);
    }
  }

  refreshBtn?.addEventListener("click", update);

  useGeoBtn?.addEventListener("click", () => {
    if (!navigator.geolocation) {
      noteEl.textContent = "alignment: geolocation unsupported (using default)";
      return;
    }
    noteEl.textContent = "alignment: requesting location…";
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        observer = { name: "YOU", lat: pos.coords.latitude, lon: pos.coords.longitude };
        update();
      },
      () => {
        observer = { name: "NYC", lat: 40.7128, lon: -74.0060 };
        noteEl.textContent = "alignment: location denied (using default)";
        update();
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  });

  update();
})();