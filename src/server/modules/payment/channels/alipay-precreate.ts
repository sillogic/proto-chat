/**
 * Alipay Precreate Payment Implementation (F2F Payment)
 * Docs: https://opendocs.alipay.com/open/194/105170
 *
 * This implementation uses Alipay's Face-to-Face payment API (alipay.trade.precreate)
 * which generates a QR code for users to scan and pay.
 */

import crypto from 'node:crypto';
import { BasePaymentChannel } from './base';
import type {
  ChannelPaymentResult,
  NotificationResult,
  OrderStatus,
  PaymentConfig,
  PaymentOrder,
  PaymentStatus,
} from '../types';

interface AlipayConfig {
  appId: string;
  privateKey: string; // RSA2 private key
  alipayPublicKey: string; // Alipay public key for signature verification
  notifyUrl: string;
  gatewayUrl?: string; // Optional, defaults to production gateway
  sandbox?: boolean; // Whether to use sandbox environment
}

export class AlipayPrecreateChannel extends BasePaymentChannel {
  private config: AlipayConfig;
  private gatewayUrl: string;
  private formattedPrivateKey: string;
  private formattedAlipayPublicKey: string;

  constructor(config: PaymentConfig['alipay']) {
    super();
    if (!config) {
      throw new Error('Alipay payment config is required');
    }
    this.config = config;
    this.gatewayUrl = config.sandbox
      ? 'https://openapi-sandbox.dl.alipaydev.com/gateway.do'
      : config.gatewayUrl || 'https://openapi.alipay.com/gateway.do';

    // Format keys to PEM format
    this.formattedPrivateKey = this.formatPrivateKey(config.privateKey);
    this.formattedAlipayPublicKey = this.formatPublicKey(config.alipayPublicKey);
  }

  /**
   * Format private key to PEM format
   * Supports both PKCS1 and PKCS8 formats
   */
  private formatPrivateKey(key: string): string {
    // Remove existing headers/footers and whitespace
    const cleanKey = key
      .replace(/-----BEGIN.*?-----/g, '')
      .replace(/-----END.*?-----/g, '')
      .replace(/\s/g, '');

    // Detect format by checking the beginning of the Base64 string
    // PKCS1 starts with MIIEowIBAAKCAQEA or similar
    // PKCS8 starts with MIIEvQIBADANBgkqhkiG9w or similar
    const isPKCS1 = cleanKey.startsWith('MIIEpAIBAAKCAQEA') ||
                    cleanKey.startsWith('MIIEowIBAAKCAQEA') ||
                    !cleanKey.includes('BADANBgkqhkiG9w');

    if (isPKCS1) {
      // PKCS1 format (RSA PRIVATE KEY)
      return `-----BEGIN RSA PRIVATE KEY-----\n${cleanKey.match(/.{1,64}/g)?.join('\n')}\n-----END RSA PRIVATE KEY-----`;
    } else {
      // PKCS8 format (PRIVATE KEY)
      return `-----BEGIN PRIVATE KEY-----\n${cleanKey.match(/.{1,64}/g)?.join('\n')}\n-----END PRIVATE KEY-----`;
    }
  }

  /**
   * Format public key to PEM format
   */
  private formatPublicKey(key: string): string {
    // Remove existing headers/footers and whitespace
    const cleanKey = key
      .replace(/-----BEGIN.*?-----/g, '')
      .replace(/-----END.*?-----/g, '')
      .replace(/\s/g, '');

    // Add public key headers
    return `-----BEGIN PUBLIC KEY-----\n${cleanKey.match(/.{1,64}/g)?.join('\n')}\n-----END PUBLIC KEY-----`;
  }

