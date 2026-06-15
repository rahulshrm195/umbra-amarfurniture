// =============================================================
// UMBRA — FINALIZE & PLACE ORDER
// =============================================================

function finalizeCombo(id) {
  const dims = getDims();
  if (!dims) {
    toast('Enter length & width first');
    return;
  }
  state.finalizedId = id;
  document.getElementById('workspaceView').style.display = 'none';
  document.getElementById('finalView').style.display = 'block';
  renderFinal();
  setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
}

function unfinalize() {
  state.finalizedId = null;
  state.placedOrder = null;
  document.getElementById('finalView').style.display = 'none';
  document.getElementById('workspaceView').style.display = 'block';
  document.getElementById('finalView').innerHTML = '';
}

function renderFinal() {
  // If we just placed an order, show confirmation screen instead
  if (state.placedOrder) {
    renderOrderConfirmation();
    return;
  }

  const combo = state.combos.find(c => c.id === state.finalizedId);
  if (!combo) { unfinalize(); return; }
  const dims = getDims();
  if (!dims) { unfinalize(); return; }

  const calc = calcCombo(combo, dims.L, dims.W);
  const isInternal = state.mode === 'internal';
  const custName = (document.getElementById('custName') || {}).value || '';
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const gst = calc.subtotal * (CONFIG.GST_PERCENT / 100);
  const customerPays = calc.subtotal + gst;
  const woodRate = combo.wood === 'Khair' ? CONFIG.RATES.khairPerCuft : CONFIG.RATES.teakPerCuft;

  let internalHtml = '';
  if (isInternal) {
    internalHtml =
      '<div class="final-internal">' +
        '<div class="final-internal-row"><span>Subtotal</span><span>' + fmt(calc.subtotal) + '</span></div>' +
        '<div class="final-internal-row"><span>+ GST ' + CONFIG.GST_PERCENT + '%</span><span>' + fmt(gst) + '</span></div>' +
        '<div class="final-internal-row heavy"><span>Customer pays</span><span>' + fmt(customerPays) + '</span></div>' +
      '</div>';
  }

  document.getElementById('finalView').innerHTML =
    '<button class="back-btn" id="backBtn">← Back to comparison</button>' +
    '<div class="card final-card">' +
      '<div class="final-banner">' +
        '<div class="final-banner-stamp">★ Finalized Quote ★</div>' +
        '<div class="final-banner-title">UMBRA</div>' +
        '<div class="final-banner-sub">Threshold of fortune · उंबरा</div>' +
      '</div>' +
      '<div class="final-body">' +
        '<div class="final-meta">' +
          '<div class="final-meta-row"><div class="meta-label">Customer</div><div class="meta-value">' + (custName.trim() ? escapeHtml(custName.trim()) : '—') + '</div></div>' +
          '<div class="final-meta-row"><div class="meta-label">Date</div><div class="meta-value">' + today + '</div></div>' +
          '<div class="final-meta-row"><div class="meta-label">Quote No.</div><div class="meta-value">' + (state.quoteId || '—') + '</div></div>' +
          '<div class="final-meta-row"><div class="meta-label">Size</div><div class="meta-value">' + dims.Lft + ' ft × ' + dims.W + '" × ' + combo.height + '"</div></div>' +
        '</div>' +
        '<div class="final-spec-title">◆ Specification ◆</div>' +
        '<div class="final-spec">' + escapeHtml(comboTitle(combo)) + '</div>' +
        '<div class="final-line">' +
          '<div><span class="ln-label">' + combo.wood + ' wood</span>' +
          '<span class="ln-detail">' + calc.volCuft.toFixed(3) + ' cuft @ ' + fmt(woodRate) + '/cuft</span></div>' +
          '<div class="ln-value">' + fmt(calc.wood) + '</div>' +
        '</div>' +
        (combo.carve ?
          '<div class="final-line">' +
            '<div><span class="ln-label">CNC carving</span>' +
            '<span class="ln-detail">' + calc.sqIn + ' sq in @ ' + fmt(CONFIG.RATES.cncPerSqIn) + '/sq in</span></div>' +
            '<div class="ln-value">' + fmt(calc.cnc) + '</div>' +
          '</div>' : '') +
        (combo.polish ?
          '<div class="final-line">' +
            '<div><span class="ln-label">Polish</span>' +
            '<span class="ln-detail">' + calc.surface + ' sq in surface @ ' + fmt(CONFIG.RATES.polishPerSqIn) + '/sq in (min ' + fmt(CONFIG.RATES.polishMin) + ')</span></div>' +
            '<div class="ln-value">' + fmt(calc.polish) + '</div>' +
          '</div>' : '') +
        '<div class="final-total">' +
          '<div class="tot-label">' + (isInternal ? 'Net (ex-GST)' : 'Total') + '</div>' +
          '<div class="tot-value">' + fmt(calc.subtotal) + '</div>' +
        '</div>' +
        '<div class="final-note">' +
          (isInternal ? '* Net price excludes GST. Customer total shown below.'
                      : '* GST ' + CONFIG.GST_PERCENT + '% extra. Transport extra. <br><em>GST व ट्रान्सपोर्ट वेगळे · GST और ट्रांसपोर्ट अलग</em>') +
        '</div>' +
        internalHtml +

        // PRIMARY action: Place Order
        '<button class="btn btn-primary-action" id="placeOrderBtn">' +
          '<span class="btn-icon">✓</span> Place This Order' +
        '</button>' +

        // Secondary: text + pdf share (kept for in-shop use)
        '<div class="share-row">' +
          '<button class="share-btn whatsapp" id="shareFinalWA">📱 Text Quote</button>' +
          '<button class="share-btn" id="shareFinalPDF">📄 Share PDF</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  document.getElementById('backBtn').addEventListener('click', unfinalize);
  document.getElementById('placeOrderBtn').addEventListener('click', openPlaceOrderModal);
  document.getElementById('shareFinalWA').addEventListener('click', () => shareFinal(combo, calc, dims, custName.trim(), today));
  document.getElementById('shareFinalPDF').addEventListener('click', () => {
    const doc = buildFinalPDF(combo, calc, dims, custName.trim(), today);
    const filename = (state.quoteId || 'umbra-quote') + '-final.pdf';
    const ctx = 'Final umbra quotation from Amar Furniture' + (custName.trim() ? ' for ' + custName.trim() : '');
    sharePDF(doc, filename, ctx);
  });
}

