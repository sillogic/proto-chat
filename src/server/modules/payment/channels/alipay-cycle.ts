/**
 * Alipay Cycle Pay Implementation (周期扣款)
 * Docs: https://opendocs.alipay.com/open/20190319114403226822
 *
 * This implementation uses Alipay's Cycle Pay API for subscription payments:
 * - alipay.trade.app.pay: Create payment + sign agreement
 * - alipay.trade.pay: Deduct payment using agreement
 * - alipay.user.agreement.query: Query agreement status
 * - alipay.user.agreement.unsign: Cancel agreement
 */

import crypto from 'node:crypto';

import type { PaymentConfig } from '../types';

interface AlipayConfig {
  alipayPublicKey: string;
  appId: string;
  gatewayUrl?: string;
  notifyUrl: string;
  privateKey: string;
  sandbox?: boolean;
  signNotifyUrl?: string; // 签约成功异步通知地址
}

interface AgreementSignParams {
  accessChannel: 'QRCODE' | 'QRCODEORSMS' | 'ALIPAYAPP';
  billingInterval: 'month' | 'year';
  externalAgreementNo: string;
  period: number;
  periodType: 'DAY' | 'MONTH';
  planName: string;
  signScene: string;
  singleAmount: number; // 单次扣款金额（分）
  totalAmount?: number; // 周期内总扣款金额（分）
  totalPayments?: number; // 总扣款次数
}

interface CreateSignPaymentParams {
  agreementParams: AgreementSignParams;
  amount: number; // 首次支付金额（分）
  orderNo: string;
  subject: string;
}

interface DeductPaymentParams {
  agreementNo: string;
  amount: number; // 扣款金额（分）
  orderNo: string;
  subject: string;
}

interface SignNotificationResult {
  agreementNo: string;
  alipayLogonId?: string;
  alipayOpenId?: string;
  alipayUserId?: string;
  externalAgreementNo: string;
  signScene: string;
  signTime: Date;
  status: 'NORMAL' | 'UNSIGN';
  success: boolean;
}

interface DeductResult {
  channelOrderNo?: string;
  errorCode?: string;
  errorMessage?: string;
  orderNo: string;
  status: 'success' | 'failed' | 'pending';
}

interface AgreementQueryResult {
  agreementNo?: string;
  errorMessage?: string;
  nextDeductDate?: string;
  signTime?: Date;
  status: 'NORMAL' | 'UNSIGN' | 'NOT_EXIST';
  success: boolean;
  validTime?: Date;
}

export class AlipayCycleChannel {
  private config: AlipayConfig;
  private gatewayUrl: string;
  private formattedPrivateKey: string;
  private formattedAlipayPublicKey: string;

  constructor(config: PaymentConfig['alipay']) {
    if (!config) {
      throw new Error('Alipay payment config is required');
    }
    this.config = config;
    this.gatewayUrl = config.sandbox
      ? 'https://openapi-sandbox.dl.alipaydev.com/gateway.do'
      : config.gatewayUrl || 'https://openapi.alipay.com/gateway.do';

    this.formattedPrivateKey = this.formatPrivateKey(config.privateKey);
    this.formattedAlipayPublicKey = this.formatPublicKey(config.alipayPublicKey);
  }

  /**
   * Format private key to PEM format
   */
  private formatPrivateKey(key: string): string {
    const cleanKey = key
      .replaceAll(/-----BEGIN.*?-----/g, '')
      .replaceAll(/-----END.*?-----/g, '')
      .replaceAll(/\s/g, '');

    const isPKCS1 =
      cleanKey.startsWith('MIIEpAIBAAKCAQEA') ||
      cleanKey.startsWith('MIIEowIBAAKCAQEA') ||
      !cleanKey.includes('BADANBgkqhkiG9w');

    if (isPKCS1) {
      return `-----BEGIN RSA PRIVATE KEY-----\n${cleanKey.match(/.{1,64}/g)?.join('\n')}\n-----END RSA PRIVATE KEY-----`;
    } else {
      return `-----BEGIN PRIVATE KEY-----\n${cleanKey.match(/.{1,64}/g)?.join('\n')}\n-----END PRIVATE KEY-----`;
    }
  }

  /**
   * Format public key to PEM format
   */
  private formatPublicKey(key: string): string {
    const cleanKey = key
      .replaceAll(/-----BEGIN.*?-----/g, '')
      .replaceAll(/-----END.*?-----/g, '')
      .replaceAll(/\s/g, '');

    return `-----BEGIN PUBLIC KEY-----\n${cleanKey.match(/.{1,64}/g)?.join('\n')}\n-----END PUBLIC KEY-----`;
  }

