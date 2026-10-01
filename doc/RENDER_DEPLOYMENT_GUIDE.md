# LifeLink / Rakthayatra - Render Deployment Guide

This guide provides instructions to deploy the **Rakthayatra (LifeLink)** platform on [Render](https://render.com).

---

## Architecture Overview

The system consists of three components on Render:
1. **Managed PostgreSQL Database**: Stores user accounts, blood inventory, hospital profiles, donor records, and donation camps.
2. **Backend API (Web Service)**: Node.js / Express REST API with Prisma ORM, JWT authentication, and health checks.
3. **Frontend Client (Static Site)**: React + Vite Single Page Application (SPA) with client-side routing.

```
       +-----------------------------------------------+
       |             Render Static Site                |
       |         (React 18 + Vite Frontend)            |
       +-----------------------+-----------------------+
                               |
                   HTTPS (VITE_API_URL)
                               |
                               v
       +-----------------------------------------------+
       |              Render Web Service               |
       |           (Node.js Express Backend)           |
       +-----------------------+-----------------------+
                               |
                  Internal PostgreSQL Network
                               |
                               v
       +-----------------------------------------------+
       |           Render PostgreSQL Database          |
       |             (Managed PostgreSQL)              |
       +-----------------------------------------------+
```

---

## Method 1: Automated Blueprint Deployment (Recommended)

Render provides Infrastructure as Code via `render.yaml`. This is the fastest, zero-touch method.

### Prerequisites
1. Push your latest code with `render.yaml` to your GitHub repository:
   ```bash
   git add .
   git commit -m "feat: add render deployment configuration"
   git push origin main
   ```
2. Log in to [Render Dashboard](https://dashboard.render.com).

### Deployment Steps
1. In your Render Dashboard, click **New +** at the top right and select **Blueprint**.
2. Connect your GitHub account and select the **rakthayatra** repository.
3. Render will parse `render.yaml` and display the blueprint resources:
   * **`rakthayatra-db`** (PostgreSQL Database)
   * **`rakthayatra-backend`** (Web Service)
   * **`rakthayatra-frontend`** (Static Site)
4. Click **Apply**.
5. Render will automatically:
   * Provision the PostgreSQL database.
   * Connect the backend to the database.
   * Run Prisma migrations and seed default roles and accounts via `seed-prod.ts`.
   * Build the frontend with the backend URL linked.
6. Once deployment completes, your frontend static site URL will be live!

---

## Method 2: Manual Dashboard Deployment (Step-by-Step)

If you prefer to configure each service manually in the Render UI:

### Step 1: Create the PostgreSQL Database
1. Go to **Dashboard** -> Click **New +** -> Select **PostgreSQL**.
2. Fill in the database details:
   * **Name**: `rakthayatra-db`
   * **Database**: `rakthayatra`
   * **User**: `rakthayatra_user`
   * **Region**: Choose a region closest to your users (e.g., `Oregon`, `Frankfurt`, or `Singapore`).
   * **PostgreSQL Version**: `16` (or latest default).
   * **Instance Type**: `Free` (or `Starter` for production).
3. Click **Create Database**.
4. Once created, locate the **Connections** section on the database details page:
   * Copy the **Internal Database URL** (e.g. `postgres://rakthayatra_user:...@dpg-...-a/rakthayatra`). You will need this for the backend.

---

### Step 2: Create the Backend Web Service
1. Click **New +** -> Select **Web Service**.
2. Connect your **rakthayatra** repository.
3. Configure the service settings:
   * **Name**: `rakthayatra-backend`
   * **Region**: *Select the same region as your database* (crucial for latency and internal networking).
   * **Branch**: `main`
   * **Root Directory**: `backend`
   * **Runtime**: `Node`
   * **Build Command**:
     ```bash
     npm install --include=dev && npx prisma generate && npx prisma db push --skip-generate && node prisma/seed-prod.js && npm run build
     ```
   * **Start Command**:
     ```bash
     npm start
     ```
   * **Instance Type**: `Free` (or `Starter`).
4. Expand **Advanced** -> Add the **Environment Variables**:

| Variable Name | Recommended Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production mode |
| `PORT` | `5000` | Port for Express listener (Render routes automatically) |
| `DATABASE_URL` | *(Paste Internal Database URL from Step 1)* | Connection string to Render PostgreSQL |
| `JWT_SECRET` | *(Click "Generate" or enter a 32+ character random secret)* | Signs JWT session tokens |
| `ENCRYPTION_KEYS` | `dev-key-must-be-32-characters-long-!` | 32-character AES field encryption key |
| `ALLOWED_ORIGINS` | `*` *(or your frontend URL after Step 3)* | Allowed CORS origins |
| `LOG_LEVEL` | `info` | Logging verbosity |

5. Under **Health Check Path**, enter:
   ```
   /health
   ```
6. Click **Create Web Service**.
7. Wait for the build and deployment logs to say:
   `Server is running in production mode on port ...`
8. Copy your backend URL from the top of the service page (e.g. `https://rakthayatra-backend.onrender.com`).

---

### Step 3: Create the Frontend Static Site
1. Click **New +** -> Select **Static Site**.
2. Connect the **rakthayatra** repository.
3. Configure the static site settings:
   * **Name**: `rakthayatra-frontend`
   * **Branch**: `main`
   * **Root Directory**: `frontend`
   * **Build Command**:
     ```bash
     npm install && npm run build
     ```
   * **Publish Directory**:
     ```bash
     dist
     ```
4. Expand **Advanced** -> Add the environment variable:

| Variable Name | Value | Note |
| :--- | :--- | :--- |
| `VITE_API_URL` | `https://rakthayatra-backend.onrender.com/api` | Your backend URL from Step 2 with `/api` |

5. Click **Create Static Site**.

---

### Step 4: Configure SPA Client-Side Routing (Important!)
React Router requires all sub-routes (e.g. `/donor/dashboard`, `/login`, `/register`) to redirect to `/index.html` on direct page refresh.

1. In your **rakthayatra-frontend** Static Site page on Render:
2. Go to **Redirects/Rewrites** in the left sidebar.
3. Click **Add Rule**:
   * **Type**: `Rewrite`
   * **Source**: `/*`
   * **Destination**: `/index.html`
4. Click **Save**.

---

## Default Seed Accounts for Testing

The production seed script (`seed-prod.ts`) automatically provisions default roles and accounts:

| Role | Email | Password | Dashboard URL |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@lifelink.org` | `Admin@1234` | `/admin/dashboard` |
| **Donor** | `aman.jain@donor.org` | `Donor@1234` | `/donor/dashboard` |
| **Hospital** | `apollo@lifelink.org` | `Hosp@1234` | `/hospital/dashboard` |
| **Blood Bank** | `citybank@lifelink.org` | `Bank@1234` | `/blood-bank/dashboard` |

*(You can also register new accounts directly from the `/register` page.)*

---

## Common Render Gotchas & Troubleshooting

### 1. Free Tier Spin-Down (Cold Start)
* On Render's Free tier, Web Services spin down after 15 minutes of inactivity.
* When a new request arrives, it may take 30–50 seconds for the backend service to wake up.
* **Fix**: For production environments, upgrade the backend service to the `Starter` plan ($7/mo) to keep it running 24/7 with zero cold starts.

### 2. Updating Frontend API URL
* `VITE_` variables are baked into the frontend JavaScript bundle during `npm run build`.
* If you change `VITE_API_URL` in the Render dashboard, you **must trigger a manual redeploy** ("Clear build cache & deploy") so Vite rebuilds the assets with the new URL.

### 3. Database SSL / Connections
* When using Render's **Internal Database URL**, traffic stays within Render's private network, which provides faster query performance and lower latency.
* If connecting from an external client (like pgAdmin or local machine), use the **External Database URL** with SSL mode enabled.

### 4. Direct Refresh 404 Errors
* If clicking refresh on `/donor/dashboard` gives a 404 error, make sure the SPA Rewrite rule (`/*` -> `/index.html`) is active under the Static Site **Redirects/Rewrites** settings.