/* =============================================================
   PLACE ORDER MODAL
   ============================================================= */

function openPlaceOrderModal() {
  if (!fbReady()) {
    toast('Connecting to server… try again in a moment');
    return;
  }

  // Rate limit check
  const rl = checkDeviceRateLimit();
  if (!rl.allowed) {
    toast('Too many orders from this device in the last hour. Please call us at +91 ' + CONFIG.shopWhatsApp.slice(2), 5000);
    return;
  }

  // Pre-fill from existing fields
  const prefName = (document.getElementById('custName') || {}).value || '';
  const prefMobile = (document.getElementById('custMobile') || {}).value || '';

  const modal = document.getElementById('placeOrderModal');
  modal.innerHTML =
    '<div class="modal">' +
      '<button class="modal-close" id="poClose" aria-label="Close">✕</button>' +
      '<div class="modal-title">Place Your Order</div>' +
      '<div class="modal-text">We\'ll save it and contact you to confirm.</div>' +

      '<div class="po-field">' +
        '<label class="po-label">Your name <span class="req">*</span></label>' +
        '<input type="text" id="poName" placeholder="e.g. Patil Family" value="' + escapeHtml(prefName.trim()) + '" autocomplete="name">' +
      '</div>' +

      '<div class="po-field">' +
        '<label class="po-label">Mobile number <span class="req">*</span></label>' +
        '<input type="tel" id="poMobile" placeholder="98765 43210" value="' + escapeHtml(prefMobile.trim()) + '" inputmode="tel" autocomplete="tel">' +
        '<div class="po-hint">We\'ll WhatsApp / call you on this number.</div>' +
      '</div>' +

      '<div class="po-field">' +
        '<label class="po-label">Anything to add? <span class="opt">(optional)</span></label>' +
        '<textarea id="poNote" rows="3" placeholder="e.g. need by Diwali, prefer dark polish, will collect from shop…"></textarea>' +
      '</div>' +

      // Honeypot — invisible to humans, bots fill it → silent reject
      '<div class="po-honeypot" aria-hidden="true">' +
        '<label>Leave this blank</label>' +
        '<input type="text" id="poHoneypot" tabindex="-1" autocomplete="off">' +
      '</div>' +

      '<div class="po-error" id="poError"></div>' +

      '<div class="btn-row">' +
        '<button class="btn btn-secondary" id="poCancel">Cancel</button>' +
        '<button class="btn" id="poSubmit">Place Order</button>' +
      '</div>' +
    '</div>';

  modal.classList.add('active');
  setTimeout(() => {
    const focusEl = prefName.trim() ? document.getElementById('poMobile') : document.getElementById('poName');
    if (focusEl) focusEl.focus();
  }, 100);

  document.getElementById('poClose').addEventListener('click', closePlaceOrderModal);
  document.getElementById('poCancel').addEventListener('click', closePlaceOrderModal);
  document.getElementById('poSubmit').addEventListener('click', submitPlaceOrder);

  // Submit on Enter from name/mobile fields
  ['poName', 'poMobile'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); submitPlaceOrder(); }
    });
  });
}

