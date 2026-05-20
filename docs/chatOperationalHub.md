# ServeOS Chat — Operational hub (product spec)

This document defines what the **Chat** surface is across ServeOS (mobile, web admin, backend). It is **not** a generic messaging product. Chat is a **real-time operational control layer** linking customers, staff, kitchen, owners, and support/admin.

**Design north star:** a **live order communication hub**, not a WhatsApp-style social chat.

---

## 1. Three channel types (keep them separate)

| Type | Who | Purpose |
|------|-----|---------|
| **A — Customer ↔ restaurant (order-based)** | Customer ↔ venue | Highest priority. Dietary changes, delays, “where is my order?”, table requests, special instructions. **Always tied to an order or a table.** |
| **B — Staff ↔ staff (internal ops)** | Staff only | Kitchen ↔ front of house, cashier ↔ waiter, manager alerts, coordination (e.g. “Table 12 needs water”, “Order #104 ready”). |
| **C — Support / admin (system level)** | Owner ↔ platform | Onboarding help, billing/support, system-level alerts from ServeOS. |

Mixing these without clear **channel types** will make the product messy quickly.

---

## 2. Logical structure

Treat the chat system as three families of rooms, not one undifferentiated inbox:

```text
CHAT SYSTEM
├── Order chats      (customer threads; order/table scoped)
├── Internal chats   (staff threads)
└── Support chat     (admin / platform thread)
```

Each room has a **`type`** (or equivalent) that drives routing, permissions, and UI.

---

## 3. Visual structure — desktop (admin / owner)

- **Left:** sidebar list of threads — active orders first, completed orders, table chats, kitchen channel, support, etc.
- **Center:** conversation with **header context** — order id, status, customer, table when relevant.
- **Bottom:** composer + **quick actions** (operational shortcuts, not only “send”).
- **Right (when useful):** **order context panel** — items, price, status, payment, table — so chat and order state stay linked.

---

## 4. Visual structure — mobile (Expo app)

**List screen:** compact entries — e.g. “Order #104” (with active emphasis), “Table 12”, “Kitchen”, “Support”.

**Detail screen:** single thread view with clear order/thread title, messages (including system lines), then composer.

Mobile prioritizes **scanning “what needs attention”** and **one-tap depth** into the right operational thread.

---

## 5. What makes this “operations chat” (not normal chat)

1. **System messages (required)**  
   Auto-generated from domain events — e.g. order accepted, delayed, payment received, item out of stock. These are **not** free-typed by users.

2. **Action affordances in-thread**  
   Staff (and sometimes customer flows) expose **actions** next to or derived from messages — e.g. refund/replace templates after “order is wrong”; “mark served”, “notify waiter”, “delay 5 min” after kitchen signals. Goal: **resolve operations without leaving the thread.**

3. **Order linkage + context**  
   Especially on desktop: chat stays visually and logically tied to **current order state**, not a detached conversation.

---

## 6. Experience flows (reference)

**After customer places order**

1. Order created  
2. Order-scoped chat exists / opens as the operational thread  
3. System message(s) seed the timeline  
4. Restaurant may reply  
5. Subsequent updates stream in real time  

**When something goes wrong**

- Customer message can **flag** the order, **notify** kitchen/staff, and surface **quick actions** for staff (templates, refunds, replacements as product allows).

---

## 7. Backend principles

- Chat is **not** an isolated subsystem: it **subscribes to and emits** the same operational events as orders and payments (e.g. `ORDER_CREATED`, `MESSAGE_SENT`, `ORDER_UPDATED`, `PAYMENT_CONFIRMED`).
- Persist messages in the main data store; **publish** changes for realtime fan-out (e.g. Redis pub/sub) to the **realtime/WebSocket** layer so all relevant devices update immediately.

**Reference pipeline**

```text
User sends message
  → API Gateway
  → Chat (domain) service
  → PostgreSQL (persist)
  → Event bus (e.g. Redis)
  → Realtime service (WebSockets)
  → Connected clients update
```

(Exact service names should follow `docs/deploymentArchitecture.md` and existing gateway patterns.)

---

## 8. Data model (minimal scalable shape)

```text
ChatRoom
  - id
  - type        (ORDER | STAFF | SUPPORT)
  - orderId     (optional; required for order-customer threads when applicable)
  - restaurantId

Message
  - id
  - chatRoomId
  - senderId
  - role
  - content
  - type        (text | system | action)
  - timestamp
```

Extend with moderation, attachments, and action payloads as the product matures.

---

## 9. Anti-patterns (do not build toward this)

- Generic social DM between unrelated users  
- Random unstructured threads with no venue/order/table anchor  
- **No** system-generated timeline for order lifecycle  
- **No** link between message UI and order controls  

That path makes chat **operationally useless** for restaurants.

---

## 10. UI tone: operational, not social

**Prefer:** clear cards, readable timestamps, status labels, system highlights, bounded quick actions.

**Avoid:** social-feed styling, emoji-heavy casual tone as default, unstructured endless threads.

---

## 11. UX question every thread must answer

> **“What is happening with this order (or this operational object) right now?”**

Not: “what did someone say in the abstract?”

---

## 12. Standout capability (full vision)

**Smart hybrid:** Chat + **order controls** + **notifications** + **in-thread actions** so staff can reply, update status, refund/delay, and notify the customer **from one surface** where the product allows.

---

## 13. MVP build order (recommended)

**Phase 1 — Customer ↔ order chat only**

- Text messages in an order-scoped room  
- System messages from order events  
- Realtime sync  
- Strong **order (or table) linkage**  

Ship this before generalizing internal or support UIs at scale.

---

## 14. One-line mental model

```text
NOT a messaging app

BUT a real-time operations console with a chat layer on top
```

---

## 15. Implementation note (current repo)

Until backend and UI catch up, the mobile **Chat** tab may show placeholder copy. New work on that tab should align with this document: **channel types**, **order binding**, **system messages**, and **operational** layout — not a generic chat clone.
