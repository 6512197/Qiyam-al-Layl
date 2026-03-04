
// ─────────────────────────────────────────────
//  STARS ANIMATION
// ─────────────────────────────────────────────
(function() {
  const canvas = document.getElementById('stars-canvas');
  const ctx = canvas.getContext('2d');
  let stars = [], W, H, raf;

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function initStars(n) {
    stars = [];
    for (let i = 0; i < n; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.4 + 0.2,
        alpha: Math.random() * 0.8 + 0.1,
        speed: Math.random() * 0.008 + 0.002,
        phase: Math.random() * Math.PI * 2,
        drift: (Math.random() - 0.5) * 0.08,
      });
    }
  }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    for (const s of stars) {
      const pulse = Math.sin(t * s.speed * 60 + s.phase);
      const a = s.alpha * (0.6 + 0.4 * pulse);
      s.x += s.drift;
      if (s.x < 0) s.x = W;
      if (s.x > W) s.x = 0;

      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(232,234,242,${a})`;
      ctx.fill();

      // sparkle cross for larger stars
      if (s.r > 1.2) {
        const len = s.r * 3 * (0.7 + 0.3 * pulse);
        ctx.strokeStyle = `rgba(245,228,160,${a * 0.4})`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(s.x - len, s.y); ctx.lineTo(s.x + len, s.y);
        ctx.moveTo(s.x, s.y - len); ctx.lineTo(s.x, s.y + len);
        ctx.stroke();
      }
    }
    raf = requestAnimationFrame(draw);
  }

  window.addEventListener('resize', () => { resize(); initStars(320); });
  resize();
  initStars(320);
  requestAnimationFrame(draw);
})();

// ─────────────────────────────────────────────
//  MOON PHASE
// ─────────────────────────────────────────────
function updateMoonPhase(date) {
  const d = date || new Date();
  // Simple moon phase approximation
  const known = new Date(2000, 0, 6, 18, 14, 0); // known new moon
  const diff = (d - known) / (1000 * 60 * 60 * 24);
  const cycle = 29.53058868;
  const phase = ((diff % cycle) + cycle) % cycle;
  const pct = phase / cycle;
  const names = ['New Moon','Waxing Crescent','First Quarter','Waxing Gibbous',
                  'Full Moon','Waning Gibbous','Last Quarter','Waning Crescent'];
  const idx = Math.round(pct * 8) % 8;
  document.getElementById('moon-phase-label').textContent = names[idx].toUpperCase().split(' ').join('\n');

  // adjust moon body illumination visually
  const illum = Math.sin(pct * Math.PI);
  const body = document.querySelector('.moon-body');
  body.style.boxShadow = `0 0 ${20 + illum*20}px ${5+illum*10}px rgba(201,168,76,${0.2+illum*0.3}), 0 0 80px 30px rgba(201,168,76,${0.05+illum*0.1})`;
}

// ─────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────
let state = {
  lat: null, lon: null,
  date: new Date(),
  method: 'MWL',
  highLat: 'NightMiddle',
  customAngle: 18,
  format: 12,
  result: null,
  countdownInterval: null,
};

const METHODS = {
  MWL:       { fajrAngle: 18,   name: 'Muslim World League',      ummalqura: false },
  ISNA:      { fajrAngle: 15,   name: 'ISNA — North America',     ummalqura: false },
  Egypt:     { fajrAngle: 19.5, name: 'Egyptian Authority',       ummalqura: false },
  UmmAlQura: { fajrAngle: 18.5, name: 'Umm al-Qura, Makkah',     ummalqura: true  }, // uses fixed 90min offset
  Karachi:   { fajrAngle: 18,   name: 'University of Karachi',    ummalqura: false },
  Custom:    { fajrAngle: 18,   name: 'Custom Angle',             ummalqura: false },
};

// ─────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────
(function init() {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth()+1).padStart(2,'0');
  const d = String(today.getDate()).padStart(2,'0');
  document.getElementById('date-input').value = `${y}-${m}-${d}`;
  updateMoonPhase(today);

  // City search
  const cityInput = document.getElementById('city-input');
  cityInput.addEventListener('input', debounce(handleCitySearch, 400));
  document.addEventListener('click', e => {
    if (!e.target.closest('.city-wrap')) hideSuggestions();
  });
})();

// ─────────────────────────────────────────────
//  CITY SEARCH (using nominatim)
// ─────────────────────────────────────────────
function debounce(fn, ms) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

async function handleCitySearch() {
  const q = document.getElementById('city-input').value.trim();
  if (q.length < 2) { hideSuggestions(); return; }
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1`;
    const r = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    const data = await r.json();
    showSuggestions(data);
  } catch(e) { hideSuggestions(); }
}

