# OfferBazaar

> **OfferBazaar is a modern, full-stack deals and marketplace platform featuring a high-performance React frontend and a scalable Express MVC backend integrated with MongoDB Atlas and Cloudinary.**

> **Developed by Sarvesh Mekhe**

---

## 🚀 Tech Stack

- **Client (`/client`)**: React 19, Vite, Tailwind CSS v4, Lucide Icons, ESLint, Prettier
- **Server (`/server`)**: Node.js, Express (ES Modules), MongoDB Atlas (Mongoose), Cloudinary Node SDK, ESLint, Prettier
- **Quality & Standards**: ESLint 9 (Flat Config), Prettier formatting, Git version control, MIT License

---

## 📁 Project Structure

```text
Offerbazaar/
├── .env.example                # Root environment variables template
├── .gitignore                  # Git ignore rules for repo
├── LICENSE                     # MIT License (Copyright (c) 2026 Sarvesh Mekhe)
├── README.md                   # Project documentation
│
├── client/                     # Frontend application
│   ├── public/                 # Static assets
│   ├── src/
│   │   ├── components/         # Reusable React components
│   │   ├── App.jsx             # Main dashboard & live health monitor
│   │   ├── index.css           # Tailwind CSS imports & global styles
│   │   └── main.jsx            # React root entry point
│   ├── index.html              # HTML shell with Google Fonts & metadata
│   ├── vite.config.js          # Vite configuration with Tailwind & API proxy
│   ├── eslint.config.js        # ESLint 9 configuration for React
│   ├── .prettierrc             # Prettier rules for client
│   └── package.json            # Author: Sarvesh Mekhe
│
└── server/                     # Backend API (MVC Architecture)
    ├── config/
    │   ├── db.js               # MongoDB Atlas connection & ping status
    │   └── cloudinary.js       # Cloudinary SDK setup & ping status
    ├── controllers/
    │   └── health.controller.js # Health-check controller
    ├── middleware/
    │   ├── error.middleware.js # Centralized error handler
    │   └── notFound.middleware.js # 404 handler
    ├── models/
    │   └── .gitkeep            # Mongoose schemas & data models
    ├── routes/
    │   ├── health.routes.js    # /health route
    │   └── index.js            # Combined API router
    ├── utils/
    │   └── apiResponse.js      # Standardized API response formatters
    ├── .env.example            # Backend environment variables template
    ├── app.js                  # Express app setup, CORS & middleware
    ├── server.js               # Server entry point & graceful shutdown
    ├── eslint.config.mjs       # ESLint 9 configuration for Node.js
    ├── .prettierrc             # Prettier rules for server
    └── package.json            # Author: Sarvesh Mekhe
```

---

## ⚙️ Environment Configuration

1. In the `server` directory, copy `.env.example` to create `.env`:

   ```bash
   cd server
   cp .env.example .env
   ```

2. Fill in your credentials inside `server/.env`:

   ```env
   PORT=5000
   NODE_ENV=development
   CLIENT_URL=http://localhost:5173

   # MongoDB Atlas Connection String
   MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/offerbazaar?retryWrites=true&w=majority

   # Cloudinary Media Configuration
   CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
   CLOUDINARY_API_KEY=your_cloudinary_api_key
   CLOUDINARY_API_SECRET=your_cloudinary_api_secret
   ```

---

## 🏃 Running the Project Locally

### ⚡ Quick Start (Client + Server Together)

From the project root:

```bash
npm install
npm run dev
```

This launches both the Vite client (`http://localhost:5173`) and the Express server (`http://localhost:5000`) concurrently.

---

### Starting Services Individually

#### 1. Start the Server (Backend)

Open a terminal and run:

```bash
cd server
npm install
npm run dev
```

- The Express API server will start on **`http://localhost:5000`**.
- Health check endpoint is accessible at **`http://localhost:5000/api/health`**.

### 2. Start the Client (Frontend)

Open a second terminal and run:

```bash
cd client
npm install
npm run dev
```

- The React Vite client will launch on **`http://localhost:5173`**.
- Requests to `/api/*` are automatically proxied to `http://localhost:5000`.

---

## 🩺 Health Check API

The backend includes an automated health check endpoint to verify database and cloud storage availability:

- **Endpoint**: `GET /api/health`
- **Verification**:
  - **MongoDB Atlas**: Tests Mongoose connection state and executes a ping command against the database cluster.
  - **Cloudinary**: Executes an authenticated `ping()` request against the Cloudinary Admin API.

### Sample Response

