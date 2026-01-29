# <img width="20" height="30" alt="Syncraft logo compressed" src="https://github.com/user-attachments/assets/e0b9f873-8888-4936-afb7-b0f346e235ee" /> Syncraft

**A Real-time, Two-Way Synchronization Engine between Google Sheets and a Custom Dashboard.**

Syncraft allows users to manage Google Sheets data from a modern, secure web interface. Changes made in the Dashboard reflect instantly in the Sheet, and edits in the Sheet appear immediately on the Dashboard—all while preserving data integrity and handling multi-user conflicts.

---
### [See Live website](https://syncraft-dashboard.vercel.app/) |  [Walkthrough demo](https://drive.google.com/file/d/1jXnzX-vF4am5aBdLMTjul5_AcEuznD9m/view?usp=drive_link)

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

<img width="975" height="794" alt="Screenshot (29)" src="https://github.com/user-attachments/assets/9a5c8df0-37ad-495b-a603-f9a878af8dd8" />
<img width="1918" height="919" alt="Screenshot (23)" src="https://github.com/user-attachments/assets/51ce9384-42d1-4130-b338-9e9e49ed8645" />
<img width="1900" height="910" alt="Screenshot (24)" src="https://github.com/user-attachments/assets/f8bb128a-8738-41fd-b3c8-d20438a09930" />
<img width="1919" height="921" alt="Screenshot (25)" src="https://github.com/user-attachments/assets/74468e5a-ead5-44ae-846f-008d7e6a7d5c" />
<img width="609" height="359" alt="Screenshot (27)" src="https://github.com/user-attachments/assets/47207471-61eb-47ab-b672-a050137097b0" />
<img width="499" height="247" alt="Screenshot (28)" src="https://github.com/user-attachments/assets/1466b00c-e37c-44fa-931f-1ab49da885fd" />
<img width="467" height="311" alt="Screenshot (26)" src="https://github.com/user-attachments/assets/8c70e308-49ad-498f-b97c-4043b20e00b9" />

---

## 🛠️ Engineering Challenges & Edge Cases Handling Details

Building a true 2-way sync involves handling race conditions, data type mismatches, and infrastructure timeouts. Below is a detailed log of the specific nuances and edge cases handled in this architecture.

### 1. The "Ghost Data" & Lazy Loading Problem
* **Challenge:** When a user creates a new sheet and makes a single edit, naive webhooks only send that single row. If the backend creates a table based on just that row, the rest of the existing data in the sheet is lost.
* **Solution:** Implemented a **"Smart Import" Logic**. The backend checks if the table exists and has data. If the table is missing or practically empty, the first webhook trigger forces a **Full Sheet Fetch** to populate the initial state. Subsequent edits switch to lightweight single-row `UPSERT` operations.

### 2. Infrastructure & "Cold" Connections
* **Challenge:** Cloud databases (like TiDB Serverless) sever idle connections after 5-10 minutes, causing `ECONNRESET` errors when the backend tries to sync after a period of inactivity.
* **Solution:** Implemented a **Database Heartbeat** mechanism that pings the database every 10 seconds to keep the connection pool active and "hot," ensuring instant response times for webhooks.

### 3. Schema Sanitization & "Double Prefixing"
* **Challenge:** SQL tables cannot have columns with spaces or special characters. We sanitize headers (e.g., `Market Value` → `col_market_value`). However, sending this back to the frontend sometimes resulted in recursive sanitization (e.g., `col_col_market_value`).
* **Solution:** Built a smart sanitizer that detects existing prefixes and prevents double-labeling. Additionally, the backend performs a "Fuzzy Match" lookup when writing back to Google Sheets, correctly mapping `col_model` in the DB to `Model` in the Sheet.

### 4. Batch Operations (Multiplayer Usage)
* **Challenge:** Standard Google Apps Script `onEdit` triggers often fail or only capture the top-left cell when a user pastes a large block of data (e.g., 50 rows at once).
* **Solution:** The Apps Script logic was upgraded to detect `range` height. If multiple rows are edited, it iterates through the range and sends a **Batch Payload** ensuring every single row in the paste operation is synced to the database.

