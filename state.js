// =============================================================
// UMBRA — STATE
// =============================================================
// All in-memory state lives here. Refresh wipes it (by design).
// =============================================================

const state = {
  // View / routing
  route: 'builder',        // 'builder' | 'orders' | 'admin'

  // Builder mode
  mode: 'customer',        // 'customer' | 'internal'
  internalUnlocked: false,

  // In-progress combo builder
  builder: { wood: null, height: null, carve: null, polish: null },

  // Comparison list (current session)
  combos: [],
  finalizedId: null,
  nextId: 1,
  quoteId: null,

  // Place Order modal
  placeOrderOpen: false,

  // Customer panel
  customer: {
    loggedInMobile: null,    // normalized 91XXXXXXXXXX
    orders: [],
    selectedOrderId: null,
  },

  // Admin panel
  admin: {
    user: null,              // Firebase user object when authenticated
    orders: [],
    selectedOrderId: null,
    statusFilter: 'all',
    searchQuery: '',
  },
};

/* ------- Toast (used everywhere) ------- */
function toast(msg, duration) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => t.classList.remove('show'), duration || 2400);
}

/* ------- Tiny HTML escape ------- */
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
