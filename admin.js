// =============================================================
// UMBRA — ADMIN PANEL (#admin)
// =============================================================

async function renderAdmin() {
  const view = document.getElementById('adminView');
  if (!view) return;

  if (!fbReady()) {
    view.innerHTML = '<div class="empty-state" style="margin-top:40px"><div class="empty-icon">⏳</div>Connecting…</div>';
    setTimeout(renderAdmin, 300);
    return;
  }

  if (!state.admin.user) {
    renderAdminLogin();
  } else if (state.admin.selectedOrderId) {
    await renderAdminOrderDetail();
  } else {
    await renderAdminDashboard();
  }
}

function renderAdminLogin() {
  const view = document.getElementById('adminView');
  view.innerHTML =
    '<button class="back-btn" id="adminBackHome">← Back to home</button>' +
    '<div class="card">' +
      '<div class="card-title">◆ Admin Access ◆</div>' +
      '<h2 class="card-heading">Sign In</h2>' +
      '<div class="po-field">' +
        '<label class="po-label">Email</label>' +
        '<input type="email" id="adminEmail" placeholder="rahulshrm195@gmail.com" autocomplete="email">' +
      '</div>' +
      '<div class="po-field">' +
        '<label class="po-label">Password</label>' +
        '<input type="password" id="adminPassword" placeholder="••••••••" autocomplete="current-password">' +
      '</div>' +
      '<div class="po-error" id="adminLoginError"></div>' +
      '<button class="btn" id="adminSignInBtn">Sign In</button>' +
    '</div>';

  document.getElementById('adminBackHome').addEventListener('click', () => navigateTo(''));
  document.getElementById('adminSignInBtn').addEventListener('click', adminLoginSubmit);
  ['adminEmail', 'adminPassword'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); adminLoginSubmit(); }
    });
  });
  setTimeout(() => {
    const el = document.getElementById('adminEmail');
    if (el) el.focus();
  }, 100);
}

