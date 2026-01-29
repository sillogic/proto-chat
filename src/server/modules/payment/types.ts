/**
 * Payment module type definitions
 */

// Payment order data structure
export interface PaymentOrder {
  id: string;
  orderNo: string;
  userId: string;
  planId: string;
  planInterval: 'month' | 'year';
  amount: number; // in cents
  currency: string;
  payChannel: string;
  channelOrderNo?: string;
  status: PaymentStatus;
  channelData?: Record<string, any>;
  expiredAt: Date;
  paidAt?: Date;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Payment status enum
export type PaymentStatus = 'pending' | 'paid' | 'closed' | 'refunded';

// Result from creating a payment with a channel
export interface ChannelPaymentResult {
  success: boolean;
  channelOrderNo?: string;
  channelData?: Record<string, any>; // e.g., { code_url: "weixin://..." }
  errorMessage?: string;
}

// Result from parsing a payment notification
export interface NotificationResult {
  success: boolean;
  orderNo: string;
  channelOrderNo?: string;
  paidAt?: Date;
  amount?: number;
  errorMessage?: string;
}

// Order status query result
export interface OrderStatus {
  orderNo: string;
  status: PaymentStatus;
  paidAt?: Date;
  channelOrderNo?: string;
}

// Payment channel abstract interface
export interface PaymentChannel {
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

  /**
   * Close/cancel an unpaid order
   */
  closeOrder(orderNo: string): Promise<void>;
}

// Create order input
export interface CreateOrderInput {
  userId: string;
  planId: string;
  planInterval: 'month' | 'year';
  payChannel: 'wechat_native' | 'alipay_precreate'; // extensible
}

// Payment service configuration
export interface PaymentConfig {
  wechat?: {
    appId: string;
    mchId: string;
    apiKey: string;
    notifyUrl: string;
  };
  alipay?: {
    appId: string;
    privateKey: string; // RSA2 private key
    alipayPublicKey: string; // Alipay public key for signature verification
    notifyUrl: string;
    gatewayUrl?: string; // Optional, defaults to production gateway
    sandbox?: boolean; // Whether to use sandbox environment
  };
}
