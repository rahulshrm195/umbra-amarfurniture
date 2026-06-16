// =============================================================
// UMBRA — INQUIRY / CART SESSION
// =============================================================
// Manages the customer identity capture (Add to Cart modal)
// and links combo additions to a Firestore inquiry record.
// =============================================================

const INQUIRY_STORAGE_KEY = 'umbra_inquiry_session';

/* Restore a saved inquiry session from localStorage (cross-visit persistence) */
function restoreInquirySession() {
  try {
    const raw = localStorage.getItem(INQUIRY_STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    // Expire sessions older than 30 days
    if (!saved.capturedAt || Date.now() - saved.capturedAt > 30 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(INQUIRY_STORAGE_KEY);
      return;
    }
    state.inquiry.firestoreId = saved.firestoreId || null;
    state.inquiry.customerName = saved.customerName || null;
    state.inquiry.customerMobile = saved.customerMobile || null;
    state.inquiry.capturedAt = saved.capturedAt || null;

    // Pre-fill the name/mobile fields in the workspace
    if (saved.customerName) {
      const nameEl = document.getElementById('custName');
      if (nameEl && !nameEl.value) nameEl.value = saved.customerName;
    }
    if (saved.customerMobile) {
      const mobileEl = document.getElementById('custMobile');
      if (mobileEl && !mobileEl.value) mobileEl.value = saved.customerMobile;
    }
  } catch (e) {
    console.warn('Could not restore inquiry session', e);
  }
}

function saveInquirySession() {
  try {
    localStorage.setItem(INQUIRY_STORAGE_KEY, JSON.stringify({
      firestoreId: state.inquiry.firestoreId,
      customerName: state.inquiry.customerName,
      customerMobile: state.inquiry.customerMobile,
      capturedAt: state.inquiry.capturedAt,
    }));
  } catch (e) {}
}

function clearInquirySession() {
  state.inquiry = { firestoreId: null, customerName: null, customerMobile: null, capturedAt: null };
  localStorage.removeItem(INQUIRY_STORAGE_KEY);
}

/* Check if we already have the customer's identity for this session */
function inquiryIdentityKnown() {
  return !!(state.inquiry.customerName && state.inquiry.customerMobile);
}

/* =============================================================
   ADD TO CART MODAL
   Shows when customer taps "Add to Cart" and we don't know who they are.
   On submit: saves identity, then calls addCombo() to proceed.
   ============================================================= */

function openAddToCartModal(pendingCombo) {
  // Pre-fill from workspace fields if the operator had typed something
  const prefName = (document.getElementById('custName') || {}).value || state.inquiry.customerName || '';
  const prefMobile = (document.getElementById('custMobile') || {}).value || '';

  const modal = document.getElementById('addToCartModal');
  modal.innerHTML =
    '<div class="modal">' +
      '<div class="modal-title">✦ Save to Cart</div>' +
      '<div class="modal-text">Enter your details so we can prepare your quote and follow up.</div>' +

      '<div class="po-field">' +
        '<label class="po-label">Your name <span class="req">*</span></label>' +
        '<input type="text" id="cartName" placeholder="e.g. Patil Family" value="' + escapeHtml(prefName.trim()) + '" autocomplete="name">' +
      '</div>' +

      '<div class="po-field">' +
        '<label class="po-label">Mobile number <span class="req">*</span></label>' +
        '<input type="tel" id="cartMobile" placeholder="98765 43210" value="' + escapeHtml(prefMobile.trim()) + '" inputmode="tel" autocomplete="tel">' +
        '<div class="po-hint">So we can send you the quote and follow up.</div>' +
      '</div>' +

      '<div class="po-error" id="cartError"></div>' +

      '<div class="btn-row">' +
        '<button class="btn btn-secondary" id="cartCancel">Cancel</button>' +
        '<button class="btn" id="cartSubmit">Add to Cart →</button>' +
      '</div>' +
    '</div>';

  modal.classList.add('active');

  setTimeout(() => {
    const focusEl = prefName.trim()
      ? document.getElementById('cartMobile')
      : document.getElementById('cartName');
    if (focusEl) focusEl.focus();
  }, 100);

  document.getElementById('cartCancel').addEventListener('click', closeAddToCartModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeAddToCartModal(); });

  document.getElementById('cartSubmit').addEventListener('click', () => submitAddToCart(pendingCombo));
  ['cartName', 'cartMobile'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); submitAddToCart(pendingCombo); }
    });
  });
}

function closeAddToCartModal() {
  const modal = document.getElementById('addToCartModal');
  modal.classList.remove('active');
  setTimeout(() => { modal.innerHTML = ''; }, 200);
}

