/**
 * Payment module type definitions
 */

// Subscription type
export type SubscriptionType = 'recurring' | 'onetime';

// Payment order data structure
export interface PaymentOrder {
  amount: number;
  channelData?: Record<string, any>;
  channelOrderNo?: string;
  closedAt?: Date;
  createdAt: Date;
  // in cents
  currency: string; 
  // Duration in months for one-time payments (1, 3, 6, 12), undefined for recurring
  durationMonths?: number;
  expiredAt: Date;
  id: string;
  orderNo: string;
  paidAt?: Date;
  payChannel: string;
  planId: string;
  // Optional plan metadata for display in payment providers
  planInterval: 'month' | 'year';
  planName?: string;
  planSlug?: string;
  status: PaymentStatus;
  // Subscription type: 'recurring' (auto-renew) or 'onetime' (one-time payment)
  subscriptionType: SubscriptionType;
  updatedAt: Date;
  userId: string;
}

// Payment status enum
export type PaymentStatus = 'pending' | 'paid' | 'closed' | 'refunded';

// Result from creating a payment with a channel
export interface ChannelPaymentResult {
  channelData?: Record<string, any>;
  channelOrderNo?: string;
  // e.g., { code_url: "weixin://..." }
  errorMessage?: string; 
  success: boolean;
}

// Result from parsing a payment notification
export interface NotificationResult {
  amount?: number;
  channelOrderNo?: string;
  errorMessage?: string;
  orderNo: string;
  paidAt?: Date;
  success: boolean;
}

// Order status query result
export interface OrderStatus {
  channelOrderNo?: string;
  orderNo: string;
  paidAt?: Date;
  status: PaymentStatus;
}

// Payment channel abstract interface
export interface PaymentChannel {
  /**
   * Close/cancel an unpaid order
   */
  closeOrder(orderNo: string): Promise<void>;

  /**
   * Create a payment with the channel
   */
  createPayment(order: PaymentOrder): Promise<ChannelPaymentResult>;

  /**
   * Parse notification callback from the channel
   */
  parseNotification(rawBody: string | Buffer, headers?: Record<string, any>): Promise<NotificationResult>;

  /**
   * Query order status from the channel
   */
  queryOrder(orderNo: string): Promise<OrderStatus>;
}

// Create order input
export interface CreateOrderInput {
  // Duration in months for one-time payments (1, 3, 6, 12)
// Required when subscriptionType = 'onetime', undefined for 'recurring'
  durationMonths?: number;
  payChannel: 'wechat_native' | 'alipay_precreate';
  planId: string;
  planInterval: 'month' | 'year'; // extensible
  // Subscription type: 'recurring' or 'onetime'
  subscriptionType: SubscriptionType;
  userId: string;
}

// Payment service configuration
export interface PaymentConfig {
  alipay?: {
    // RSA2 private key
    alipayPublicKey: string;
    appId: string; 
    gatewayUrl?: string; // Alipay public key for signature verification
    notifyUrl: string;
    privateKey: string; // Optional, defaults to production gateway
    sandbox?: boolean; // Whether to use sandbox environment
  };
  wechat?: {
    apiKey: string;
    appId: string;
    mchId: string;
    notifyUrl: string;
  };
}