```json
{
  "status": "healthy",
  "timestamp": "2026-09-11T17:15:00.000Z",
  "uptimeSeconds": 120,
  "responseTimeMs": 14,
  "services": {
    "database": {
      "status": "up",
      "message": "MongoDB Atlas is connected and reachable",
      "readyState": 1
    },
    "cloudinary": {
      "status": "up",
      "message": "Cloudinary API is reachable and credentials are valid",
      "cloudName": "your_cloud_name"
    }
  }
}
```

---

## 🛠️ Code Quality & Formatting

Both `client` and `server` have standardized ESLint and Prettier configurations.

### Client
```bash
cd client
npm run lint       # Run ESLint
npm run lint:fix   # Auto-fix lint issues
npm run format     # Format code with Prettier
```

### Server
```bash
cd server
npm run lint       # Run ESLint
npm run lint:fix   # Auto-fix lint issues
npm run format     # Format code with Prettier
```

---

## 🚀 Deploying to Vercel

The app is split into **two independent Vercel projects** so the API can scale
on its own while the frontend is served as static assets from the CDN.

| Project | Root Directory | Framework | Production URL |
| --- | --- | --- | --- |
| `offerbazaar-server` | `server` | Express | `https://offerbazaar-server.vercel.app` |
| `offerbazaar` (web) | `client` | Vite | `https://offerbazaar.vercel.app` |

### 1. Deploy the API (`server`)

1. **Create the project** — import the repo, set **Root Directory = `server`**,
   and set **Framework Preset = Express**. Vercel detects `server/app.js` as the
   entrypoint and bundles the whole app into a single Function.
2. **Add environment variables** (Project Settings → Environment Variables):

   ```
   NODE_ENV=production
   CLIENT_URL=https://offerbazaar.vercel.app
   MONGO_URI=mongodb+srv://<user>:<pass>@cluster0.mongodb.net/offerbazaar?retryWrites=true&w=majority
   JWT_SECRET=<openssl rand -hex 32>
   JWT_EXPIRES_IN=7d
   CLOUDINARY_CLOUD_NAME=...
   CLOUDINARY_API_KEY=...
   CLOUDINARY_API_SECRET=...
   VALIDATION_MODE=auto
   LLM_API_KEY=...
   LLM_MODEL=gpt-4o-mini
   COOKIE_SAMESITE=strict
   ```

3. **Allow Vercel in MongoDB Atlas** — Atlas → Network Access → add
   `0.0.0.0/0` (or the Vercel egress ranges). Without this every function
   invocation fails to reach the cluster.
4. **Seed the database** once, from your machine (not from Vercel):
   ```bash
   cd server
   # .env must contain the production MONGO_URI / ADMIN_* values
   npm run seed
   ```
5. **Deploy.** `GET https://offerbazaar-server.vercel.app/api/health` must
   return `"status": "healthy"`.

### 2. Deploy the frontend (`client`)

1. Import the repo again, set **Root Directory = `client`**,
   **Framework Preset = Vite**. No environment variables are needed — the
   client calls `/api/*` on its own origin.
2. Update the API host in `client/vercel.json` if your API project has a
   different name:
   ```json
   { "source": "/api/:path*", "destination": "https://<your-api-domain>/api/:path*" }
   ```
3. **Deploy.** The Vercel rewrite proxies `/api/*` to the API project, so the
   browser only ever talks to one origin and the auth cookie stays first-party.

### Production notes

- **Rate limiting** — `app.set('trust proxy', 1)` makes Express read the real
  client IP from `X-Forwarded-For`. The `x-test-client-ip` header is honoured
  **only** when `NODE_ENV=test`, so it cannot be used to bypass limits in
  production.
- **Database connections** — the Mongoose connection is created lazily and
  cached on the function instance (`globalThis`), so warm invocations reuse the
  pool instead of opening a new one on every request. The pool is capped at 5
  connections per instance.
- **Image uploads** — the browser uploads directly to Cloudinary using a
  signature issued by `POST /api/upload/sign`. This keeps file bytes out of
  the function, avoiding Vercel's 4.5 MB request body limit. The
  `POST /api/upload` proxy route remains as a fallback for small files.
- **Request body limit** — Vercel caps request/response bodies at 4.5 MB.
  `express.json()` is limited to 1 MB and uploads to 4 MB per file.
- **Function duration** — `maxDuration` is 60 s (set in `server/vercel.json`),
  enough for the parallel LLM + geocoding + vision validation pipeline.
- **LLM key** — without `LLM_API_KEY` the text validator cannot run, so every
  offer is routed to the manual review queue (`flagged_for_review`).

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) - Copyright (c) 2026 **Sarvesh Mekhe**.
