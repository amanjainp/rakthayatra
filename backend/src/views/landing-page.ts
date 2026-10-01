export function renderApiLandingPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rakthayatra (LifeLink) • Backend API & Platform Hub</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@500;600;700;800&display=swap" rel="stylesheet">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🩸</text></svg>">
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: radial-gradient(circle at 50% 0%, #1e1b4b 0%, #0f172a 40%, #020617 100%);
      color: #f8fafc;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 2.5rem 1.25rem;
    }
    .container {
      width: 100%;
      max-width: 900px;
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }
    .header {
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.35rem 0.85rem;
      border-radius: 9999px;
      background: rgba(34, 197, 94, 0.15);
      border: 1px solid rgba(34, 197, 94, 0.3);
      color: #4ade80;
      font-size: 0.825rem;
      font-weight: 600;
      letter-spacing: 0.025em;
    }
    .badge-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #22c55e;
      box-shadow: 0 0 10px #22c55e;
      animation: pulse 2s infinite ease-in-out;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(1.25); }
    }
    h1 {
      font-family: 'Outfit', sans-serif;
      font-size: 2.5rem;
      font-weight: 800;
      background: linear-gradient(135deg, #ffffff 0%, #cbd5e1 50%, #f43f5e 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      letter-spacing: -0.02em;
    }
    .subtitle {
      color: #94a3b8;
      font-size: 1.1rem;
      max-width: 600px;
      line-height: 1.6;
    }
    .hero-card {
      background: rgba(30, 41, 59, 0.65);
      border: 1px solid rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(16px);
      border-radius: 1.25rem;
      padding: 2rem;
      box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      align-items: center;
      text-align: center;
    }
    .hero-card h2 {
      font-family: 'Outfit', sans-serif;
      font-size: 1.5rem;
      color: #f1f5f9;
    }
    .hero-card p {
      color: #94a3b8;
      line-height: 1.6;
      max-width: 650px;
    }
    .cta-group {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      justify-content: center;
      margin-top: 0.5rem;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.85rem 1.6rem;
      border-radius: 0.75rem;
      font-size: 0.95rem;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.2s ease;
      cursor: pointer;
    }
    .btn-primary {
      background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);
      color: #ffffff;
      box-shadow: 0 4px 20px rgba(225, 29, 72, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
    .btn-primary:hover {
      background: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%);
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(225, 29, 72, 0.6);
    }
    .btn-secondary {
      background: rgba(51, 65, 85, 0.8);
      color: #e2e8f0;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .btn-secondary:hover {
      background: rgba(71, 85, 105, 0.9);
      color: #ffffff;
      transform: translateY(-2px);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1.5rem;
    }
    .card {
      background: rgba(30, 41, 59, 0.45);
      border: 1px solid rgba(255, 255, 255, 0.06);
      backdrop-filter: blur(12px);
      border-radius: 1rem;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .card-title {
      font-family: 'Outfit', sans-serif;
      font-size: 1.15rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: #f8fafc;
    }
    .credentials-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }
    .credentials-table th, .credentials-table td {
      padding: 0.6rem 0.5rem;
      text-align: left;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }
    .credentials-table th {
      color: #94a3b8;
      font-weight: 500;
    }
    .credentials-table td code {
      background: rgba(15, 23, 42, 0.8);
      padding: 0.2rem 0.4rem;
      border-radius: 0.35rem;
      color: #38bdf8;
      font-family: monospace;
      font-size: 0.825rem;
    }
    .endpoints-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .endpoint-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.5rem 0.75rem;
      background: rgba(15, 23, 42, 0.5);
      border-radius: 0.5rem;
      border: 1px solid rgba(255, 255, 255, 0.04);
      font-size: 0.875rem;
    }
    .endpoint-item code {
      color: #a5b4fc;
      font-family: monospace;
    }
    .endpoint-badge {
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.15rem 0.45rem;
      border-radius: 0.25rem;
      background: rgba(34, 197, 94, 0.2);
      color: #4ade80;
    }
    .footer {
      text-align: center;
      color: #64748b;
      font-size: 0.85rem;
      padding-top: 1rem;
    }
    .footer a {
      color: #94a3b8;
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="badge">
        <span class="badge-dot"></span>
        API Service Online & Healthy
      </div>
      <h1>Rakthayatra (LifeLink)</h1>
      <p class="subtitle">Cloud Blood Donation & Emergency Matching API Server</p>
    </div>

    <div class="hero-card">
      <h2>Looking for the Web Application Interface?</h2>
      <p>
        You are currently viewing the <strong>Backend API Service</strong>. The full interactive React user interface (Donor portal, Blood Bank inventory, Emergency requests, and Admin dashboard) is hosted on the sibling <strong>Frontend Static Site</strong> on Render.
      </p>
      <div class="cta-group">
        <a id="frontend-link" href="https://rakthayatra-frontend.onrender.com" target="_blank" class="btn btn-primary">
          🚀 Open LifeLink Web App
        </a>
        <a href="/health" class="btn btn-secondary">
          🩺 View System Health
        </a>
        <a href="/?json=true" class="btn btn-secondary">
          📋 Raw JSON Response
        </a>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="card-title">🔑 Seed Login Credentials</div>
        <p style="font-size: 0.85rem; color: #94a3b8;">Use these test credentials on the web application login page:</p>
        <table class="credentials-table">
          <thead>
            <tr><th>Role</th><th>Email</th><th>Password</th></tr>
          </thead>
          <tbody>
            <tr><td>Admin</td><td><code>admin@lifelink.org</code></td><td><code>Admin@1234</code></td></tr>
            <tr><td>Blood Bank</td><td><code>citybank@lifelink.org</code></td><td><code>Bank@1234</code></td></tr>
            <tr><td>Hospital</td><td><code>apollo@lifelink.org</code></td><td><code>Hosp@1234</code></td></tr>
            <tr><td>Donor</td><td><code>aman.jain@donor.org</code></td><td><code>Donor@1234</code></td></tr>
          </tbody>
        </table>
      </div>

      <div class="card">
        <div class="card-title">⚡ Available API Endpoints</div>
        <div class="endpoints-list">
          <div class="endpoint-item">
            <code>GET /health</code>
            <span class="endpoint-badge">200 OK</span>
          </div>
          <div class="endpoint-item">
            <code>GET /health/ready</code>
            <span class="endpoint-badge">DEPENDENCIES</span>
          </div>
          <div class="endpoint-item">
            <code>POST /api/auth/login</code>
            <span class="endpoint-badge">JWT AUTH</span>
          </div>
          <div class="endpoint-item">
            <code>GET /api/inventory</code>
            <span class="endpoint-badge">INVENTORY</span>
          </div>
          <div class="endpoint-item">
            <code>GET /api/requests</code>
            <span class="endpoint-badge">REQUESTS</span>
          </div>
          <div class="endpoint-item">
            <code>GET /metrics</code>
            <span class="endpoint-badge">PROMETHEUS</span>
          </div>
        </div>
      </div>
    </div>

    <div class="footer">
      Rakthayatra Platform v1.0.0 • Deployed on Render • PostgreSQL Database Connected
    </div>
  </div>

  <script>
    // Dynamically calculate sibling frontend static site URL if on render.com
    (function() {
      const host = window.location.hostname;
      if (host.includes('-backend.onrender.com')) {
        const frontendHost = host.replace('-backend.onrender.com', '-frontend.onrender.com');
        const link = document.getElementById('frontend-link');
        if (link) {
          link.href = 'https://' + frontendHost;
        }
      }
    })();
  </script>
</body>
</html>
`;
}
