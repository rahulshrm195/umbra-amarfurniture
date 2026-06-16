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
  } else if (state.admin.selectedInquiryId) {
    await renderAdminInquiryDetail();
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
    const [orders, inquiries] = await Promise.all([
      getAllOrders('all'),
      getAllInquiries('all'),
    ]);
    state.admin.orders = orders;
    state.admin.inquiries = inquiries;
  } catch (err) {
    console.error('Failed to load admin data:', err);
    toast('Could not load data');
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

    '<div class="admin-tabs">' +
      '<button class="admin-tab ' + (state.admin.activeTab === 'orders' ? 'active' : '') + '" data-tab="orders">📦 Orders</button>' +
      '<button class="admin-tab ' + (state.admin.activeTab === 'inquiries' ? 'active' : '') + '" data-tab="inquiries">📋 Enquiries</button>' +
    '</div>' +

    '<div class="card">' +
      '<div class="card-title">◆ Admin Dashboard ◆</div>' +
      '<h2 class="card-heading">' + (state.admin.activeTab === 'orders' ? 'Orders' : 'Enquiries') + '</h2>' +

      (state.admin.activeTab === 'orders' ? (
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
        )
      ) : renderInquiriesTab()) +

      '<button class="btn btn-secondary" id="adminRefresh" style="margin-top:16px">↻ Refresh</button>' +
    '</div>';

  document.getElementById('adminBackHome').addEventListener('click', () => navigateTo(''));
  document.getElementById('adminLogoutBtn').addEventListener('click', adminLogout);
  document.getElementById('adminRefresh').addEventListener('click', async () => {
    state.admin.orders = [];
    state.admin.inquiries = [];
    await refreshAdminOrders();
    renderAdminDashboard();
  });

  // Tab switching
  view.querySelectorAll('.admin-tab').forEach(b => {
    b.addEventListener('click', () => {
      state.admin.activeTab = b.dataset.tab;
      renderAdminDashboard();
    });
  });

  // Filter pills (orders only)
  if (state.admin.activeTab === 'orders') {
    view.querySelectorAll('.filter-pill').forEach(b => {
      b.addEventListener('click', () => {
        state.admin.statusFilter = b.dataset.filter;
        renderAdminDashboard();
      });
    });

    // Search (orders)
    const searchEl = document.getElementById('adminSearch');
    if (searchEl) {
      let searchTimer;
      searchEl.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          state.admin.searchQuery = searchEl.value;
          renderAdminDashboard();
        }, 300);
      });
    }

    // Order card clicks
    view.querySelectorAll('.order-card').forEach(card => {
      card.addEventListener('click', () => {
        state.admin.selectedOrderId = card.dataset.id;
        renderAdminOrderDetail();
      });
    });
  } else {
    // Inquiry tab wiring
    const inqSearch = document.getElementById('inqSearch');
    if (inqSearch) {
      let inqTimer;
      inqSearch.addEventListener('input', () => {
        clearTimeout(inqTimer);
        inqTimer = setTimeout(() => {
          state.admin.inquirySearchQuery = inqSearch.value;
          renderAdminDashboard();
        }, 300);
      });
    }
    view.querySelectorAll('.inq-filter-pill').forEach(b => {
      b.addEventListener('click', () => {
        state.admin.inquiryStatusFilter = b.dataset.filter;
        renderAdminDashboard();
      });
    });
    view.querySelectorAll('.inquiry-card').forEach(card => {
      card.addEventListener('click', () => {
        state.admin.selectedInquiryId = card.dataset.id;
        renderAdminInquiryDetail();
      });
    });
  }
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

// =============================================================
// ADMIN — ENQUIRIES TAB
// =============================================================

const INQUIRY_STATUS_LABELS = {
  new: 'New',
  contacted: 'Contacted',
  converted: 'Converted',
  lost: 'Lost',
};

