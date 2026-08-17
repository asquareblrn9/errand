# Errand Boy — Architecture & System Design

> **Last Updated: July 2026**
> **Status: Active Development**

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Errand Boy Platform                         │
│                                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐ │
│  │ Next.js   │  │ iOS App  │  │ Android  │  │ Admin Dashboard      │ │
│  │ Web App   │  │ (future) │  │ (future) │  │ Next.js /admin       │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────────┬───────────┘ │
│       └─────────────┴──────┬──────┴────────────────────┘             │
│                            │                                        │
│                   ┌────────▼────────┐                               │
│                   │  Laravel API     │                               │
│                   │  PHP 8.4         │                               │
│                   │  PostgreSQL      │                               │
│                   └────────┬────────┘                               │
│                            │                                        │
│   External: ┌──────────┬───┴───┬──────────┬──────────┐             │
│             │Flutterwave│Paystack│  Termii  │   FCM    │             │
│             └──────────┘└───────┘└──────────┘└──────────┘             │
└─────────────────────────────────────────────────────────────────────┘
```

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Backend API | Laravel 11, PHP 8.4 |
| Database | PostgreSQL |
| Cache | Redis (OTP, rate limiting) |
| Frontend | Next.js 16, React 19, Tailwind CSS v4, shadcn/ui |
| State Management | Zustand (auth), TanStack React Query (server) |
| Forms | react-hook-form + Zod |
| Real-time | FCM (push notifications) |
| Payments | Flutterwave, Paystack (config-driven) |
| Auth | Laravel Sanctum, Spatie RBAC |

---

## 3. Errand Lifecycle — Strict State Machine

The entire errand lifecycle is governed by `ErrandStateMachine` which validates every transition server-side.

```
REQUEST_CREATED (draft → open)
        ↓
BIDDING (open)
        ↓
BID_ACCEPTED (assigned)        ← BidService::accept()
        ↓
AWAITING_PAYMENT (assigned)
        ↓
PAYMENT_MADE (in_progress)     ← PaymentGatewayService
        ↓
IN_PROGRESS (in_progress)      ← DeliveryController::start()
        ↓
DELIVERED (delivered)          ← DeliveryOtpService
        ↓
REQUESTER_CONFIRMED (confirmed) ← OTP confirmation
        ↓
ESCROW_HOLD (escrow_hold)     ← Auto after confirmation
        ↓
DISPUTE_WINDOW (dispute_window) ← If dispute opened
        or
FUNDS_RELEASED (funds_released) ← Auto after window expires
        ↓
COMPLETED (completed)          ← Terminal state
```

### RequestStatus Enum (14 states)

`draft → open → assigned → in_progress → delivered → confirmed → escrow_hold → dispute_window → funds_released → completed`

Plus terminal states: `cancelled`, `expired`, `refunded`, `disputed`

### BidStatus Enum (7 states)

`pending → accepted → payment_made → in_progress → completed`

Plus terminal: `rejected`, `withdrawn`

### DisputeStatus Enum (7 states)

`dispute_opened → under_review → admin_decision → full_refund / partial_refund / funds_released → completed`

Plus: `request_evidence` (admin sends back for more info → loops to `under_review`)

### State Machine Guards

Every transition has guards enforced by `ErrandStateMachine::transition()`:

| Transition | Guard |
|---|---|
| `open → assigned` | Bid must be accepted |
| `assigned → in_progress` | Payment must be confirmed |
| `assigned → cancelled` | No payment exists |
| `in_progress → delivered` | Assigned errander only |
| `in_progress → cancelled` | Late threshold exceeded + requester only |
| `delivered → confirmed` | OTP validated |
| `escrow_hold → dispute_window` | Dispute opened |
| `dispute_window → funds_released/completed` | Admin only |

---

## 4. Payment System

### Architecture

- **Config-driven providers**: `config/payment.php` lists available card providers
- **Provider interface**: `PaymentProviderInterface` with `initializePayment()`, `verifyPayment()`, `handleWebhook()`
- **Resolver**: `PaymentProviderResolver` maps slugs to implementations
- **Adding a new provider**: 1 config line + 1 class implementing the interface

### Payment Flow

```
Accept Bid → PaymentModal opens immediately
  ├── Wallet: Check balance → Lock escrow → Deduct → Bid = payment_made
  └── Card: Select provider → Redirect to gateway → Webhook confirms → Bid = payment_made
