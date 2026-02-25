/**
 * WeChat Native Payment Implementation
 * Docs: https://pay.weixin.qq.com/wiki/doc/api/native.php
 */

import crypto from 'node:crypto';
import { parseStringPromise, Builder } from 'xml2js';

import { BasePaymentChannel } from './base';
import type {
  ChannelPaymentResult,
  NotificationResult,
  OrderStatus,
  PaymentConfig,
  PaymentOrder,
  PaymentStatus,
} from '../types';

interface WeChatConfig {
  apiKey: string;
  appId: string;
  mchId: string;
  notifyUrl: string;
}

export class WeChatNativeChannel extends BasePaymentChannel {
  private config: WeChatConfig;
  private unifiedOrderUrl = 'https://api.mch.weixin.qq.com/pay/unifiedorder';
  private orderQueryUrl = 'https://api.mch.weixin.qq.com/pay/orderquery';
  private closeOrderUrl = 'https://api.mch.weixin.qq.com/pay/closeorder';

  constructor(config: PaymentConfig['wechat']) {
    super();
    if (!config) {
      throw new Error('WeChat payment config is required');
    }
    this.config = config;
  }

  /**
   * Create a WeChat Native payment
   */
  async createPayment(order: PaymentOrder): Promise<ChannelPaymentResult> {
    try {
      // Generate friendly body for the order
      // Priority: use slug (English, no encoding issues) > fallback to planId
      const planDisplay = order.planSlug
        ? order.planSlug.charAt(0).toUpperCase() + order.planSlug.slice(1)
        : order.planId;
      const intervalDisplay = order.planInterval === 'year' ? 'Annual' : 'Monthly';

      // For onetime payments, show duration
      let bodySuffix = '';
      if (order.subscriptionType === 'onetime' && order.durationMonths) {
        bodySuffix = ` - ${order.durationMonths}mo`;
      }

      const params = {
        appid: this.config.appId,
        body: `${planDisplay} ${intervalDisplay} Plan${bodySuffix}`,
        mch_id: this.config.mchId,
        nonce_str: this.generateNonceStr(),
        // Should be replaced with actual IP in production
        notify_url: this.config.notifyUrl,

        out_trade_no: order.orderNo,

        spbill_create_ip: '127.0.0.1',
        total_fee: order.amount.toString(),
        trade_type: 'NATIVE',
      };

      const sign = this.generateSignature(params);
      const xmlData = this.buildXml({ ...params, sign });

      const response = await fetch(this.unifiedOrderUrl, {
        body: xmlData,
        headers: { 'Content-Type': 'application/xml' },
        method: 'POST',
      });

      const responseText = await response.text();
      const result = await this.parseXml(responseText);

      if (result.return_code !== 'SUCCESS') {
        return {
          errorMessage: result.return_msg || 'WeChat API error',
          success: false,
        };
      }

      if (result.result_code !== 'SUCCESS') {
        return {
          errorMessage: result.err_code_des || result.err_code || 'Payment creation failed',
          success: false,
        };
      }

      // Verify signature
      if (!this.verifySignature(result)) {
        return {
          errorMessage: 'Invalid response signature',
          success: false,
        };
      }

      return {
        channelData: {
          code_url: result.code_url,
          prepay_id: result.prepay_id,
        },
        channelOrderNo: result.prepay_id,
        success: true,
      };
    } catch (error) {
      return {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      };
    }
  }

  /**
   * Parse WeChat payment notification
   */
  async parseNotification(
    rawBody: string | Buffer,
  ): Promise<NotificationResult> {
    try {
      const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
      const data = await this.parseXml(bodyStr);

      // Verify signature
      if (!this.verifySignature(data)) {
        return {
          errorMessage: 'Invalid signature',
          orderNo: data.out_trade_no || '',
          success: false,
        };
      }

      if (data.return_code !== 'SUCCESS') {
        return {
          errorMessage: data.return_msg || 'Notification error',
          orderNo: data.out_trade_no || '',
          success: false,
        };
      }

      if (data.result_code !== 'SUCCESS') {
        return {
          errorMessage: data.err_code_des || data.err_code || 'Payment failed',
          orderNo: data.out_trade_no || '',
          success: false,
        };
      }

      return {
        amount: Number.parseInt(data.total_fee, 10),
        channelOrderNo: data.transaction_id,
        orderNo: data.out_trade_no,
        paidAt: this.parseWeChatTime(data.time_end),
        success: true,
      };
    } catch (error) {
      return {
        errorMessage: error instanceof Error ? error.message : 'Parse error',
        orderNo: '',
        success: false,
      };
    }
  }

