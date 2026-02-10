// @vitest-environment node
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { LobeChatDatabase } from '@lobechat/database';

import { PaymentService } from './index';
import type { PaymentConfig, CreateOrderInput, PaymentChannel } from './types';

// Mock payment channels
const createMockChannelMethods = () => ({
  closeOrder: vi.fn().mockResolvedValue(undefined),
  createPayment: vi.fn().mockResolvedValue({
    channelData: { code_url: 'https://example.com/qr' },
    channelOrderNo: 'CH123456',
    success: true,
  }),
  parseNotification: vi.fn(),
  queryOrder: vi.fn(),
});

const createMockCycleChannelMethods = () => ({
  ...createMockChannelMethods(),
  createSignPayment: vi.fn().mockResolvedValue({
    codeUrl: 'https://example.com/qr',
    success: true,
  }),
  deductPayment: vi.fn().mockResolvedValue({
    channelOrderNo: 'CH789',
    status: 'success',
  }),
  unsignAgreement: vi.fn().mockResolvedValue({ success: true }),
});

vi.mock('./channels/wechat-native', () => ({
  WeChatNativeChannel: class {
    closeOrder = vi.fn().mockResolvedValue(undefined);
    createPayment = vi.fn().mockResolvedValue({
      channelData: { code_url: 'https://example.com/qr' },
      channelOrderNo: 'CH123456',
      success: true,
    });
    parseNotification = vi.fn();
    queryOrder = vi.fn();
  },
}));

vi.mock('./channels/alipay-precreate', () => ({
  AlipayPrecreateChannel: class {
    closeOrder = vi.fn().mockResolvedValue(undefined);
    createPayment = vi.fn().mockResolvedValue({
      channelData: { code_url: 'https://example.com/qr' },
      channelOrderNo: 'CH123456',
      success: true,
    });
    parseNotification = vi.fn();
    queryOrder = vi.fn();
  },
}));

vi.mock('./channels/alipay-cycle', () => ({
  AlipayCycleChannel: class {
    closeOrder = vi.fn().mockResolvedValue(undefined);
    createPayment = vi.fn().mockResolvedValue({
      channelData: { code_url: 'https://example.com/qr' },
      channelOrderNo: 'CH123456',
      success: true,
    });
    createSignPayment = vi.fn().mockResolvedValue({
      codeUrl: 'https://example.com/qr',
      success: true,
    });
    deductPayment = vi.fn().mockResolvedValue({
      channelOrderNo: 'CH789',
      status: 'success',
    });
    parseNotification = vi.fn();
    queryOrder = vi.fn();
    unsignAgreement = vi.fn().mockResolvedValue({ success: true });
  },
}));

// Mock database
const createMockDb = () => {
  const mockLimit = vi.fn();
  const mockWhere = vi.fn(() => ({ limit: mockLimit }));
  const mockFrom = vi.fn(() => ({ limit: mockLimit, where: mockWhere }));
  const mockSelect = vi.fn(() => ({ from: mockFrom }));
  const mockValues = vi.fn();
  const mockInsert = vi.fn(() => ({ values: mockValues }));
  const mockSetWhere = vi.fn();
  const mockSet = vi.fn(() => ({ where: mockSetWhere }));
  const mockUpdate = vi.fn(() => ({ set: mockSet }));

  return {
    insert: mockInsert,
    select: mockSelect,
    update: mockUpdate,
    _mockHelpers: {
      from: mockFrom,
      insert: mockInsert,
      limit: mockLimit,
      select: mockSelect,
      set: mockSet,
      setWhere: mockSetWhere,
      update: mockUpdate,
      values: mockValues,
      where: mockWhere,
    },
  } as unknown as LobeChatDatabase & {
    _mockHelpers: {
      from: ReturnType<typeof vi.fn>;
      insert: ReturnType<typeof vi.fn>;
      limit: ReturnType<typeof vi.fn>;
      select: ReturnType<typeof vi.fn>;
      set: ReturnType<typeof vi.fn>;
      setWhere: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      values: ReturnType<typeof vi.fn>;
      where: ReturnType<typeof vi.fn>;
    };
  };
};

