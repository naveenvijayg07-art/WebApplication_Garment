# Supplier Work Order Portal

A web-based portal integrating directly with the company's SQL Server ERP database. It allows suppliers to view work orders, check Delivery Challan (DC) details, log completed quantities, and track balances. It also provides an administrative portal for managing supplier access and monitoring production statuses.

---

## Recommended Repository Name

- **`supplier-work-order-portal`** *(Recommended)*
- Alternative: **`erp-supplier-portal`** or **`WebApplication_Garment`**

---

## Tech Stack

- **Frontend**: React 18, Vite, TypeScript, Pure CSS, Lucide Icons
- **Backend**: Node.js, Express, TypeScript, `mssql` (SQL Server)
- **Authentication**:
  - **Suppliers**: GST Number & password with JWT token authentication
  - **Admins**: Direct integration with ERP `MasterEmployee` table using legacy ERP password decryption
- **Database**: Microsoft SQL Server (Read-only access on core ERP tables)
- **Deployment**: Express static file serving + PM2 process manager

---

## Key Features

1. **Supplier Work Order Tracking**:
   - Consolidated work orders grouped by work order number, fabric/colour, and process.
   - Combined total order quantities (even across multiple line entries/DCs).
   - Real-time completed quantity logging and balance tracking.

2. **Delivery Challan (DC) Details**:
   - Inspect specific DC numbers, DC dates, and allocated quantities per work order directly from ERP tables.

3. **Admin Portal**:
   - Secure login via `MasterEmployee` (Employee Code, Employee Name, or Contact Number).
   - Supplier credential management: create, activate, deactivate, or reset supplier passwords.
   - Work order completion monitoring and status auditing.

4. **Production Ready & Optimized**:
   - Direct indexed database queries for sub-second page loads.
   - Built-in rate limiting, security headers (`helmet`), and CORS protection.
   - Single-port deployment (Express serves both API and React frontend).

---

## Project Structure

```text
WebApplication_Garment/
├── backend/
│   ├── src/
│   │   ├── config/       # Database pool, constants, and query mappings
│   │   ├── middleware/   # JWT verification and role-based access control
│   │   ├── routes/       # Auth, Supplier, and Admin API routes
│   │   └── server.ts     # Main Express application entry point
│   ├── dist/             # Compiled JavaScript output
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── api/          # Axios HTTP clients for Auth, Admin, and Supplier
│   │   ├── pages/        # Login, Work Orders, Supplier Management pages
│   │   ├── types/        # TypeScript interfaces and data models
│   │   └── App.tsx       # Routing and navigation
│   ├── dist/             # Production build of the React app
│   ├── package.json
│   └── vite.config.ts
│
├── .gitignore
└── README.md
```

---

## Getting Started

### 1. Prerequisites
- Node.js (v18+ recommended)
- SQL Server access with ERP database (`ERP_DB`)

### 2. Backend Setup
```bash
cd backend
npm install
npm run build
```

Configure your environment in `backend/.env`:
```env
PORT=5000
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_SERVER=your_db_ip_or_host
DB_PORT=1433
DB_DATABASE=ERP_DB
JWT_SECRET=your_jwt_secret_key
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run build
```

---

## Running in Production (with PM2)

1. Build both frontend and backend:
   ```bash
   # In frontend/
   npm run build

   # In backend/
   npm run build
   ```

2. Start or restart backend with PM2:
   ```bash
   cd backend
   pm2 start dist/src/server.js --name "supplier-portal"
   ```
   Or if already running:
   ```bash
   pm2 restart all
   ```

3. Open the portal in your browser:
   ```text
   http://<SERVER_IP>:5000
   ```
