# Syncraft ⚡️

**A Real-time, Two-Way Synchronization Engine between Google Sheets and a Custom Dashboard.**

Syncraft allows users to manage Google Sheets data from a modern, secure web interface. Changes made in the Dashboard reflect instantly in the Sheet, and edits in the Sheet appear immediately on the Dashboard—all while preserving data integrity and handling multi-user conflicts.

---
### [See Live](https://syncraft-dashboard.vercel.app/) |  [Demo](https://syncraft-dashboard.vercel.app/)

## 🚀 Key Features (The "Nuances" Handled)

1.  **Multiplayer Identity Injection**: Even when a user edits the Google Sheet directly, their email identity (`Session.getActiveUser()`) is captured and synced to the dashboard's audit log.
2.  **Concurrency Control**: Implements **Optimistic UI** updates and **Atomic SQL Transactions** (`ON DUPLICATE KEY UPDATE`) to prevent race conditions when multiple users edit the same row simultaneously.
3.  **Google Quota Management**: Uses a **Batch Processing Queue** in Apps Script to bundle rapid edits into single API calls, avoiding Google's 6-second execution limit.
4.  **Dynamic Schema Adaptation**: The backend automatically detects column changes in the Sheet and alters the MySQL schema on the fly—no manual migration scripts needed.
5.  **Secure Access**: Built with **NextAuth v5** (OAuth 2.0) and a strict Middleware "Bouncer" that restricts access to an allowed list of Admin emails.
6.  **Audit Trails**: A "Conflict Log" records the `prev_value` vs `new_value` for every change, ensuring complete data accountability.

---

## 🛠 Tech Stack

* **Frontend:** Next.js 15 (App Router), TypeScript, Tailwind CSS, TanStack Query.
* **Backend:** Node.js, Express, MySQL (TiDB Serverless).
* **Integration:** Google Sheets API v4, Google Apps Script (Webhooks).
* **Auth:** NextAuth.js (Google Provider).

---

## 🏗 Architecture

```text
[ Google Sheet ]  <--->  [ Apps Script Trigger ]
       ^                          |
       | (Polling/API)            | (Webhook POST)
       v                          v
[ Node.js Backend ] <---> [ MySQL Database ]
```

---

## ⚙️ Setup Instructions
**Prerequisites:**
* Node.js v18+

* A Google Cloud Project (with Sheets API enabled)

* A MySQL Database (Local or Cloud)

**1. Backend Setup**
```Bash
cd backend
npm install
```
Create a .env file in /backend:

```Code snippet
PORT=5000
DB_HOST=your-db-host
DB_USER=your-db-user
DB_PASSWORD=your-db-pass
DB_NAME=test
SPREADSHEET_ID=your-google-sheet-id
GOOGLE_CREDENTIALS_PATH=./service_account.json
```
Run the server:

```Bash
node server.js
```
**2. Frontend Setup**
```Bash
cd syncraft-dashboard
npm install
```
Create a .env file in /syncraft-dashboard:

```Code snippet
AUTH_SECRET=random_string
AUTH_GOOGLE_ID=your-google-client-id
AUTH_GOOGLE_SECRET=your-google-client-secret
ADMIN_EMAILS=admin1@gmail.com,admin2@gmail.com
NEXT_PUBLIC_API_URL=http://localhost:5000
```
Run the dashboard:

```Bash
npm run dev
```
**3. Google Sheet Setup**
Open your `Google Sheet` -> `Extensions` -> `Apps Script`.

Paste the code from `google-script/Code.gs`.

Update `BACKEND_URL` to your deployed backend address.

Add an installable Trigger: `Function: handleEdit` -> `Event Source: Spreadsheet` -> `Event Type: On Edit`.

---

## 📸 Screenshots

---

## 🧪 Edge Case Handling Details
* **Diff Tracking:** The history log calculates the difference between old and new JSON states to highlight only specific cell changes.

* **Port Collision:** The backend runs on Port 5000 to leave Port 3000 open for Next.js and OAuth callbacks.

* **Empty Columns:** The sync engine automatically assigns placeholder names (Column_5) to unnamed headers to prevent SQL crashes.

---

## 🔮 Future Roadmap & Scalability

While the current MVP demonstrates a robust single-tenant architecture, the roadmap for Syncraft focuses on transitioning to a multi-tenant SaaS platform with enterprise-grade features.

### 1. Architecture Transition (SaaS Model)
* **Multi-Tenancy:** Migration from configuration-based setup (`.env`) to a relational metadata schema (`Users`, `Organizations`, `Projects`) allowing a single user to manage multiple distinct Sheet synchronizations.
* **Google Workspace Add-on:** Replacing the manual Apps Script deployment with a published **Workspace Add-on**. This will allow users to "Connect to Syncraft" directly from the Google Sheets sidebar, automatically provisioning webhooks and API keys.

### 2. Advanced User Management
* **Role-Based Access Control (RBAC):** Implementing granular permissions beyond the current binary Admin/No-Access model:
    * **Viewer:** Read-only access to dashboard data (for stakeholders).
    * **Editor:** Cell-level updates allowed; schema changes restricted.
    * **Owner:** Full control over project settings, user invites, and billing.
* **Organization-Level Admins:** Allowing "Super Admins" to invite team members via email and assign them to specific projects/sheets.

### 3. Data Integrity & Visualization
* **Type Enforcement Layer:** Unlike Google Sheets (which is loosely typed), the Dashboard will enforce strict data types (e.g., Currency, Date, Email, Select Dropdowns) during input, preventing "bad data" from corrupting the database.
* **Dynamic Views:** Leveraging the underlying data to offer alternative visualizations:
    * **Kanban View:** Automatically grouping rows by "Status" columns.
    * **Calendar View:** Visualizing rows based on "Date" columns.
    * **Form View:** Public-facing forms to allow external users to append rows without full table access.

### 4. UX & Performance
* **Theme Toggle:** Implementation of system-aware Dark/Light mode (UI scaffolding already present).
* **Virtualization:** Implementing `react-window` for the Data Table to support rendering 10,000+ rows with zero performance degradation.
* **Offline Mode:** PWA (Progressive Web App) support to allow dashboard edits while offline, syncing changes to the queue once connectivity is restored.

---
**Made with 💚 by Avii**
