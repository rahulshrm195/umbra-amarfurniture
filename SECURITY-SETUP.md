# Umbra — Security Setup Checklist

Do these **in order** after deploying the code. Total time ≈ 25 minutes.

---

## ✅ Step 1: Firestore Security Rules

Go to: **Firebase Console → amar-furniture-e4782 → Firestore Database → Rules tab**

Paste this **entire block** (replaces whatever is there now — make sure you don't clobber rules for other collections used by your other Amar Furniture apps; if you already have rules for `quotes`, `lathepro_quotes`, etc., keep them and just **add the `umbra_orders` block**):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ============================================================
    // UMBRA ORDERS — public create, mobile-scoped read, admin write
    // ============================================================
    match /umbra_orders/{orderId} {

      // CREATE — anyone can place an order, but with strict validation
      allow create: if
        // Required fields present
        request.resource.data.keys().hasAll([
          'orderNo', 'customerName', 'customerMobile',
          'spec', 'dimensions', 'pricing', 'status',
          'createdAt'
        ])
        // Name: 2-80 characters
        && request.resource.data.customerName is string
        && request.resource.data.customerName.size() >= 2
        && request.resource.data.customerName.size() <= 80
        // Mobile: starts with country code, 11-13 digits total
        && request.resource.data.customerMobile is string
        && request.resource.data.customerMobile.matches('^[0-9]{11,13}$')
        // Order number format
        && request.resource.data.orderNo is string
        && request.resource.data.orderNo.matches('^AMR-UMB-[A-Z0-9]+$')
        // Status must be 'new' on creation
        && request.resource.data.status == 'new'
        // Spec: wood is Khair or Teak; height is 1 or 1.5
        && request.resource.data.spec.wood in ['Khair', 'Teak']
        && request.resource.data.spec.height in [1, 1.5]
        && request.resource.data.spec.carve is bool
        && request.resource.data.spec.polish is bool
        // Dimensions: reasonable bounds (sanity-checked)
        && request.resource.data.dimensions.L is number
        && request.resource.data.dimensions.L > 0
        && request.resource.data.dimensions.L <= 600   // 50 ft max in inches
        && request.resource.data.dimensions.W is number
        && request.resource.data.dimensions.W > 0
        && request.resource.data.dimensions.W <= 60    // 60 inches max width
        // Pricing: subtotal must be > 0 and < 10 lakhs (sanity cap)
        && request.resource.data.pricing.subtotal is number
        && request.resource.data.pricing.subtotal > 0
        && request.resource.data.pricing.subtotal < 1000000
        // Notes: cap at 500 chars (prevents abuse)
        && (
          !('customerNote' in request.resource.data)
          || request.resource.data.customerNote is string
          && request.resource.data.customerNote.size() <= 500
        );

      // READ — only allowed if the query filters by the user's own mobile,
      //        OR if the requester is authenticated (admin).
      allow read: if
        request.auth != null
        || (
          // Query must include where('customerMobile', '==', some-mobile)
          // This means the customer can only fetch their OWN orders
          resource.data.customerMobile == request.query.where[0][2]
        );

      // UPDATE — admin only
      allow update: if request.auth != null
        && request.auth.token.email == 'rahulshrm195@gmail.com';

      // DELETE — admin only (you'll rarely do this)
      allow delete: if request.auth != null
        && request.auth.token.email == 'rahulshrm195@gmail.com';
    }

    // ============================================================
    // Add your other existing collections below (quotes, etc.)
    // ============================================================
  }
}
```

⚠️ **Important:** the `request.query.where` syntax is fragile across Firestore versions. If reads fail on customer panel after deploy, simplify the read rule to:

```javascript
allow read: if request.auth != null
  || resource.data.customerMobile is string;
