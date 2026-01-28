# Curated Commerce

A curated dropshipping platform with automated product scraping, 10% finder's fee, and Stripe checkout.

## Quick Setup (30 minutes)

### Step 1: Formspree — Collect Emails (5 min)

1. Go to [formspree.io](https://formspree.io) and sign up free
2. Click **New Form**
3. Set email to yours (e.g., mauricio@couturiervision.com)
4. Copy your form ID (looks like `xvoeqpwd`)
5. In `curated-commerce.html`, find this line near the top:
   ```js
   FORMSPREE_ID: 'YOUR_FORM_ID',
   ```
   Replace `YOUR_FORM_ID` with your actual ID.

### Step 2: Stripe — Accept Payments (15 min)

1. Go to [stripe.com](https://stripe.com) and create an account
2. Go to **Developers → API Keys**
3. Copy your **Publishable key** (starts with `pk_test_` or `pk_live_`)
4. In `curated-commerce.html`, find:
   ```js
   STRIPE_KEY: 'pk_test_YOUR_KEY',
   ```
   Replace with your key.

5. Copy your **Secret key** (starts with `sk_test_` or `sk_live_`)
6. You'll add this when deploying the API (Step 3)

### Step 3: Deploy the API — Railway (10 min)

1. Create a [GitHub](https://github.com) account if you don't have one
2. Create a new repository and upload the `product-scraper` folder contents:
   - `server.js`
   - `package.json`

3. Go to [railway.app](https://railway.app) and sign up with GitHub
4. Click **New Project → Deploy from GitHub repo**
5. Select your repository
6. Once deployed, go to **Variables** and add:
   ```
   STRIPE_SECRET_KEY = sk_test_your_secret_key_here
   ```
7. Go to **Settings → Networking → Generate Domain**
8. Copy your URL (like `https://curated-abc123.railway.app`)
9. In `curated-commerce.html`, find:
   ```js
   SCRAPER_API: 'http://localhost:3001',
   ```
   Replace with your Railway URL.

### Step 4: Add to Squarespace (5 min)

1. In Squarespace, go to the page where you want the shop
2. Add a **Code Block** (click + → Code)
3. Paste the entire contents of `curated-commerce.html`
4. Uncheck "Display Source"
5. Save and publish

**You're live!**

---

## How It Works

1. **Admin** pastes product URL → Scraper extracts name, price, image
2. **Admin** adjusts details → Adds to catalog with 10% fee
3. **Customer** browses → Adds to cart → Checkout via Stripe
4. **You** get paid → Order from supplier → Ship to customer

---

## Testing

Before going live:

1. Use Stripe **test mode** (keys starting with `pk_test_` and `sk_test_`)
2. Test card number: `4242 4242 4242 4242`
3. Any future expiry, any CVC
4. Test the full flow: add product, checkout, verify payment in Stripe dashboard

---

## Going Live

1. In Stripe, switch to **live mode**
2. Replace test keys with live keys in:
   - `curated-commerce.html` (publishable key)
   - Railway variables (secret key)
3. Test with a real $1 product to verify

---

## Files

```
├── curated-commerce.html   # Complete frontend (shop + admin + chat)
├── server.js               # API (scraper + Stripe checkout)
├── package.json            # Dependencies
└── README.md               # This file
```

---

## Costs

| Service | Cost |
|---------|------|
| Formspree | Free (50 submissions/mo) or $10/mo |
| Railway | Free (500 hours/mo) or $5/mo |
| Stripe | 2.9% + $0.30 per transaction |
| Squarespace | Your existing plan |

---

## Troubleshooting

**"Could not fetch product"**
- Make sure Railway API is running
- Check the URL is correct in CONFIG.SCRAPER_API
- Some sites block scrapers — try editing manually

**"Checkout failed"**
- Check Stripe keys are correct
- Check STRIPE_SECRET_KEY is set in Railway variables
- Check browser console for errors

**Emails not arriving**
- Check Formspree dashboard for submissions
- Check spam folder
- Verify form ID is correct
