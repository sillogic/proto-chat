import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InMemoryStreamEventManager } from '../InMemoryStreamEventManager';

describe('InMemoryStreamEventManager', () => {
  let manager: InMemoryStreamEventManager;

  beforeEach(() => {
    manager = new InMemoryStreamEventManager();
  });

  afterEach(() => {
    manager.clear();
  });

  describe('publishStreamEvent', () => {
    it('should publish an event and return an event id', async () => {
      const eventId = await manager.publishStreamEvent('op-1', {
        data: { text: 'hello' },
        stepIndex: 0,
        type: 'stream_chunk',
      });

      expect(typeof eventId).toBe('string');
      expect(eventId).toBeTruthy();
    });

    it('should store published events', async () => {
      await manager.publishStreamEvent('op-1', {
        data: { text: 'hello' },
        stepIndex: 0,
        type: 'stream_chunk',
      });

      const events = manager.getAllEvents('op-1');
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('stream_chunk');
      expect(events[0].operationId).toBe('op-1');
      expect(events[0].data).toEqual({ text: 'hello' });
    });

    it('should increment event ids monotonically', async () => {
      const id1 = await manager.publishStreamEvent('op-1', {
        data: {},
        stepIndex: 0,
        type: 'stream_start',
      });
      const id2 = await manager.publishStreamEvent('op-1', {
        data: {},
        stepIndex: 1,
        type: 'stream_chunk',
      });

      // IDs should be different
      expect(id1).not.toBe(id2);
    });

    it('should add timestamp to published events', async () => {
      const before = Date.now();
      await manager.publishStreamEvent('op-1', {
        data: {},
        stepIndex: 0,
        type: 'stream_chunk',
      });
      const after = Date.now();

      const events = manager.getAllEvents('op-1');
      expect(events[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(events[0].timestamp).toBeLessThanOrEqual(after);
    });

    it('should keep events isolated per operation id', async () => {
      await manager.publishStreamEvent('op-1', {
        data: { text: 'for op-1' },
        stepIndex: 0,
        type: 'stream_chunk',
      });
      await manager.publishStreamEvent('op-2', {
        data: { text: 'for op-2' },
        stepIndex: 0,
        type: 'stream_chunk',
      });

      expect(manager.getAllEvents('op-1')).toHaveLength(1);
      expect(manager.getAllEvents('op-2')).toHaveLength(1);
      expect(manager.getAllEvents('op-1')[0].data.text).toBe('for op-1');
      expect(manager.getAllEvents('op-2')[0].data.text).toBe('for op-2');
    });

    it('should cap stream at 1000 events to prevent memory overflow', async () => {
      // Publish 1001 events
      for (let i = 0; i < 1001; i++) {
        await manager.publishStreamEvent('op-1', {
          data: { index: i },
          stepIndex: i,
          type: 'stream_chunk',
        });
      }

      const events = manager.getAllEvents('op-1');
      expect(events.length).toBe(1000);
    });

    it('should notify subscribers when an event is published', async () => {
      const callback = vi.fn();
      manager.subscribe('op-1', callback);

      await manager.publishStreamEvent('op-1', {
        data: { text: 'hello' },
        stepIndex: 0,
        type: 'stream_chunk',
      });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ type: 'stream_chunk', data: { text: 'hello' } }),
        ]),
      );
    });

    it('should not call subscribers for a different operation id', async () => {
      const callback = vi.fn();
      manager.subscribe('op-1', callback);

      await manager.publishStreamEvent('op-2', {
        data: {},
        stepIndex: 0,
        type: 'stream_chunk',
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle subscriber callback errors gracefully', async () => {
      const errorCallback = vi.fn(() => {
        throw new Error('subscriber error');
      });
      const normalCallback = vi.fn();

      manager.subscribe('op-1', errorCallback);
      manager.subscribe('op-1', normalCallback);

      // Should not throw even when a subscriber throws
      await expect(
        manager.publishStreamEvent('op-1', {
          data: {},
          stepIndex: 0,
          type: 'stream_chunk',
        }),
      ).resolves.not.toThrow();

      // Normal callback should still be called
      expect(normalCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('publishStreamChunk', () => {
    it('should publish a stream_chunk event', async () => {
      await manager.publishStreamChunk('op-1', 2, {
        chunkType: 'text',
        content: 'chunk content',
      });

      const events = manager.getAllEvents('op-1');
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('stream_chunk');
      expect(events[0].stepIndex).toBe(2);
      expect(events[0].data.content).toBe('chunk content');
    });
  });

  describe('publishAgentRuntimeInit', () => {
    it('should publish an agent_runtime_init event', async () => {
      const initialState = { config: { model: 'gpt-4' }, status: 'idle' };

      await manager.publishAgentRuntimeInit('op-1', initialState);

      const events = manager.getAllEvents('op-1');
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('agent_runtime_init');
      expect(events[0].stepIndex).toBe(0);
      expect(events[0].data).toEqual(initialState);
    });
  });

  describe('publishAgentRuntimeEnd', () => {
    it('should publish an agent_runtime_end event with default values', async () => {
      const finalState = { result: 'done' };

      await manager.publishAgentRuntimeEnd('op-1', 5, finalState);

      const events = manager.getAllEvents('op-1');
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('agent_runtime_end');
      expect(events[0].stepIndex).toBe(5);
      expect(events[0].data.reason).toBe('completed');
      expect(events[0].data.reasonDetail).toBe('Agent runtime completed successfully');
      expect(events[0].data.phase).toBe('execution_complete');
    });

    it('should publish an agent_runtime_end event with custom reason', async () => {
      const finalState = { result: 'interrupted' };

      await manager.publishAgentRuntimeEnd('op-1', 3, finalState, 'interrupted', 'User stopped');

      const events = manager.getAllEvents('op-1');
      expect(events[0].data.reason).toBe('interrupted');
      expect(events[0].data.reasonDetail).toBe('User stopped');
    });

    it('should include operationId in event data', async () => {
      await manager.publishAgentRuntimeEnd('op-42', 0, {});

      const events = manager.getAllEvents('op-42');
      expect(events[0].data.operationId).toBe('op-42');
    });
  });

  describe('getStreamHistory', () => {
    it('should return empty array when operation has no events', async () => {
      const history = await manager.getStreamHistory('nonexistent');
      expect(history).toEqual([]);
    });

    it('should return events in reverse order (most recent first)', async () => {
      await manager.publishStreamEvent('op-1', {
        data: { n: 1 },
        stepIndex: 0,
        type: 'stream_start',
      });
      await manager.publishStreamEvent('op-1', {
        data: { n: 2 },
        stepIndex: 1,
        type: 'stream_chunk',
      });
      await manager.publishStreamEvent('op-1', {
        data: { n: 3 },
        stepIndex: 2,
        type: 'stream_end',
      });

      const history = await manager.getStreamHistory('op-1');
      expect(history[0].data.n).toBe(3);
      expect(history[1].data.n).toBe(2);
      expect(history[2].data.n).toBe(1);
    });

    it('should respect the count limit', async () => {
      for (let i = 0; i < 10; i++) {
        await manager.publishStreamEvent('op-1', {
          data: { i },
          stepIndex: i,
          type: 'stream_chunk',
        });
      }

      const history = await manager.getStreamHistory('op-1', 3);
      expect(history).toHaveLength(3);
    });

    it('should return all events when count exceeds total', async () => {
      await manager.publishStreamEvent('op-1', { data: {}, stepIndex: 0, type: 'stream_chunk' });
      await manager.publishStreamEvent('op-1', { data: {}, stepIndex: 1, type: 'stream_chunk' });

      const history = await manager.getStreamHistory('op-1', 100);
      expect(history).toHaveLength(2);
    });
  });

  describe('cleanupOperation', () => {
    it('should remove all events for an operation', async () => {
      await manager.publishStreamEvent('op-1', { data: {}, stepIndex: 0, type: 'stream_chunk' });
      await manager.cleanupOperation('op-1');

      expect(manager.getAllEvents('op-1')).toEqual([]);
    });

    it('should remove subscribers for an operation', async () => {
      const callback = vi.fn();
      manager.subscribe('op-1', callback);

      await manager.cleanupOperation('op-1');

      // Publishing after cleanup should not trigger the callback
      await manager.publishStreamEvent('op-1', { data: {}, stepIndex: 0, type: 'stream_chunk' });
      expect(callback).not.toHaveBeenCalled();
    });

    it('should not affect other operations', async () => {
      await manager.publishStreamEvent('op-1', { data: {}, stepIndex: 0, type: 'stream_chunk' });
      await manager.publishStreamEvent('op-2', { data: {}, stepIndex: 0, type: 'stream_chunk' });

      await manager.cleanupOperation('op-1');

      expect(manager.getAllEvents('op-1')).toEqual([]);
      expect(manager.getAllEvents('op-2')).toHaveLength(1);
    });
  });

  describe('getActiveOperationsCount', () => {
    it('should return 0 when there are no operations', async () => {
      expect(await manager.getActiveOperationsCount()).toBe(0);
    });

    it('should count active operations correctly', async () => {
      await manager.publishStreamEvent('op-1', { data: {}, stepIndex: 0, type: 'stream_chunk' });
      await manager.publishStreamEvent('op-2', { data: {}, stepIndex: 0, type: 'stream_chunk' });

      expect(await manager.getActiveOperationsCount()).toBe(2);
    });

    it('should decrease count after cleanup', async () => {
      await manager.publishStreamEvent('op-1', { data: {}, stepIndex: 0, type: 'stream_chunk' });
      await manager.publishStreamEvent('op-2', { data: {}, stepIndex: 0, type: 'stream_chunk' });

      await manager.cleanupOperation('op-1');

      expect(await manager.getActiveOperationsCount()).toBe(1);
    });
  });

  describe('subscribe / unsubscribe', () => {
    it('should receive events after subscribing', async () => {
      const received: any[] = [];
      manager.subscribe('op-1', (events) => received.push(...events));

      await manager.publishStreamEvent('op-1', {
        data: { msg: 'hi' },
        stepIndex: 0,
        type: 'stream_chunk',
      });

      expect(received).toHaveLength(1);
      expect(received[0].data.msg).toBe('hi');
    });

    it('should stop receiving events after unsubscribing', async () => {
      const callback = vi.fn();
      const unsubscribe = manager.subscribe('op-1', callback);

      await manager.publishStreamEvent('op-1', { data: {}, stepIndex: 0, type: 'stream_chunk' });
      unsubscribe();
      await manager.publishStreamEvent('op-1', { data: {}, stepIndex: 1, type: 'stream_chunk' });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should support multiple subscribers for the same operation', async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      manager.subscribe('op-1', callback1);
      manager.subscribe('op-1', callback2);

      await manager.publishStreamEvent('op-1', { data: {}, stepIndex: 0, type: 'stream_chunk' });

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('should unsubscribe only the specific callback', async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const unsubscribe1 = manager.subscribe('op-1', callback1);
      manager.subscribe('op-1', callback2);

      unsubscribe1();
      await manager.publishStreamEvent('op-1', { data: {}, stepIndex: 0, type: 'stream_chunk' });

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });

  describe('clear', () => {
    it('should remove all events and subscribers', async () => {
      const callback = vi.fn();
      manager.subscribe('op-1', callback);
      await manager.publishStreamEvent('op-1', { data: {}, stepIndex: 0, type: 'stream_chunk' });
      await manager.publishStreamEvent('op-2', { data: {}, stepIndex: 0, type: 'stream_chunk' });

      manager.clear();

      expect(manager.getAllEvents('op-1')).toEqual([]);
      expect(manager.getAllEvents('op-2')).toEqual([]);
      expect(await manager.getActiveOperationsCount()).toBe(0);

      // Subscribers should be cleared too
      await manager.publishStreamEvent('op-1', { data: {}, stepIndex: 0, type: 'stream_chunk' });
      expect(callback).toHaveBeenCalledTimes(1); // only the pre-clear publish
    });

    it('should reset event id counter', async () => {
      await manager.publishStreamEvent('op-1', { data: {}, stepIndex: 0, type: 'stream_chunk' });
      manager.clear();

      const id = await manager.publishStreamEvent('op-1', {
        data: {},
        stepIndex: 0,
        type: 'stream_chunk',
      });
      // After clear, the counter resets so ids will restart from low values
      expect(id).toMatch(/^\d+-1$/);
    });
  });

  describe('getAllEvents', () => {
    it('should return empty array for unknown operation', () => {
      expect(manager.getAllEvents('unknown')).toEqual([]);
    });

    it('should return events in insertion order', async () => {
      for (let i = 0; i < 5; i++) {
        await manager.publishStreamEvent('op-1', {
          data: { i },
          stepIndex: i,
          type: 'stream_chunk',
        });
      }

      const events = manager.getAllEvents('op-1');
      for (let i = 0; i < 5; i++) {
        expect(events[i].data.i).toBe(i);
      }
    });
  });

  describe('waitForEvent', () => {
    it('should resolve immediately if event already exists', async () => {
      await manager.publishStreamEvent('op-1', { data: {}, stepIndex: 0, type: 'stream_end' });

      const event = await manager.waitForEvent('op-1', 'stream_end', 1000);
      expect(event.type).toBe('stream_end');
    });

    it('should wait for a future event and resolve when it arrives', async () => {
      const waitPromise = manager.waitForEvent('op-1', 'agent_runtime_end', 2000);

      // Publish a different event first (should not resolve the wait)
      await manager.publishStreamEvent('op-1', { data: {}, stepIndex: 0, type: 'stream_chunk' });
      // Publish the expected event
      await manager.publishStreamEvent('op-1', {
        data: { finalState: {} },
        stepIndex: 1,
        type: 'agent_runtime_end',
      });

      const event = await waitPromise;
      expect(event.type).toBe('agent_runtime_end');
    });

    it('should reject with timeout error if event never arrives', async () => {
      await expect(manager.waitForEvent('op-1', 'agent_runtime_end', 50)).rejects.toThrow(
        'Timeout waiting for event agent_runtime_end',
      );
    });
  });

  describe('disconnect', () => {
    it('should resolve without error', async () => {
      await expect(manager.disconnect()).resolves.not.toThrow();
    });
  });
});
