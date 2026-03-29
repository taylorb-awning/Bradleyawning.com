/**
 * Bradley Awning — Backend Server
 * Node.js + Express
 *
 * SETUP:
 *   npm install express cors nodemailer
 *   node server.js
 *
 * ENDPOINTS:
 *   POST /api/estimate        — Submit a free estimate request
 *   GET  /api/admin/leads     — View all leads (password protected)
 *   PUT  /api/admin/leads/:id — Update lead status
 *   DELETE /api/admin/leads/:id — Delete a lead
 *   GET  /api/admin/stats     — Dashboard stats
 */

const express  = require('express');
const path     = require('path');
const fs       = require('fs');
const crypto   = require('crypto');

// ── Optional: nodemailer for email notifications ──────────────────────────
let nodemailer;
try { nodemailer = require('nodemailer'); } catch(e) { nodemailer = null; }

const app  = express();
const PORT = process.env.PORT || 3000;

// ── CONFIG ────────────────────────────────────────────────────────────────
const CONFIG = {
  adminPassword: process.env.ADMIN_PASSWORD || 'bradley2026',   // CHANGE THIS
  dataFile:      path.join(__dirname, 'data', 'leads.json'),
  email: {
    enabled:  false,   // Set true after configuring SMTP below
    from:     'noreply@bradleyawning.com',
    notifyTo: 'Taylorb@bradleyawning.com',
    smtp: {
      host:   process.env.SMTP_HOST || 'smtp.gmail.com',
      port:   587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER || '',   // your gmail address
        pass: process.env.SMTP_PASS || '',   // your gmail app password
      }
    }
  }
};

// ── MIDDLEWARE ────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Simple CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Request logger
app.use((req, res, next) => {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${req.method} ${req.path}`);
  next();
});

// ── DATA HELPERS ──────────────────────────────────────────────────────────
function ensureDataFile() {
  const dir = path.dirname(CONFIG.dataFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(CONFIG.dataFile)) fs.writeFileSync(CONFIG.dataFile, JSON.stringify([], null, 2));
}

function loadLeads() {
  ensureDataFile();
  try { return JSON.parse(fs.readFileSync(CONFIG.dataFile, 'utf8')); }
  catch(e) { return []; }
}

function saveLeads(leads) {
  ensureDataFile();
  fs.writeFileSync(CONFIG.dataFile, JSON.stringify(leads, null, 2));
}

// ── AUTH MIDDLEWARE ───────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.replace('Bearer ', '');
  if (token === CONFIG.adminPassword) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

// ── EMAIL HELPER ──────────────────────────────────────────────────────────
async function sendNotificationEmail(lead) {
  if (!CONFIG.email.enabled || !nodemailer) return;
  try {
    const transporter = nodemailer.createTransport(CONFIG.email.smtp);
    await transporter.sendMail({
      from: CONFIG.email.from,
      to:   CONFIG.email.notifyTo,
      subject: `New Estimate Request — ${lead.name} (${lead.propertyType || 'Unknown'})`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#02123b;padding:24px;border-bottom:3px solid #f5c518;">
            <h1 style="color:#fff;margin:0;font-size:24px;">New Estimate Request</h1>
            <p style="color:#f5c518;margin:4px 0 0;">Bradley Awning</p>
          </div>
          <div style="background:#f9f6ec;padding:28px;">
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:8px 0;font-weight:bold;color:#0e2654;width:140px;">Name:</td><td style="padding:8px 0;">${lead.name}</td></tr>
              <tr><td style="padding:8px 0;font-weight:bold;color:#0e2654;">Phone:</td><td style="padding:8px 0;"><a href="tel:${lead.phone}">${lead.phone}</a></td></tr>
              <tr><td style="padding:8px 0;font-weight:bold;color:#0e2654;">Email:</td><td style="padding:8px 0;">${lead.email || '—'}</td></tr>
              <tr><td style="padding:8px 0;font-weight:bold;color:#0e2654;">Property Type:</td><td style="padding:8px 0;">${lead.propertyType || '—'}</td></tr>
              <tr><td style="padding:8px 0;font-weight:bold;color:#0e2654;">Awning Count:</td><td style="padding:8px 0;">${lead.awningCount || '—'}</td></tr>
              <tr><td style="padding:8px 0;font-weight:bold;color:#0e2654;">Message:</td><td style="padding:8px 0;">${lead.message || '—'}</td></tr>
              <tr><td style="padding:8px 0;font-weight:bold;color:#0e2654;">Submitted:</td><td style="padding:8px 0;">${new Date(lead.createdAt).toLocaleString()}</td></tr>
            </table>
          </div>
          <div style="background:#02123b;padding:16px;text-align:center;">
            <p style="color:rgba(255,255,255,.5);font-size:12px;margin:0;">Bradley Awning · 385-256-6659 · Salt Lake City, UT</p>
          </div>
        </div>
      `
    });
    console.log(`Email notification sent for lead: ${lead.name}`);
  } catch(err) {
    console.error('Email send failed:', err.message);
  }
}

