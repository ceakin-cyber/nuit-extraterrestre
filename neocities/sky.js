/* sky.js - accurate flat star map background (no dome effect) */
(function () {
  var canvas = document.getElementById("sky");
  if (!canvas) return;

  var ctx = canvas.getContext("2d", { alpha: true });
  var statusEl = document.getElementById("skyStatus");

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg;
  }

  // Make canvas visible behind content
  // (CSS must set #sky { z-index:0 } and .container { z-index:1 })
  function resize() {
    var dpr = window.devicePixelRatio || 1;
    if (dpr < 1) dpr = 1;
    if (dpr > 2) dpr = 2;

    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = "100vw";
    canvas.style.height = "100vh";

    // draw in CSS pixels
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  resize();
  window.addEventListener("resize", function () {
    resize();
    requestDraw();
  });

  // Observer (default Orlando-ish)
  var observer = { lat: 28.6, lon: -81.3 };

  var latInput = document.getElementById("skyLat");
var lonInput = document.getElementById("skyLon");
var applyBtn = document.getElementById("skyApply");
var geoBtn = document.getElementById("skyGeo");

function setObserver(lat, lon) {
  if (!isFinite(lat) || !isFinite(lon)) return;
  observer.lat = lat;
  observer.lon = lon;
  requestDraw();
}

if (applyBtn) {
  applyBtn.addEventListener("click", function () {
    var lat = parseFloat(latInput ? latInput.value : "");
    var lon = parseFloat(lonInput ? lonInput.value : "");
    setObserver(lat, lon);

    // visible proof
    if (statusEl) statusEl.textContent = "sky: location set to lat " + lat + ", lon " + lon;
  });
}

if (geoBtn) {
  geoBtn.addEventListener("click", function () {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        var lat = pos.coords.latitude;
        var lon = pos.coords.longitude;
        if (latInput) latInput.value = String(lat);
        if (lonInput) lonInput.value = String(lon);
        setObserver(lat, lon);
        if (statusEl) statusEl.textContent = "sky: using your location";
      },
      function () {
        if (statusEl) statusEl.textContent = "sky: location denied";
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  });
}

  function degToRad(d) { return d * Math.PI / 180; }
  function radToDeg(r) { return r * 180 / Math.PI; }

  function siderealTimeDeg(date, lonDeg) {
    var JD = date.getTime() / 86400000 + 2440587.5;
    var T = (JD - 2451545.0) / 36525.0;
    var GST =
      280.46061837 +
      360.98564736629 * (JD - 2451545) +
      0.000387933 * T * T -
      (T * T * T) / 38710000;

    var LST = (GST + lonDeg) % 360;
    if (LST < 0) LST += 360;
    return LST;
  }

  function raDecToAltAz(raDeg, decDeg, date, latDeg, lonDeg) {
    var LST = siderealTimeDeg(date, lonDeg);
    var HA = (LST - raDeg) % 360;
    if (HA < 0) HA += 360;

    var ha = degToRad(HA);
    var dec = degToRad(decDeg);
    var lat = degToRad(latDeg);

    var sinAlt =
      Math.sin(dec) * Math.sin(lat) +
      Math.cos(dec) * Math.cos(lat) * Math.cos(ha);

    var alt = Math.asin(sinAlt);

    var y = -Math.sin(ha) * Math.cos(dec);
    var x =
      Math.sin(dec) * Math.cos(lat) -
      Math.cos(dec) * Math.sin(lat) * Math.cos(ha);

    var az = Math.atan2(y, x);
    if (az < 0) az += Math.PI * 2;

    return { alt: alt, az: az };
  }

  // Flat map: az across width, alt up height (no dome projection)
  function altAzToXY(altRad, azRad, w, h) {
    var altDeg = radToDeg(altRad);
    var azDeg = radToDeg(azRad);

    if (altDeg < 0) altDeg = 0;
    if (altDeg > 90) altDeg = 90;

    var x = (azDeg / 360) * w;
    var y = h - (altDeg / 90) * h;

    return { x: x, y: y };
  }

  function magToRadius(mag) {
    var r = 2.8 - (mag * 0.28);
    if (r < 0.9) r = 0.9;
    if (r > 2.6) r = 2.6;
    return r;
  }

  function fetchText(url) {
    return fetch(url, { cache: "no-store" }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.text();
    });
  }

  // VERY robust parser:
  // - works for JSON arrays
  // - works for "var something = [ ... ];"
  // - works even if file has extra JS around it by extracting the biggest [...] block
function parseCatalog(text) {
  var s = (text || "").trim();

  // Extract the largest [ ... ] block (the star array)
  var first = s.indexOf("[");
  var last = s.lastIndexOf("]");
  if (first === -1 || last === -1 || last <= first) {
    throw new Error("no array block found");
  }

  var block = s.slice(first, last + 1);

  // IMPORTANT:
  // Use JS evaluation instead of JSON.parse so it tolerates trailing commas, etc.
  // This returns the actual array.
  // eslint-disable-next-line no-new-func
  var arr = new Function("return " + block + ";")();

  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error("catalog array empty");
  }
  return arr;
}

  // If catalog fails, we still draw a visible test pattern so you know canvas works.
  function drawFallbackTest() {
    var w = window.innerWidth;
    var h = window.innerHeight;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#ffffff";

    for (var i = 0; i < 200; i++) {
      var x = (i * 97) % w;
      var y = (i * 57) % h;
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  var stars = null;
  var drawQueued = false;

  function requestDraw() {
    if (drawQueued) return;
    drawQueued = true;
    requestAnimationFrame(function () {
      drawQueued = false;
      draw();
    });
  }

  function draw() {
    if (!stars) return;

    var w = window.innerWidth;
    var h = window.innerHeight;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#ffffff";

    var now = new Date();
    var drawn = 0;

    for (var i = 0; i < stars.length; i++) {
      var row = stars[i];

      // expected: [HIP, Vmag, RAdeg, DEdeg, ...]
      var mag = row[1];
      var raDeg = row[2];
      var decDeg = row[3];

      var aa = raDecToAltAz(raDeg, decDeg, now, observer.lat, observer.lon);
      if (aa.alt <= 0) continue;

      var p = altAzToXY(aa.alt, aa.az, w, h);
      var r = magToRadius(mag);

      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      drawn++;
    }

    setStatus("sky: OK — stars drawn: " + drawn);
  }

  // Load catalog (LOCAL ONLY; avoids CORS surprises)
  // Put hipparcos_6.5_concise.js in your Neocities root.
  var localUrl = "/hipparcos_6.5_concise.js";

  setStatus("sky: loading catalog " + localUrl);

  fetchText(localUrl)
    .then(function (text) {
      stars = parseCatalog(text);
      if (!Array.isArray(stars) || !stars.length) throw new Error("empty catalog");
      setStatus("sky: catalog loaded — total rows: " + stars.length);
      requestDraw();
      setInterval(requestDraw, 2000);
    })
    .catch(function (e) {
      setStatus("sky: FAIL — catalog not loading/parsing. showing test stars");
      drawFallbackTest();
    });
})();