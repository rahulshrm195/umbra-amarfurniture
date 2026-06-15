// =============================================================
// UMBRA — ROUTER & APP INIT
// =============================================================

const ROUTES = ['', 'orders', 'admin'];

function getRouteFromHash() {
  const h = (window.location.hash || '').replace(/^#/, '').trim().toLowerCase();
  if (h === 'orders') return 'orders';
  if (h === 'admin') return 'admin';
  return '';
}

function navigateTo(route) {
  if (route === '') {
    if (window.location.hash) {
      history.pushState('', document.title, window.location.pathname + window.location.search);
    }
  } else {
    window.location.hash = '#' + route;
  }
  renderRoute();
}

function renderRoute() {
  const r = getRouteFromHash();
  state.route = r === '' ? 'builder' : r;

  const workspace = document.getElementById('workspaceView');
  const finalv = document.getElementById('finalView');
  const customerv = document.getElementById('customerView');
  const adminv = document.getElementById('adminView');

  // Hide all
  workspace.style.display = 'none';
  finalv.style.display = 'none';
  customerv.style.display = 'none';
  adminv.style.display = 'none';

  if (state.route === 'orders') {
    customerv.style.display = 'block';
    renderCustomerPanel();
  } else if (state.route === 'admin') {
    adminv.style.display = 'block';
    renderAdmin();
  } else {
    // Builder route — show workspace, or final view if a finalize is active
    if (state.finalizedId || state.placedOrder) {
      finalv.style.display = 'block';
      renderFinal();
    } else {
      workspace.style.display = 'block';
      renderList();
    }
  }

  // Update track-order link visibility
  updateHeaderLinks();
}

function updateHeaderLinks() {
  // Show "Track Order" only when on builder; show "Home" when elsewhere
  const trackLink = document.getElementById('trackOrderLink');
  if (trackLink) {
    if (state.route === 'builder') {
      trackLink.style.display = '';
      trackLink.textContent = 'Track Order →';
      trackLink.onclick = (e) => { e.preventDefault(); navigateTo('orders'); };
    } else {
      trackLink.style.display = '';
      trackLink.textContent = '← Home';
      trackLink.onclick = (e) => { e.preventDefault(); navigateTo(''); };
    }
  }
}

/* =============================================================
   MODE / PIN (internal pricing view) — unchanged
   ============================================================= */
function setMode(mode) {
  if (mode === 'internal' && !state.internalUnlocked) {
    showPinModal();
    return;
  }
  state.mode = mode;
  document.querySelectorAll('.mode-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.mode === mode);
  });
  if (state.finalizedId) renderFinal();
  else renderList();
}

function showPinModal() {
  document.getElementById('pinModal').classList.add('active');
  document.getElementById('pinInput').value = '';
  document.getElementById('pinError').textContent = '';
  setTimeout(() => document.getElementById('pinInput').focus(), 100);
}

function hidePinModal() {
  document.getElementById('pinModal').classList.remove('active');
}

function checkPin() {
  const v = document.getElementById('pinInput').value;
  if (v === CONFIG.PIN) {
    state.internalUnlocked = true;
    hidePinModal();
    setMode('internal');
    toast('Internal mode unlocked');
  } else {
    document.getElementById('pinError').textContent = 'Incorrect PIN';
    document.getElementById('pinInput').value = '';
  }
}

/* =============================================================
   INIT — runs once on DOMContentLoaded
   ============================================================= */
function initApp() {
  // Init Firebase early
  initFirebase();

  // Builder UI wiring
  buildBuilder();
  syncBuilderUI();

  // Mode tabs
  document.querySelectorAll('.mode-tab').forEach(t => {
    t.addEventListener('click', () => setMode(t.dataset.mode));
  });

  // Quick-pick sizes
  document.querySelectorAll('.quick-pick button[data-l]').forEach(b => {
    b.addEventListener('click', () => {
      document.getElementById('length').value = b.dataset.l;
      document.getElementById('width').value = b.dataset.w;
      updateBuilderPreview();
      renderList();
      if (state.finalizedId) renderFinal();
    });
  });

  // Length/width input changes
  ['length', 'width'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      if (id === 'length') maybeWarnLength();
      updateBuilderPreview();
      renderList();
      if (state.finalizedId) renderFinal();
    });
  });

  // Customer name change re-renders final if active
  document.getElementById('custName').addEventListener('input', () => {
    if (state.finalizedId) renderFinal();
  });

  // Add button
  document.getElementById('addBtn').addEventListener('click', addCombo);

  // PIN modal
  document.getElementById('pinSubmit').addEventListener('click', checkPin);
  document.getElementById('pinCancel').addEventListener('click', hidePinModal);
  document.getElementById('pinInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') checkPin();
    if (e.key === 'Escape') hidePinModal();
  });
  document.getElementById('pinModal').addEventListener('click', e => {
    if (e.target.id === 'pinModal') hidePinModal();
  });

  // Place Order modal — close on backdrop click
  document.getElementById('placeOrderModal').addEventListener('click', e => {
    if (e.target.id === 'placeOrderModal') closePlaceOrderModal();
  });

  // Hash router
  window.addEventListener('hashchange', renderRoute);
  renderRoute();
}

document.addEventListener('DOMContentLoaded', initApp);

/* Service worker for PWA */
if ('serviceWorker' in navigator) {
  const sw =
    "const CACHE='umbra-v2-' + Date.now();" +
    "self.addEventListener('install',e=>self.skipWaiting());" +
    "self.addEventListener('activate',e=>self.clients.claim());" +
    "self.addEventListener('fetch',e=>{" +
      "if(e.request.method!=='GET')return;" +
      "e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));" +
    "});";
  const url = URL.createObjectURL(new Blob([sw], { type: 'application/javascript' }));
  navigator.serviceWorker.register(url).catch(() => {});
}
