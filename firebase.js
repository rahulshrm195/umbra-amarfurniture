// =============================================================
// UMBRA — FIREBASE
// =============================================================
// Initializes Firebase (modular v10 from CDN, imported via <script type="module">
// in index.html which exposes the SDK to window.firebaseSDK).
// All Firestore operations live here.
// =============================================================

let _app = null;
let _db = null;
let _auth = null;
let _appCheck = null;
let _fbReady = false;

/* Called once on page load (after firebaseSDK module loads).
   index.html imports the modular SDK and assigns to window.firebaseSDK. */
function initFirebase() {
  const SDK = window.firebaseSDK;
  if (!SDK) {
    console.warn('Firebase SDK not loaded yet — retrying in 200ms');
    setTimeout(initFirebase, 200);
    return;
  }

  try {
    _app = SDK.initializeApp(FIREBASE_CONFIG);
    _db = SDK.getFirestore(_app);
    _auth = SDK.getAuth(_app);

    // App Check — enable once you've configured reCAPTCHA v3 site key in console.
    // If RECAPTCHA_SITE_KEY is empty, skip App Check (dev mode).
    if (window.RECAPTCHA_SITE_KEY) {
      try {
        _appCheck = SDK.initializeAppCheck(_app, {
          provider: new SDK.ReCaptchaV3Provider(window.RECAPTCHA_SITE_KEY),
          isTokenAutoRefreshEnabled: true,
        });
      } catch (e) {
        console.warn('App Check init failed:', e);
      }
    }

    // Listen for admin auth state changes
    SDK.onAuthStateChanged(_auth, (user) => {
      state.admin.user = user || null;
      // If we're on admin route, re-render to reflect login state
      if (state.route === 'admin' && typeof renderAdmin === 'function') {
        renderAdmin();
      }
    });

    _fbReady = true;
    console.log('✓ Firebase ready');
  } catch (err) {
    console.error('Firebase init failed:', err);
  }
}

function fbReady() { return _fbReady; }

/* =============================================================
   ORDERS — CRUD
   ============================================================= */

/* Create a new order in Firestore.
   Returns the created order (with id and orderNo) on success.
   Rate-limit + honeypot checks happen BEFORE this is called. */
async function createOrder(orderData) {
  if (!_fbReady) throw new Error('Firebase not ready');
  const SDK = window.firebaseSDK;

  const orderNo = generateOrderNo();
  const now = Date.now();

  const doc = {
    orderNo: orderNo,
    customerName: orderData.customerName,
    customerMobile: orderData.customerMobile,
    customerNote: orderData.customerNote || '',
    spec: orderData.spec,
    dimensions: orderData.dimensions,
    pricing: orderData.pricing,
    status: 'new',
    statusHistory: [{ status: 'new', at: now, by: 'customer' }],
    internalNotes: '',
    deviceId: getDeviceId(),
    createdAt: now,
    updatedAt: now,
  };

  const colRef = SDK.collection(_db, FIRESTORE_COLLECTION);
  const docRef = await SDK.addDoc(colRef, doc);
  await addOrderLookup(doc.customerMobile, docRef.id, now);

  return { id: docRef.id, ...doc };
}

/* =============================================================
   ORDER LOOKUP BY MOBILE
   Each order is also filed under umbra_lookup/{mobile}/orders/{orderId}.
   Firestore rules let anyone list ONE mobile's folder and fetch an order
   by its (unguessable) id, but nobody except the admin can list all
   orders — so customers can't download everyone's names and numbers.
   ============================================================= */
const LOOKUP_COLLECTION = 'umbra_lookup';

/* File an order under its mobile number. Never throws: a failed lookup
   write must not block the order (the admin backfill repairs it). */
async function addOrderLookup(mobile, orderId, createdAt) {
  try {
    const SDK = window.firebaseSDK;
    await SDK.setDoc(SDK.doc(_db, LOOKUP_COLLECTION, mobile, 'orders', orderId),
      { orderId: orderId, createdAt: createdAt || Date.now() });
  } catch (err) {
    console.warn('Order lookup write failed (admin backfill will repair):', err);
  }
}

/* Admin: make sure every order has a lookup entry (covers orders placed
   before this existed). Remembers done ids per device so it's cheap. */
