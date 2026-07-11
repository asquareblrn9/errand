/**
 * Deep linking map for Errand Boy mobile app.
 *
 * Push notification payloads use the 'target' key with these paths.
 * Expo Router handles path resolution on app open.
 *
 * Example notification payload:
 *   { target: 'requests/abc-123', type: 'bid_received' }
 */
export const DEEP_LINK_MAP: Record<string, string> = {
  bid_received: '/requests/:id',
  bid_accepted: '/jobs/:bidId',
  payment_confirmed: '/jobs/:bidId',
  delivery_otp_generated: '/requests/:id',
  delivery_confirmed: '/jobs/:bidId',
  dispute_opened: '/disputes/:id',
  payout_sent: '/(tabs)/wallet',
  chat_message: '/chat/:id',
  kyc_approved: '/(tabs)/profile',
  funds_received: '/(tabs)/wallet',
};