async function adminLoginSubmit() {
  const emailEl = document.getElementById('adminEmail');
  const passEl = document.getElementById('adminPassword');
  const errEl = document.getElementById('adminLoginError');
  const btn = document.getElementById('adminSignInBtn');

  const email = (emailEl.value || '').trim();
  const password = passEl.value || '';

  errEl.textContent = '';
  if (!email || !password) { errEl.textContent = 'Please enter both email and password.'; return; }

  btn.disabled = true;
  btn.textContent = 'Signing in…';

  try {
    await adminSignIn(email, password);
    // onAuthStateChanged listener in firebase.js will trigger re-render
  } catch (err) {
    console.error('Sign-in failed:', err);
    const code = (err.code || '').toLowerCase();
    if (code.includes('user-not-found') || code.includes('wrong-password') || code.includes('invalid-credential')) {
      errEl.textContent = 'Invalid email or password.';
    } else if (code.includes('too-many')) {
      errEl.textContent = 'Too many attempts. Please wait a few minutes.';
    } else {
      errEl.textContent = 'Could not sign in. Please try again.';
    }
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
}

async function adminLogout() {
  state.admin.user = null;
  state.admin.orders = [];
  state.admin.selectedOrderId = null;
  await adminSignOut();
  renderAdmin();
}

async function refreshAdminOrders() {
  try {
    state.admin.orders = await getAllOrders('all');
  } catch (err) {
    console.error('Failed to load orders:', err);
    toast('Could not load orders');
  }
}

async function renderAdminDashboard() {
  const view = document.getElementById('adminView');

  if (state.admin.orders.length === 0) {
    view.innerHTML = '<div class="empty-state" style="margin-top:40px"><div class="empty-icon">⏳</div>Loading orders…</div>';
    await refreshAdminOrders();
  }

  const orders = state.admin.orders;
  const filter = state.admin.statusFilter;
  const search = state.admin.searchQuery.toLowerCase().trim();

  // Stats
  const now = Date.now();
  const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
  const monthOrders = orders.filter(o => o.createdAt > monthAgo);
  const monthRevenue = monthOrders.reduce((s, o) => s + (o.pricing?.subtotal || 0), 0);
  const newCount = orders.filter(o => o.status === 'new').length;
  const avgOrder = monthOrders.length > 0 ? Math.round(monthRevenue / monthOrders.length) : 0;

  // Filter + search
  let filtered = orders;
  if (filter && filter !== 'all') {
    filtered = filtered.filter(o => o.status === filter);
  }
  if (search) {
    filtered = filtered.filter(o =>
      (o.customerName || '').toLowerCase().includes(search) ||
      (o.customerMobile || '').includes(search) ||
      (o.orderNo || '').toLowerCase().includes(search)
    );
  }

  const userEmail = state.admin.user?.email || 'admin';

  view.innerHTML =
    '<div class="admin-topbar">' +
      '<button class="back-btn" id="adminBackHome">← Home</button>' +
      '<div class="admin-user">' +
        '<span class="muted">Logged in as</span> <strong>' + escapeHtml(userEmail) + '</strong>' +
        '<button class="text-link" id="adminLogoutBtn" style="margin-left:10px">Logout</button>' +
      '</div>' +
    '</div>' +

    '<div class="card">' +
      '<div class="card-title">◆ Admin Dashboard ◆</div>' +
      '<h2 class="card-heading">Orders</h2>' +

      '<div class="admin-stats">' +
        '<div class="stat-box"><div class="stat-label">This Month</div><div class="stat-value">' + monthOrders.length + '</div><div class="stat-sub">orders</div></div>' +
        '<div class="stat-box"><div class="stat-label">Revenue</div><div class="stat-value">' + fmt(monthRevenue) + '</div><div class="stat-sub">last 30 days</div></div>' +
        '<div class="stat-box"><div class="stat-label">New</div><div class="stat-value">' + newCount + '</div><div class="stat-sub">awaiting action</div></div>' +
        '<div class="stat-box"><div class="stat-label">Avg Order</div><div class="stat-value">' + fmt(avgOrder) + '</div><div class="stat-sub">this month</div></div>' +
      '</div>' +

      '<div class="admin-filter-row">' +
        ['all','new','confirmed','in_production','ready','delivered','cancelled'].map(s => {
          const label = s === 'all' ? 'All' : STATUS_LABELS[s];
          const active = filter === s;
          return '<button class="filter-pill ' + (active ? 'active' : '') + '" data-filter="' + s + '">' + label + '</button>';
        }).join('') +
      '</div>' +

      '<div class="po-field" style="margin-bottom:14px">' +
        '<input type="text" id="adminSearch" placeholder="Search name / mobile / order #" value="' + escapeHtml(state.admin.searchQuery) + '">' +
      '</div>' +

      (filtered.length === 0 ?
        '<div class="empty-state"><div class="empty-icon">◇</div>No orders match.</div>' :
        '<div class="order-list">' + filtered.map(o => renderAdminOrderCard(o)).join('') + '</div>'
      ) +

      '<button class="btn btn-secondary" id="adminRefresh" style="margin-top:16px">↻ Refresh</button>' +
    '</div>';

  document.getElementById('adminBackHome').addEventListener('click', () => navigateTo(''));
  document.getElementById('adminLogoutBtn').addEventListener('click', adminLogout);
  document.getElementById('adminRefresh').addEventListener('click', async () => {
    await refreshAdminOrders();
    renderAdminDashboard();
  });

  // Filter pills
  view.querySelectorAll('.filter-pill').forEach(b => {
    b.addEventListener('click', () => {
      state.admin.statusFilter = b.dataset.filter;
      renderAdminDashboard();
    });
  });

  // Search
  const searchEl = document.getElementById('adminSearch');
  let searchTimer;
  searchEl.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.admin.searchQuery = searchEl.value;
      renderAdminDashboard();
    }, 300);
  });

  // Order card clicks
  view.querySelectorAll('.order-card').forEach(card => {
    card.addEventListener('click', () => {
      state.admin.selectedOrderId = card.dataset.id;
      renderAdminOrderDetail();
    });
  });
}

function renderAdminOrderCard(order) {
  const date = new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  const time = new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  return '<div class="order-card admin-order-card" data-id="' + order.id + '">' +
    '<div class="order-card-top">' +
      '<div class="order-card-no">' + escapeHtml(order.orderNo) + '</div>' +
      renderStatusBadge(order.status) +
    '</div>' +
    '<div class="admin-customer-line">' +
      '<strong>' + escapeHtml(order.customerName) + '</strong>' +
      '<span class="muted"> · ' + escapeHtml(displayMobile(order.customerMobile)) + '</span>' +
    '</div>' +
    '<div class="order-card-title">' + escapeHtml(comboTitle(order.spec)) + '</div>' +
    '<div class="order-card-meta">' +
      '<span>' + order.dimensions.Lft + ' ft × ' + order.dimensions.W + '"</span>' +
      '<span class="dot">·</span>' +
      '<span>' + date + ', ' + time + '</span>' +
    '</div>' +
    '<div class="order-card-price">' + fmt(order.pricing.subtotal) + '</div>' +
  '</div>';
}