  /**
   * 创建支付并签约订单
   * 返回用于生成二维码的字符串
   */
  async createSignPayment(params: CreateSignPaymentParams): Promise<{
    codeUrl?: string;
    errorMessage?: string;
    orderStr?: string;
    success: boolean;
  }> {
    try {
      const { orderNo, amount, subject, agreementParams } = params;

      // 计算下次扣款时间（签约成功后的下一个周期）
      const executeTime = this.calculateNextDeductDate(
        agreementParams.periodType,
        agreementParams.period,
      );

      const bizContent = {
        agreement_sign_params: {
          access_params: {
            channel: agreementParams.accessChannel,
          },
          external_agreement_no: agreementParams.externalAgreementNo,
          period_rule_params: {
            execute_time: executeTime,
            period: String(agreementParams.period),
            period_type: agreementParams.periodType,
            single_amount: (agreementParams.singleAmount / 100).toFixed(2),
            total_amount: agreementParams.totalAmount
              ? (agreementParams.totalAmount / 100).toFixed(2)
              : undefined,
            total_payments: agreementParams.totalPayments
              ? String(agreementParams.totalPayments)
              : undefined,
          },
          personal_product_code: 'CYCLE_PAY_AUTH_P',
          sign_notify_url: this.config.signNotifyUrl || this.config.notifyUrl,
          sign_scene: agreementParams.signScene,
        },
        out_trade_no: orderNo,
        product_code: 'CYCLE_PAY_AUTH',
        subject,
        timeout_express: '120m',
        total_amount: (amount / 100).toFixed(2),
      };

      // 使用 sdkExecute 方式获取签名字符串（用于 App/小程序 唤起支付）
      // 对于 Web 端扫码，我们需要用 alipay.trade.precreate 或页面跳转方式
      // 这里使用 pageExecute 方式生成跳转 URL

      const requestParams = this.buildCommonParams('alipay.trade.app.pay', bizContent);
      const signedParams = this.signParams(requestParams);

      // 生成签名后的完整参数字符串（用于 App SDK 或生成二维码）
      const orderStr = new URLSearchParams(signedParams).toString();

      // 对于 Web 扫码场景，我们需要生成一个可以被扫码打开的 URL
      // 支付宝提供的方式是通过 H5 页面中转
      // 实际上，周期扣款的扫码签约需要使用 alipay.user.agreement.page.sign 接口
      // 但由于我们需要支付+签约，这里使用 alipay.trade.app.pay 的方式

      // 生成二维码 URL（通过支付宝网关跳转）
      const codeUrl = `${this.gatewayUrl}?${orderStr}`;

      return {
        codeUrl,
        orderStr,
        success: true,
      };
    } catch (error) {
      console.error('[AlipayCycle] Create sign payment error:', error);
      return {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      };
    }
  }

  /**
   * 使用协议号进行代扣
   */
  async deductPayment(params: DeductPaymentParams): Promise<DeductResult> {
    try {
      const { orderNo, amount, subject, agreementNo } = params;

      const bizContent = {
        agreement_params: {
          agreement_no: agreementNo,
        },
        out_trade_no: orderNo,
        product_code: 'CYCLE_PAY_AUTH',
        subject,
        total_amount: (amount / 100).toFixed(2),
      };

      const requestParams = this.buildCommonParams('alipay.trade.pay', bizContent);
      const signedParams = this.signParams(requestParams);

      const response = await fetch(this.gatewayUrl, {
        body: new URLSearchParams(signedParams).toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        method: 'POST',
      });

      const responseText = await response.text();
      console.log('[AlipayCycle] Deduct response:', responseText);
      const result = JSON.parse(responseText);

      const responseKey = 'alipay_trade_pay_response';
      const tradeResponse = result[responseKey];

      if (!tradeResponse) {
        return {
          errorMessage: 'Invalid response from Alipay',
          orderNo,
          status: 'failed',
        };
      }

      // 根据结果码处理
      switch (tradeResponse.code) {
        case '10000': // 支付成功
          return {
            channelOrderNo: tradeResponse.trade_no,
            orderNo,
            status: 'success',
          };

        case '10003': // 等待用户付款
        case '20000': // 未知异常
          return {
            errorCode: tradeResponse.code,
            errorMessage: tradeResponse.sub_msg || tradeResponse.msg,
            orderNo,
            status: 'pending',
          };

        case '40004': // 支付失败
        default:
          return {
            errorCode: tradeResponse.sub_code || tradeResponse.code,
            errorMessage: tradeResponse.sub_msg || tradeResponse.msg || 'Deduct failed',
            orderNo,
            status: 'failed',
          };
      }
    } catch (error) {
      console.error('[AlipayCycle] Deduct payment error:', error);
      return {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        orderNo: params.orderNo,
        status: 'failed',
      };
    }
  }

  /**
   * 查询签约协议状态
   */
  async queryAgreement(agreementNo: string): Promise<AgreementQueryResult> {
    try {
      const bizContent = {
        agreement_no: agreementNo,
        personal_product_code: 'CYCLE_PAY_AUTH_P',
      };

      const requestParams = this.buildCommonParams('alipay.user.agreement.query', bizContent);
      const signedParams = this.signParams(requestParams);

      const response = await fetch(this.gatewayUrl, {
        body: new URLSearchParams(signedParams).toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        method: 'POST',
      });

      const responseText = await response.text();
      const result = JSON.parse(responseText);

      const responseKey = 'alipay_user_agreement_query_response';
      const queryResponse = result[responseKey];

      if (!queryResponse || queryResponse.code !== '10000') {
        // 协议不存在或查询失败
        return {
          errorMessage: queryResponse?.sub_msg || queryResponse?.msg || 'Query failed',
          status: 'NOT_EXIST',
          success: false,
        };
      }

      return {
        agreementNo: queryResponse.agreement_no,
        nextDeductDate: queryResponse.next_deduct_date,
        signTime: queryResponse.sign_time ? new Date(queryResponse.sign_time) : undefined,
        status: queryResponse.status,
        success: true,
        validTime: queryResponse.valid_time ? new Date(queryResponse.valid_time) : undefined,
      };
    } catch (error) {
      console.error('[AlipayCycle] Query agreement error:', error);
      return {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        status: 'NOT_EXIST',
        success: false,
      };
    }
  }