function closePlaceOrderModal() {
  const modal = document.getElementById('placeOrderModal');
  modal.classList.remove('active');
  setTimeout(() => { modal.innerHTML = ''; }, 200);
}

async function submitPlaceOrder() {
  const nameEl = document.getElementById('poName');
  const mobileEl = document.getElementById('poMobile');
  const noteEl = document.getElementById('poNote');
  const honeyEl = document.getElementById('poHoneypot');
  const errEl = document.getElementById('poError');
  const submitBtn = document.getElementById('poSubmit');

  const name = (nameEl.value || '').trim();
  const mobileRaw = (mobileEl.value || '').trim();
  const note = (noteEl.value || '').trim();
  const honey = (honeyEl.value || '').trim();

  // Honeypot tripped — silent reject
  if (honey) {
    closePlaceOrderModal();
    // Pretend it worked so bots don't probe
    toast('Order placed', 1500);
    return;
  }

  errEl.textContent = '';

  if (!name) { errEl.textContent = 'Please enter your name.'; return; }
  if (name.length < 2) { errEl.textContent = 'Name is too short.'; return; }
  if (!isValidMobile(mobileRaw)) {
    errEl.textContent = 'Please enter a valid mobile number (10 digits).';
    return;
  }

  // Rate limit re-check at submit time
  const rl = checkDeviceRateLimit();
  if (!rl.allowed) {
    errEl.textContent = 'Too many orders from this device. Please call us at +91 ' + CONFIG.shopWhatsApp.slice(2);
    return;
  }

  const combo = state.combos.find(c => c.id === state.finalizedId);
  const dims = getDims();
  if (!combo || !dims) {
    errEl.textContent = 'Something went wrong. Please go back and try again.';
    return;
  }

  const calc = calcCombo(combo, dims.L, dims.W);
  const normalizedMobile = parseMobile(mobileRaw);

  // Sync the inputs at top of page too
  const custNameEl = document.getElementById('custName');
  const custMobileEl = document.getElementById('custMobile');
  if (custNameEl && !custNameEl.value.trim()) custNameEl.value = name;
  if (custMobileEl && !custMobileEl.value.trim()) custMobileEl.value = mobileRaw;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Placing…';

  try {
    const order = await createOrder({
      customerName: name,
      customerMobile: normalizedMobile,
      customerNote: note,
      spec: {
        wood: combo.wood,
        height: combo.height,
        carve: combo.carve,
        polish: combo.polish,
      },
      dimensions: { L: dims.L, W: dims.W, Lft: dims.Lft },
      pricing: {
        wood: calc.wood,
        cnc: calc.cnc,
        polish: calc.polish,
        subtotal: calc.subtotal,
      },
    });

    recordDeviceOrder();
    state.placedOrder = order;
    closePlaceOrderModal();
    renderOrderConfirmation();

  } catch (err) {
    console.error('Order placement failed:', err);
    errEl.textContent = 'Could not place order. Please check your internet and try again.';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Place Order';
  }
}