async function backfillOrderLookups(orders) {
  if (!state.admin.user || !orders || !orders.length) return;
  const KEY = 'umbra_lookup_backfilled_v1';
  let done;
  try { done = new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch (e) { done = new Set(); }
  const SDK = window.firebaseSDK;
  let changed = false;
  for (const o of orders) {
    if (done.has(o.id) || !o.customerMobile) continue;
    try {
      await SDK.setDoc(SDK.doc(_db, LOOKUP_COLLECTION, o.customerMobile, 'orders', o.id),
        { orderId: o.id, createdAt: o.createdAt || Date.now() });
      done.add(o.id); changed = true;
    } catch (err) {
      console.warn('Lookup backfill stopped (are the new Firestore rules published?):', err);
      break;
    }
  }
  if (changed) { try { localStorage.setItem(KEY, JSON.stringify([...done])); } catch (e) {} }
}

/* Get all orders for a given normalized mobile number */
async function getOrdersByMobile(normalizedMobile) {
  if (!_fbReady) throw new Error('Firebase not ready');
  const SDK = window.firebaseSDK;

  // New path: list this mobile's lookup folder, then fetch each order by id
  try {
    const lookSnap = await SDK.getDocs(SDK.collection(_db, LOOKUP_COLLECTION, normalizedMobile, 'orders'));
    const ids = [];
    lookSnap.forEach(d => ids.push(d.id));
    const snaps = await Promise.all(ids.map(id => SDK.getDoc(SDK.doc(_db, FIRESTORE_COLLECTION, id))));
    const orders = snaps.filter(s => s.exists()).map(s => ({ id: s.id, ...s.data() }));
    orders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return orders;
  } catch (err) {
    // Rules not published yet → fall back to the old query below
    console.warn('Lookup read failed, using legacy query:', err && err.code);
  }

  const colRef = SDK.collection(_db, FIRESTORE_COLLECTION);
  const q = SDK.query(
    colRef,
    SDK.where('customerMobile', '==', normalizedMobile),
    SDK.orderBy('createdAt', 'desc')
  );

  const snap = await SDK.getDocs(q);
  const orders = [];
  snap.forEach(d => orders.push({ id: d.id, ...d.data() }));
  return orders;
}

/* Get a single order by its Firestore document id */
async function getOrderById(id) {
  if (!_fbReady) throw new Error('Firebase not ready');
  const SDK = window.firebaseSDK;
  const docRef = SDK.doc(_db, FIRESTORE_COLLECTION, id);
  const snap = await SDK.getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/* Admin: list all orders (with optional status filter), newest first */
async function getAllOrders(statusFilter) {
  if (!_fbReady) throw new Error('Firebase not ready');
  const SDK = window.firebaseSDK;

  const colRef = SDK.collection(_db, FIRESTORE_COLLECTION);
  let q;
  if (statusFilter && statusFilter !== 'all') {
    q = SDK.query(colRef, SDK.where('status', '==', statusFilter), SDK.orderBy('createdAt', 'desc'));
  } else {
    q = SDK.query(colRef, SDK.orderBy('createdAt', 'desc'));
  }

  const snap = await SDK.getDocs(q);
  const orders = [];
  snap.forEach(d => orders.push({ id: d.id, ...d.data() }));
  return orders;
}

/* Admin: update an order's status */
async function updateOrderStatus(id, newStatus) {
  if (!_fbReady) throw new Error('Firebase not ready');
  if (!state.admin.user) throw new Error('Admin not authenticated');
  const SDK = window.firebaseSDK;

  const docRef = SDK.doc(_db, FIRESTORE_COLLECTION, id);
  const snap = await SDK.getDoc(docRef);
  if (!snap.exists()) throw new Error('Order not found');

  const current = snap.data();
  const now = Date.now();
  const history = (current.statusHistory || []).concat([{
    status: newStatus,
    at: now,
    by: state.admin.user.email || 'admin',
  }]);

  await SDK.updateDoc(docRef, {
    status: newStatus,
    statusHistory: history,
    updatedAt: now,
  });
}

/* Admin: update internal notes on an order */
async function updateOrderNotes(id, notes) {
  if (!_fbReady) throw new Error('Firebase not ready');
  if (!state.admin.user) throw new Error('Admin not authenticated');
  const SDK = window.firebaseSDK;

  const docRef = SDK.doc(_db, FIRESTORE_COLLECTION, id);
  await SDK.updateDoc(docRef, {
    internalNotes: notes || '',
    updatedAt: Date.now(),
  });
}

/* =============================================================
   ADMIN AUTH
   ============================================================= */

/* =============================================================
   INQUIRIES — ADMIN CRUD
   ============================================================= */

async function getAllInquiries(statusFilter) {
  if (!_fbReady) throw new Error('Firebase not ready');
  const SDK = window.firebaseSDK;

  const colRef = SDK.collection(_db, INQUIRY_COLLECTION);
  let q;
  if (statusFilter && statusFilter !== 'all') {
    q = SDK.query(colRef, SDK.where('status', '==', statusFilter), SDK.orderBy('createdAt', 'desc'));
  } else {
    q = SDK.query(colRef, SDK.orderBy('createdAt', 'desc'));
  }

  const snap = await SDK.getDocs(q);
  const inquiries = [];
  snap.forEach(d => inquiries.push({ id: d.id, ...d.data() }));
  return inquiries;
}

async function updateInquiryStatus(id, newStatus) {
  if (!_fbReady) throw new Error('Firebase not ready');
  if (!state.admin.user) throw new Error('Admin not authenticated');
  const SDK = window.firebaseSDK;

  const docRef = SDK.doc(_db, INQUIRY_COLLECTION, id);
  const snap = await SDK.getDoc(docRef);
  if (!snap.exists()) throw new Error('Inquiry not found');

  const current = snap.data();
  const now = Date.now();
  const history = (current.statusHistory || []).concat([{
    status: newStatus,
    at: now,
    by: state.admin.user.email || 'admin',
  }]);

  await SDK.updateDoc(docRef, {
    status: newStatus,
    statusHistory: history,
    updatedAt: now,
  });
}

async function updateInquiryNotes(id, notes) {
  if (!_fbReady) throw new Error('Firebase not ready');
  if (!state.admin.user) throw new Error('Admin not authenticated');
  const SDK = window.firebaseSDK;

  const docRef = SDK.doc(_db, INQUIRY_COLLECTION, id);
  await SDK.updateDoc(docRef, {
    internalNotes: notes || '',
    updatedAt: Date.now(),
  });
}

/* Convert an inquiry to an order — picks a specific combo, creates order */
async function convertInquiryToOrder(inquiryId, selectedCombo, dimensions) {
  if (!_fbReady) throw new Error('Firebase not ready');
  if (!state.admin.user) throw new Error('Admin not authenticated');
  const SDK = window.firebaseSDK;

  // Fetch inquiry
  const inqRef = SDK.doc(_db, INQUIRY_COLLECTION, inquiryId);
  const inqSnap = await SDK.getDoc(inqRef);
  if (!inqSnap.exists()) throw new Error('Inquiry not found');
  const inq = inqSnap.data();

  // Calculate pricing from the selected combo + stored dimensions
  const dims = dimensions || inq.dimensions;
  if (!dims) throw new Error('No dimensions stored on inquiry');

  const calc = calcCombo(selectedCombo, dims.L, dims.W);
  const orderNo = generateOrderNo();
  const now = Date.now();

  // Create order
  const order = {
    orderNo,
    customerName: inq.customerName,
    customerMobile: inq.customerMobile,
    customerNote: 'Converted from enquiry by admin.',
    spec: {
      wood: selectedCombo.wood,
      height: selectedCombo.height,
      carve: selectedCombo.carve,
      polish: selectedCombo.polish,
    },
    dimensions: dims,
    pricing: {
      wood: calc.wood,
      cnc: calc.cnc,
      polish: calc.polish,
      subtotal: calc.subtotal,
    },
    status: 'confirmed',
    statusHistory: [
      { status: 'confirmed', at: now, by: state.admin.user.email || 'admin' }
    ],
    internalNotes: 'Created from enquiry ' + inquiryId,
    linkedInquiryId: inquiryId,
    deviceId: inq.deviceId || '',
    createdAt: now,
    updatedAt: now,
  };

  const ordersRef = SDK.collection(_db, FIRESTORE_COLLECTION);
  const orderRef = await SDK.addDoc(ordersRef, order);
  await addOrderLookup(order.customerMobile, orderRef.id, now);

  // Update inquiry: mark converted, link order
  const historyEntry = { status: 'converted', at: now, by: state.admin.user.email || 'admin' };
  await SDK.updateDoc(inqRef, {
    status: 'converted',
    linkedOrderNo: orderNo,
    linkedOrderId: orderRef.id,
    statusHistory: (inq.statusHistory || []).concat([historyEntry]),
    updatedAt: now,
  });

  return { id: orderRef.id, ...order };
}

async function adminSignIn(email, password) {
  if (!_fbReady) throw new Error('Firebase not ready');
  const SDK = window.firebaseSDK;
  return await SDK.signInWithEmailAndPassword(_auth, email, password);
}

async function adminSignOut() {
  if (!_fbReady) return;
  const SDK = window.firebaseSDK;
  await SDK.signOut(_auth);
}
