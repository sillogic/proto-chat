import { describe, expect, it } from 'vitest';

import {
  errorCauseFrom,
  errorMessageFrom,
  errorNameFrom,
  errorStackFrom,
  isError,
  isErrorLike,
} from './error';

describe('isError', () => {
  it('should return true for an Error instance', () => {
    expect(isError(new Error('test'))).toBe(true);
  });

  it('should return true for subclass Error instances', () => {
    expect(isError(new TypeError('type error'))).toBe(true);
    expect(isError(new RangeError('range error'))).toBe(true);
    expect(isError(new SyntaxError('syntax error'))).toBe(true);
  });

  it('should return false for null', () => {
    expect(isError(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isError(undefined)).toBe(false);
  });

  it('should return false for a plain object with error-like shape', () => {
    expect(isError({ message: 'test', name: 'Error' })).toBe(false);
  });

  it('should return false for a string', () => {
    expect(isError('error message')).toBe(false);
  });

  it('should return false for a number', () => {
    expect(isError(42)).toBe(false);
  });

  it('should return false for an array', () => {
    expect(isError([])).toBe(false);
  });
});

describe('isErrorLike', () => {
  it('should return true for an actual Error instance', () => {
    expect(isErrorLike(new Error('test'))).toBe(true);
  });

  it('should return true for an object with name and message string properties', () => {
    expect(isErrorLike({ name: 'CustomError', message: 'something went wrong' })).toBe(true);
  });

  it('should return true for an object with extra properties beyond name and message', () => {
    expect(isErrorLike({ name: 'Error', message: 'msg', code: 404 })).toBe(true);
  });

  it('should return false for null', () => {
    expect(isErrorLike(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isErrorLike(undefined)).toBe(false);
  });

  it('should return false for an object missing message', () => {
    expect(isErrorLike({ name: 'Error' })).toBe(false);
  });

  it('should return false for an object missing name', () => {
    expect(isErrorLike({ message: 'error' })).toBe(false);
  });

  it('should return false when name is not a string', () => {
    expect(isErrorLike({ name: 123, message: 'error' })).toBe(false);
  });

  it('should return false when message is not a string', () => {
    expect(isErrorLike({ name: 'Error', message: 123 })).toBe(false);
  });

  it('should return false for a plain string', () => {
    expect(isErrorLike('error')).toBe(false);
  });

  it('should return false for a number', () => {
    expect(isErrorLike(42)).toBe(false);
  });

  it('should return false for an empty object', () => {
    expect(isErrorLike({})).toBe(false);
  });
});

describe('errorNameFrom', () => {
  it('should return the name from an Error instance', () => {
    expect(errorNameFrom(new Error('test'))).toBe('Error');
  });

  it('should return the name from a TypeError', () => {
    expect(errorNameFrom(new TypeError('type error'))).toBe('TypeError');
  });

  it('should return the name from an error-like object', () => {
    expect(errorNameFrom({ name: 'CustomError', message: 'msg' })).toBe('CustomError');
  });

  it('should return undefined for null', () => {
    expect(errorNameFrom(null)).toBeUndefined();
  });

  it('should return undefined for undefined', () => {
    expect(errorNameFrom(undefined)).toBeUndefined();
  });

  it('should return undefined for a plain string', () => {
    expect(errorNameFrom('error')).toBeUndefined();
  });

  it('should return undefined for a non-error-like object', () => {
    expect(errorNameFrom({ foo: 'bar' })).toBeUndefined();
  });
});

describe('errorMessageFrom', () => {
  it('should return the message from an Error instance', () => {
    expect(errorMessageFrom(new Error('test message'))).toBe('test message');
  });

  it('should return the message from an error-like object', () => {
    expect(errorMessageFrom({ name: 'CustomError', message: 'custom message' })).toBe(
      'custom message',
    );
  });

  it('should return undefined for null', () => {
    expect(errorMessageFrom(null)).toBeUndefined();
  });

  it('should return undefined for undefined', () => {
    expect(errorMessageFrom(undefined)).toBeUndefined();
  });

  it('should return undefined for a plain string', () => {
    expect(errorMessageFrom('error')).toBeUndefined();
  });

  it('should return undefined for a non-error-like object', () => {
    expect(errorMessageFrom({ foo: 'bar' })).toBeUndefined();
  });
});

describe('errorStackFrom', () => {
  it('should return the stack from an Error instance', () => {
    const err = new Error('test');
    const result = errorStackFrom(err);
    expect(typeof result).toBe('string');
    expect(result).toContain('Error: test');
  });

  it('should return the stack from an error-like object that has a stack', () => {
    const obj = { name: 'CustomError', message: 'msg', stack: 'CustomError: msg\n  at test:1:1' };
    expect(errorStackFrom(obj)).toBe('CustomError: msg\n  at test:1:1');
  });

  it('should generate a fallback stack when error-like object has no stack', () => {
    const obj = { name: 'CustomError', message: 'fallback message' };
    const result = errorStackFrom(obj);
    expect(typeof result).toBe('string');
    // Should contain the message in the generated stack
    expect(result).toContain('fallback message');
  });

  it('should return undefined for null', () => {
    expect(errorStackFrom(null)).toBeUndefined();
  });

  it('should return undefined for undefined', () => {
    expect(errorStackFrom(undefined)).toBeUndefined();
  });

  it('should return undefined for a plain string', () => {
    expect(errorStackFrom('error')).toBeUndefined();
  });
});

describe('errorCauseFrom', () => {
  it('should return the cause from an Error with cause', () => {
    const cause = new Error('original error');
    const err = new Error('wrapper error', { cause });
    expect(errorCauseFrom(err)).toBe(cause);
  });

  it('should return the cause from an error-like object with cause', () => {
    const cause = { code: 404 };
    const obj = { name: 'Error', message: 'not found', cause };
    expect(errorCauseFrom(obj)).toBe(cause);
  });

  it('should return undefined when there is no cause', () => {
    const err = new Error('no cause');
    expect(errorCauseFrom(err)).toBeUndefined();
  });

  it('should return undefined when cause is null', () => {
    const obj = { name: 'Error', message: 'null cause', cause: null };
    expect(errorCauseFrom(obj)).toBeUndefined();
  });

  it('should return undefined for null input', () => {
    expect(errorCauseFrom(null)).toBeUndefined();
  });

  it('should return undefined for undefined input', () => {
    expect(errorCauseFrom(undefined)).toBeUndefined();
  });

  it('should return undefined for a non-error-like object', () => {
    expect(errorCauseFrom({ foo: 'bar' })).toBeUndefined();
  });

  it('should support primitive cause values', () => {
    const obj = { name: 'Error', message: 'string cause', cause: 'original cause string' };
    expect(errorCauseFrom<string>(obj)).toBe('original cause string');
  });
});
