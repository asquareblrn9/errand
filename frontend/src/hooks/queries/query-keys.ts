// ── Centralized Query Key Factory ──────────────────────────

export const queryKeys = {
  // Auth & User
  me: ["me"] as const,
  userProfile: (id: string) => ["users", id, "profile"] as const,
  userRatings: (id: string) => ["users", id, "ratings"] as const,
  sessions: ["auth", "sessions"] as const,

  // Addresses
  addresses: ["me", "addresses"] as const,
  address: (id: string) => ["me", "addresses", id] as const,

  // Requests
  feed: (params?: object) =>
    ["requests", "feed", params ?? {}] as const,
  request: (id: string) => ["requests", id] as const,
  myRequests: (params?: object) =>
    ["my-requests", params ?? {}] as const,

  // Categories
  categories: ["categories"] as const,
  category: (id: string) => ["categories", id] as const,

  // Bids
  bidsForRequest: (requestId: string) =>
    ["requests", requestId, "bids"] as const,
  myBids: (params?: object) =>
    ["my-bids", params ?? {}] as const,

  // Wallet
  wallet: ["wallet"] as const,
  transactions: (params?: object) =>
    ["wallet", "transactions", params ?? {}] as const,

  // Payments
  payment: (id: string) => ["payments", id] as const,
  myPayments: (params?: object) =>
    ["my-payments", params ?? {}] as const,

  // Delivery
  delivery: (bidId: string) => ["deliveries", bidId] as const,
  deliveryTimeline: (bidId: string) => ["deliveries", bidId, "timeline"] as const,

  // Chat
  conversations: ["conversations"] as const,
  messages: (conversationId: string, params?: object) =>
    ["conversations", conversationId, "messages", params ?? {}] as const,

  // Disputes
  dispute: (id: string) => ["disputes", id] as const,
  myDisputes: (params?: object) =>
    ["my-disputes", params ?? {}] as const,

  // Companies
  company: (id: string) => ["companies", id] as const,
  companyMembers: (id: string) => ["companies", id, "members"] as const,

  // Subscriptions
  plans: ["plans"] as const,
  mySubscription: ["my-subscription"] as const,

  // Admin
  adminDashboard: ["admin", "dashboard"] as const,
  adminUsers: (params?: object) =>
    ["admin", "users", params ?? {}] as const,
  adminUser: (id: string) => ["admin", "users", id] as const,
  adminKycPending: ["admin", "kyc", "pending"] as const,
  adminKycDetail: (userId: string) => ["admin", "kyc", userId] as const,
} as const;