### 5. Silent Failures & Security
* **Challenge:** Securely managing `service-account.json` keys in a production environment (Render) without committing them to Git.
* **Solution:** Utilized Render's **Secret Files** mount to securely inject credentials at runtime (`/etc/secrets/`), allowing the application to authenticate with Google APIs without exposing sensitive keys in the codebase.

### 6. Empty & Duplicate Headers
* **Challenge:** Users often leave columns blank or name them identically, which crashes SQL `CREATE TABLE` commands.
* **Solution:** The sync engine automatically assigns placeholder names (e.g., `Column_5`, `Column_6`) to unnamed headers. This ensures the SQL schema generation never fails, even with messy user data.

### 7. Granular Diff Tracking
* **Challenge:** In a high-frequency edit environment, it is difficult to visualize exactly what changed in a row with many columns.
* **Solution:** The history log captures both the `prev_value` and `new_value` states as JSON. The frontend uses this to calculate the difference, highlighting specific cell changes in the audit log rather than just showing a generic "Row Updated" message.

### 8. Port Collision & Environment Isolation
* **Challenge:** Running a full-stack Next.js app alongside an Express API locally often leads to port conflicts, especially when handling OAuth callbacks on `localhost:3000`.
* **Solution:** Engineered the architecture to run the Backend API strictly on **Port 5000** while keeping the Next.js Frontend on **Port 3000**. This isolation ensures that OAuth redirects and proxy rewrites function correctly without "Address already in use" errors during development.

---

## 🧠 Architecture Decision Record (ADR)

### 1. Why Webhooks + Smart Polling over WebSockets?
* **Decision:** We utilized Google Apps Script Webhooks for Sheet-to-DB sync and React Query "Smart Polling" for DB-to-Dashboard sync.
* **Reasoning:**
    * **Statelessness:** WebSockets require maintaining persistent stateful connections, which complicates horizontal scaling (serverless environments like Render often kill idle socket connections).
    * **Reliability:** Webhooks are retriable. If the server is down, the edit event isn't lost in a dropped socket connection; it can be logged or retried.
    * **Nature of Data:** Spreadsheet edits are human-speed events (seconds), not high-frequency trading (milliseconds). A 3-5 second poll interval provides a "perceived real-time" experience with significantly lower infrastructure complexity.

### 2. Why "Lazy Loading" (Snapshot vs. Stream)?
* **Decision:** The system does not import data immediately upon sheet creation. It waits for the first user edit to trigger a full snapshot import.
* **Reasoning:**
    * **Resource Efficiency:** Prevents the database from being flooded with stale or unused sheets. We only incur the cost of storage and processing for sheets that are actively being worked on.
    * **Performance:** Subsequent updates use lightweight `UPSERT` operations (single row payload) rather than re-scanning the entire sheet, ensuring O(1) performance for edits regardless of sheet size.

### 3. Handling Scale (100 Million Records)
* **Current implementation:**
    * **Server-Side Pagination:** The dashboard never fetches "all" data. It fetches chunks (`LIMIT 50 OFFSET X`), ensuring the frontend remains snappy even with million-row tables.
    * **Incremental Sync:** The sync engine processes only the *delta* (changes), never the full dataset after the initial load.
* **Future Scale Strategy:**
    * **Database Sharding:** For 100M+ records, we would shard the MySQL tables based on `sheet_id`.
    * **Queue-Based Ingestion:** Instead of processing webhooks synchronously (which might timeout on massive pastes), we would push events to a Redis Queue (BullMQ) and process them via background workers.

### 4. Authentication Strategy (Google Only)
* **Decision:** Restricted login to Google OAuth.
* **Reasoning:** Since the core integration target is Google Sheets, the user *must* have a Google identity. Implementing a separate Email/Password flow adds friction and security surface area without adding value to the core workflow.

### 5. Why a Standalone Dashboard vs. Spreadsheet Extension?
* **Decision:** Built a separate full-stack React application rather than an embedded Google Workspace Add-on.
* **Reasoning:**
    * **Control:** A standalone app offers complete control over the UI/UX rendering engine (React) without the limitations of Google's Apps Script HTML Service (CardService).
    * **Observability:** It decouples the "View" from the "Source." If Google Sheets goes down, the data remains accessible and queryable via the Dashboard.

