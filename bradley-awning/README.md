# Bradley Awning — Website & Backend

## Quick Start

### 1. Install dependencies
```
npm install
```

### 2. Start the server
```
npm start
```

### 3. Open in browser
- **Website:**   http://localhost:3000
- **Admin:**     http://localhost:3000/admin  (default password: `bradley2026`)

---

## File Structure

```
bradley-awning/
├── server.js          ← Backend (Node.js/Express)
├── package.json
├── data/
│   └── leads.json     ← Auto-created, stores all estimate requests
└── public/
    └── index.html     ← Your website frontend
```

---

## Admin Dashboard

Go to `http://localhost:3000/admin` and enter your password.

**Features:**
- See all estimate requests with name, phone, email, property type
- Filter by status: New / Contacted / Quoted / Won / Lost
- Search by name or phone
- Add notes to each lead
- Track stats: total leads, today, this week, this month, won jobs
- Delete leads

**Change the admin password** — open `server.js` and find:
```js
adminPassword: process.env.ADMIN_PASSWORD || 'bradley2026',
```
Either change `'bradley2026'` to your own password, or set an environment variable:
```
ADMIN_PASSWORD=mypassword node server.js
```

---

## Email Notifications

To get emailed every time someone submits an estimate request:

1. Open `server.js`
2. Find `CONFIG.email`
3. Set `enabled: true`
4. Fill in your Gmail address and App Password (create one at myaccount.google.com → Security → App Passwords)

```js
email: {
  enabled: true,
  from: 'noreply@bradleyawning.com',
  notifyTo: 'Taylorb@bradleyawning.com',
  smtp: {
    host: 'smtp.gmail.com',
    port: 587,
    auth: {
      user: 'your@gmail.com',
      pass: 'your-app-password',
    }
  }
}
```

---

## Deploying Online (Free Options)

### Option A — Railway.app (Easiest, Free)
1. Create account at railway.app
2. Click "New Project" → "Deploy from GitHub"
3. Push your files to GitHub first, then connect
4. Set environment variable: `ADMIN_PASSWORD=yourpassword`
5. Done — Railway gives you a live URL!

### Option B — Render.com (Free)
1. Create account at render.com
2. New Web Service → connect GitHub repo
3. Build command: `npm install`
4. Start command: `node server.js`
5. Set env vars, deploy!

### Option C — VPS (DigitalOcean $6/mo)
1. Create a Droplet (Ubuntu)
2. Upload files via SFTP
3. `npm install && npm start`
4. Use PM2 to keep it running: `npm install -g pm2 && pm2 start server.js`

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/estimate` | Submit estimate request (public) |
| GET | `/api/admin/leads` | List all leads (admin) |
| PUT | `/api/admin/leads/:id` | Update status/notes (admin) |
| DELETE | `/api/admin/leads/:id` | Delete a lead (admin) |
| GET | `/api/admin/stats` | Dashboard stats (admin) |

Admin endpoints require: `Authorization: Bearer yourpassword` header.

---

## Contact
Taylor Bradley · 385-256-6659 · Taylorb@bradleyawning.com