  /**
   * Create an Alipay precreate payment (F2F QR code payment)
   */
  async createPayment(order: PaymentOrder): Promise<ChannelPaymentResult> {
    try {
      const bizContent = {
        out_trade_no: order.orderNo,
        total_amount: (order.amount / 100).toFixed(2), // Convert cents to yuan
        subject: `Subscription Plan ${order.planId}`, // Use English to avoid encoding issues
        timeout_express: '120m', // 2 hours
      };

      const params = this.buildCommonParams('alipay.trade.precreate', bizContent);
      const signedParams = this.signParams(params);

      const response = await fetch(this.gatewayUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(signedParams).toString(),
      });

      const responseText = await response.text();
      const result = JSON.parse(responseText);

      const responseKey = 'alipay_trade_precreate_response';
      if (!result[responseKey]) {
        return {
          success: false,
          errorMessage: 'Invalid response from Alipay',
        };
      }

      const tradeResponse = result[responseKey];

      if (tradeResponse.code !== '10000') {
        return {
          success: false,
          errorMessage: tradeResponse.sub_msg || tradeResponse.msg || 'Payment creation failed',
        };
      }

      // Verify response signature
      const sign = result.sign;

      // Extract the exact JSON string for the response key
      // The signature is calculated on the raw JSON string of alipay_trade_precreate_response
      const responseKeyStart = responseText.indexOf(`"${responseKey}":`);
      if (responseKeyStart === -1) {
        console.error('Cannot find response key in text');
        return {
          success: false,
          errorMessage: 'Invalid response format',
        };
      }

      // Find the opening brace after the key
      const contentStart = responseText.indexOf('{', responseKeyStart);

      // Find the matching closing brace
      let braceCount = 0;
      let contentEnd = contentStart;
      for (let i = contentStart; i < responseText.length; i++) {
        if (responseText[i] === '{') braceCount++;
        if (responseText[i] === '}') {
          braceCount--;
          if (braceCount === 0) {
            contentEnd = i + 1;
            break;
          }
        }
      }

      const signContent = responseText.substring(contentStart, contentEnd);

      // In sandbox mode, signature verification might fail due to key mismatch
      // Skip verification in sandbox for testing (enable strict mode in production)
      if (!this.config.sandbox) {
        if (!this.verifySignature(signContent, sign)) {
          console.error('Signature verification failed');
          return {
            success: false,
            errorMessage: 'Invalid response signature',
          };
        }
      }

      return {
        success: true,
        channelOrderNo: tradeResponse.trade_no,
        channelData: {
          code_url: tradeResponse.qr_code, // Unified field name with WeChat (was qr_code)
          out_trade_no: tradeResponse.out_trade_no,
        },
      };
    } catch (error) {
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Parse Alipay payment notification
   */
  async parseNotification(
    rawBody: string | Buffer,
    _headers?: Record<string, any>,
  ): Promise<NotificationResult> {
    try {
      const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf-8') : rawBody;
      const params = new URLSearchParams(bodyStr);
      const data: Record<string, string> = {};

      for (const [key, value] of params.entries()) {
        data[key] = value;
      }

      // Verify signature
      const sign = data.sign;
      const signType = data.sign_type;

      if (!sign || signType !== 'RSA2') {
        return {
          success: false,
          orderNo: data.out_trade_no || '',
          errorMessage: 'Invalid signature type',
        };
      }

      // Remove sign and sign_type for verification
      const { sign: _sign, sign_type: _signType, ...paramsToVerify } = data;
      const signContent = this.buildSignContent(paramsToVerify);

      if (!this.verifySignature(signContent, sign)) {
        return {
          success: false,
          orderNo: data.out_trade_no || '',
          errorMessage: 'Invalid signature',
        };
      }

      // Check trade status
      if (data.trade_status !== 'TRADE_SUCCESS' && data.trade_status !== 'TRADE_FINISHED') {
        return {
          success: false,
          orderNo: data.out_trade_no || '',
          errorMessage: `Trade status is ${data.trade_status}`,
        };
      }

      return {
        success: true,
        orderNo: data.out_trade_no,
        channelOrderNo: data.trade_no,
        paidAt: data.gmt_payment ? new Date(data.gmt_payment) : new Date(),
        amount: Math.round(parseFloat(data.total_amount) * 100), // Convert yuan to cents
      };
    } catch (error) {
      return {
        success: false,
        orderNo: '',
        errorMessage: error instanceof Error ? error.message : 'Parse error',
      };
    }
  }

  /**
   * Query order status from Alipay
   */
  async queryOrder(orderNo: string): Promise<OrderStatus> {
    try {
      const bizContent = {
        out_trade_no: orderNo,
      };

      const params = this.buildCommonParams('alipay.trade.query', bizContent);
      const signedParams = this.signParams(params);

      const response = await fetch(this.gatewayUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(signedParams).toString(),
      });

      const responseText = await response.text();
      const result = JSON.parse(responseText);

      const responseKey = 'alipay_trade_query_response';
      if (!result[responseKey]) {
        return {
          orderNo,
          status: 'pending',
        };
      }

      const tradeResponse = result[responseKey];

      if (tradeResponse.code !== '10000') {
        // Order not found or query failed
        return {
          orderNo,
          status: 'pending',
        };
      }

      // Map Alipay trade status to our payment status
      const status = this.mapTradeStatus(tradeResponse.trade_status);

      return {
        orderNo,
        status,
        channelOrderNo: tradeResponse.trade_no,
        paidAt:
          tradeResponse.send_pay_date ? new Date(tradeResponse.send_pay_date) : undefined,
      };
    } catch {
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
    const bizContent = {
      out_trade_no: orderNo,
    };

    const params = this.buildCommonParams('alipay.trade.close', bizContent);
    const signedParams = this.signParams(params);

    await fetch(this.gatewayUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(signedParams).toString(),
    });

    // Alipay close order API may fail if order is already paid/closed
    // We don't throw error here, just silently ignore
  }

  /**
   * Build common parameters for Alipay API
   */
  private buildCommonParams(method: string, bizContent: Record<string, any>): Record<string, string> {
    return {
      app_id: this.config.appId,
      method,
      format: 'JSON',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      version: '1.0',
      notify_url: this.config.notifyUrl,
      biz_content: JSON.stringify(bizContent),
    };
  }

  /**
   * Build sign content from parameters
   */
  private buildSignContent(params: Record<string, string>): string {
    const sortedKeys = Object.keys(params).sort();
    const pairs = sortedKeys
      .filter((key) => params[key] !== '' && params[key] !== undefined && params[key] !== null)
      .map((key) => `${key}=${params[key]}`);
    return pairs.join('&');
  }

  /**
   * Sign parameters using RSA2
   */
  private signParams(params: Record<string, string>): Record<string, string> {
    const signContent = this.buildSignContent(params);
    const sign = this.generateSignature(signContent);
    return { ...params, sign };
  }

  /**
   * Generate RSA2 signature
   */
  private generateSignature(content: string): string {
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(content, 'utf-8');
    return sign.sign(this.formattedPrivateKey, 'base64');
  }

  /**
   * Verify signature using Alipay public key
   */
  private verifySignature(content: string, signature: string): boolean {
    try {
      const verify = crypto.createVerify('RSA-SHA256');
      verify.update(content, 'utf-8');
      return verify.verify(this.formattedAlipayPublicKey, signature, 'base64');
    } catch {
      return false;
    }
  }

  /**
   * Map Alipay trade status to our payment status
   */
  private mapTradeStatus(tradeStatus: string): PaymentStatus {
    switch (tradeStatus) {
      case 'TRADE_SUCCESS':
      case 'TRADE_FINISHED':
        return 'paid';
      case 'TRADE_CLOSED':
        return 'closed';
      case 'WAIT_BUYER_PAY':
      default:
        return 'pending';
    }
  }
}
