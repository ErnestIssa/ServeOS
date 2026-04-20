---

# ServeOS Deployment Architecture

## Official Production Infrastructure (Current Standard)

ServeOS uses a simplified scalable production architecture optimized for fast execution, low maintenance, and future growth.

This deployment architecture is mandatory unless explicitly changed by the project owner.

---

## Core Stack

### Backend API

**Provider:** Render

**Deployment Type:** Single backend deployment

**Purpose:**
Runs the full ServeOS backend application as one production service.

**Includes:**

* Authentication
* Users
* Restaurants
* Menus
* Orders
* Reservations
* Payments
* Notifications
* Internal business logic
* API endpoints for all frontend apps and future services

**Notes:**
Although the codebase may contain modular services/folders, production deployment runs as one backend service for simplicity and speed.

---

### Web Admin Dashboard

**Provider:** Render

**Deployment Type:** Static Web Service

**Purpose:**
Desktop-only admin dashboard for restaurant owners and administrators.

**Usage:**

* Menu management
* Staff management
* Reports
* Settings
* Billing
* Advanced control panel

---

### Customer Web App

**Provider:** Render

**Deployment Type:** Static Web Service

**Purpose:**
Public-facing customer ordering web app.

**Usage:**

* QR menu access
* Online ordering
* Checkout
* Booking
* Order tracking

---

### Mobile App

**Provider:** Expo EAS

**Purpose:**
Native mobile builds for iOS and Android.

**Includes:**

* Customer mobile experience
* Restaurant owner mobile operations
* Staff quick actions

**Deployment Method:**

* Expo EAS Build
* App Store deployment
* Google Play deployment

---

### Primary Database

**Provider:** Neon

**Engine:** PostgreSQL

**Purpose:**
Main production relational database.

**Stores:**

* Users
* Restaurants
* Orders
* Reservations
* Menus
* Payments metadata
* Staff accounts
* CRM data
* Audit data

---

### Cache / Realtime / Queue

**Provider:** Upstash

**Engine:** Redis

**Purpose:**
High-speed temporary infrastructure layer.

**Used For:**

* Realtime order updates
* Queue processing
* Session cache
* OTP codes
* Rate limiting
* Dashboard caching
* Background jobs
* Pub/Sub events

---

## CI/CD Standard

### Provider: Render Auto Deploy

### Workflow:

#### Backend

Push to `main` branch:

* Render auto-builds backend
* Render auto-deploys backend

#### Web Admin

Push to `main` branch:

* Render auto-builds web-admin
* Render auto-deploys web-admin

#### Customer Web

Push to `main` branch:

* Render auto-builds customer-web
* Render auto-deploys customer-web

---

## Git Branching Standard

### main

Production-ready code only.

### develop

All active development occurs here.

### Release Flow

1. Build features in `develop`
2. Test fully
3. Merge into `main`
4. Render auto deploy triggers

---

## Frontend Connection Rules

### Web Apps

Use environment variable:

`VITE_API_URL`

Points to Render backend production URL.

### Mobile App

Use environment variable:

`EXPO_PUBLIC_API_URL`

Points to Render backend production URL.

---

## Platform Rules

### Desktop Browser

Loads full web admin dashboard.

### Mobile Browser / Tablet Browser

Loads mobile app experience / responsive app version.

### Native Mobile

Uses Expo builds.

---

## Security Rules

* All production traffic uses HTTPS
* Secrets stored in Render environment variables
* Database secrets stored securely
* Redis credentials stored securely
* JWT secrets required
* No secrets hardcoded in repo

---

## Scaling Strategy (Future)

Current phase uses one backend deployment.

When growth requires:

* Separate auth service
* Separate order service
* Separate notifications service
* Separate analytics service

These may later be split into multiple Render services or migrated to AWS.

Until then:

**Single backend deployment remains official standard.**

---

## Developer Rules

All future code decisions must respect this deployment architecture.

Do not introduce:

* AWS infrastructure
* Kubernetes
* Multiple backend production services
* Alternative databases
* Alternative Redis providers
* Alternative deployment targets

Unless explicitly approved by project owner.

---

## Protected File Rule

This file is infrastructure source of truth.

Cursor must:

* Never delete this file
* Never ignore this file
* Never replace this file without permission
* Reference this file during backend/frontend/devops decisions

---

## Official Summary

ServeOS Production Stack:

* Backend API → Render
* Web Admin → Render
* Customer Web → Render
* Mobile Builds → Expo EAS
* Database → Neon PostgreSQL
* Cache / Queue / Realtime → Upstash Redis
* CI/CD → Render Auto Deploy

This is the official ServeOS deployment system.