async function submitAddToCart(pendingCombo) {
  const nameEl = document.getElementById('cartName');
  const mobileEl = document.getElementById('cartMobile');
  const errEl = document.getElementById('cartError');
  const btn = document.getElementById('cartSubmit');

  const name = (nameEl.value || '').trim();
  const mobileRaw = (mobileEl.value || '').trim();

  errEl.textContent = '';
  if (!name || name.length < 2) { errEl.textContent = 'Please enter your name.'; return; }
  if (!isValidMobile(mobileRaw)) { errEl.textContent = 'Please enter a valid 10-digit mobile number.'; return; }

  const normalizedMobile = parseMobile(mobileRaw);

  // Save identity to state + localStorage
  state.inquiry.customerName = name;
  state.inquiry.customerMobile = normalizedMobile;
  if (!state.inquiry.capturedAt) state.inquiry.capturedAt = Date.now();

  // Sync back to workspace fields
  const custNameEl = document.getElementById('custName');
  const custMobileEl = document.getElementById('custMobile');
  if (custNameEl) custNameEl.value = name;
  if (custMobileEl) custMobileEl.value = mobileRaw;

  saveInquirySession();

  btn.disabled = true;
  btn.textContent = 'Saving…';

  try {
    // Now do the actual combo add
    await doAddCombo(pendingCombo);
    closeAddToCartModal();
  } catch (err) {
    console.error('Add to cart failed:', err);
    errEl.textContent = 'Could not save. Check your internet and try again.';
    btn.disabled = false;
    btn.textContent = 'Add to Cart →';
  }
}

/* =============================================================
   INQUIRY FIRESTORE OPERATIONS
   ============================================================= */

/* Called every time a combo is added to the list.
   Creates inquiry on first add, updates on subsequent adds. */
async function syncInquiryToFirestore(combos, dims) {
  if (!fbReady()) return; // Silently skip if Firebase not ready yet
  if (!inquiryIdentityKnown()) return;

  const comboSnapshots = combos.map(c => {
    const calc = dims ? calcCombo(c, dims.L, dims.W) : null;
    return {
      wood: c.wood,
      height: c.height,
      carve: c.carve,
      polish: c.polish,
      title: comboTitle(c),
      pricing: calc ? {
        wood: calc.wood,
        cnc: calc.cnc,
        polish: calc.polish,
        subtotal: calc.subtotal,
      } : null,
    };
  });

  const dimensions = dims ? { L: dims.L, W: dims.W, Lft: dims.Lft } : null;
  const now = Date.now();

  const SDK = window.firebaseSDK;
  if (!SDK) return;

  try {
    if (!state.inquiry.firestoreId) {
      // First combo — create new inquiry
      const colRef = SDK.collection(_db, INQUIRY_COLLECTION);
      const docRef = await SDK.addDoc(colRef, {
        customerName: state.inquiry.customerName,
        customerMobile: state.inquiry.customerMobile,
        combos: comboSnapshots,
        dimensions: dimensions,
        status: 'new',
        statusHistory: [{ status: 'new', at: now }],
        internalNotes: '',
        linkedOrderNo: null,
        deviceId: getDeviceId(),
        createdAt: now,
        updatedAt: now,
      });
      state.inquiry.firestoreId = docRef.id;
      saveInquirySession();
    } else {
      // Subsequent adds — update combos list
      const docRef = SDK.doc(_db, INQUIRY_COLLECTION, state.inquiry.firestoreId);
      await SDK.updateDoc(docRef, {
        combos: comboSnapshots,
        dimensions: dimensions,
        updatedAt: now,
      });
    }
  } catch (err) {
    console.warn('Inquiry sync failed (non-critical):', err);
    // Don't throw — inquiry sync failure should never block the user
  }
}

/* Called when an order is placed — links order to inquiry */
async function linkInquiryToOrder(orderNo) {
  if (!state.inquiry.firestoreId) return;
  if (!fbReady()) return;
  const SDK = window.firebaseSDK;
  if (!SDK) return;

  try {
    const docRef = SDK.doc(_db, INQUIRY_COLLECTION, state.inquiry.firestoreId);
    const snap = await SDK.getDoc(docRef);
    if (!snap.exists()) return;
    const current = snap.data();
    const now = Date.now();
    const history = (current.statusHistory || []).concat([
      { status: 'converted', at: now, by: 'customer' }
    ]);
    await SDK.updateDoc(docRef, {
      status: 'converted',
      linkedOrderNo: orderNo,
      statusHistory: history,
      updatedAt: now,
    });
  } catch (err) {
    console.warn('Could not link inquiry to order:', err);
  }
}