async function renderAdminOrderDetail() {
  const view = document.getElementById('adminView');
  view.innerHTML = '<div class="empty-state" style="margin-top:40px"><div class="empty-icon">⏳</div>Loading order…</div>';

  let order;
  try {
    order = await getOrderById(state.admin.selectedOrderId);
  } catch (err) {
    console.error(err);
    view.innerHTML = '<div class="empty-state">Could not load order.</div>';
    return;
  }

  if (!order) {
    view.innerHTML = '<div class="empty-state">Order not found.</div>';
    return;
  }

  const date = new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const woodRate = order.spec.wood === 'Khair' ? CONFIG.RATES.khairPerCuft : CONFIG.RATES.teakPerCuft;
  const L = order.dimensions.L || (order.dimensions.Lft * 12);
  const W = order.dimensions.W;
  const H = order.spec.height;
  const volCuft = (L * W * H) / 1728;
  const sqIn = L * W;
  const surface = (L * W) + 2 * (L * H) + 2 * (W * H);
  const gst = order.pricing.subtotal * (CONFIG.GST_PERCENT / 100);

  view.innerHTML =
    '<button class="back-btn" id="adminBackList">← Back to orders</button>' +
    '<div class="card">' +
      '<div class="card-title">◆ Order Details ◆</div>' +
      '<h2 class="card-heading">' + escapeHtml(order.orderNo) + '</h2>' +

      '<div class="admin-section-title">CUSTOMER</div>' +
      '<div class="admin-section">' +
        '<div class="admin-row"><span>Name</span><strong>' + escapeHtml(order.customerName) + '</strong></div>' +
        '<div class="admin-row"><span>Mobile</span>' +
          '<a href="https://wa.me/' + order.customerMobile + '" target="_blank" class="big-call-link">' +
          '📱 ' + escapeHtml(displayMobile(order.customerMobile)) + '</a>' +
        '</div>' +
        '<div class="admin-row"><span>Placed</span><strong>' + date + '</strong></div>' +
      '</div>' +

      '<div class="admin-section-title">SPECIFICATION</div>' +
      '<div class="final-spec">' + escapeHtml(comboTitle(order.spec)) + '</div>' +
      '<div class="admin-row"><span>Size</span><strong>' + order.dimensions.Lft + ' ft × ' + order.dimensions.W + '" × ' + order.spec.height + '"</strong></div>' +

      '<div class="admin-section-title">PRICING</div>' +
      '<div class="final-line">' +
        '<div><span class="ln-label">' + order.spec.wood + ' wood</span>' +
        '<span class="ln-detail">' + volCuft.toFixed(3) + ' cuft @ ' + fmt(woodRate) + '/cuft</span></div>' +
        '<div class="ln-value">' + fmt(order.pricing.wood) + '</div>' +
      '</div>' +
      (order.spec.carve ?
        '<div class="final-line">' +
          '<div><span class="ln-label">CNC carving</span>' +
          '<span class="ln-detail">' + sqIn + ' sq in @ ' + fmt(CONFIG.RATES.cncPerSqIn) + '/sq in</span></div>' +
          '<div class="ln-value">' + fmt(order.pricing.cnc) + '</div>' +
        '</div>' : '') +
      (order.spec.polish ?
        '<div class="final-line">' +
          '<div><span class="ln-label">Polish</span>' +
          '<span class="ln-detail">' + surface + ' sq in @ ' + fmt(CONFIG.RATES.polishPerSqIn) + '/sq in</span></div>' +
          '<div class="ln-value">' + fmt(order.pricing.polish) + '</div>' +
        '</div>' : '') +
      '<div class="final-total">' +
        '<div class="tot-label">Subtotal</div>' +
        '<div class="tot-value">' + fmt(order.pricing.subtotal) + '</div>' +
      '</div>' +
      '<div class="final-internal" style="margin-top:8px">' +
        '<div class="final-internal-row"><span>+ GST ' + CONFIG.GST_PERCENT + '%</span><span>' + fmt(gst) + '</span></div>' +
        '<div class="final-internal-row heavy"><span>Customer pays</span><span>' + fmt(order.pricing.subtotal + gst) + '</span></div>' +
      '</div>' +

      (order.customerNote && order.customerNote.trim() ? (
        '<div class="admin-section-title">CUSTOMER NOTE</div>' +
        '<div class="customer-note-text" style="background:rgba(184,134,11,0.06); padding:10px 12px; border-left:3px solid var(--gold); border-radius:2px">' +
        escapeHtml(order.customerNote) + '</div>'
      ) : '') +

      '<div class="admin-section-title">STATUS</div>' +
      '<div class="admin-section">' +
        '<div class="admin-row"><span>Current</span>' + renderStatusBadge(order.status) + '</div>' +
        '<div class="admin-status-buttons">' +
          ['new','confirmed','in_production','ready','delivered','cancelled'].map(s => {
            if (s === order.status) return '';
            return '<button class="status-btn status-btn-' + s + '" data-status="' + s + '">→ ' + STATUS_LABELS[s] + '</button>';
          }).join('') +
        '</div>' +
      '</div>' +

      '<div class="admin-section-title">STATUS HISTORY</div>' +
      '<div class="admin-section">' +
        (order.statusHistory || []).map(h => {
          const when = new Date(h.at).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'2-digit', hour:'2-digit', minute:'2-digit' });
          return '<div class="status-history-row">' +
            renderStatusBadge(h.status) +
            '<span class="muted">' + when + '</span>' +
            (h.by ? '<span class="muted"> · ' + escapeHtml(h.by) + '</span>' : '') +
          '</div>';
        }).join('') +
      '</div>' +

      '<div class="admin-section-title">INTERNAL NOTES <span class="muted" style="font-weight:400">(not visible to customer)</span></div>' +
      '<div class="admin-section">' +
        '<textarea id="adminNotes" rows="3" placeholder="Add internal notes…">' + escapeHtml(order.internalNotes || '') + '</textarea>' +
        '<button class="btn btn-secondary" id="saveNotesBtn" style="margin-top:8px">Save Notes</button>' +
      '</div>' +

      '<div class="share-row" style="margin-top:18px">' +
        '<button class="share-btn" id="adminDownloadPDF">📄 Download PDF</button>' +
        '<a class="share-btn whatsapp" href="https://wa.me/' + order.customerMobile + '?text=' + encodeURIComponent('Hi ' + order.customerName + ', regarding your umbra order ' + order.orderNo) + '" target="_blank" style="text-decoration:none">📱 WhatsApp Customer</a>' +
      '</div>' +
    '</div>';

  document.getElementById('adminBackList').addEventListener('click', () => {
    state.admin.selectedOrderId = null;
    renderAdminDashboard();
  });

  view.querySelectorAll('.status-btn').forEach(b => {
    b.addEventListener('click', async () => {
      const newStatus = b.dataset.status;
      const confirmMsg = 'Change status to "' + STATUS_LABELS[newStatus] + '"?';
      if (!confirm(confirmMsg)) return;
      try {
        b.disabled = true;
        await updateOrderStatus(order.id, newStatus);
        toast('Status updated to ' + STATUS_LABELS[newStatus]);
        // Refresh in-memory cache + re-render
        state.admin.orders = state.admin.orders.map(o =>
          o.id === order.id ? { ...o, status: newStatus } : o
        );
        await renderAdminOrderDetail();
      } catch (err) {
        console.error(err);
        toast('Could not update status');
        b.disabled = false;
      }
    });
  });

  document.getElementById('saveNotesBtn').addEventListener('click', async () => {
    const btn = document.getElementById('saveNotesBtn');
    const notes = document.getElementById('adminNotes').value;
    try {
      btn.disabled = true;
      btn.textContent = 'Saving…';
      await updateOrderNotes(order.id, notes);
      toast('Notes saved');
      btn.textContent = 'Save Notes';
      btn.disabled = false;
    } catch (err) {
      console.error(err);
      toast('Could not save notes');
      btn.textContent = 'Save Notes';
      btn.disabled = false;
    }
  });

  document.getElementById('adminDownloadPDF').addEventListener('click', () => {
    const doc = buildOrderPDF(order);
    sharePDF(doc, order.orderNo + '.pdf', 'Umbra order ' + order.orderNo);
  });
}
