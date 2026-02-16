// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PaymentService } from './index';
import type { PaymentChannel, PaymentConfig, CreateOrderInput } from './types';

// Mock dependencies
vi.mock('./channels/wechat-native');
vi.mock('./channels/alipay-precreate');
vi.mock('./channels/alipay-cycle');
vi.mock('./utils/order-no');

describe('PaymentService', () => {
  let mockDb: any;
  let paymentService: PaymentService;
  let mockWeChatChannel: PaymentChannel;
  let mockAlipayChannel: PaymentChannel;
  let mockCycleChannel: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock payment channels
    mockWeChatChannel = {
      closeOrder: vi.fn(),
      createPayment: vi.fn(),
      parseNotification: vi.fn(),
      queryOrder: vi.fn(),
    };

    mockAlipayChannel = {
      closeOrder: vi.fn(),
      createPayment: vi.fn(),
      parseNotification: vi.fn(),
      queryOrder: vi.fn(),
    };

    mockCycleChannel = {
      createSignPayment: vi.fn(),
      deductPayment: vi.fn(),
      unsignAgreement: vi.fn(),
    };

    // Mock channel constructors
    const { WeChatNativeChannel } = await import('./channels/wechat-native');
    const { AlipayPrecreateChannel } = await import('./channels/alipay-precreate');
    const { AlipayCycleChannel } = await import('./channels/alipay-cycle');

    vi.mocked(WeChatNativeChannel).mockImplementation(() => mockWeChatChannel as any);
    vi.mocked(AlipayPrecreateChannel).mockImplementation(() => mockAlipayChannel as any);
    vi.mocked(AlipayCycleChannel).mockImplementation(() => mockCycleChannel);

    // Mock database
    mockDb = {
      delete: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };

    // Mock order number generation
    const { generateOrderNo } = await import('./utils/order-no');
    vi.mocked(generateOrderNo).mockReturnValue('PC202601270930451234567');
  });

  describe('constructor', () => {
    it('should initialize with WeChat channel only', () => {
      const config: PaymentConfig = {
        wechat: {
          apiKey: 'test-api-key',
          appId: 'wx123456',
          mchId: 'mch123',
          notifyUrl: 'https://example.com/notify',
        },
      };

      paymentService = new PaymentService(mockDb, config);

      expect(paymentService).toBeDefined();
      expect(paymentService.getChannel('wechat_native')).toBeDefined();
      expect(paymentService.getChannel('alipay_precreate')).toBeUndefined();
      expect(paymentService.getCycleChannel()).toBeNull();
    });

    it('should initialize with Alipay channels', () => {
      const config: PaymentConfig = {
        alipay: {
          alipayPublicKey: 'alipay-public-key',
          appId: 'alipay123',
          notifyUrl: 'https://example.com/notify',
          privateKey: 'private-key',
        },
      };

      paymentService = new PaymentService(mockDb, config);

      expect(paymentService.getChannel('alipay_precreate')).toBeDefined();
      expect(paymentService.getCycleChannel()).toBeDefined();
    });

    it('should initialize with both WeChat and Alipay channels', () => {
      const config: PaymentConfig = {
        alipay: {
          alipayPublicKey: 'alipay-public-key',
          appId: 'alipay123',
          notifyUrl: 'https://example.com/notify',
          privateKey: 'private-key',
        },
        wechat: {
          apiKey: 'test-api-key',
          appId: 'wx123456',
          mchId: 'mch123',
          notifyUrl: 'https://example.com/notify',
        },
      };

      paymentService = new PaymentService(mockDb, config);

      expect(paymentService.getChannel('wechat_native')).toBeDefined();
      expect(paymentService.getChannel('alipay_precreate')).toBeDefined();
      expect(paymentService.getCycleChannel()).toBeDefined();
    });
  });

  describe('createOrder', () => {
    beforeEach(() => {
      const config: PaymentConfig = {
        alipay: {
          alipayPublicKey: 'alipay-public-key',
          appId: 'alipay123',
          notifyUrl: 'https://example.com/notify',
          privateKey: 'private-key',
        },
        wechat: {
          apiKey: 'test-api-key',
          appId: 'wx123456',
          mchId: 'mch123',
          notifyUrl: 'https://example.com/notify',
        },
      };

      paymentService = new PaymentService(mockDb, config);
    });

    it('should throw error when durationMonths is missing for one-time payment', async () => {
      const input: CreateOrderInput = {
        payChannel: 'wechat_native',
        planId: 'plan-123',
        planInterval: 'month',
        subscriptionType: 'onetime',
        userId: 'user-123',
      };

      await expect(paymentService.createOrder(input)).rejects.toThrow(
        'durationMonths is required for one-time payment',
      );
    });

    it('should throw error when durationMonths is invalid for one-time payment', async () => {
      const input: CreateOrderInput = {
        durationMonths: 5,
        payChannel: 'wechat_native',
        planId: 'plan-123',
        planInterval: 'month',
        subscriptionType: 'onetime',
        userId: 'user-123',
      };

      await expect(paymentService.createOrder(input)).rejects.toThrow(
        'durationMonths must be 1, 3, 6, or 12',
      );
    });

    it('should throw error when durationMonths is provided for recurring subscription', async () => {
      const input: CreateOrderInput = {
        durationMonths: 3,
        payChannel: 'wechat_native',
        planId: 'plan-123',
        planInterval: 'month',
        subscriptionType: 'recurring',
        userId: 'user-123',
      };

      await expect(paymentService.createOrder(input)).rejects.toThrow(
        'durationMonths should not be provided for recurring subscriptions',
      );
    });

    it('should throw error for unsupported payment channel', async () => {
      const input: CreateOrderInput = {
        payChannel: 'unsupported_channel' as any,
        planId: 'plan-123',
        planInterval: 'month',
        subscriptionType: 'recurring',
        userId: 'user-123',
      };

      await expect(paymentService.createOrder(input)).rejects.toThrow(
        'Payment channel unsupported_channel not supported',
      );
    });

    it('should throw error when plan is not found', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      const input: CreateOrderInput = {
        payChannel: 'wechat_native',
        planId: 'nonexistent-plan',
        planInterval: 'month',
        subscriptionType: 'recurring',
        userId: 'user-123',
      };

      await expect(paymentService.createOrder(input)).rejects.toThrow('Plan not found');
    });

    it('should create recurring monthly payment order successfully', async () => {
      const mockPlan = {
        id: 'plan-123',
        monthlyPrice: 9900,
        name: 'Pro Plan',
        slug: 'pro',
        yearlyPrice: 99_000,
      };

      mockDb.limit
        .mockResolvedValueOnce([mockPlan]) // Plan query
        .mockResolvedValueOnce([]); // No existing order

      vi.mocked(mockWeChatChannel.createPayment).mockResolvedValue({
        channelData: { code_url: 'weixin://pay/code123' },
        channelOrderNo: 'wx-order-123',
        success: true,
      });

      const input: CreateOrderInput = {
        payChannel: 'wechat_native',
        planId: 'plan-123',
        planInterval: 'month',
        subscriptionType: 'recurring',
        userId: 'user-123',
      };

      const result = await paymentService.createOrder(input);

      expect(result).toEqual({
        amount: 9900,
        codeUrl: 'weixin://pay/code123',
        expiredAt: expect.any(Date),
        orderNo: 'PC202601270930451234567',
      });

      expect(mockWeChatChannel.createPayment).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
      expect(mockDb.update).toHaveBeenCalledTimes(1);
    });

    it('should create recurring yearly payment order successfully', async () => {
      const mockPlan = {
        id: 'plan-123',
        monthlyPrice: 9900,
        name: 'Pro Plan',
        slug: 'pro',
        yearlyPrice: 99_000,
      };

      mockDb.limit
        .mockResolvedValueOnce([mockPlan])
        .mockResolvedValueOnce([]);

      vi.mocked(mockWeChatChannel.createPayment).mockResolvedValue({
        channelData: { code_url: 'weixin://pay/code123' },
        channelOrderNo: 'wx-order-123',
        success: true,
      });

      const input: CreateOrderInput = {
        payChannel: 'wechat_native',
        planId: 'plan-123',
        planInterval: 'year',
        subscriptionType: 'recurring',
        userId: 'user-123',
      };

      const result = await paymentService.createOrder(input);

      expect(result.amount).toBe(99_000);
    });

    it('should create one-time payment for 12 months using yearly price', async () => {
      const mockPlan = {
        id: 'plan-123',
        monthlyPrice: 9900,
        name: 'Pro Plan',
        slug: 'pro',
        yearlyPrice: 99_000,
      };

      mockDb.limit
        .mockResolvedValueOnce([mockPlan])
        .mockResolvedValueOnce([]);

      vi.mocked(mockAlipayChannel.createPayment).mockResolvedValue({
        channelData: { code_url: 'alipay://code123' },
        channelOrderNo: 'alipay-order-123',
        success: true,
      });

      const input: CreateOrderInput = {
        durationMonths: 12,
        payChannel: 'alipay_precreate',
        planId: 'plan-123',
        planInterval: 'year',
        subscriptionType: 'onetime',
        userId: 'user-123',
      };

      const result = await paymentService.createOrder(input);

      expect(result.amount).toBe(99_000);
    });

    it('should create one-time payment for 3 months using monthly price', async () => {
      const mockPlan = {
        id: 'plan-123',
        monthlyPrice: 9900,
        name: 'Pro Plan',
        slug: 'pro',
        yearlyPrice: 99_000,
      };

      mockDb.limit
        .mockResolvedValueOnce([mockPlan])
        .mockResolvedValueOnce([]);

      vi.mocked(mockAlipayChannel.createPayment).mockResolvedValue({
        channelData: { code_url: 'alipay://code123' },
        channelOrderNo: 'alipay-order-123',
        success: true,
      });

      const input: CreateOrderInput = {
        durationMonths: 3,
        payChannel: 'alipay_precreate',
        planId: 'plan-123',
        planInterval: 'month',
        subscriptionType: 'onetime',
        userId: 'user-123',
      };

      const result = await paymentService.createOrder(input);

      expect(result.amount).toBe(29_700); // 9900 * 3
    });

    it('should apply discount amount correctly', async () => {
      const mockPlan = {
        id: 'plan-123',
        monthlyPrice: 9900,
        name: 'Pro Plan',
        slug: 'pro',
        yearlyPrice: 99_000,
      };

      mockDb.limit
        .mockResolvedValueOnce([mockPlan])
        .mockResolvedValueOnce([]);

      vi.mocked(mockWeChatChannel.createPayment).mockResolvedValue({
        channelData: { code_url: 'weixin://pay/code123' },
        channelOrderNo: 'wx-order-123',
        success: true,
      });

      const input: CreateOrderInput = {
        discountAmount: 1000,
        payChannel: 'wechat_native',
        planId: 'plan-123',
        planInterval: 'month',
        subscriptionType: 'recurring',
        userId: 'user-123',
      };

      const result = await paymentService.createOrder(input);

      expect(result.amount).toBe(8900); // 9900 - 1000
    });

    it('should apply residual value correctly', async () => {
      const mockPlan = {
        id: 'plan-123',
        monthlyPrice: 9900,
        name: 'Pro Plan',
        slug: 'pro',
        yearlyPrice: 99_000,
      };

      mockDb.limit
        .mockResolvedValueOnce([mockPlan])
        .mockResolvedValueOnce([]);

      vi.mocked(mockWeChatChannel.createPayment).mockResolvedValue({
        channelData: { code_url: 'weixin://pay/code123' },
        channelOrderNo: 'wx-order-123',
        success: true,
      });

      const input: CreateOrderInput = {
        payChannel: 'wechat_native',
        planId: 'plan-123',
        planInterval: 'month',
        residualValue: 2000,
        subscriptionType: 'recurring',
        userId: 'user-123',
      };

      const result = await paymentService.createOrder(input);

      expect(result.amount).toBe(7900); // 9900 - 2000
    });

    it('should apply both discount and residual value correctly', async () => {
      const mockPlan = {
        id: 'plan-123',
        monthlyPrice: 9900,
        name: 'Pro Plan',
        slug: 'pro',
        yearlyPrice: 99_000,
      };

      mockDb.limit
        .mockResolvedValueOnce([mockPlan])
        .mockResolvedValueOnce([]);

      vi.mocked(mockWeChatChannel.createPayment).mockResolvedValue({
        channelData: { code_url: 'weixin://pay/code123' },
        channelOrderNo: 'wx-order-123',
        success: true,
      });

      const input: CreateOrderInput = {
        discountAmount: 1000,
        payChannel: 'wechat_native',
        planId: 'plan-123',
        planInterval: 'month',
        residualValue: 2000,
        subscriptionType: 'recurring',
        userId: 'user-123',
      };

      const result = await paymentService.createOrder(input);

      expect(result.amount).toBe(6900); // 9900 - 1000 - 2000
    });

    it('should set amount to 0 when discounts exceed base amount', async () => {
      const mockPlan = {
        id: 'plan-123',
        monthlyPrice: 9900,
        name: 'Pro Plan',
        slug: 'pro',
        yearlyPrice: 99_000,
      };

      mockDb.limit
        .mockResolvedValueOnce([mockPlan])
        .mockResolvedValueOnce([]);

      vi.mocked(mockWeChatChannel.createPayment).mockResolvedValue({
        channelData: { code_url: 'weixin://pay/code123' },
        channelOrderNo: 'wx-order-123',
        success: true,
      });

      const input: CreateOrderInput = {
        discountAmount: 5000,
        payChannel: 'wechat_native',
        planId: 'plan-123',
        planInterval: 'month',
        residualValue: 10_000,
        subscriptionType: 'recurring',
        userId: 'user-123',
      };

      const result = await paymentService.createOrder(input);

      expect(result.amount).toBe(0);
    });

    it('should reuse existing pending order if not expired', async () => {
      const mockPlan = {
        id: 'plan-123',
        monthlyPrice: 9900,
        name: 'Pro Plan',
        slug: 'pro',
        yearlyPrice: 99_000,
      };

      const futureDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
      const existingOrder = {
        amount: 9900,
        channelData: { code_url: 'weixin://existing-code' },
        expiredAt: futureDate,
        orderNo: 'PC202601270930451234560',
        status: 'pending',
      };

      mockDb.limit
        .mockResolvedValueOnce([mockPlan])
        .mockResolvedValueOnce([existingOrder]);

      const input: CreateOrderInput = {
        payChannel: 'wechat_native',
        planId: 'plan-123',
        planInterval: 'month',
        subscriptionType: 'recurring',
        userId: 'user-123',
      };

      const result = await paymentService.createOrder(input);

      expect(result).toEqual({
        amount: 9900,
        codeUrl: 'weixin://existing-code',
        expiredAt: futureDate,
        orderNo: 'PC202601270930451234560',
      });

      // Should NOT create new order
      expect(mockWeChatChannel.createPayment).not.toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('should throw error when plan has invalid amount', async () => {
      const mockPlan = {
        id: 'plan-123',
        monthlyPrice: 0,
        name: 'Pro Plan',
        slug: 'pro',
        yearlyPrice: 0,
      };

      mockDb.limit
        .mockResolvedValueOnce([mockPlan])
        .mockResolvedValueOnce([]);

      const input: CreateOrderInput = {
        payChannel: 'wechat_native',
        planId: 'plan-123',
        planInterval: 'month',
        subscriptionType: 'recurring',
        userId: 'user-123',
      };

      await expect(paymentService.createOrder(input)).rejects.toThrow(
        'Invalid amount calculated for plan plan-123',
      );
    });

    it('should close order and throw error when channel creation fails', async () => {
      const mockPlan = {
        id: 'plan-123',
        monthlyPrice: 9900,
        name: 'Pro Plan',
        slug: 'pro',
        yearlyPrice: 99_000,
      };

      mockDb.limit
        .mockResolvedValueOnce([mockPlan])
        .mockResolvedValueOnce([]);

      vi.mocked(mockWeChatChannel.createPayment).mockResolvedValue({
        errorMessage: 'Payment gateway error',
        success: false,
      });

      const input: CreateOrderInput = {
        payChannel: 'wechat_native',
        planId: 'plan-123',
        planInterval: 'month',
        subscriptionType: 'recurring',
        userId: 'user-123',
      };

      await expect(paymentService.createOrder(input)).rejects.toThrow('Payment gateway error');

      // Should update order to closed status
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('queryOrder', () => {
    beforeEach(() => {
      const config: PaymentConfig = {
        wechat: {
          apiKey: 'test-api-key',
          appId: 'wx123456',
          mchId: 'mch123',
          notifyUrl: 'https://example.com/notify',
        },
      };

      paymentService = new PaymentService(mockDb, config);
    });

    it('should throw error when order is not found', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      await expect(paymentService.queryOrder('nonexistent-order')).rejects.toThrow(
        'Order not found',
      );
    });

    it('should return order status for pending order', async () => {
      const mockOrder = {
        amount: 9900,
        orderNo: 'PC202601270930451234567',
        paidAt: null,
        status: 'pending',
      };

      mockDb.limit.mockResolvedValueOnce([mockOrder]);

      const result = await paymentService.queryOrder('PC202601270930451234567');

      expect(result).toEqual({
        amount: 9900,
        orderNo: 'PC202601270930451234567',
        paidAt: undefined,
        status: 'pending',
      });
    });

    it('should return order status for paid order with paidAt date', async () => {
      const paidAt = new Date('2024-01-27T10:00:00Z');
      const mockOrder = {
        amount: 9900,
        orderNo: 'PC202601270930451234567',
        paidAt,
        status: 'paid',
      };

      mockDb.limit.mockResolvedValueOnce([mockOrder]);

      const result = await paymentService.queryOrder('PC202601270930451234567');

      expect(result).toEqual({
        amount: 9900,
        orderNo: 'PC202601270930451234567',
        paidAt,
        status: 'paid',
      });
    });
  });

  describe('closeOrder', () => {
    beforeEach(() => {
      const config: PaymentConfig = {
        wechat: {
          apiKey: 'test-api-key',
          appId: 'wx123456',
          mchId: 'mch123',
          notifyUrl: 'https://example.com/notify',
        },
      };

      paymentService = new PaymentService(mockDb, config);
    });

    it('should throw error when order is not found', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      await expect(paymentService.closeOrder('nonexistent-order', 'user-123')).rejects.toThrow(
        'Order not found',
      );
    });

    it('should throw error when user does not own the order', async () => {
      const mockOrder = {
        orderNo: 'PC202601270930451234567',
        payChannel: 'wechat_native',
        status: 'pending',
        userId: 'different-user',
      };

      mockDb.limit.mockResolvedValueOnce([mockOrder]);

      await expect(
        paymentService.closeOrder('PC202601270930451234567', 'user-123'),
      ).rejects.toThrow('Unauthorized');
    });

    it('should do nothing if order is already paid', async () => {
      const mockOrder = {
        orderNo: 'PC202601270930451234567',
        payChannel: 'wechat_native',
        status: 'paid',
        userId: 'user-123',
      };

      mockDb.limit.mockResolvedValueOnce([mockOrder]);

      await paymentService.closeOrder('PC202601270930451234567', 'user-123');

      expect(mockWeChatChannel.closeOrder).not.toHaveBeenCalled();
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('should close pending order successfully', async () => {
      const mockOrder = {
        orderNo: 'PC202601270930451234567',
        payChannel: 'wechat_native',
        status: 'pending',
        userId: 'user-123',
      };

      mockDb.limit.mockResolvedValueOnce([mockOrder]);

      await paymentService.closeOrder('PC202601270930451234567', 'user-123');

      expect(mockWeChatChannel.closeOrder).toHaveBeenCalledWith('PC202601270930451234567');
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('getChannel', () => {
    it('should return correct channel', () => {
      const config: PaymentConfig = {
        wechat: {
          apiKey: 'test-api-key',
          appId: 'wx123456',
          mchId: 'mch123',
          notifyUrl: 'https://example.com/notify',
        },
      };

      paymentService = new PaymentService(mockDb, config);

      const channel = paymentService.getChannel('wechat_native');
      expect(channel).toBe(mockWeChatChannel);
    });

    it('should return undefined for non-existent channel', () => {
      const config: PaymentConfig = {
        wechat: {
          apiKey: 'test-api-key',
          appId: 'wx123456',
          mchId: 'mch123',
          notifyUrl: 'https://example.com/notify',
        },
      };

      paymentService = new PaymentService(mockDb, config);

      const channel = paymentService.getChannel('nonexistent');
      expect(channel).toBeUndefined();
    });
  });
});