// ── ROUTES ─────────────────────────────────────────────────────────────────

/**
 * POST /api/estimate
 * Submit a free estimate request
 */
app.post('/api/estimate', async (req, res) => {
  const { name, phone, email, propertyType, awningCount, message } = req.body;

  // Validation
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  if (!phone || !phone.trim()) return res.status(400).json({ error: 'Phone number is required' });

  const lead = {
    id:           crypto.randomUUID(),
    name:         name.trim(),
    phone:        phone.trim(),
    email:        email ? email.trim() : '',
    propertyType: propertyType || '',
    awningCount:  awningCount || '',
    message:      message ? message.trim() : '',
    status:       'new',        // new | contacted | quoted | won | lost
    notes:        '',
    createdAt:    new Date().toISOString(),
    updatedAt:    new Date().toISOString(),
  };

  const leads = loadLeads();
  leads.unshift(lead);  // newest first
  saveLeads(leads);

  // Send email notification (non-blocking)
  sendNotificationEmail(lead).catch(()=>{});

  console.log(`✅ New lead: ${lead.name} (${lead.phone})`);
  res.status(201).json({ success: true, message: 'Estimate request received!', id: lead.id });
});

/**
 * GET /api/admin/leads
 * Get all leads — requires admin password in Authorization header
 * Query params: ?status=new&search=john&page=1&limit=20
 */
app.get('/api/admin/leads', requireAdmin, (req, res) => {
  let leads = loadLeads();
  const { status, search, page = 1, limit = 50 } = req.query;

  if (status && status !== 'all') {
    leads = leads.filter(l => l.status === status);
  }
  if (search) {
    const q = search.toLowerCase();
    leads = leads.filter(l =>
      l.name.toLowerCase().includes(q) ||
      l.phone.includes(q) ||
      (l.email && l.email.toLowerCase().includes(q)) ||
      (l.propertyType && l.propertyType.toLowerCase().includes(q))
    );
  }

  const total = leads.length;
  const start = (page - 1) * limit;
  const paginated = leads.slice(start, start + Number(limit));

  res.json({ leads: paginated, total, page: Number(page), limit: Number(limit) });
});

/**
 * GET /api/admin/leads/:id
 * Get a single lead
 */
