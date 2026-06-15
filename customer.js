// =============================================================
// UMBRA — CUSTOMER PANEL (#orders)
// =============================================================

function renderCustomerPanel() {
  const view = document.getElementById('customerView');
  if (!view) return;

  // Try restoring login from sessionStorage
  if (!state.customer.loggedInMobile) {
    const saved = sessionStorage.getItem('umbra_customer_mobile');
    if (saved) {
      state.customer.loggedInMobile = saved;
    }
  }

  if (!state.customer.loggedInMobile) {
    renderCustomerLogin();
  } else if (state.customer.selectedOrderId) {
    renderCustomerOrderDetail();
  } else {
    renderCustomerOrderList();
  }
}

function renderCustomerLogin() {
  const view = document.getElementById('customerView');
  view.innerHTML =
    '<button class="back-btn" id="custBackHome">← Back to home</button>' +
    '<div class="card">' +
      '<div class="card-title">◆ Track Your Orders ◆</div>' +
      '<h2 class="card-heading">Enter Your Mobile</h2>' +
      '<div class="po-field">' +
        '<label class="po-label">Mobile number</label>' +
        '<input type="tel" id="custLoginMobile" placeholder="98765 43210" inputmode="tel" autocomplete="tel">' +
        '<div class="po-hint">We\'ll show all orders placed with this number.</div>' +
      '</div>' +
      '<div class="po-error" id="custLoginError"></div>' +
      '<button class="btn" id="custLoginBtn">View My Orders →</button>' +
    '</div>';

  document.getElementById('custBackHome').addEventListener('click', () => navigateTo(''));
  document.getElementById('custLoginBtn').addEventListener('click', customerLogin);
  document.getElementById('custLoginMobile').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); customerLogin(); }
  });
  setTimeout(() => {
    const el = document.getElementById('custLoginMobile');
    if (el) el.focus();
  }, 100);
}

async function customerLogin() {
  const mobileEl = document.getElementById('custLoginMobile');
  const errEl = document.getElementById('custLoginError');
  const btn = document.getElementById('custLoginBtn');
  if (!mobileEl) return;

  const raw = mobileEl.value.trim();
  errEl.textContent = '';

  if (!isValidMobile(raw)) {
    errEl.textContent = 'Please enter a valid mobile number.';
    return;
  }

  const normalized = parseMobile(raw);
  btn.disabled = true;
  btn.textContent = 'Loading…';

  try {
    const orders = await getOrdersByMobile(normalized);
    state.customer.loggedInMobile = normalized;
    state.customer.orders = orders;
    sessionStorage.setItem('umbra_customer_mobile', normalized);
    renderCustomerOrderList();
  } catch (err) {
    console.error('Customer login failed:', err);
    errEl.textContent = 'Could not load orders. Please check your internet.';
    btn.disabled = false;
    btn.textContent = 'View My Orders →';
  }
}

function customerLogout() {
  state.customer.loggedInMobile = null;
  state.customer.orders = [];
  state.customer.selectedOrderId = null;
  sessionStorage.removeItem('umbra_customer_mobile');
  renderCustomerPanel();
}

async function refreshCustomerOrders() {
  if (!state.customer.loggedInMobile) return;
  try {
    const orders = await getOrdersByMobile(state.customer.loggedInMobile);
    state.customer.orders = orders;
  } catch (err) {
    console.error('Failed to refresh orders:', err);
  }
}

async function renderCustomerOrderList() {
  const view = document.getElementById('customerView');

  // Fresh fetch if list is empty (e.g., reload)
  if (state.customer.orders.length === 0) {
    view.innerHTML = '<div class="empty-state" style="margin-top:40px"><div class="empty-icon">⏳</div>Loading your orders…</div>';
    await refreshCustomerOrders();
  }

  const orders = state.customer.orders;
  const displayNum = displayMobile(state.customer.loggedInMobile);

  let listHtml = '';
  if (orders.length === 0) {
    listHtml =
      '<div class="empty-state">' +
        '<div class="empty-icon">◇</div>' +
        'No orders yet for this number.<br>' +
        '<a href="#" id="custGoHome" style="color:var(--wood-mid); text-decoration:underline">Place a new order</a>' +
      '</div>';
  } else {
    listHtml = '<div class="order-list">' +
      orders.map(o => renderCustomerOrderCard(o)).join('') +
      '</div>';
  }

  view.innerHTML =
    '<button class="back-btn" id="custBackHome">← Back to home</button>' +
    '<div class="card">' +
      '<div class="card-title">◆ Your Orders ◆</div>' +
      '<div class="list-header">' +
        '<h2 class="card-heading" style="margin-bottom:0">' + displayNum + '</h2>' +
        '<button class="text-link" id="custLogout">Logout</button>' +
      '</div>' +
      listHtml +
      '<div class="customer-call-block">' +
        'Need to change or cancel an order?<br>' +
        '<a href="https://wa.me/' + CONFIG.shopWhatsApp + '" target="_blank" class="big-call-link">' +
          '📱 WhatsApp Amar Furniture' +
        '</a>' +
        '<div class="muted" style="margin-top:6px">+91 ' + CONFIG.shopWhatsApp.slice(2) + '</div>' +
      '</div>' +
    '</div>';

  document.getElementById('custBackHome').addEventListener('click', () => navigateTo(''));
  document.getElementById('custLogout').addEventListener('click', customerLogout);
  const goHome = document.getElementById('custGoHome');
  if (goHome) goHome.addEventListener('click', e => { e.preventDefault(); navigateTo(''); });

  view.querySelectorAll('.order-card').forEach(card => {
    card.addEventListener('click', () => {
      state.customer.selectedOrderId = card.dataset.id;
      renderCustomerOrderDetail();
    });
  });
}