  /**
   * 解约协议
   */
  async unsignAgreement(agreementNo: string): Promise<{ errorMessage?: string; success: boolean }> {
    try {
      const bizContent = {
        agreement_no: agreementNo,
        personal_product_code: 'CYCLE_PAY_AUTH_P',
      };

      const requestParams = this.buildCommonParams('alipay.user.agreement.unsign', bizContent);
      const signedParams = this.signParams(requestParams);

      const response = await fetch(this.gatewayUrl, {
        body: new URLSearchParams(signedParams).toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        method: 'POST',
      });

      const responseText = await response.text();
      const result = JSON.parse(responseText);

      const responseKey = 'alipay_user_agreement_unsign_response';
      const unsignResponse = result[responseKey];

      if (!unsignResponse || unsignResponse.code !== '10000') {
        return {
          errorMessage: unsignResponse?.sub_msg || unsignResponse?.msg || 'Unsign failed',
          success: false,
        };
      }

      return { success: true };
    } catch (error) {
      console.error('[AlipayCycle] Unsign agreement error:', error);
      return {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      };
    }
  }

  /**
   * 解析签约异步通知
   */
  parseSignNotification(rawBody: string | Buffer): SignNotificationResult | null {
    try {
      const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
      const params = new URLSearchParams(bodyStr);
      const data: Record<string, string> = {};

      for (const [key, value] of params.entries()) {
        data[key] = value;
      }

      // 验证签名
      const sign = data.sign;
      const signType = data.sign_type;

      if (!sign || signType !== 'RSA2') {
        console.error('[AlipayCycle] Invalid sign type in notification');
        return null;
      }

      // 移除 sign 和 sign_type 进行验签
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { sign: _sign, sign_type: _signType, ...paramsToVerify } = data;
      const signContent = this.buildSignContent(paramsToVerify);

      if (!this.config.sandbox && !this.verifySignature(signContent, sign)) {
        console.error('[AlipayCycle] Signature verification failed');
        return null;
      }

      // 检查通知类型
      const notifyType = data.notify_type;
      if (notifyType !== 'dut_user_sign' && notifyType !== 'dut_user_unsign') {
        console.log('[AlipayCycle] Unknown notify type:', notifyType);
        return null;
      }

      return {
        agreementNo: data.agreement_no,
        alipayLogonId: data.alipay_logon_id,
        alipayOpenId: data.alipay_open_id,
        alipayUserId: data.alipay_user_id,
        externalAgreementNo: data.external_agreement_no,
        signScene: data.sign_scene,
        signTime: data.sign_time ? new Date(data.sign_time) : new Date(),
        status: data.status as 'NORMAL' | 'UNSIGN',
        success: true,
      };
    } catch (error) {
      console.error('[AlipayCycle] Parse sign notification error:', error);
      return null;
    }
  }

  /**
   * 计算下次扣款日期
   */
  private calculateNextDeductDate(periodType: 'DAY' | 'MONTH', period: number): string {
    const now = new Date();
    const nextDate = new Date(now);

    if (periodType === 'MONTH') {
      nextDate.setMonth(nextDate.getMonth() + period);
      // 确保日期不超过28日（避免某些月份没有29、30、31日）
      if (nextDate.getDate() > 28) {
        nextDate.setDate(28);
      }
    } else {
      nextDate.setDate(nextDate.getDate() + period);
    }

    // 格式化为 yyyy-MM-dd
    return nextDate.toISOString().split('T')[0];
  }

  /**
   * Build common parameters for Alipay API
   */
  private buildCommonParams(
    method: string,
    bizContent: Record<string, any>,
  ): Record<string, string> {
    return {
      app_id: this.config.appId,
      biz_content: JSON.stringify(bizContent),
      charset: 'utf8',
      format: 'JSON',
      method,
      notify_url: this.config.notifyUrl,
      sign_type: 'RSA2',
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      version: '1.0',
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
    sign.update(content, 'utf8');
    return sign.sign(this.formattedPrivateKey, 'base64');
  }

  /**
   * Verify signature using Alipay public key
   */
  private verifySignature(content: string, signature: string): boolean {
    try {
      const verify = crypto.createVerify('RSA-SHA256');
      verify.update(content, 'utf8');
      return verify.verify(this.formattedAlipayPublicKey, signature, 'base64');
    } catch {
      return false;
    }
  }
}