  /**
   * Query order status from WeChat
   */
  async queryOrder(orderNo: string): Promise<OrderStatus> {
    try {
      const params = {
        appid: this.config.appId,
        mch_id: this.config.mchId,
        nonce_str: this.generateNonceStr(),
        out_trade_no: orderNo,
      };

      const sign = this.generateSignature(params);
      const xmlData = this.buildXml({ ...params, sign });

      const response = await fetch(this.orderQueryUrl, {
        body: xmlData,
        headers: { 'Content-Type': 'application/xml' },
        method: 'POST',
      });

      const responseText = await response.text();
      const result = await this.parseXml(responseText);

      if (result.return_code !== 'SUCCESS' || result.result_code !== 'SUCCESS') {
        // If order not found or query failed, treat as pending
        return {
          orderNo,
          status: 'pending',
        };
      }

      // Map WeChat trade state to our payment status
      const status = this.mapTradeState(result.trade_state);

      return {
        channelOrderNo: result.transaction_id,
        orderNo,
        paidAt: result.time_end ? this.parseWeChatTime(result.time_end) : undefined,
        status,
      };
    } catch {
      // On error, return pending status
      return {
        orderNo,
        status: 'pending',
      };
    }
  }

  /**
   * Close an unpaid order
   */
  async closeOrder(orderNo: string): Promise<void> {
    const params = {
      appid: this.config.appId,
      mch_id: this.config.mchId,
      nonce_str: this.generateNonceStr(),
      out_trade_no: orderNo,
    };

    const sign = this.generateSignature(params);
    const xmlData = this.buildXml({ ...params, sign });

    await fetch(this.closeOrderUrl, {
      body: xmlData,
      headers: { 'Content-Type': 'application/xml' },
      method: 'POST',
    });

    // WeChat close order API may fail if order is already paid/closed
    // We don't throw error here, just silently ignore
  }

  /**
   * Generate MD5 signature for WeChat Pay
   */
  private generateSignature(params: Record<string, string>): string {
    // Sort keys alphabetically
    const sortedKeys = Object.keys(params).sort();

    // Build string: key1=value1&key2=value2&key=API_KEY
    const stringA = sortedKeys.map((key) => `${key}=${params[key]}`).join('&');
    const stringSignTemp = `${stringA}&key=${this.config.apiKey}`;

    // MD5 hash and convert to uppercase
    return crypto.createHash('md5').update(stringSignTemp, 'utf8').digest('hex').toUpperCase();
  }

  /**
   * Verify signature from WeChat response/notification
   */
  private verifySignature(data: Record<string, any>): boolean {
    const receivedSign = data.sign;
    if (!receivedSign) return false;

    // Remove sign field and rebuild signature
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { sign: _sign, ...paramsWithoutSign } = data;
    const calculatedSign = this.generateSignature(paramsWithoutSign);

    return calculatedSign === receivedSign;
  }

  /**
   * Generate random string for nonce_str
   */
  private generateNonceStr(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Build XML string from params
   */
  private buildXml(params: Record<string, string>): string {
    const builder = new Builder({ headless: true, rootName: 'xml' });
    return builder.buildObject(params);
  }

  /**
   * Parse XML string to object
   */
  private async parseXml(xml: string): Promise<Record<string, any>> {
    const result = await parseStringPromise(xml, {
      explicitArray: false,
      ignoreAttrs: true,
    });
    return result.xml || {};
  }

  /**
   * Parse WeChat time format (YYYYMMDDHHmmss) to Date
   */
  private parseWeChatTime(timeStr: string): Date {
    // Format: 20260127093045 -> 2026-01-27 09:30:45
    const year = Number.parseInt(timeStr.slice(0, 4), 10);
    const month = Number.parseInt(timeStr.slice(4, 6), 10) - 1; // JS months are 0-indexed
    const day = Number.parseInt(timeStr.slice(6, 8), 10);
    const hours = Number.parseInt(timeStr.slice(8, 10), 10);
    const minutes = Number.parseInt(timeStr.slice(10, 12), 10);
    const seconds = Number.parseInt(timeStr.slice(12, 14), 10);

    return new Date(year, month, day, hours, minutes, seconds);
  }

  /**
   * Map WeChat trade_state to our payment status
   */
  private mapTradeState(tradeState: string): PaymentStatus {
    switch (tradeState) {
      case 'SUCCESS': {
        return 'paid';
      }
      case 'CLOSED':
      case 'REVOKED': {
        return 'closed';
      }
      case 'REFUND': {
        return 'refunded';
      }
      default: {
        return 'pending';
      }
    }
  }
}