// Mock payment channel
const createMockChannel = (): PaymentChannel => ({
  closeOrder: vi.fn().mockResolvedValue(undefined),
  createPayment: vi.fn().mockResolvedValue({
    channelData: { code_url: 'https://example.com/qr' },
    channelOrderNo: 'CH123456',
    success: true,
  }),
  parseNotification: vi.fn(),
  queryOrder: vi.fn(),
});

describe('PaymentService', () => {
  let mockDb: LobeChatDatabase & {
    _mockHelpers: {
      from: ReturnType<typeof vi.fn>;
      insert: ReturnType<typeof vi.fn>;
      limit: ReturnType<typeof vi.fn>;
      select: ReturnType<typeof vi.fn>;
      set: ReturnType<typeof vi.fn>;
      setWhere: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      values: ReturnType<typeof vi.fn>;
      where: ReturnType<typeof vi.fn>;
    };
  };
  let paymentService: PaymentService;
  let mockConfig: PaymentConfig;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();

    mockDb = createMockDb();
    mockConfig = {
      alipay: {
        alipayPublicKey: 'test-alipay-public-key',
        appId: 'test-alipay-app-id',
        notifyUrl: 'https://test.com/notify/alipay',
        privateKey: 'test-alipay-private-key',
      },
      wechat: {
        apiKey: 'test-wechat-api-key',
        appId: 'test-wechat-app-id',
        mchId: 'test-wechat-mch-id',
        notifyUrl: 'https://test.com/notify/wechat',
      },
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Constructor', () => {
    it('should initialize with WeChat channel when config provided', () => {
      const config: PaymentConfig = {
        wechat: {
          apiKey: 'test-key',
          appId: 'test-app-id',
          mchId: 'test-mch-id',
          notifyUrl: 'https://test.com/notify',
        },
      };
      const service = new PaymentService(mockDb, config);
      expect(service.getChannel('wechat_native')).toBeDefined();
    });

    it('should initialize with Alipay channels when config provided', () => {
      const config: PaymentConfig = {
        alipay: {
          alipayPublicKey: 'test-public-key',
          appId: 'test-app-id',
          notifyUrl: 'https://test.com/notify',
          privateKey: 'test-private-key',
        },
      };
      const service = new PaymentService(mockDb, config);
      expect(service.getChannel('alipay_precreate')).toBeDefined();
      expect(service.getCycleChannel()).toBeDefined();
    });

    it('should initialize with both channels when both configs provided', () => {
      const service = new PaymentService(mockDb, mockConfig);
      expect(service.getChannel('wechat_native')).toBeDefined();
      expect(service.getChannel('alipay_precreate')).toBeDefined();
      expect(service.getCycleChannel()).toBeDefined();
    });

    it('should not initialize channels when config not provided', () => {
      const service = new PaymentService(mockDb, {});
      expect(service.getChannel('wechat_native')).toBeUndefined();
      expect(service.getChannel('alipay_precreate')).toBeUndefined();
      expect(service.getCycleChannel()).toBeNull();
    });
  });

  describe('createOrder - Input Validation', () => {
    beforeEach(() => {
      paymentService = new PaymentService(mockDb, mockConfig);
    });

    it('should throw error when durationMonths missing for one-time payment', async () => {
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
        durationMonths: 2,
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

    it('should throw error when durationMonths provided for recurring subscription', async () => {
      const input: CreateOrderInput = {
        durationMonths: 12,
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

    it('should throw error when payment channel not supported', async () => {
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

    it('should throw error when plan not found', async () => {
      mockDb._mockHelpers.limit.mockResolvedValue([]);

      const input: CreateOrderInput = {
        payChannel: 'wechat_native',
        planId: 'non-existent-plan',
        planInterval: 'month',
        subscriptionType: 'recurring',
        userId: 'user-123',
      };

      await expect(paymentService.createOrder(input)).rejects.toThrow('Plan not found');
    });
  });

  describe('createOrder - Amount Calculation', () => {
    beforeEach(() => {
      paymentService = new PaymentService(mockDb, mockConfig);

      // Mock plan data
      mockDb._mockHelpers.limit.mockResolvedValueOnce([
        {
          id: 'plan-123',
          monthlyPrice: 5000, // 50 CNY
          name: 'Pro Plan',
          slug: 'pro',
          yearlyPrice: 50_000, // 500 CNY
        },
      ]);

      // Mock no existing orders
      mockDb._mockHelpers.limit.mockResolvedValueOnce([]);

      // Mock insert
      mockDb._mockHelpers.values.mockResolvedValue(undefined);
    });

    it('should calculate amount correctly for monthly recurring subscription', async () => {
      const input: CreateOrderInput = {
        payChannel: 'wechat_native',
        planId: 'plan-123',
        planInterval: 'month',
        subscriptionType: 'recurring',
        userId: 'user-123',
      };

      const result = await paymentService.createOrder(input);
      expect(result.amount).toBe(5000);
    });

    it('should calculate amount correctly for yearly recurring subscription', async () => {
      const input: CreateOrderInput = {
        payChannel: 'wechat_native',
        planId: 'plan-123',
        planInterval: 'year',
        subscriptionType: 'recurring',
        userId: 'user-123',
      };

      const result = await paymentService.createOrder(input);
      expect(result.amount).toBe(50_000);
    });

    it('should calculate amount correctly for 1-month one-time payment', async () => {
      const input: CreateOrderInput = {
        durationMonths: 1,
        payChannel: 'wechat_native',
        planId: 'plan-123',
        planInterval: 'month',
        subscriptionType: 'onetime',
        userId: 'user-123',
      };

      const result = await paymentService.createOrder(input);
      expect(result.amount).toBe(5000); // monthlyPrice × 1
    });

    it('should calculate amount correctly for 3-month one-time payment', async () => {
      const input: CreateOrderInput = {
        durationMonths: 3,
        payChannel: 'wechat_native',
        planId: 'plan-123',
        planInterval: 'month',
        subscriptionType: 'onetime',
        userId: 'user-123',
      };

      const result = await paymentService.createOrder(input);
      expect(result.amount).toBe(15_000); // monthlyPrice × 3
    });

    it('should calculate amount correctly for 12-month one-time payment using yearly price', async () => {
      const input: CreateOrderInput = {
        durationMonths: 12,
        payChannel: 'wechat_native',
        planId: 'plan-123',
        planInterval: 'month',
        subscriptionType: 'onetime',
        userId: 'user-123',
      };

      const result = await paymentService.createOrder(input);
      expect(result.amount).toBe(50_000); // yearlyPrice
    });

    it('should apply discount amount correctly', async () => {
      const input: CreateOrderInput = {
        discountAmount: 1000, // 10 CNY discount
        payChannel: 'wechat_native',
        planId: 'plan-123',
        planInterval: 'month',
        subscriptionType: 'recurring',
        userId: 'user-123',
      };

      const result = await paymentService.createOrder(input);
      expect(result.amount).toBe(4000); // 5000 - 1000
    });

    it('should apply residual value correctly', async () => {
      const input: CreateOrderInput = {
        payChannel: 'wechat_native',
        planId: 'plan-123',
        planInterval: 'month',
        residualValue: 2000, // 20 CNY residual
        subscriptionType: 'recurring',
        userId: 'user-123',
      };

      const result = await paymentService.createOrder(input);
      expect(result.amount).toBe(3000); // 5000 - 2000
    });

    it('should apply both discount and residual value correctly', async () => {
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
      expect(result.amount).toBe(2000); // 5000 - 1000 - 2000
    });

    it('should not allow negative amount', async () => {
      const input: CreateOrderInput = {
        discountAmount: 3000,
        payChannel: 'wechat_native',
        planId: 'plan-123',
        planInterval: 'month',
        residualValue: 3000,
        subscriptionType: 'recurring',
        userId: 'user-123',
      };

      const result = await paymentService.createOrder(input);
      expect(result.amount).toBe(0); // Max(0, 5000 - 3000 - 3000)
    });

    it('should throw error when plan has zero or negative price', async () => {
      // Override plan mock with zero price
      mockDb._mockHelpers.limit.mockReset();
      mockDb._mockHelpers.limit.mockResolvedValueOnce([
        {
          id: 'plan-123',
          monthlyPrice: 0,
          name: 'Free Plan',
          slug: 'free',
          yearlyPrice: 0,
        },
      ]);

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
  });

  describe('createOrder - Existing Order Reuse', () => {
    beforeEach(() => {
      paymentService = new PaymentService(mockDb, mockConfig);
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-15T10:00:00'));
    });

    it('should reuse existing unexpired pending order', async () => {
      // Mock plan data
      mockDb._mockHelpers.limit.mockResolvedValueOnce([
        {
          id: 'plan-123',
          monthlyPrice: 5000,
          name: 'Pro Plan',
          slug: 'pro',
          yearlyPrice: 50_000,
        },
      ]);

      // Mock existing unexpired order
      const existingExpiredAt = new Date('2026-01-15T12:00:00'); // 2 hours later
      mockDb._mockHelpers.limit.mockResolvedValueOnce([
        {
          amount: 5000,
          channelData: { code_url: 'https://existing.com/qr' },
          expiredAt: existingExpiredAt,
          orderNo: 'PC20260115080000123456',
          planId: 'plan-123',
          planInterval: 'month',
          status: 'pending',
          subscriptionType: 'recurring',
          userId: 'user-123',
        },
      ]);

      const input: CreateOrderInput = {
        payChannel: 'wechat_native',
        planId: 'plan-123',
        planInterval: 'month',
        subscriptionType: 'recurring',
        userId: 'user-123',
      };

      const result = await paymentService.createOrder(input);

      expect(result.orderNo).toBe('PC20260115080000123456');
      expect(result.codeUrl).toBe('https://existing.com/qr');
      expect(result.amount).toBe(5000);
      // Should not create new order
      expect(mockDb._mockHelpers.values).not.toHaveBeenCalled();
    });

    it('should create new order when existing order is expired', async () => {
      // Mock plan data
      mockDb._mockHelpers.limit.mockResolvedValueOnce([
        {
          id: 'plan-123',
          monthlyPrice: 5000,
          name: 'Pro Plan',
          slug: 'pro',
          yearlyPrice: 50_000,
        },
      ]);

      // Mock existing expired order
      const existingExpiredAt = new Date('2026-01-15T09:00:00'); // 1 hour ago (expired)
      mockDb._mockHelpers.limit.mockResolvedValueOnce([
        {
          amount: 5000,
          channelData: { code_url: 'https://existing.com/qr' },
          expiredAt: existingExpiredAt,
          orderNo: 'PC20260115070000123456',
          planId: 'plan-123',
          planInterval: 'month',
          status: 'pending',
          subscriptionType: 'recurring',
          userId: 'user-123',
        },
      ]);

      // Mock insert
      mockDb._mockHelpers.values.mockResolvedValue(undefined);

      const input: CreateOrderInput = {
        payChannel: 'wechat_native',
        planId: 'plan-123',
        planInterval: 'month',
        subscriptionType: 'recurring',
        userId: 'user-123',
      };

      const result = await paymentService.createOrder(input);

      // Should create new order
      expect(mockDb._mockHelpers.values).toHaveBeenCalled();
      expect(result.orderNo).not.toBe('PC20260115070000123456');
    });
  });

  describe('createOrder - Order Creation', () => {
    beforeEach(() => {
      paymentService = new PaymentService(mockDb, mockConfig);
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-15T10:00:00'));

      // Mock plan data
      mockDb._mockHelpers.limit.mockResolvedValueOnce([
        {
          id: 'plan-123',
          monthlyPrice: 5000,
          name: 'Pro Plan',
          slug: 'pro',
          yearlyPrice: 50_000,
        },
      ]);

      // Mock no existing orders
      mockDb._mockHelpers.limit.mockResolvedValueOnce([]);

      // Mock insert
      mockDb._mockHelpers.values.mockResolvedValue(undefined);
    });

    it('should set expiration time to 2 hours', async () => {
      const input: CreateOrderInput = {
        payChannel: 'wechat_native',
        planId: 'plan-123',
        planInterval: 'month',
        subscriptionType: 'recurring',
        userId: 'user-123',
      };

      const result = await paymentService.createOrder(input);

      const expectedExpiredAt = new Date('2026-01-15T12:00:00');
      expect(result.expiredAt).toEqual(expectedExpiredAt);
    });

    it('should return code URL from channel', async () => {
      const input: CreateOrderInput = {
        payChannel: 'wechat_native',
        planId: 'plan-123',
        planInterval: 'month',
        subscriptionType: 'recurring',
        userId: 'user-123',
      };

      const result = await paymentService.createOrder(input);

      expect(result.codeUrl).toBe('https://example.com/qr');
    });

    it('should close order and throw error when channel creation fails', async () => {
      // Mock channel failure
      const mockChannel = paymentService.getChannel('wechat_native') as any;
      vi.spyOn(mockChannel, 'createPayment').mockResolvedValueOnce({
        errorMessage: 'Channel error',
        success: false,
      });

      const input: CreateOrderInput = {
        payChannel: 'wechat_native',
        planId: 'plan-123',
        planInterval: 'month',
        subscriptionType: 'recurring',
        userId: 'user-123',
      };

      await expect(paymentService.createOrder(input)).rejects.toThrow('Channel error');

      // Verify order was closed
      expect(mockDb._mockHelpers.set).toHaveBeenCalledWith(
        expect.objectContaining({
          closedAt: expect.any(Date),
          status: 'closed',
        }),
      );
    });

    it('should store plan value for future residual calculation', async () => {
      const input: CreateOrderInput = {
        discountAmount: 1000,
        payChannel: 'wechat_native',
        planId: 'plan-123',
        planInterval: 'month',
        subscriptionType: 'recurring',
        userId: 'user-123',
      };

      await paymentService.createOrder(input);

      // Verify plan value = baseAmount - discount (but NOT residual)
      expect(mockDb._mockHelpers.values).toHaveBeenCalledWith(
        expect.objectContaining({
          planValue: 4000, // 5000 - 1000
        }),
      );
    });
  });

  describe('queryOrder', () => {
    beforeEach(() => {
      paymentService = new PaymentService(mockDb, mockConfig);
    });

    it('should return order details when order exists', async () => {
      mockDb._mockHelpers.limit.mockResolvedValue([
        {
          amount: 5000,
          orderNo: 'PC20260115100000123456',
          paidAt: new Date('2026-01-15T10:30:00'),
          status: 'paid',
        },
      ]);

      const result = await paymentService.queryOrder('PC20260115100000123456');

      expect(result).toEqual({
        amount: 5000,
        orderNo: 'PC20260115100000123456',
        paidAt: new Date('2026-01-15T10:30:00'),
        status: 'paid',
      });
    });

    it('should throw error when order not found', async () => {
      mockDb._mockHelpers.limit.mockResolvedValue([]);

      await expect(paymentService.queryOrder('non-existent-order')).rejects.toThrow(
        'Order not found',
      );
    });

    it('should return undefined paidAt when order is pending', async () => {
      mockDb._mockHelpers.limit.mockResolvedValue([
        {
          amount: 5000,
          orderNo: 'PC20260115100000123456',
          paidAt: null,
          status: 'pending',
        },
      ]);

      const result = await paymentService.queryOrder('PC20260115100000123456');

      expect(result.paidAt).toBeUndefined();
    });
  });

  describe('closeOrder', () => {
    beforeEach(() => {
      paymentService = new PaymentService(mockDb, mockConfig);
    });

    it('should close pending order successfully', async () => {
      mockDb._mockHelpers.limit.mockResolvedValue([
        {
          orderNo: 'PC20260115100000123456',
          payChannel: 'wechat_native',
          status: 'pending',
          userId: 'user-123',
        },
      ]);

      mockDb._mockHelpers.setWhere.mockResolvedValue(undefined);

      await paymentService.closeOrder('PC20260115100000123456', 'user-123');

      // Verify channel close was called
      const mockChannel = paymentService.getChannel('wechat_native') as any;
      expect(mockChannel.closeOrder).toHaveBeenCalledWith('PC20260115100000123456');

      // Verify database update
      expect(mockDb._mockHelpers.set).toHaveBeenCalledWith(
        expect.objectContaining({
          closedAt: expect.any(Date),
          status: 'closed',
          updatedAt: expect.any(Date),
        }),
      );
    });

    it('should throw error when order not found', async () => {
      mockDb._mockHelpers.limit.mockResolvedValue([]);

      await expect(paymentService.closeOrder('non-existent', 'user-123')).rejects.toThrow(
        'Order not found',
      );
    });

    it('should throw error when user does not own the order', async () => {
      mockDb._mockHelpers.limit.mockResolvedValue([
        {
          orderNo: 'PC20260115100000123456',
          status: 'pending',
          userId: 'other-user',
        },
      ]);

      await expect(
        paymentService.closeOrder('PC20260115100000123456', 'user-123'),
      ).rejects.toThrow('Unauthorized');
    });

    it('should not close already paid order', async () => {
      mockDb._mockHelpers.limit.mockResolvedValue([
        {
          orderNo: 'PC20260115100000123456',
          payChannel: 'wechat_native',
          status: 'paid',
          userId: 'user-123',
        },
      ]);

      await paymentService.closeOrder('PC20260115100000123456', 'user-123');

      // Should return early without updating
      expect(mockDb._mockHelpers.set).not.toHaveBeenCalled();
    });

    it('should not close already closed order', async () => {
      mockDb._mockHelpers.limit.mockResolvedValue([
        {
          orderNo: 'PC20260115100000123456',
          payChannel: 'wechat_native',
          status: 'closed',
          userId: 'user-123',
        },
      ]);

      await paymentService.closeOrder('PC20260115100000123456', 'user-123');

      // Should return early without updating
      expect(mockDb._mockHelpers.set).not.toHaveBeenCalled();
    });
  });

  describe('getChannel', () => {
    it('should return channel when it exists', () => {
      const service = new PaymentService(mockDb, mockConfig);
      const channel = service.getChannel('wechat_native');
      expect(channel).toBeDefined();
    });

    it('should return undefined when channel does not exist', () => {
      const service = new PaymentService(mockDb, {});
      const channel = service.getChannel('wechat_native');
      expect(channel).toBeUndefined();
    });
  });

  describe('getCycleChannel', () => {
    it('should return cycle channel when alipay configured', () => {
      const service = new PaymentService(mockDb, mockConfig);
      const channel = service.getCycleChannel();
      expect(channel).toBeDefined();
    });

    it('should return null when alipay not configured', () => {
      const service = new PaymentService(mockDb, {
        wechat: mockConfig.wechat,
      });
      const channel = service.getCycleChannel();
      expect(channel).toBeNull();
    });
  });
});