### 6. Conflict Resolution & Audit History
* **Decision:** Implemented a `sync_history` table that logs `prev_value` and `new_value` for every cell change.
* **Reasoning:** In a 2-way sync system, "Last Write Wins" is the default strategy, but it is destructive. The history log acts as a safety net, allowing users to trace *who* overwrote data and roll back if necessary (a critical feature for multi-user environments).

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

## ❓ Frequently Asked Questions (FAQ)

### 🔹 General Usage
**1. Where do I find the Google Apps Script code?**
The full script is in `google-scripts/Code.gs`. Copy and paste it into **Extensions > Apps Script** in your Google Sheet.

**2. Google says "This app isn't verified." Is it safe?**
Yes. This appears because the script is a personal project, not published to the Marketplace. Click **Advanced > Go to (Untitled) (unsafe)** to proceed. The script only talks to your specific backend URL.

**3. How can I test this right now?**
* **Live Dashboard:** https://syncraft-dashboard.vercel.app
* **Live Google Sheet:** https://docs.google.com/spreadsheets/d/1D1VMARdHCeD412JladGjc4TdQk1O78Bwrsfs_5vjRe4/edit?usp=sharing
  *(Note: You can view the sheet. If you want to edit, please request access or fork the project to use your own credentials.)*

---

### 🔹 Technical Deep Dive (The "Genuine" Questions)

**4. What happens if I rename a Column Header in Google Sheets?**
The system treats this as a **schema evolution event**.
* If you rename `Price` to `Cost`, the backend detects a "new" column named `col_cost` and adds it to the database.
* The old `col_price` column remains in the database (to prevent accidental data loss), but it will stop receiving updates.

**5. Does this system support Excel Formulas (e.g., `=SUM(A1:B1)`)?**
Yes, but with a nuance.
* **Sheet-to-DB:** The system syncs the **calculated value**, not the formula string. This ensures the database contains the actual data (e.g., `500`) rather than `=A1+B1`.
* **DB-to-Sheet:** If the database updates a cell that contains a formula, the formula will be **overwritten** by the static value. This is standard behavior to prevent circular dependency loops.

**6. Why are all database columns set to `TEXT` type?**
Google Sheets is "loosely typed" (you can write "Free" in a "Price" column). If the MySQL database enforced strict `INT` or `DECIMAL` types, a single user typo would crash the synchronization queue.
* **Decision:** We use `TEXT` for robustness during ingestion. Type casting/validation should happen at the Application Layer (API) or Reporting Layer, not the Ingestion Layer.

**7. How do you handle "Race Conditions" (e.g., User A and User B edit the same cell instantly)?**
We use a **"Last Write Wins"** strategy at the database level, but we prioritize **Auditability**.
* Every edit is recorded in the `sync_history` table.
* Even if User B overwrites User A's work milliseconds later, the history log captures *both* transactions, allowing an admin to review or rollback changes if needed.

**8. What happens if I delete a row in Google Sheets?**
Currently, the system is designed for **Additive Sync** (Create/Update).
* Deleting a row in the Sheet does *not* delete it from the Database.
* **Reasoning:** Hard deletions in 2-way sync are dangerous. A user accidentally deleting a row shouldn't wipe historical business data. A production version would implement a "Soft Delete" (marking a flag `is_deleted = true`), but for this demo, we prioritize data retention.

**9. Why is there a delay when I create a new sheet?**
This is a feature, not a bug, called **"Lazy Loading."**
* To save bandwidth, we do not fetch data when you click "New Sheet."
* We wait for the **First Edit**. This signal tells the backend, "This sheet is active and has data." Only then do we trigger the potentially expensive operation of downloading and importing the full dataset.

**10. Why use Polling (5s) instead of WebSockets for the Dashboard?**
* **Reliability:** WebSockets are stateful and often drop connections in serverless environments (like Render) when idle.
* **Simplicity:** For a spreadsheet application, a 5-second "heartbeat" provides excellent perceived real-time performance without the massive infrastructure complexity of maintaining thousands of open socket connections.

---

**Made with 💚 by Avii**
