// =============================================================
// UMBRA — PRICING & FORMAT HELPERS
// =============================================================

/* Calculate price for one combo at given dimensions */
function calcCombo(c, L, W) {
  const H = c.height;
  const volCuft = (L * W * H) / 1728;
  const woodRate = c.wood === 'Khair' ? CONFIG.RATES.khairPerCuft : CONFIG.RATES.teakPerCuft;
  const wood = volCuft * woodRate;

  let cnc = 0;
  if (c.carve) cnc = L * W * CONFIG.RATES.cncPerSqIn;

  let polish = 0, surface = 0;
  if (c.polish) {
    surface = (L * W) + 2 * (L * H) + 2 * (W * H);
    polish = Math.max(surface * CONFIG.RATES.polishPerSqIn, CONFIG.RATES.polishMin);
  }

  const subtotal = wood + cnc + polish;

  return {
    L, W, H, volCuft,
    wood: Math.round(wood),
    cnc: Math.round(cnc),
    polish: Math.round(polish),
    surface: Math.round(surface),
    subtotal: Math.round(subtotal),
    sqIn: L * W,
  };
}

/* Indian-format rupee string */
function fmt(n) {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

/* Human-readable combo title */
function comboTitle(c) {
  const h = c.height === 1.5 ? '1½"' : '1"';
  const parts = [c.wood, h];
  parts.push(c.carve ? 'Carved' : 'Plain');
  parts.push(c.polish ? 'Polished' : 'No Polish');
  return parts.join(' · ');
}

/* Read length (feet) + width (inches) from the input fields.
   Internally L is converted to inches for all math. */
function getDims() {
  const lEl = document.getElementById('length');
  const wEl = document.getElementById('width');
  if (!lEl || !wEl) return null;
  const Lft = parseFloat(lEl.value);
  const W = parseFloat(wEl.value);
  if (!Lft || !W || Lft <= 0 || W <= 0) return null;
  return { L: Lft * 12, W, Lft };
}

/* Mobile number normalization for India: returns 91XXXXXXXXXX or null */
function parseMobile(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10) return '91' + digits;
  if (digits.length === 11 && digits.startsWith('0')) return '91' + digits.slice(1);
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  if (digits.length >= CONFIG.MIN_MOBILE_DIGITS && digits.length <= CONFIG.MAX_MOBILE_DIGITS) return digits;
  return null;
}

/* Validate that mobile is acceptable for placing an order */
function isValidMobile(raw) {
  return parseMobile(raw) !== null;
}

/* Pretty-print a normalized mobile back for display */
function displayMobile(normalized) {
  if (!normalized) return '';
  if (normalized.length === 12 && normalized.startsWith('91')) {
    return '+91 ' + normalized.slice(2, 7) + ' ' + normalized.slice(7);
  }
  return '+' + normalized;
}

/* Warn if length seems entered in inches by mistake */
let lengthWarnedAt = 0;
function maybeWarnLength() {
  const lEl = document.getElementById('length');
  if (!lEl) return;
  const Lft = parseFloat(lEl.value);
  if (!Lft) return;
  if (Lft > 10 && Date.now() - lengthWarnedAt > 5000) {
    lengthWarnedAt = Date.now();
    toast('Length is in FEET, not inches — ' + Lft + ' ft seems too large');
  }
}

/* Generate a public-facing order number */
function generateOrderNo() {
  return CONFIG.brandShort + '-' + Date.now().toString(36).toUpperCase().slice(-6);
}

/* Device fingerprint for rate limiting (persistent local id) */
function getDeviceId() {
  let id = localStorage.getItem('umbra_device_id');
  if (!id) {
    id = 'd_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('umbra_device_id', id);
  }
  return id;
}

/* Check if device has hit the orders-per-hour limit */
function checkDeviceRateLimit() {
  const key = 'umbra_order_times';
  const now = Date.now();
  const hourAgo = now - 60 * 60 * 1000;
  let times = [];
  try {
    times = JSON.parse(localStorage.getItem(key) || '[]');
  } catch (e) { times = []; }
  times = times.filter(t => t > hourAgo);
  const allowed = times.length < CONFIG.MAX_ORDERS_PER_DEVICE_PER_HOUR;
  return { allowed, count: times.length, max: CONFIG.MAX_ORDERS_PER_DEVICE_PER_HOUR };
}

function recordDeviceOrder() {
  const key = 'umbra_order_times';
  const now = Date.now();
  const hourAgo = now - 60 * 60 * 1000;
  let times = [];
  try {
    times = JSON.parse(localStorage.getItem(key) || '[]');
  } catch (e) { times = []; }
  times = times.filter(t => t > hourAgo);
  times.push(now);
  localStorage.setItem(key, JSON.stringify(times));
}