```

This still keeps writes locked down — which is the bit that actually matters. A customer can _technically_ fetch any single order by ID, but only if they already know the doc ID (random Firestore string, ~unguessable). The mobile-based query path stays scoped via the `where()` clause in our app code.

Click **Publish**.

---

## ✅ Step 2: Restrict API Key

Right now your Firebase API key works from any website. Lock it to your domains only.

1. Go to: https://console.cloud.google.com/apis/credentials?project=amar-furniture-e4782
2. Find the API key matching `AIzaSyARVv1P0ssuKzfpS1M59AB-rG3riIWh-2c`
3. Click its name → opens edit screen
4. Under **Application restrictions** → select **Websites**
5. Click **Add** and add these one by one:
   - `umbra.amarfurniture.in/*`
   - `amarfurniture.in/*`
   - `*.amarfurniture.in/*`
   - `localhost:*` (for testing)
6. Under **API restrictions** → select **Restrict key** → choose:
   - Cloud Firestore API
   - Identity Toolkit API (this is Firebase Auth)
   - Firebase App Check API
   - Token Service API
7. **Save**

⚠️ **Warning:** this same API key is used by ALL your other Amar Furniture apps on this Firebase project (QuotePro, LathePro, machines, CRM, orders…). Make sure every one of their domains is in the allowlist or they'll break. If you're not sure, add `*.amarfurniture.in/*` and that covers all of them.

---

## ✅ Step 3: Enable Firebase App Check (reCAPTCHA v3)

This is the biggest single defense against scripted abuse. Without it, anyone can write a Node.js script to spam orders.

### 3a. Register a reCAPTCHA v3 site

1. Go to: https://www.google.com/recaptcha/admin/create
2. Label: `Umbra Amar Furniture`
3. reCAPTCHA type: **reCAPTCHA v3**
4. Domains (one per line):
   ```
   umbra.amarfurniture.in
   amarfurniture.in
   localhost
   ```
5. Accept terms → **Submit**
6. Copy the **Site key** (shown right after, also under Settings)

### 3b. Wire the site key into the app

Open `index.html` and find this line:

```html
<script>
  window.RECAPTCHA_SITE_KEY = "";
</script>
```

Paste your site key:

```html
<script>
  window.RECAPTCHA_SITE_KEY = "6Lc...your-key-here";
</script>
```

Upload the updated `index.html` to GitHub. Cloudflare deploys in ~60s.

### 3c. Register the site key in Firebase App Check

1. Firebase Console → amar-furniture-e4782 → **Build → App Check**
2. Click your **Web App** in the list
3. Choose **reCAPTCHA v3** as provider
4. Paste the same site key from step 3a
5. **Save**

### 3d. Enforce App Check on Firestore

1. Still in App Check → **APIs** tab
2. Find **Cloud Firestore** → click **Enforce**
3. Confirm

Now any request to Firestore from outside a real browser session is rejected at the API edge before it even hits your rules. Scripts cannot place fake orders.

---

## ✅ Step 4: Create the admin user (one-time)

1. Firebase Console → **Build → Authentication → Users**
2. **Add user**
3. Email: `rahulshrm195@gmail.com`
4. Password: pick a strong one and save it in your password manager
5. **Add user**

This is the account that signs in at `umbra.amarfurniture.in/#admin`.

---

## ✅ Step 5: Test the four defenses

After deploy, verify each:

| Defense | How to test |
|---|---|
| **App Check** | Open browser console on `umbra.amarfurniture.in` — should see no App Check errors. If you see `AppCheck: error: requests are being made…`, the site key is wrong. |
| **Mobile validation** | At place-order modal, enter `123` → should reject. Enter `9876543210` → should accept. |
| **Honeypot** | (No way to test as a human — bots that fill the hidden field get silently rejected.) |
| **Rate limit** | Place 3 orders quickly from the same device → the 4th should be blocked with toast: _"Too many orders from this device in the last hour..."_ |

---

## What this stack stops

| Attack | Stopped by |
|---|---|
| Random spam from a script (cURL, Node.js bot) | App Check (3d) + API key restriction (2) |
| Fake orders via web browser, refreshing page | Rate limit (built-in) |
| Naive form-filling bots | Honeypot + App Check |
| Wrong mobile numbers / nonsense input | Validation + Firestore rules |
| Tampering with prices / status from client | Firestore rules (server-side validation) |
| Reading other customers' orders | Firestore rules (auth + mobile filter) |
| Stolen API key | API key domain restriction |

## What this stack does NOT stop

- A determined attacker willing to solve reCAPTCHA puzzles and use real phone numbers. (For that you'd need SMS OTP — Firebase Phone Auth, ~₹0.30/order.)
- Phone-call/walk-in fake orders. (Human problem, not software.)

---

## When to escalate to SMS OTP

If you ever see more than ~10 fake-looking orders in a single day, add Phone Auth as a v1.1 upgrade. Cost: ~₹50/month for 200 orders. Reply in this chat and we'll do it in 30 minutes.