/* =============================================================
   ORDER CONFIRMATION SCREEN (replaces finalize view after place)
   ============================================================= */

function renderOrderConfirmation() {
  const order = state.placedOrder;
  if (!order) { unfinalize(); return; }

  const view = document.getElementById('finalView');
  view.innerHTML =
    '<div class="card confirm-card">' +
      '<div class="confirm-icon">✓</div>' +
      '<div class="confirm-title">Order Placed!</div>' +
      '<div class="confirm-sub">We\'ve received your order.</div>' +

      '<div class="confirm-orderno-block">' +
        '<div class="confirm-orderno-label">YOUR ORDER NUMBER</div>' +
        '<div class="confirm-orderno">' + escapeHtml(order.orderNo) + '</div>' +
        '<div class="confirm-orderno-hint">Save this to track your order anytime.</div>' +
      '</div>' +

      '<div class="confirm-summary">' +
        '<div class="confirm-summary-row"><span>' + escapeHtml(comboTitle(order.spec)) + '</span></div>' +
        '<div class="confirm-summary-row"><span class="muted">' + order.dimensions.Lft + ' ft × ' + order.dimensions.W + '"</span></div>' +
        '<div class="confirm-summary-row total"><span>Total</span><span>' + fmt(order.pricing.subtotal) + '</span></div>' +
      '</div>' +

      '<button class="btn btn-primary-action" id="confirmShareShop">' +
        '<span class="btn-icon">📱</span> Send Order to Amar Furniture' +
      '</button>' +

      '<div class="confirm-share-hint">Tap above so we have the order on WhatsApp too — no need to save our number.</div>' +

      '<div class="share-row">' +
        '<button class="share-btn" id="confirmDownloadPDF">📄 Download My Copy</button>' +
        '<button class="share-btn" id="confirmTrack">📋 Track Order</button>' +
      '</div>' +

      '<div class="confirm-followup">' +
        'We\'ll contact you on <strong>' + escapeHtml(displayMobile(order.customerMobile)) + '</strong> to confirm your order.' +
      '</div>' +

      '<button class="back-btn" id="confirmAnother">← Place another order</button>' +
    '</div>';

  document.getElementById('confirmShareShop').addEventListener('click', () => shareOrderToShop(order));
  document.getElementById('confirmDownloadPDF').addEventListener('click', () => {
    const doc = buildOrderPDF(order);
    const filename = order.orderNo + '.pdf';
    sharePDF(doc, filename, 'Umbra order ' + order.orderNo);
  });
  document.getElementById('confirmTrack').addEventListener('click', () => {
    // Cache mobile in session so customer panel auto-loads
    sessionStorage.setItem('umbra_customer_mobile', order.customerMobile);
    navigateTo('orders');
  });
  document.getElementById('confirmAnother').addEventListener('click', () => {
    state.placedOrder = null;
    // Clear builder state for a fresh order
    state.combos = [];
    state.finalizedId = null;
    state.quoteId = null;
    state.nextId = 1;
    unfinalize();
    renderList();
    document.getElementById('custName').value = '';
    document.getElementById('custMobile').value = '';
    document.getElementById('length').value = '';
    document.getElementById('width').value = '';
    syncBuilderUI();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}