app.get('/api/admin/leads/:id', requireAdmin, (req, res) => {
  const leads = loadLeads();
  const lead = leads.find(l => l.id === req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  res.json(lead);
});

/**
 * PUT /api/admin/leads/:id
 * Update lead status or notes
 * Body: { status, notes }
 */
app.put('/api/admin/leads/:id', requireAdmin, (req, res) => {
  const leads = loadLeads();
  const idx = leads.findIndex(l => l.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Lead not found' });

  const allowed = ['status', 'notes'];
  allowed.forEach(key => {
    if (req.body[key] !== undefined) leads[idx][key] = req.body[key];
  });
  leads[idx].updatedAt = new Date().toISOString();

  saveLeads(leads);
  res.json({ success: true, lead: leads[idx] });
});

/**
 * DELETE /api/admin/leads/:id
 * Delete a lead
 */
app.delete('/api/admin/leads/:id', requireAdmin, (req, res) => {
  let leads = loadLeads();
  const idx = leads.findIndex(l => l.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Lead not found' });
  leads.splice(idx, 1);
  saveLeads(leads);
  res.json({ success: true });
});

/**
 * GET /api/admin/stats
 * Dashboard summary stats
 */
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const leads = loadLeads();
  const now   = new Date();
  const today = now.toDateString();
  const thisWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const stats = {
    total:        leads.length,
    new:          leads.filter(l => l.status === 'new').length,
    contacted:    leads.filter(l => l.status === 'contacted').length,
    quoted:       leads.filter(l => l.status === 'quoted').length,
    won:          leads.filter(l => l.status === 'won').length,
    lost:         leads.filter(l => l.status === 'lost').length,
    todayCount:   leads.filter(l => new Date(l.createdAt).toDateString() === today).length,
    weekCount:    leads.filter(l => new Date(l.createdAt) >= thisWeek).length,
    monthCount:   leads.filter(l => new Date(l.createdAt) >= thisMonth).length,
    recentLeads:  leads.slice(0, 5),
  };
  res.json(stats);
});

/**
 * GET /admin
 * Serves the admin dashboard HTML
 */
app.get('/admin', (req, res) => {
  res.send(ADMIN_HTML);
});

// Catch-all → serve index.html (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── START ─────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🏠 Bradley Awning Server running!`);
  console.log(`   Website:  http://localhost:${PORT}`);
  console.log(`   Admin:    http://localhost:${PORT}/admin`);
  console.log(`   Password: ${CONFIG.adminPassword}\n`);
});