function showSuggestions(places) {
  const box = document.getElementById('city-suggestions');
  if (!places.length) { hideSuggestions(); return; }
  box.innerHTML = '';
  places.forEach(p => {
    const el = document.createElement('div');
    el.className = 'city-item';
    const name = p.display_name.split(',').slice(0,3).join(', ');
    el.textContent = name;
    el.onclick = () => {
      document.getElementById('lat-input').value = parseFloat(p.lat).toFixed(6);
      document.getElementById('lon-input').value = parseFloat(p.lon).toFixed(6);
      document.getElementById('city-input').value = name;
      hideSuggestions();
    };
    box.appendChild(el);
  });
  box.style.display = 'block';
}

function hideSuggestions() {
  document.getElementById('city-suggestions').style.display = 'none';
}

// ─────────────────────────────────────────────
//  GEOLOCATION
// ─────────────────────────────────────────────
function geolocate() {
  if (!navigator.geolocation) { showError('Geolocation not supported by this browser.'); return; }
  navigator.geolocation.getCurrentPosition(pos => {
    document.getElementById('lat-input').value = pos.coords.latitude.toFixed(6);
    document.getElementById('lon-input').value = pos.coords.longitude.toFixed(6);
    document.getElementById('city-input').value = 'Current Location';
  }, err => showError('Location access denied. Please enter coordinates manually.'));
}

// ─────────────────────────────────────────────
//  METHOD CHANGE
// ─────────────────────────────────────────────
function onMethodChange() {
  const v = document.getElementById('method-select').value;
  const row = document.getElementById('custom-angle-row');
  if (v === 'Custom') row.classList.add('visible');
  else row.classList.remove('visible');
}

// ─────────────────────────────────────────────
//  FORMAT TOGGLE
// ─────────────────────────────────────────────
function setFormat(f) {
  state.format = f;
  document.getElementById('fmt12').classList.toggle('active', f === 12);
  document.getElementById('fmt24').classList.toggle('active', f === 24);
  if (state.result) renderResult(state.result);
}

// ─────────────────────────────────────────────
//  CORE SOLAR CALCULATIONS
// ─────────────────────────────────────────────
function toRad(d) { return d * Math.PI / 180; }
function toDeg(r) { return r * 180 / Math.PI; }

/**
 * Calculate time when sun reaches a given negative elevation angle (below horizon).
 * Returns a Date or null if no solution.
 */
function sunAngleTime(date, lat, lon, angle, rising) {
  // Iterative refinement using SunCalc position
  const MS = 60000;
  const dateUTC = new Date(date);
  dateUTC.setUTCHours(rising ? 2 : 14, 0, 0, 0); // start near dawn/dusk

  for (let iter = 0; iter < 50; iter++) {
    const pos = SunCalc.getPosition(dateUTC, lat, lon);
    const elev = toDeg(pos.altitude);
    const target = -angle;
    const diff = elev - target;
    if (Math.abs(diff) < 0.01) return new Date(dateUTC);
    // Move time by estimated delta (sun moves ~15°/hr = 1°/4min)
    const dt = diff * 4 * MS * (rising ? -1 : 1);
    dateUTC.setTime(dateUTC.getTime() + dt);
  }
  return null;
}

/**
 * Get sunset (Maghrib) for given date/location.
 * Uses SunCalc's built-in sunset.
 */
function getMaghrib(date, lat, lon) {
  const times = SunCalc.getTimes(date, lat, lon);
  return times.sunset; // Official sunset = Maghrib
}

/**
 * Get Fajr time using angle method.
 * For Umm al-Qura: Fajr = Sunrise - 90 minutes.
 * Otherwise: angle below horizon at dawn.
 */
function getFajr(date, lat, lon, method, customAngle, highLat) {
  const methodDef = METHODS[method];
  const angle = method === 'Custom' ? customAngle : methodDef.fajrAngle;

  // Next calendar day for Fajr calculation
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);

  // Umm al-Qura special case
  if (method === 'UmmAlQura') {
    const sunTimes = SunCalc.getTimes(nextDay, lat, lon);
    const sunrise = sunTimes.sunrise;
    if (isNaN(sunrise)) return applyHighLatFajr(date, lat, lon, angle, highLat);
    return new Date(sunrise.getTime() - 90 * 60000);
  }

  // Angle-based Fajr
  let fajr = sunAngleTime(nextDay, lat, lon, angle, true);

  if (!fajr || isNaN(fajr)) {
    fajr = applyHighLatFajr(date, lat, lon, angle, highLat);
  } else {
    // Verify it's actually before sunrise
    const sunTimes = SunCalc.getTimes(nextDay, lat, lon);
    if (fajr >= sunTimes.sunrise) {
      fajr = applyHighLatFajr(date, lat, lon, angle, highLat);
    }
  }
  return fajr;
}

