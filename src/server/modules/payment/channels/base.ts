/**
 * Base payment channel interface
 * All payment channels (WeChat, Alipay, etc.) should implement this interface
 */

import type {
  ChannelPaymentResult,
  NotificationResult,
  OrderStatus,
  PaymentChannel,
  PaymentOrder,
} from '../types';

export abstract class BasePaymentChannel implements PaymentChannel {
  abstract createPayment(order: PaymentOrder): Promise<ChannelPaymentResult>;

  abstract parseNotification(
    rawBody: string | Buffer,
    headers?: Record<string, any>,
  ): Promise<NotificationResult>;

  abstract queryOrder(orderNo: string): Promise<OrderStatus>;

  abstract closeOrder(orderNo: string): Promise<void>;
}