```

### Security

- Webhook signature verification (hash_equals, HMAC-SHA512)
- Idempotency: checks for pending + successful payments before allowing new ones
- Rate limiting: `payment` (5/min), `webhook` (30/min)
- Wallet verify: deduplicates by reference

### Idempotency

- `PaymentGatewayService::initiate()` blocks if any non-failed payment exists for the bid
- `WalletController::verifyPayment()` checks for duplicate references
- `ReleaseExpiredEscrow` command skips already-paid deliveries

---

## 5. SLA Timer & Delivery

### SLA Configuration

- Requester sets `sla_minutes` when creating a request (optional, falls back to platform default 120 min)
- Platform settings: `delivery_default_sla_minutes`, `delivery_late_threshold_pct` (default 40%)
- Per-category SLA via `categories.dispute_window_hours`

### Live Countdown Timer

Frontend `SlaTimer` component updates every second showing:
- Remaining time (countdown format)
- Percentage used (progress bar: green → orange 80%+ → red overdue)
- Time elapsed
- Grace period indicator
- Late fee accrual

Visible to both requester and errander on the request detail page and delivery page.

### Late Completion Logic

- When elapsed time exceeds `delivery_late_threshold_pct` (40%) → requester sees "Cancel Errand" button
- Configurable via Platform Settings (key: `delivery_late_threshold_pct`)
- Cancellation: refunds payment, unlocks escrow, notifies both parties, records audit

### Time Extensions

- Errander requests additional minutes with reason
- Requester approves/rejects
- Approved: extends `deadline_at`, timer updates automatically
- Notifications (in-app + push + email) for both parties

---

## 6. Escrow System

### Flow

```
Payment → WalletService::lock() → locked_balance += amount (requester's wallet)
Delivery confirmed → escrow_transactions record created (status: held)
Dispute window expires → ReleaseExpiredEscrow command:
  1. Unlocks requester's locked_balance
  2. Credits errander via creditPayout()
  3. Updates escrow_transactions (status: released)
  4. Request → completed
```

### Auto-Release

`ReleaseExpiredEscrow` Artisan command runs every minute via scheduler:
- Finds requests in `escrow_hold` where `dispute_window_closes_at <= now()`
- Releases funds, updates escrow, transitions to completed
- Idempotent: skips already-processed payouts

### Withdrawal Rules

- Errander cannot withdraw while funds are in escrow (`escrow_hold` or `dispute_window` states)
- `WalletController::withdraw()` checks for active escrow before processing
- `available_balance = balance - locked_balance` enforced by wallet model

---

## 7. Dispute System

### Dispute Flow

```
escrow_hold → dispute_opened (requester)
  → under_review (errander responds)
  → admin_decision (admin reviews)
  → full_refund / partial_refund / funds_released / request_evidence
  → completed
```

### Admin Decisions

| Outcome | Effect |
|---|---|
| `full_refund` | 100% back to requester |
| `partial_refund` | Configurable split (default 50/50, admin sets percentage) |
| `funds_released` | 100% to errander → payout |
| `request_evidence` | Loops back to `under_review` |

### Traceability

Every dispute decision records: AuditLog, FCM push, email (DisputeResolvedMail), escrow ledger update, wallet balance update, payment status change.

---

## 8. Notification System

### Channels

| Event | In-App | Push (FCM) | Email |
|---|---|---|---|
| Bid accepted | ✅ | ✅ | — |
| Payment successful | ✅ | ✅ | ✅ |
| Work started | ✅ | ✅ | ✅ |
| Extension requested/approved/rejected | ✅ | ✅ | ✅ |
| Delivery confirmed | ✅ | ✅ | ✅ |
| Request cancelled | ✅ | ✅ | ✅ |
| Payment released | ✅ | ✅ | ✅ |
| Dispute resolved | ✅ | ✅ | ✅ |
| Evidence requested | ✅ | ✅ | — |

### Admin Resend

`POST /admin/notifications/resend` — admin can resend any past notification by audit log ID via email, push, or both.

---

## 9. Admin Features

| Feature | Endpoint |
|---|---|
| Dashboard KPIs | `GET /admin/dashboard` |
| Active errands + SLA monitoring | `GET /admin/errands` |
| Errander earnings | `GET /admin/errander-earnings` |
| Payment history | `GET /admin/payments` |
| Escrow balances | `GET /admin/escrow` |
| All disputes | `GET /admin/disputes` |
| User management | `GET/PUT /admin/users/*` |
| KYC review | `GET/POST /admin/kyc/*` |
| Platform settings | `GET/PUT /admin/settings` |
| Notification resend | `POST /admin/notifications/resend` |
| Categories CRUD | `CRUD /admin/categories` |

---

## 10. Security

### Webhook Protection

- Flutterwave: `verif-hash` header validated with `hash_equals()`
- Paystack: `x-paystack-signature` HMAC-SHA512 verified
- Rate limited: 30 req/min per IP

### Rate Limiting

| Group | Rate | Applied To |
|---|---|---|
| `api` | 60/min per user | All authenticated routes |
| `auth` | 5/min per IP | Login, register, password reset |
| `otp` | 3/min per user | OTP send/verify |
| `payment` | 5/min per user | Payment initiate, verify |
| `webhook` | 30/min per IP | Webhook endpoints |

### Authorization

- All admin routes: `role:admin|super_admin` middleware
- State-changing endpoints: ownership checks (user_id, isOwnedBy)
- State machine guards: role + state validation on every transition

---

## 11. Database — Key Tables

```
IDENTITY:       users, password_reset_tokens, verification_codes,
                device_tokens, personal_access_tokens, refresh_tokens,
                audit_logs, roles, permissions (Spatie)

KYC:            kyc_verifications, kyc_documents, bank_accounts,
                emergency_contacts

MARKETPLACE:    categories, requests, request_photos, bids

FINANCIAL:      wallets, wallet_transactions, escrow_transactions,
                payments, payouts, withdrawals

DELIVERY:       deliveries, delivery_updates, delivery_extensions

DISPUTE:        disputes, dispute_evidence, dispute_messages

COMMUNICATION:  conversations, messages, notifications

TRUST:          ratings, errander_stats

BUSINESS:       companies, company_users

SYSTEM:         platform_settings, subscriptions, plans
```

---

## 12. API Routes

```
/auth/*              — Authentication, registration, 2FA
/me, /me/*           — User profile
/requests, /my/requests — Request CRUD + feed
/bids, /my/bids      — Bid management
/wallet, /wallet/*   — Wallet, funding, withdrawal
/payments, /payments/webhook/* — Payment initiation + webhooks
/deliveries/*        — Delivery, OTP, extensions, timeline
/disputes            — Dispute management
/conversations/*     — Chat
/ratings             — Ratings & reviews
/notifications       — Notification listing + read
/admin/*             — All admin endpoints (role-gated)
/kyc, /kyc/*         — KYC verification
/categories          — Category listing (public)
/plans, /subscriptions — Plans & subscriptions
```

---

## 13. Frontend Pages

```
/                            — Landing
/login, /register           — Auth
/verify-email               — Email verification
/dashboard                   — Dashboard with stats
/feed                        — Open requests feed
/requests/new               — Create request (rich text + SLA picker)
/requests/[id]              — Request detail (bids, SLA timer, actions)
/requests/[id]/pay          — Payment page
/delivery/[bidId]           — Delivery OTP + SLA timer
/wallet                      — Wallet balance, fund, withdraw, transactions
/settings                    — Profile, security, sessions
/verification/*             — KYC wizard
/my-bids                     — Errander bid list
/notifications              — Notification inbox
/admin/dashboard            — Admin KPIs
/admin/errands              — Active errand monitoring
/admin/users, /admin/users/[id] — User management
/admin/kyc, /admin/kyc/[id] — KYC review
/admin/categories           — Category management
/admin/settings             — Platform settings
/admin/payments             — Payment history
/admin/escrow               — Escrow balances
/admin/disputes             — Dispute management
```

---

## 14. Design Decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | **UUIDs via Trait** | Custom `HasUuid` trait — no third-party package dependency |
| 2 | **OTP over link verification** | Mobile-first Nigerian market; OTP faster on slow connections |
| 3 | **Phone + email login** | Critical in Nigeria where many users are mobile-first |
| 4 | **Refresh token rotation** | Each refresh invalidates previous; token theft detection |
| 5 | **Spatie RBAC** | Multi-role support (requester + company_admin simultaneously) |
| 6 | **Config-driven payment providers** | Add new provider = 1 config line + 1 class |
| 7 | **Strict state machine** | `ErrandStateMachine` validates every transition server-side |
| 8 | **next-themes** | Class-based dark mode with system preference detection |
| 9 | **Tiptap rich text editor** | Lightweight WYSIWYG with bold/italic/underline/lists/links |
| 10 | **Escrow via wallet locked_balance** | Funds locked on requester wallet, released on completion |
| 11 | **SLA configurable per-request** | Requester picks timeframe; falls back to platform default |