/**
 * High latitude adjustment methods when Fajr angle not reached naturally.
 */
function applyHighLatFajr(date, lat, lon, angle, method) {
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  const sunTimes = SunCalc.getTimes(nextDay, lat, lon);
  const sunrise = sunTimes.sunrise;
  const prevDay = new Date(date);
  const maghrib = getMaghrib(prevDay, lat, lon);

  if (isNaN(sunrise) || isNaN(maghrib)) return null;

  const nightDur = sunrise - maghrib;

  switch (method) {
    case 'NightMiddle':
      return new Date(sunrise.getTime() - nightDur / 2);
    case 'OneSeventh':
      return new Date(sunrise.getTime() - nightDur / 7);
    case 'AngleBased': {
      const portion = angle / 60;
      return new Date(sunrise.getTime() - nightDur * portion);
    }
    case 'None':
    default:
      return null;
  }
}

// ─────────────────────────────────────────────
//  MAIN CALCULATE
// ─────────────────────────────────────────────
function calculate() {
  hideError();

  const lat = parseFloat(document.getElementById('lat-input').value);
  const lon = parseFloat(document.getElementById('lon-input').value);
  if (isNaN(lat) || isNaN(lon)) { showError('Please enter a valid latitude and longitude.'); return; }
  if (lat < -90 || lat > 90) { showError('Latitude must be between -90° and 90°.'); return; }
  if (lon < -180 || lon > 180) { showError('Longitude must be between -180° and 180°.'); return; }

  const dateVal = document.getElementById('date-input').value;
  if (!dateVal) { showError('Please select a date.'); return; }

  const [y, mo, d] = dateVal.split('-').map(Number);
  const date = new Date(y, mo - 1, d, 12, 0, 0); // noon local

  const method = document.getElementById('method-select').value;
  const highLat = document.getElementById('highlat-select').value;
  const customAngle = parseFloat(document.getElementById('custom-angle').value) || 18;

  try {
    const maghrib = getMaghrib(date, lat, lon);
    const fajr = getFajr(date, lat, lon, method, customAngle, highLat);

    if (!maghrib || isNaN(maghrib)) {
      showError('Could not calculate Maghrib for this location/date. Possible polar anomaly.');
      return;
    }
    if (!fajr || isNaN(fajr)) {
      showError('Could not calculate Fajr for this location/date. Sun may not reach the required angle (polar region). Try a different high-latitude adjustment method.');
      return;
    }

    // Ensure Fajr is after Maghrib (next day)
    let fajrAdj = new Date(fajr);
    if (fajrAdj <= maghrib) {
      fajrAdj = new Date(fajrAdj.getTime() + 24 * 3600000);
    }

    const nightDuration = fajrAdj - maghrib; // ms
    const thirdDuration = nightDuration / 3;
    const lastThirdStart = new Date(fajrAdj.getTime() - thirdDuration);
    const islamicMidnight = new Date(maghrib.getTime() + nightDuration / 2);

    const methodAngle = method === 'Custom' ? customAngle : METHODS[method].fajrAngle;
    const methodName = METHODS[method].name;

    const warnings = [];
    if (Math.abs(lat) > 48) {
      warnings.push('⚠ High latitude detected. Prayer times may use adjusted calculation. Verify with a local authority.');
    }
    if (nightDuration < 4 * 3600000) {
      warnings.push('⚠ Night duration is unusually short (< 4 hours). This may occur during summer at high latitudes.');
    }

    state.result = {
      lat, lon, date, method, methodName, methodAngle, highLat,
      maghrib, fajr: fajrAdj, islamicMidnight, lastThirdStart,
      nightDuration, thirdDuration, warnings
    };

    updateMoonPhase(date);
    renderResult(state.result);
    document.getElementById('results').classList.add('visible');
    document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'start' });

    startCountdown();
  } catch(e) {
    showError('Calculation error: ' + e.message);
  }
}