function renderInquiriesTab() {
  const inquiries = state.admin.inquiries;
  const filter = state.admin.inquiryStatusFilter;
  const search = state.admin.inquirySearchQuery.toLowerCase().trim();

  // Stats
  const newCount = inquiries.filter(i => i.status === 'new').length;
  const contactedCount = inquiries.filter(i => i.status === 'contacted').length;
  const convertedCount = inquiries.filter(i => i.status === 'converted').length;
  const lostCount = inquiries.filter(i => i.status === 'lost').length;

  // Filter + search
  let filtered = inquiries;
  if (filter && filter !== 'all') {
    filtered = filtered.filter(i => i.status === filter);
  }
  if (search) {
    filtered = filtered.filter(i =>
      (i.customerName || '').toLowerCase().includes(search) ||
      (i.customerMobile || '').includes(search) ||
      (i.linkedOrderNo || '').toLowerCase().includes(search)
    );
  }

  return (
    '<div class="admin-stats">' +
      '<div class="stat-box"><div class="stat-label">New</div><div class="stat-value">' + newCount + '</div><div class="stat-sub">need follow-up</div></div>' +
      '<div class="stat-box"><div class="stat-label">Contacted</div><div class="stat-value">' + contactedCount + '</div><div class="stat-sub">in progress</div></div>' +
      '<div class="stat-box"><div class="stat-label">Converted</div><div class="stat-value">' + convertedCount + '</div><div class="stat-sub">became orders</div></div>' +
      '<div class="stat-box"><div class="stat-label">Lost</div><div class="stat-value">' + lostCount + '</div><div class="stat-sub">did not buy</div></div>' +
    '</div>' +

    '<div class="admin-filter-row">' +
      ['all', 'new', 'contacted', 'converted', 'lost'].map(s => {
        const label = s === 'all' ? 'All' : INQUIRY_STATUS_LABELS[s];
        const active = filter === s;
        return '<button class="inq-filter-pill filter-pill ' + (active ? 'active' : '') + '" data-filter="' + s + '">' + label + '</button>';
      }).join('') +
    '</div>' +

    '<div class="po-field" style="margin-bottom:14px">' +
      '<input type="text" id="inqSearch" placeholder="Search name / mobile" value="' + escapeHtml(state.admin.inquirySearchQuery) + '">' +
    '</div>' +

    (filtered.length === 0 ?
      '<div class="empty-state"><div class="empty-icon">◇</div>' +
        (inquiries.length === 0 ? 'No enquiries yet. When customers add combos to cart, they appear here.' : 'No enquiries match.') +
      '</div>' :
      '<div class="order-list">' + filtered.map(i => renderInquiryCard(i)).join('') + '</div>'
    )
  );
}