function renderCustomerOrderCard(order) {
  const date = new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  return '<div class="order-card" data-id="' + order.id + '">' +
    '<div class="order-card-top">' +
      '<div class="order-card-no">' + escapeHtml(order.orderNo) + '</div>' +
      renderStatusBadge(order.status) +
    '</div>' +
    '<div class="order-card-title">' + escapeHtml(comboTitle(order.spec)) + '</div>' +
    '<div class="order-card-meta">' +
      '<span>' + order.dimensions.Lft + ' ft × ' + order.dimensions.W + '"</span>' +
      '<span class="dot">·</span>' +
      '<span>' + date + '</span>' +
    '</div>' +
    '<div class="order-card-price">' + fmt(order.pricing.subtotal) + '</div>' +
  '</div>';
}

const STATUS_LABELS = {
  new: 'New',
  confirmed: 'Confirmed',
  in_production: 'In Production',
  ready: 'Ready',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

function renderStatusBadge(status) {
  const label = STATUS_LABELS[status] || status;
  return '<span class="status-badge status-' + status + '">' + label + '</span>';
}

async function renderCustomerOrderDetail() {
  const view = document.getElementById('customerView');
  let order = state.customer.orders.find(o => o.id === state.customer.selectedOrderId);

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

  view.innerHTML =
    '<button class="back-btn" id="custBackList">← Back to my orders</button>' +
    '<div class="card final-card">' +
      '<div class="final-banner">' +
        '<div class="final-banner-stamp">★ Your Order ★</div>' +
        '<div class="final-banner-title">' + escapeHtml(order.orderNo) + '</div>' +
        '<div class="final-banner-sub">' + renderStatusBadge(order.status) + '</div>' +
      '</div>' +
      '<div class="final-body">' +
        '<div class="final-meta">' +
          '<div class="final-meta-row"><div class="meta-label">Customer</div><div class="meta-value">' + escapeHtml(order.customerName) + '</div></div>' +
          '<div class="final-meta-row"><div class="meta-label">Date</div><div class="meta-value">' + date + '</div></div>' +
          '<div class="final-meta-row"><div class="meta-label">Mobile</div><div class="meta-value">' + escapeHtml(displayMobile(order.customerMobile)) + '</div></div>' +
          '<div class="final-meta-row"><div class="meta-label">Size</div><div class="meta-value">' + order.dimensions.Lft + ' ft × ' + order.dimensions.W + '" × ' + order.spec.height + '"</div></div>' +
        '</div>' +
        '<div class="final-spec-title">◆ Specification ◆</div>' +
        '<div class="final-spec">' + escapeHtml(comboTitle(order.spec)) + '</div>' +
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
            '<span class="ln-detail">' + surface + ' sq in surface @ ' + fmt(CONFIG.RATES.polishPerSqIn) + '/sq in</span></div>' +
            '<div class="ln-value">' + fmt(order.pricing.polish) + '</div>' +
          '</div>' : '') +
        '<div class="final-total">' +
          '<div class="tot-label">Total</div>' +
          '<div class="tot-value">' + fmt(order.pricing.subtotal) + '</div>' +
        '</div>' +
        '<div class="final-note">' +
          '* GST ' + CONFIG.GST_PERCENT + '% extra. Transport extra.' +
        '</div>' +

        (order.customerNote && order.customerNote.trim() ?
          '<div class="customer-note-block">' +
            '<div class="customer-note-label">YOUR NOTE</div>' +
            '<div class="customer-note-text">' + escapeHtml(order.customerNote) + '</div>' +
          '</div>' : '') +

        '<div class="status-history-block">' +
          '<div class="customer-note-label">STATUS HISTORY</div>' +
          (order.statusHistory || []).map(h => {
            const when = new Date(h.at).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
            return '<div class="status-history-row">' +
              renderStatusBadge(h.status) +
              '<span class="muted">' + when + '</span>' +
            '</div>';
          }).join('') +
        '</div>' +

        '<div class="customer-call-block">' +
          'Need to change or cancel this order?<br>' +
          '<a href="https://wa.me/' + CONFIG.shopWhatsApp + '?text=' +
            encodeURIComponent('Hi, regarding my umbra order ' + order.orderNo) +
            '" target="_blank" class="big-call-link">' +
            '📱 WhatsApp Amar Furniture' +
          '</a>' +
          '<div class="muted" style="margin-top:6px">+91 ' + CONFIG.shopWhatsApp.slice(2) + '</div>' +
        '</div>' +

        '<div class="share-row">' +
          '<button class="share-btn" id="custDownloadPDF">📄 Download PDF</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  document.getElementById('custBackList').addEventListener('click', () => {
    state.customer.selectedOrderId = null;
    renderCustomerOrderList();
  });
  document.getElementById('custDownloadPDF').addEventListener('click', () => {
    const doc = buildOrderPDF(order);
    sharePDF(doc, order.orderNo + '.pdf', 'Umbra order ' + order.orderNo);
  });
}