// ── ADMIN DASHBOARD HTML ──────────────────────────────────────────────────
const ADMIN_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Bradley Awning — Admin Dashboard</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{font-family:system-ui,sans-serif;background:#0f1828;color:#d5e9f0;min-height:100vh;}
.login-screen{display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;}
.login-box{background:#02123b;border:1px solid rgba(245,197,24,.3);border-top:3px solid #f5c518;border-radius:12px;padding:44px 40px;width:100%;max-width:380px;text-align:center;}
.login-box h1{font-size:26px;font-weight:800;color:#fff;margin-bottom:6px;}
.login-box p{font-size:13px;color:rgba(213,233,240,.5);margin-bottom:28px;}
.login-box input{width:100%;background:rgba(255,255,255,.07);border:1px solid rgba(213,233,240,.2);border-radius:6px;padding:13px 16px;color:#fff;font-size:15px;margin-bottom:14px;outline:none;}
.login-box input:focus{border-color:#f5c518;}
.login-box button{width:100%;background:#f5c518;color:#02123b;border:none;border-radius:6px;padding:14px;font-size:16px;font-weight:800;cursor:pointer;letter-spacing:1px;transition:background .2s;}
.login-box button:hover{background:#d4a800;}
.err{color:#e05a4a;font-size:13px;margin-top:10px;}

.dashboard{display:none;}
header{background:#02123b;border-bottom:2px solid #f5c518;padding:0 28px;height:60px;display:flex;align-items:center;justify-content:space-between;}
header h1{font-size:20px;font-weight:800;color:#fff;}
header span{font-size:12px;color:#f5c518;letter-spacing:1px;}
.hdr-right{display:flex;gap:12px;align-items:center;}
.btn-sm{background:rgba(255,255,255,.08);border:1px solid rgba(213,233,240,.2);color:#d5e9f0;padding:7px 14px;border-radius:5px;font-size:12px;cursor:pointer;transition:background .2s;}
.btn-sm:hover{background:rgba(255,255,255,.15);}
.btn-danger{background:rgba(150,58,46,.2);border-color:rgba(150,58,46,.4);color:#e05a4a;}
.btn-danger:hover{background:rgba(150,58,46,.35);}

main{padding:28px;}
.stats-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:16px;margin-bottom:28px;}
.stat-box{background:#02123b;border-radius:10px;padding:22px 20px;border-top:3px solid;}
.stat-box.gold{border-color:#f5c518;}
.stat-box.blue{border-color:#4c8cb6;}
.stat-box.green{border-color:#2ecc71;}
.stat-box.red{border-color:#963a2e;}
.stat-box.grey{border-color:#555;}
.stat-num{font-size:36px;font-weight:900;color:#fff;line-height:1;}
.stat-lbl{font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:rgba(213,233,240,.5);margin-top:4px;}

.panel{background:#02123b;border-radius:10px;overflow:hidden;}
.panel-header{padding:16px 22px;border-bottom:1px solid rgba(213,233,240,.1);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;}
.panel-header h2{font-size:16px;font-weight:700;color:#fff;}
.filters{display:flex;gap:8px;flex-wrap:wrap;}
.filter-btn{background:rgba(255,255,255,.05);border:1px solid rgba(213,233,240,.15);color:rgba(213,233,240,.7);padding:5px 14px;border-radius:20px;font-size:12px;cursor:pointer;transition:all .2s;}
.filter-btn.active,.filter-btn:hover{background:rgba(245,197,24,.15);border-color:#f5c518;color:#f5c518;}
.search-box{background:rgba(255,255,255,.07);border:1px solid rgba(213,233,240,.2);border-radius:6px;padding:6px 13px;color:#fff;font-size:13px;outline:none;width:220px;}
.search-box:focus{border-color:#f5c518;}

table{width:100%;border-collapse:collapse;}
th{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:rgba(213,233,240,.4);padding:11px 18px;text-align:left;border-bottom:1px solid rgba(213,233,240,.08);background:rgba(255,255,255,.02);}
td{padding:13px 18px;font-size:14px;border-bottom:1px solid rgba(213,233,240,.06);vertical-align:top;}
tr:hover td{background:rgba(255,255,255,.025);}
.badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;}
.badge-new{background:rgba(245,197,24,.15);color:#f5c518;}
.badge-contacted{background:rgba(76,140,182,.2);color:#4c8cb6;}
.badge-quoted{background:rgba(163,84,246,.2);color:#a354f6;}
.badge-won{background:rgba(46,204,113,.15);color:#2ecc71;}
.badge-lost{background:rgba(150,58,46,.2);color:#e05a4a;}
.lead-name{font-weight:700;color:#fff;}
.lead-phone{color:#4c8cb6;}
.lead-phone a{color:#4c8cb6;text-decoration:none;}
.lead-phone a:hover{color:#f5c518;}
.actions{display:flex;gap:6px;}
.act-btn{background:rgba(255,255,255,.06);border:1px solid rgba(213,233,240,.15);color:#d5e9f0;padding:4px 12px;border-radius:4px;font-size:11px;cursor:pointer;transition:background .2s;}
.act-btn:hover{background:rgba(255,255,255,.14);}
.act-btn.del{color:#e05a4a;border-color:rgba(150,58,46,.3);}
.act-btn.del:hover{background:rgba(150,58,46,.2);}

select.status-sel{background:rgba(255,255,255,.07);border:1px solid rgba(213,233,240,.2);color:#d5e9f0;padding:4px 8px;border-radius:4px;font-size:12px;cursor:pointer;outline:none;}
select.status-sel:focus{border-color:#f5c518;}

.notes-input{background:rgba(255,255,255,.07);border:1px solid rgba(213,233,240,.15);border-radius:4px;padding:4px 8px;color:#d5e9f0;font-size:12px;width:180px;outline:none;}
.notes-input:focus{border-color:#f5c518;}

.empty-state{text-align:center;padding:48px;color:rgba(213,233,240,.35);font-size:14px;}
.loading{text-align:center;padding:32px;color:rgba(213,233,240,.4);}
.date-cell{font-size:12px;color:rgba(213,233,240,.45);}

@media(max-width:700px){
  .stats-row{grid-template-columns:1fr 1fr;}
  table{font-size:12px;}
  th,td{padding:10px 12px;}
  .notes-input{width:110px;}
}
</style>
</head>
<body>

<!-- LOGIN -->
<div class="login-screen" id="loginScreen">
  <div class="login-box">
    <h1>🏠 Bradley Awning</h1>
    <p>Admin Dashboard — Enter your password</p>
    <input type="password" id="pwInput" placeholder="Password" onkeydown="if(event.key==='Enter')login()">
    <button onclick="login()">Sign In →</button>
    <div class="err" id="loginErr"></div>
  </div>
</div>

<!-- DASHBOARD -->
<div class="dashboard" id="dashboard">
  <header>
    <h1>📋 Bradley Awning Admin</h1>
    <div class="hdr-right">
      <span id="lastRefresh"></span>
      <button class="btn-sm" onclick="loadDashboard()">↻ Refresh</button>
      <button class="btn-sm btn-danger" onclick="logout()">Sign Out</button>
    </div>
  </header>

  <main>
    <!-- Stats -->
    <div class="stats-row" id="statsRow">
      <div class="stat-box gold"><div class="stat-num" id="sTotal">—</div><div class="stat-lbl">Total Leads</div></div>
      <div class="stat-box blue"><div class="stat-num" id="sNew">—</div><div class="stat-lbl">New</div></div>
      <div class="stat-box blue"><div class="stat-num" id="sToday">—</div><div class="stat-lbl">Today</div></div>
      <div class="stat-box blue"><div class="stat-num" id="sWeek">—</div><div class="stat-lbl">This Week</div></div>
      <div class="stat-box green"><div class="stat-num" id="sWon">—</div><div class="stat-lbl">Won Jobs</div></div>
      <div class="stat-box grey"><div class="stat-num" id="sMonth">—</div><div class="stat-lbl">This Month</div></div>
    </div>

    <!-- Leads Table -->
    <div class="panel">
      <div class="panel-header">
        <h2>Estimate Requests</h2>
        <div class="filters">
          <button class="filter-btn active" onclick="setFilter('all',this)">All</button>
          <button class="filter-btn" onclick="setFilter('new',this)">New</button>
          <button class="filter-btn" onclick="setFilter('contacted',this)">Contacted</button>
          <button class="filter-btn" onclick="setFilter('quoted',this)">Quoted</button>
          <button class="filter-btn" onclick="setFilter('won',this)">Won</button>
          <button class="filter-btn" onclick="setFilter('lost',this)">Lost</button>
        </div>
        <input class="search-box" id="searchBox" placeholder="🔍 Search name, phone..." oninput="debounceSearch()">
      </div>
      <div id="tableWrap"></div>
    </div>
  </main>
</div>

<script>
let PASSWORD = '';
let currentFilter = 'all';
let searchTimer;

function login() {
  const pw = document.getElementById('pwInput').value;
  if (!pw) return;
  PASSWORD = pw;
  fetch('/api/admin/stats', { headers: { Authorization: 'Bearer ' + pw } })
    .then(r => {
      if (r.status === 401) {
        document.getElementById('loginErr').textContent = 'Incorrect password.';
        PASSWORD = '';
      } else {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        loadDashboard();
      }
    })
    .catch(() => { document.getElementById('loginErr').textContent = 'Cannot connect to server.'; });
}

function logout() {
  PASSWORD = '';
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('pwInput').value = '';
}

async function loadDashboard() {
  await Promise.all([loadStats(), loadLeads()]);
  document.getElementById('lastRefresh').textContent = 'Updated ' + new Date().toLocaleTimeString();
}

async function loadStats() {
  const r = await fetch('/api/admin/stats', { headers: { Authorization: 'Bearer ' + PASSWORD } });
  const d = await r.json();
  document.getElementById('sTotal').textContent = d.total;
  document.getElementById('sNew').textContent   = d.new;
  document.getElementById('sToday').textContent = d.todayCount;
  document.getElementById('sWeek').textContent  = d.weekCount;
  document.getElementById('sWon').textContent   = d.won;
  document.getElementById('sMonth').textContent = d.monthCount;
}

async function loadLeads() {
  const search = document.getElementById('searchBox').value;
  const url = '/api/admin/leads?status=' + currentFilter + (search ? '&search=' + encodeURIComponent(search) : '');
  const wrap = document.getElementById('tableWrap');
  wrap.innerHTML = '<div class="loading">Loading...</div>';
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + PASSWORD } });
  const d = await r.json();
  renderTable(d.leads, d.total);
}

function renderTable(leads, total) {
  const wrap = document.getElementById('tableWrap');
  if (!leads.length) {
    wrap.innerHTML = '<div class="empty-state">No leads found.</div>';
    return;
  }
  const statusOpts = ['new','contacted','quoted','won','lost'].map(s => '<option value="' + s + '">' + s.charAt(0).toUpperCase()+s.slice(1) + '</option>').join('');
  const rows = leads.map(l => {
    const date = new Date(l.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
    return '<tr>' +
      '<td><div class="lead-name">'+esc(l.name)+'</div><div class="date-cell">'+date+'</div></td>' +
      '<td class="lead-phone"><a href="tel:'+esc(l.phone)+'">'+esc(l.phone)+'</a><br><span style="font-size:11px;color:rgba(213,233,240,.4)">'+esc(l.email||'')+'</span></td>' +
      '<td>'+esc(l.propertyType||'—')+'<br><span style="font-size:11px;color:rgba(213,233,240,.4)">'+(l.awningCount ? l.awningCount+' awnings' : '')+'</span></td>' +
      '<td style="max-width:200px;font-size:13px;color:rgba(213,233,240,.65)">'+esc((l.message||'').slice(0,100))+(l.message&&l.message.length>100?'…':'')+'</td>' +
      '<td><select class="status-sel" onchange="updateStatus(\''+l.id+'\',this.value)">'+statusOpts.replace('value="'+l.status+'"','value="'+l.status+'" selected')+'</select></td>' +
      '<td><input class="notes-input" value="'+esc(l.notes||'')+'" placeholder="Add note..." onblur="saveNotes(\''+l.id+'\',this.value)"></td>' +
      '<td><div class="actions"><button class="act-btn del" onclick="deleteLead(\''+l.id+'\')">Delete</button></div></td>' +
    '</tr>';
  }).join('');

  wrap.innerHTML = '<table>' +
    '<thead><tr><th>Name / Date</th><th>Contact</th><th>Property</th><th>Message</th><th>Status</th><th>Notes</th><th></th></tr></thead>' +
    '<tbody>'+rows+'</tbody></table>' +
    '<div style="padding:12px 18px;font-size:12px;color:rgba(213,233,240,.35)">Showing '+leads.length+' of '+total+' leads</div>';
}

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

async function updateStatus(id, status) {
  await fetch('/api/admin/leads/'+id, { method:'PUT', headers:{'Content-Type':'application/json','Authorization':'Bearer '+PASSWORD}, body: JSON.stringify({status}) });
  loadStats();
}

async function saveNotes(id, notes) {
  await fetch('/api/admin/leads/'+id, { method:'PUT', headers:{'Content-Type':'application/json','Authorization':'Bearer '+PASSWORD}, body: JSON.stringify({notes}) });
}

async function deleteLead(id) {
  if (!confirm('Delete this lead? This cannot be undone.')) return;
  await fetch('/api/admin/leads/'+id, { method:'DELETE', headers:{'Authorization':'Bearer '+PASSWORD} });
  loadDashboard();
}

function setFilter(f, btn) {
  currentFilter = f;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadLeads();
}

function debounceSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadLeads, 300);
}

document.getElementById('pwInput') && document.addEventListener('keydown', e => {
  if (e.key==='Enter' && document.getElementById('loginScreen').style.display !== 'none') login();
});
</script>
</body>
</html>`;
