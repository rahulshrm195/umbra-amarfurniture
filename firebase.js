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

  return { id: docRef.id, ...doc };
}

/* Get all orders for a given normalized mobile number */
async function getOrdersByMobile(normalizedMobile) {
  if (!_fbReady) throw new Error('Firebase not ready');
  const SDK = window.firebaseSDK;

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
