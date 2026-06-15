// =============================================================
// UMBRA — CONFIGURATION
// =============================================================
// Update these values as needed. After editing, upload to GitHub.
// Cloudflare will auto-deploy within ~60 seconds.
// =============================================================

const CONFIG = {

  // ----- App version
  version: '2.0.0',
  brandShort: 'AMR-UMB',

  // ----- Internal mode PIN (for in-shop pricing breakdown view)
  PIN: '2580',

  // ----- Shop owner WhatsApp number (country code + number, no + or spaces)
  //       Used for the "Send Order to Amar Furniture" button.
  shopWhatsApp: '918275407603',

  // ===== PRICING — UPDATE WHEN RATES CHANGE ====================
  RATES: {
    // Wood — per cubic foot
    teakPerCuft: 5500,
    khairPerCuft: 17500,

    // CNC carving — per square inch (L × W of top face)
    cncPerSqIn: 3,

    // Polish — per square inch of polish surface, with minimum
    polishPerSqIn: 2,
    polishMin: 500,
  },

  // ----- GST percentage (shown in internal view only)
  GST_PERCENT: 18,

  // ----- Abuse prevention (rate limits & validation)
  MAX_ORDERS_PER_DEVICE_PER_HOUR: 3,
  MIN_MOBILE_DIGITS: 10,
  MAX_MOBILE_DIGITS: 13,
};

// =============================================================
// FIREBASE config — do not change unless moving Firebase project
// =============================================================
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyARVv1P0ssuKzfpS1M59AB-rG3riIWh-2c",
  authDomain: "amar-furniture-e4782.firebaseapp.com",
  projectId: "amar-furniture-e4782",
  storageBucket: "amar-furniture-e4782.firebasestorage.app",
  messagingSenderId: "1084205045390",
  appId: "1:1084205045390:web:2dfd98a680be89979c5bdf"
};

const FIRESTORE_COLLECTION = 'umbra_orders';