// ─────────────────────────────────────────────
//  RENDER RESULT
// ─────────────────────────────────────────────
function renderResult(r) {
  const fmt = state.format;

  // Timezone
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const fmtTime = (d, show12h) => {
    const opts = {
      hour: '2-digit', minute: '2-digit',
      hour12: show12h === 12,
      timeZone: tz
    };
    return new Intl.DateTimeFormat('en-US', opts).format(d);
  };
  const fmtAmPm = (d) => {
    if (fmt === 24) return '';
    return new Intl.DateTimeFormat('en-US', { hour12: true, hour: 'numeric', timeZone: tz }).format(d).replace(/\d/g,'').trim();
  };

  // Hero
  const lt = fmtTime(r.lastThirdStart, fmt);
  const parts = lt.split(' ');
  if (fmt === 12 && parts.length > 1) {
    document.getElementById('last-third-time').textContent = parts[0];
    document.getElementById('last-third-ampm').textContent = parts[1];
  } else {
    document.getElementById('last-third-time').textContent = lt;
    document.getElementById('last-third-ampm').textContent = '';
  }
  document.getElementById('result-tz').textContent = tz;

  // Method badge
  const badgeWrap = document.getElementById('method-badge-wrap');
  badgeWrap.innerHTML = `<span class="method-badge">◈ ${r.methodName}${r.method !== 'UmmAlQura' ? ' · ' + r.methodAngle + '°' : ''}</span>`;

  // Times grid
  document.getElementById('val-maghrib').textContent = fmtTime(r.maghrib, fmt);
  document.getElementById('val-midnight').textContent = fmtTime(r.islamicMidnight, fmt);
  document.getElementById('val-lastthird').textContent = fmtTime(r.lastThirdStart, fmt);
  document.getElementById('val-fajr').textContent = fmtTime(r.fajr, fmt);

  // Duration
  const fmtDur = ms => {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}h ${m}m`;
  };
  document.getElementById('dur-total').textContent = fmtDur(r.nightDuration);
  document.getElementById('dur-third').textContent = fmtDur(r.thirdDuration);

  // Timeline bar
  const total = r.nightDuration;
  const t1 = r.thirdDuration / total * 100;
  const t2 = r.thirdDuration * 2 / total * 100;
  document.getElementById('t-first').style.cssText = `left:0;width:${t1}%`;
  document.getElementById('t-second').style.cssText = `left:${t1}%;width:${t1}%`;
  document.getElementById('t-last').style.cssText = `left:${t2}%;width:${100-t2}%`;

  document.getElementById('tl-maghrib').textContent = fmtTime(r.maghrib, fmt);
  document.getElementById('tl-fajr').textContent = fmtTime(r.fajr, fmt);

  // Warnings
  const warnEl = document.getElementById('warning-banner');
  if (r.warnings.length) {
    warnEl.innerHTML = r.warnings.join('<br>');
    warnEl.classList.add('visible');
  } else {
    warnEl.classList.remove('visible');
  }
}

// ─────────────────────────────────────────────
//  COUNTDOWN TIMER
// ─────────────────────────────────────────────
function startCountdown() {
  if (state.countdownInterval) clearInterval(state.countdownInterval);
  updateCountdown();
  state.countdownInterval = setInterval(updateCountdown, 1000);
}

function updateCountdown() {
  if (!state.result) return;
  const r = state.result;
  const now = new Date();
  const nowMs = now.getTime();

  let target = r.lastThirdStart.getTime();
  let fajrMs = r.fajr.getTime();

  // If last third already passed today, try adding 24h or show "in prayer time"
  const diff = target - nowMs;
  const fajrDiff = fajrMs - nowMs;

  const display = document.getElementById('countdown-display');
  const status = document.getElementById('countdown-status');
  const remaining = document.getElementById('dur-remaining');

  if (nowMs >= fajrMs) {
    display.textContent = '—';
    status.textContent = 'Fajr has passed. Calculate for the next night.';
    remaining.textContent = '—';
    updateNowMarker(r, nowMs);
    return;
  }

  if (diff > 0) {
    // Countdown to last third start
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    display.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    status.textContent = 'Until the last third of the night begins';
  } else {
    // In last third — count to Fajr
    const fd = fajrDiff;
    if (fd > 0) {
      const h = Math.floor(fd / 3600000);
      const m = Math.floor((fd % 3600000) / 60000);
      const s = Math.floor((fd % 60000) / 1000);
      display.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
      display.style.color = '#c9a84c';
      status.textContent = '✦ You are in the last third of the night — Until Fajr';
    }
  }

  // Remaining until Fajr
  if (fajrDiff > 0) {
    const h = Math.floor(fajrDiff / 3600000);
    const m = Math.floor((fajrDiff % 3600000) / 60000);
    remaining.textContent = `${h}h ${m}m`;
  } else {
    remaining.textContent = 'Passed';
  }

  updateNowMarker(r, nowMs);
}

function updateNowMarker(r, nowMs) {
  const marker = document.getElementById('now-marker');
  const start = r.maghrib.getTime();
  const end = r.fajr.getTime();
  if (nowMs < start || nowMs > end) { marker.style.display = 'none'; return; }
  const pct = (nowMs - start) / (end - start) * 100;
  marker.style.left = pct + '%';
  marker.style.display = 'block';
}

// ─────────────────────────────────────────────
//  UI HELPERS
// ─────────────────────────────────────────────
function showError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = '⚠ ' + msg;
  el.classList.add('visible');
}
function hideError() {
  document.getElementById('error-msg').classList.remove('visible');
}