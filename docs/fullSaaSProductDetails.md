## Product surface rule (ALWAYS)

- **Mobile app (Expo)** is used by **restaurant customers + restaurant owners/staff** (same app, different roles/experiences).
- **Web (desktop)** is used by **customers + owners/staff**, but is primarily a **management/admin** experience for setup + deeper control.
- **Web (mobile + tablet)** should mirror the **mobile app experience** (same flows, responsive).

---

##  MOBILE APP (Operations – Owners, Staff, Customers)

* Login / Signup / Auth — email, phone, OTP, roles — **Prio**
* Onboarding / Restaurant setup (basic) — **Prio**
* Dashboard (live overview: orders, revenue, alerts) — **Prio**
* Live Orders Feed (real-time) — accept / reject / update status — **Prio**
* Order Details View — items, notes, customer — **Prio**
* Table / Reservation List — view + manage — **Prio**
* Create Reservation — **Prio**
* Walk-in Management — **Prio**
* Menu View (for staff quick access) — **Prio**
* Notifications Center (orders, system alerts) — **Prio**
* Payment View (quick status, manual mark paid) — **Prio**
* Basic Analytics (today revenue, orders count) — **Prio**
* Profile / Settings — **Prio**

---

### Customer-side (Mobile / Web QR)

* ✅ Menu Browse (categories, items) — **Prio**
* ✅ Product Details (modifiers, add-ons) — **Prio** *(read-only listing; cart flow next)*
* ✅ Cart — **Prio**
* ✅ Place Order — **Prio**
* Order Status Tracking (real-time) — **Prio**
* Payment (Stripe / Swish / Apple Pay) — **Prio**
* Order Confirmation Screen — **Prio**
* Order History — **Not Prio**
* Account / Login — **Not Prio**
* Loyalty / Rewards — **Not Prio**

---

# WEB ADMIN DASHBOARD (Control Center)

* Admin Login / Auth — **Prio**
* Main Dashboard (KPIs, charts) — **Prio**

---

### Menu Management

* ✅ Create / Edit Menu — **Prio**
* ✅ Categories management — **Prio**
* ✅ Items management — **Prio**
* ✅ Modifiers / Add-ons — **Prio**
* Availability / Scheduling — **Not Prio**

---

### Orders Management

* ✅ Orders List (all statuses) — **Prio**
* ✅ Order Details — **Prio** *(list + status update in admin; full detail view next)*
* Manual Order Creation — **Not Prio**
* Refund / cancel handling — **Not Prio**

---

### Reservations / Tables

* Table Layout Builder (drag & drop) — **Not Prio**
* Reservations List — **Prio**
* Time slots / capacity rules — **Not Prio**

---

### Customer Management (CRM)

* Customer List — **Not Prio**
* Customer Profiles — **Not Prio**
* Visit history — **Not Prio**

---

### Staff Management

* Staff accounts — **Prio**
* Roles & permissions — **Prio**
* Activity logs — **Not Prio**

---

### Payments

* Payment settings (Stripe, Swish) — **Prio**
* Transaction history — **Prio**
* Payout overview — **Not Prio**

---

### Analytics

* Sales reports — **Prio**
* Product performance — **Not Prio**
* Peak hours — **Not Prio**
* Forecasting — **Not Prio**

---

### Settings

* Restaurant profile — **Prio**
* Opening hours — **Prio**
* Tax / VAT settings — **Not Prio**
* Subscription / billing — **Prio**

---

# KITCHEN DISPLAY SYSTEM (KDS)

* Live orders screen — **Prio**
* Order status controls — **Prio**
* Timer per order — **Not Prio**
* Sound alerts — **Not Prio**

---

# BACKEND SERVICES (from your VSC structure)

### Core Services

* ✅ API Gateway — routing, auth middleware — **Prio**
* ✅ Auth Service — JWT, roles — **Prio**
* ✅ Restaurant Service — restaurants, tables — **Prio**
* ✅ Order Service — orders, statuses — **Prio**
* ✅ Menu (in restaurant service) — categories, items, modifiers, public menu — **Prio**
* Payment Service — Stripe / Swish — **Prio**
* Notification Service — push / email — **Prio**

---

### Advanced Services

* Realtime Service (WebSockets) — **Prio**
* Analytics Service — **Not Prio**
* CRM Service — **Not Prio**
* Billing Service (subscriptions) — **Prio**
* Media Service (images/uploads) — **Prio**

---

# DATABASE & STORAGE

* ✅ PostgreSQL (main database) — **Prio**
* ✅ Prisma ORM — **Prio**
* ✅ Redis (cache + real-time pub/sub) — **Prio**
* File Storage (images/menu) → AWS S3 / Cloudflare R2 — **Prio**

---

# REAL-TIME & EVENTS

* Socket.io / WebSockets — **Prio**
* Event queue (BullMQ / Redis queues) — **Prio**
* Kafka (large scale) — **Not Prio**

---

# NOTIFICATIONS & MESSAGING

* Firebase Cloud Messaging (push notifications) — **Prio**
* Email service (SendGrid / Resend) — **Prio**
* SMS (Twilio) — **Not Prio**

---

# PAYMENTS

* Stripe — **Prio**
* Swish API — **Prio**
* Apple Pay / Google Pay (via Stripe) — **Prio**

---

# AUTH & SECURITY

* JWT auth — **Prio**
* OAuth (Google login) — **Not Prio**
* Role-based access control — **Prio**
* Rate limiting — **Prio**

---

# INFRASTRUCTURE / DEVOPS

* Render / AWS (hosting) — **Prio**
* ✅ Docker — **Prio**
* Nginx (routing) — **Not Prio**
* CI/CD (GitHub Actions) — **Not Prio (early)**

---

# DEV TOOLS

* ✅ TurboRepo (monorepo) — **Prio**
* ✅ TypeScript — **Prio**
* ESLint + Prettier — **Prio**
* Postman / Insomnia — **Prio**

---

# FRONTEND STACK

### Mobile

* ✅ React Native (Expo) — **Prio**

### Web Admin

* ✅ React + Vite — **Prio**

### UI

* ✅ Tailwind CSS — **Prio**
* Component library (ShadCN / custom) — **Prio**

---

# MONITORING & LOGGING

* Logging (Winston / Pino) — **Prio**
* Error tracking (Sentry) — **Not Prio**
* Analytics (PostHog / Mixpanel) — **Not Prio**

---

# FINAL STRUCTURE LOGIC

* Mobile app = daily operations — **Prio**
* Web admin = control + setup — **Prio**
* Backend = modular services — **Prio**
* Real-time system = core engine — **Prio**

---
