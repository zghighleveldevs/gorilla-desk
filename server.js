const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

// ─── CREDENTIALS ─────────────────────────────────────────────────
const GHL_API_KEY     = process.env.GHL_API_KEY     || 'pit-da50c690-6f27-4eb3-add8-8c26fea28807';
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID || 'QXAnXqg1dimyOsQinMyX';
const GD_API_KEY      = process.env.GD_API_KEY      || 'fc4614c78dc31e7695408b4c98440dc1418b57ee604e2b15729ce2a8f6d01e9a3bfddd779783fd17';
const GD_COMPANY_ID   = process.env.GD_COMPANY_ID   || 'GD8EB92A5073';
// ─────────────────────────────────────────────────────────────────

// Gorilla Desk API helper — uses correct auth format
const gdApi = axios.create({
  baseURL: 'https://app.gorilladesk.com/api/v1',
  headers: {
    'Authorization': GD_API_KEY,
    'Content-Type':  'application/json',
    'Accept':        'application/json'
  }
});

// GHL API helper
const ghlApi = axios.create({
  baseURL: 'https://services.leadconnectorhq.com',
  headers: {
    'Authorization': `Bearer ${GHL_API_KEY}`,
    'Version':       '2021-04-15',
    'Content-Type':  'application/json'
  }
});

// ── Health check ─────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'running', message: 'GHL → Gorilla Desk sync server is live ✅' });
});

// ── Test GHL ─────────────────────────────────────────────────────
app.get('/test-ghl', async (req, res) => {
  try {
    const r = await ghlApi.get(`/calendars/?locationId=${GHL_LOCATION_ID}`);
    res.json({ status: 'connected ✅', calendars_found: r.data?.calendars?.length || 0 });
  } catch (e) {
    res.json({ status: 'error ❌', message: e.response?.data || e.message });
  }
});

// ── Test Gorilla Desk ─────────────────────────────────────────────
app.get('/test-gorilladesk', async (req, res) => {
  try {
    // Try v1 API with Authorization header as raw token
    const r = await gdApi.get('/customers?page=1&per_page=1');
    if (r.data && typeof r.data === 'object' && !r.data.includes?.('<!doctype')) {
      res.json({ status: 'connected ✅', data: r.data });
    } else {
      res.json({ status: 'error ❌', message: 'Got HTML back — trying different auth format', hint: 'Check API key in GD Settings → Integrations' });
    }
  } catch (e) {
    // Try alternative auth formats
    const formats = [
      { header: 'Authorization', value: `Bearer ${GD_API_KEY}` },
      { header: 'Authorization', value: `Token ${GD_API_KEY}` },
      { header: 'X-Auth-Token',  value: GD_API_KEY },
      { header: 'api-key',       value: GD_API_KEY },
    ];

    for (const fmt of formats) {
      try {
        const r2 = await axios.get('https://app.gorilladesk.com/api/v1/customers?page=1&per_page=1', {
          headers: { [fmt.header]: fmt.value, 'Content-Type': 'application/json', 'Accept': 'application/json' }
        });
        if (r2.data && typeof r2.data === 'object') {
          return res.json({ status: 'connected ✅', auth_format: fmt, data: r2.data });
        }
      } catch {}
    }
    res.json({
      status: 'error ❌',
      message: e.response?.data || e.message,
      hint: 'The API key may need to be regenerated. Go to Gorilla Desk → Settings → Integrations → API and copy the key shown there.'
    });
  }
});

// ── Webhook — receives appointment from GHL ───────────────────────
app.post('/webhook/appointment', async (req, res) => {
  console.log('📥 GHL Webhook received:', JSON.stringify(req.body, null, 2));
  res.json({ received: true }); // Always respond to GHL immediately

  try {
    const apt = req.body;
    const customerName = apt.contact_name || apt.full_name || apt.contactName || apt.name || 'New Customer';
    const email        = apt.email || apt.contact_email || '';
    const phone        = apt.phone || apt.contact_phone || '';
    const address      = apt.address1 || apt.address || '';
    const city         = apt.city || '';
    const state        = apt.state || '';
    const zip          = apt.postal_code || apt.postalCode || '';
    const startTime    = apt.start_time || apt.startTime || apt.appointment_start_time || apt.start;
    const notes        = `Booked via GHL — ${apt.calendar_title || apt.calendarTitle || 'NextGen'}`;
    const appointmentDate = startTime ? new Date(startTime) : new Date();

    console.log(`📅 Syncing: ${customerName} on ${appointmentDate.toLocaleString()}`);

    // Step 1 — Find or create customer in Gorilla Desk
    let customerId = null;
    if (email) {
      try {
        const search = await gdApi.get(`/customers?email=${encodeURIComponent(email)}&per_page=1`);
        const found  = search.data?.customers?.[0] || search.data?.[0];
        if (found) { customerId = found.id; console.log(`✓ Found GD customer #${customerId}`); }
      } catch (e) { console.log('Search failed:', e.message); }
    }

    if (!customerId) {
      const [fname, ...rest] = customerName.split(' ');
      const create = await gdApi.post('/customers', {
        customer: { fname, lname: rest.join(' '), email, phone, address, city, state, zip }
      });
      customerId = create.data?.customer?.id || create.data?.id;
      console.log(`✓ Created GD customer #${customerId}`);
    }

    // Step 2 — Create the job in Gorilla Desk
    const job = await gdApi.post('/jobs', {
      job: {
        customer_id:      customerId,
        description:      notes,
        scheduled_start:  appointmentDate.toISOString(),
        scheduled_end:    new Date(appointmentDate.getTime() + 60 * 60 * 1000).toISOString(),
        status:           'scheduled'
      }
    });

    const jobId = job.data?.job?.id || job.data?.id;
    console.log(`✅ GD Job #${jobId} created for ${customerName}`);

  } catch (error) {
    console.error('❌ Sync error:', error.response?.data || error.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
