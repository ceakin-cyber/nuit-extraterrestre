(() => {
  const mount = document.getElementById("issRadarMount");
  if (!mount) return;

  const DEFAULT_OBSERVER = { name: "NYC", lat: 40.7128, lon: -74.0060 };
  const MAX_KM = 3000; // radar edge clamp
  const ISS_URL = "https://api.wheretheiss.at/v1/satellites/25544";

  mount.innerHTML = `
    <div class="iss-radar" aria-label="ISS visitor radar">
      <div class="iss-radar__scope" id="issScope" role="img" aria-label="Radar scope showing ISS relative position">
        <div class="iss-radar__rings" aria-hidden="true"></div>
        <div class="iss-radar__cross" aria-hidden="true"></div>
        <div class="iss-radar__sweep" aria-hidden="true"></div>
        <div class="iss-radar__blip" id="issBlip" aria-hidden="true"></div>
      </div>

      <div class="iss-readout" aria-live="polite">
        <div class="iss-readout__row"><span class="iss-k">STATUS</span><span class="iss-v" id="issStatus">initializing…</span></div>
        <div class="iss-readout__row"><span class="iss-k">OBSERVER</span><span class="iss-v" id="issObserver">—</span></div>
        <div class="iss-readout__row"><span class="iss-k">ISS</span><span class="iss-v" id="issPos">—</span></div>
        <div class="iss-readout__row"><span class="iss-k">DIST</span><span class="iss-v" id="issDist">—</span></div>
        <div class="iss-readout__row"><span class="iss-k">BEARING</span><span class="iss-v" id="issBear">—</span></div>
        <div class="iss-readout__row"><span class="iss-k">UPDATED</span><span class="iss-v" id="issUpdated">—</span></div>

        <div class="iss-actions">
          <button class="iss-btn" type="button" id="issUseGeo">&gt; use my location</button>
          <button class="iss-btn" type="button" id="issUseDefault">&gt; use default (NYC)</button>
        </div>

        <div class="iss-note" id="issNote">Radar maps 0–3000 km. Farther pins near edge.</div>
      </div>
    </div>
  `;

  const el = (id) => document.getElementById(id);

  const scope = el("issScope");
  const blip = el("issBlip");
  const statusEl = el("issStatus");
  const observerEl = el("issObserver");
  const posEl = el("issPos");
  const distEl = el("issDist");
  const bearEl = el("issBear");
  const updEl = el("issUpdated");
  const noteEl = el("issNote");

  let observer = { ...DEFAULT_OBSERVER };
  let timer = null;

  const degToRad = (d) => (d * Math.PI) / 180;
  const radToDeg = (r) => (r * 180) / Math.PI;

  function fmtLatLon(lat, lon) {
    const ns = lat >= 0 ? "N" : "S";
    const ew = lon >= 0 ? "E" : "W";
    return `${Math.abs(lat).toFixed(3)}°${ns}, ${Math.abs(lon).toFixed(3)}°${ew}`;
  }

  function distanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = degToRad(lat2 - lat1);
    const dLon = degToRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(degToRad(lat1)) * Math.cos(degToRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  function bearingDeg(lat1, lon1, lat2, lon2) {
    const φ1 = degToRad(lat1);
    const φ2 = degToRad(lat2);
    const Δλ = degToRad(lon2 - lon1);

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x =
      Math.cos(φ1) * Math.sin(φ2) -
      Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

    const θ = Math.atan2(y, x);
    return (radToDeg(θ) + 360) % 360;
  }

  function compass(b) {
    const dirs = ["N","NE","E","SE","S","SW","W","NW"];
    return dirs[Math.round(b / 45) % 8];
  }

  function placeBlip(dist, bearing) {
    const rect = scope.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const maxR = Math.min(cx, cy) - 14;

    const r = Math.min(dist / MAX_KM, 1) * maxR;

    // bearing 0=N -> convert to screen angle
    const angle = degToRad(bearing - 90);
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);

    blip.style.left = `${x}px`;
    blip.style.top = `${y}px`;
    blip.classList.add("is-on");
  }

  async function fetchISS() {
    const res = await fetch(ISS_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function tick() {
    try {
      statusEl.textContent = "tracking…";
      observerEl.textContent = `${observer.name}: ${fmtLatLon(observer.lat, observer.lon)}`;

      const iss = await fetchISS();
      const issLat = iss.latitude;
      const issLon = iss.longitude;

      posEl.textContent = fmtLatLon(issLat, issLon);

      const dist = distanceKm(observer.lat, observer.lon, issLat, issLon);
      const bear = bearingDeg(observer.lat, observer.lon, issLat, issLon);

      distEl.textContent = `${Math.round(dist)} km`;
      bearEl.textContent = `${Math.round(bear)}° (${compass(bear)})`;
      updEl.textContent = new Date().toLocaleString();

      placeBlip(dist, bear);

      if (dist <= 800) noteEl.textContent = "> visitor nearby (within ~800 km)";
      else if (dist <= 1500) noteEl.textContent = "> visitor detected at mid-range";
      else noteEl.textContent = "> visitor detected at long range";
    } catch (e) {
      statusEl.textContent = "signal lost (retrying)";
      noteEl.textContent = "> telemetry error. endpoint unavailable or blocked.";
      blip.classList.remove("is-on");
    }
  }

  function start() {
    if (timer) clearInterval(timer);
    tick();
    timer = setInterval(tick, 10000);
  }

  function useDefault() {
    observer = { ...DEFAULT_OBSERVER };
    statusEl.textContent = "using default observer";
    start();
  }

  function useGeo() {
    if (!navigator.geolocation) {
      statusEl.textContent = "geolocation unsupported — using default";
      useDefault();
      return;
    }

    statusEl.textContent = "requesting location…";
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        observer = { name: "YOU", lat: pos.coords.latitude, lon: pos.coords.longitude };
        statusEl.textContent = "using your location";
        start();
      },
      () => {
        statusEl.textContent = "location denied — using default";
        useDefault();
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  }

  el("issUseGeo").addEventListener("click", useGeo);
  el("issUseDefault").addEventListener("click", useDefault);

  // Start silently in default mode (no prompts)
  useDefault();

  // On resize, reposition accurately
  window.addEventListener("resize", () => tick());
})();