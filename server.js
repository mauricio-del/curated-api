// Product Scraper API + Stripe Checkout
// Run with: npm install && node server.js

const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const Stripe = require('stripe');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Stripe with your secret key
const stripe = Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_YOUR_KEY_HERE');

app.use(cors());
app.use(express.json());

// Scrape product data from URL
app.post('/api/scrape', async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    console.log(`Scraping: ${url}`);
    
    // Fetch the page
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 10000,
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // Extract product data using multiple strategies
    const productData = {
      name: extractName($, url),
      price: extractPrice($, url),
      image: extractImage($, url),
      description: extractDescription($),
      sourceUrl: url,
    };

    console.log('Extracted:', productData);
    res.json(productData);

  } catch (error) {
    console.error('Scrape error:', error.message);
    res.status(500).json({ 
      error: 'Failed to scrape product',
      message: error.message 
    });
  }
});

// Create Stripe Checkout Session
app.post('/api/checkout', async (req, res) => {
  const { items, customerEmail, shippingAddress } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'No items provided' });
  }

  try {
    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + (item.basePrice * item.quantity * 100), 0); // in cents
    const curationFee = Math.round(subtotal * 0.10);
    const total = subtotal + curationFee;

    // Create line items for Stripe
    const lineItems = items.map(item => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.name,
          images: item.image ? [item.image] : [],
        },
        unit_amount: Math.round(item.basePrice * 100), // Convert to cents
      },
      quantity: item.quantity,
    }));

    // Add curation fee as a line item
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: {
          name: "Finder's Fee (10%)",
          description: 'Curation and sourcing fee',
        },
        unit_amount: curationFee,
      },
      quantity: 1,
    });

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${req.headers.origin || 'http://localhost:3000'}?success=true`,
      cancel_url: `${req.headers.origin || 'http://localhost:3000'}?canceled=true`,
      customer_email: customerEmail,
      shipping_address_collection: {
        allowed_countries: ['US', 'CA', 'GB', 'AU'],
      },
      metadata: {
        order_items: JSON.stringify(items.map(i => ({ name: i.name, qty: i.quantity, source: i.sourceUrl }))),
      },
    });

    res.json({ url: session.url, sessionId: session.id });

  } catch (error) {
    console.error('Stripe error:', error.message);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Webhook to handle successful payments (Stripe sends order details here)
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.log(`Webhook signature verification failed.`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    
    console.log('=== NEW ORDER ===');
    console.log('Customer:', session.customer_email);
    console.log('Amount:', session.amount_total / 100, 'USD');
    console.log('Items:', session.metadata.order_items);
    console.log('Shipping:', JSON.stringify(session.shipping_details));
    console.log('=================');
    
    // TODO: Send order notification email to yourself
    // TODO: Store order in database
  }

  res.json({ received: true });
});

// Extract product name
function extractName($, url) {
  const selectors = [
    'meta[property="og:title"]',
    'meta[name="twitter:title"]',
    '#productTitle',
    '#title',
    '[data-testid="product-title"]',
    '.product-title',
    '.product-name',
    '.product_title',
    'h1.title',
    'h1[itemprop="name"]',
    '[itemprop="name"]',
    'h1',
    'title',
  ];

  for (const selector of selectors) {
    let text;
    
    if (selector.startsWith('meta')) {
      text = $(selector).attr('content');
    } else {
      text = $(selector).first().text();
    }
    
    if (text) {
      text = text.trim().replace(/\s+/g, ' ');
      if (text.length > 0 && text.length < 500) {
        return text;
      }
    }
  }

  return 'Unknown Product';
}

// Extract price
function extractPrice($, url) {
  const selectors = [
    '[itemprop="price"]',
    'meta[itemprop="price"]',
    '.a-price .a-offscreen',
    '#priceblock_ourprice',
    '#priceblock_dealprice',
    '.a-price-whole',
    '[data-testid="product-price"]',
    '.product-price',
    '.price',
    '.current-price',
    '.sale-price',
    '.regular-price',
    '.product_price',
    'meta[property="product:price:amount"]',
    'meta[property="og:price:amount"]',
  ];

  for (const selector of selectors) {
    let text;
    
    if (selector.startsWith('meta')) {
      text = $(selector).attr('content');
    } else {
      text = $(selector).first().text() || $(selector).first().attr('content');
    }
    
    if (text) {
      const priceMatch = text.match(/[\d,]+\.?\d*/);
      if (priceMatch) {
        const price = parseFloat(priceMatch[0].replace(/,/g, ''));
        if (price > 0 && price < 100000) {
          return price;
        }
      }
    }
  }

  return 0;
}

// Extract main product image
function extractImage($, url) {
  const selectors = [
    'meta[property="og:image"]',
    'meta[property="og:image:secure_url"]',
    'meta[name="twitter:image"]',
    '#landingImage',
    '#imgBlkFront',
    '#main-image',
    '[data-testid="product-image"] img',
    '.product-image img',
    '.product-gallery img',
    '.gallery-image',
    '[itemprop="image"]',
    '.main-image img',
    '#product-image',
    'img[src*="product"]',
    'img[src*="upload"]',
  ];

  for (const selector of selectors) {
    let src;
    
    if (selector.startsWith('meta')) {
      src = $(selector).attr('content');
    } else {
      const $img = $(selector).first();
      src = $img.attr('src') || $img.attr('data-src') || $img.attr('data-lazy-src');
    }
    
    if (src) {
      if (src.startsWith('//')) {
        src = 'https:' + src;
      } else if (src.startsWith('/')) {
        const urlObj = new URL(url);
        src = urlObj.origin + src;
      }
      
      if (!src.includes('icon') && !src.includes('logo') && !src.includes('1x1')) {
        return src;
      }
    }
  }

  return '';
}

// Extract description
function extractDescription($) {
  const selectors = [
    'meta[property="og:description"]',
    'meta[name="description"]',
    '[itemprop="description"]',
    '.product-description',
    '#product-description',
  ];

  for (const selector of selectors) {
    let text;
    
    if (selector.startsWith('meta')) {
      text = $(selector).attr('content');
    } else {
      text = $(selector).first().text();
    }
    
    if (text) {
      text = text.trim().replace(/\s+/g, ' ');
      if (text.length > 10) {
        return text.substring(0, 500);
      }
    }
  }

  return '';
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Scraper: POST /api/scrape`);
  console.log(`Checkout: POST /api/checkout`);
});