function renderInquiryCard(inq) {
  const date = new Date(inq.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const comboCount = (inq.combos || []).length;
  const topCombo = inq.combos && inq.combos[0] ? inq.combos[0] : null;

  return '<div class="inquiry-card order-card" data-id="' + inq.id + '">' +
    '<div class="order-card-top">' +
      '<div class="order-card-no">ENQ · ' + date + '</div>' +
      renderInquiryStatusBadge(inq.status) +
    '</div>' +
    '<div class="admin-customer-line">' +
      '<strong>' + escapeHtml(inq.customerName) + '</strong>' +
      '<span class="muted"> · ' + escapeHtml(displayMobile(inq.customerMobile)) + '</span>' +
    '</div>' +
    '<div class="order-card-title">' +
      (topCombo ? escapeHtml(topCombo.title || comboTitle(topCombo)) : '—') +
      (comboCount > 1 ? ' <span class="muted">+' + (comboCount - 1) + ' more</span>' : '') +
    '</div>' +
    (inq.dimensions ?
      '<div class="order-card-meta">' +
        '<span>' + inq.dimensions.Lft + ' ft × ' + inq.dimensions.W + '"</span>' +
        (topCombo && topCombo.pricing ? '<span class="dot">·</span><span>' + fmt(topCombo.pricing.subtotal) + '</span>' : '') +
      '</div>' : '') +
    (inq.linkedOrderNo ?
      '<div class="inq-linked-order">✓ Order: ' + escapeHtml(inq.linkedOrderNo) + '</div>' : '') +
  '</div>';
}

function renderInquiryStatusBadge(status) {
  const label = INQUIRY_STATUS_LABELS[status] || status;
  return '<span class="status-badge inq-status-' + status + '">' + label + '</span>';
}

async function renderAdminInquiryDetail() {
  const view = document.getElementById('adminView');
  view.innerHTML = '<div class="empty-state" style="margin-top:40px"><div class="empty-icon">⏳</div>Loading enquiry…</div>';

  let inq;
  try {
    const SDK = window.firebaseSDK;
    const docRef = SDK.doc(_db, INQUIRY_COLLECTION, state.admin.selectedInquiryId);
    const snap = await SDK.getDoc(docRef);
    if (!snap.exists()) throw new Error('Not found');
    inq = { id: snap.id, ...snap.data() };
  } catch (err) {
    view.innerHTML = '<div class="empty-state">Could not load enquiry.</div>';
    return;
  }

  const date = new Date(inq.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const combos = inq.combos || [];

  view.innerHTML =
    '<button class="back-btn" id="inqBackList">← Back to enquiries</button>' +
    '<div class="card">' +
      '<div class="card-title">◆ Enquiry Details ◆</div>' +
      '<h2 class="card-heading">' + escapeHtml(inq.customerName) + '</h2>' +

      '<div class="admin-section-title">CUSTOMER</div>' +
      '<div class="admin-section">' +
        '<div class="admin-row"><span>Name</span><strong>' + escapeHtml(inq.customerName) + '</strong></div>' +
        '<div class="admin-row"><span>Mobile</span>' +
          '<a href="https://wa.me/' + inq.customerMobile + '" target="_blank" class="big-call-link">' +
          '📱 ' + escapeHtml(displayMobile(inq.customerMobile)) + '</a>' +
        '</div>' +
        '<div class="admin-row"><span>Enquired on</span><strong>' + date + '</strong></div>' +
        (inq.dimensions ? '<div class="admin-row"><span>Size</span><strong>' + inq.dimensions.Lft + ' ft × ' + inq.dimensions.W + '"</strong></div>' : '') +
      '</div>' +

      '<div class="admin-section-title">COMBOS THEY LOOKED AT (' + combos.length + ')</div>' +
      '<div class="inq-combos">' +
        combos.map((c, i) => {
          const title = c.title || comboTitle(c);
          const price = c.pricing ? fmt(c.pricing.subtotal) : '—';
          return '<div class="inq-combo-row">' +
            '<div class="inq-combo-num">' + (i + 1) + '</div>' +
            '<div class="inq-combo-body">' +
              '<div class="inq-combo-title">' + escapeHtml(title) + '</div>' +
              (c.pricing ? (
                '<div class="inq-combo-breakdown">' +
                  'Wood: ' + fmt(c.pricing.wood) +
                  (c.carve ? ' · CNC: ' + fmt(c.pricing.cnc) : '') +
                  (c.polish ? ' · Polish: ' + fmt(c.pricing.polish) : '') +
                '</div>'
              ) : '') +
            '</div>' +
            '<div class="inq-combo-price">' + price + '</div>' +
            '<button class="btn-convert-this" data-idx="' + i + '">Convert this →</button>' +
          '</div>';
        }).join('') +
      '</div>' +

      '<div class="admin-section-title">STATUS</div>' +
      '<div class="admin-section">' +
        '<div class="admin-row"><span>Current</span>' + renderInquiryStatusBadge(inq.status) + '</div>' +
        (inq.linkedOrderNo ? '<div class="admin-row"><span>Linked Order</span><strong>' + escapeHtml(inq.linkedOrderNo) + '</strong></div>' : '') +
        '<div class="admin-status-buttons">' +
          ['new', 'contacted', 'converted', 'lost'].map(s => {
            if (s === inq.status) return '';
            return '<button class="status-btn" data-status="' + s + '">→ ' + INQUIRY_STATUS_LABELS[s] + '</button>';
          }).join('') +
        '</div>' +
      '</div>' +

      '<div class="admin-section-title">STATUS HISTORY</div>' +
      '<div class="admin-section">' +
        (inq.statusHistory || []).map(h => {
          const when = new Date(h.at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
          return '<div class="status-history-row">' +
            renderInquiryStatusBadge(h.status) +
            '<span class="muted">' + when + '</span>' +
            (h.by ? '<span class="muted"> · ' + escapeHtml(h.by) + '</span>' : '') +
          '</div>';
        }).join('') +
      '</div>' +

      '<div class="admin-section-title">INTERNAL NOTES <span class="muted" style="font-weight:400">(not visible to customer)</span></div>' +
      '<div class="admin-section">' +
        '<textarea id="inqNotes" rows="3" placeholder="Add follow-up notes…">' + escapeHtml(inq.internalNotes || '') + '</textarea>' +
        '<button class="btn btn-secondary" id="saveInqNotesBtn" style="margin-top:8px">Save Notes</button>' +
      '</div>' +

      '<div class="share-row" style="margin-top:18px">' +
        '<a class="share-btn whatsapp" href="https://wa.me/' + inq.customerMobile + '?text=' + encodeURIComponent('Hello ' + inq.customerName + ', this is Amar Furniture Nashik. Regarding your umbra enquiry…') + '" target="_blank" style="text-decoration:none">📱 WhatsApp Customer</a>' +
      '</div>' +
    '</div>' +

    // Convert to Order modal (hidden)
    '<div id="convertModal" class="modal-backdrop"></div>';

  document.getElementById('inqBackList').addEventListener('click', () => {
    state.admin.selectedInquiryId = null;
    state.admin.activeTab = 'inquiries';
    renderAdminDashboard();
  });

  // Status change buttons
  view.querySelectorAll('.status-btn').forEach(b => {
    b.addEventListener('click', async () => {
      const newStatus = b.dataset.status;
      if (!confirm('Change status to "' + INQUIRY_STATUS_LABELS[newStatus] + '"?')) return;
      try {
        b.disabled = true;
        await updateInquiryStatus(inq.id, newStatus);
        toast('Status updated');
        state.admin.selectedInquiryId = inq.id;
        renderAdminInquiryDetail();
      } catch (err) {
        toast('Could not update status');
        b.disabled = false;
      }
    });
  });

  // Save notes
  document.getElementById('saveInqNotesBtn').addEventListener('click', async () => {
    const btn = document.getElementById('saveInqNotesBtn');
    const notes = document.getElementById('inqNotes').value;
    try {
      btn.disabled = true;
      btn.textContent = 'Saving…';
      await updateInquiryNotes(inq.id, notes);
      toast('Notes saved');
      btn.textContent = 'Save Notes';
      btn.disabled = false;
    } catch (err) {
      toast('Could not save notes');
      btn.textContent = 'Save Notes';
      btn.disabled = false;
    }
  });

  // Convert this combo to order buttons
  view.querySelectorAll('.btn-convert-this').forEach(b => {
    b.addEventListener('click', () => {
      const idx = parseInt(b.dataset.idx);
      const selectedCombo = combos[idx];
      openConvertToOrderModal(inq, selectedCombo);
    });
  });
}

function openConvertToOrderModal(inq, selectedCombo) {
  const modal = document.getElementById('convertModal');
  const title = selectedCombo.title || comboTitle(selectedCombo);
  const price = selectedCombo.pricing ? fmt(selectedCombo.pricing.subtotal) : '—';

  modal.innerHTML =
    '<div class="modal">' +
      '<div class="modal-title">Convert to Order</div>' +
      '<div class="modal-text">This will create a confirmed order for:</div>' +
      '<div class="inq-combo-title" style="font-size:17px; color:var(--wood-dark); margin:10px 0 4px">' + escapeHtml(title) + '</div>' +
      '<div class="muted" style="margin-bottom:16px">' +
        (inq.dimensions ? inq.dimensions.Lft + ' ft × ' + inq.dimensions.W + '" · ' : '') + price +
      '</div>' +
      '<div class="po-hint" style="margin-bottom:16px">Customer: <strong>' + escapeHtml(inq.customerName) + '</strong> · ' + escapeHtml(displayMobile(inq.customerMobile)) + '</div>' +
      '<div class="po-error" id="convertError"></div>' +
      '<div class="btn-row">' +
        '<button class="btn btn-secondary" id="convertCancel">Cancel</button>' +
        '<button class="btn" id="convertConfirm">Create Order →</button>' +
      '</div>' +
    '</div>';

  modal.classList.add('active');
  modal.addEventListener('click', e => { if (e.target === modal) closeConvertModal(); });

  document.getElementById('convertCancel').addEventListener('click', closeConvertModal);
  document.getElementById('convertConfirm').addEventListener('click', async () => {
    const btn = document.getElementById('convertConfirm');
    const errEl = document.getElementById('convertError');
    btn.disabled = true;
    btn.textContent = 'Creating…';
    try {
      const order = await convertInquiryToOrder(inq.id, selectedCombo, inq.dimensions);
      closeConvertModal();
      toast('Order ' + order.orderNo + ' created!');
      // WhatsApp shop notification
      shareOrderToShop(order);
      // Refresh admin data and go back to inquiries
      state.admin.inquiries = [];
      state.admin.orders = [];
      state.admin.selectedInquiryId = null;
      state.admin.activeTab = 'orders';
      await refreshAdminOrders();
      renderAdminDashboard();
    } catch (err) {
      console.error('Convert failed:', err);
      errEl.textContent = 'Could not create order. Try again.';
      btn.disabled = false;
      btn.textContent = 'Create Order →';
    }
  });
}

function closeConvertModal() {
  const modal = document.getElementById('convertModal');
  if (modal) {
    modal.classList.remove('active');
    setTimeout(() => { modal.innerHTML = ''; }, 200);
  }
}
