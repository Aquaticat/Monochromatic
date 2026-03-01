import {
  describe,
  expect,
  test,
} from 'bun:test';

import {
  isJsonRpcMessage,
  JSON_RPC_INTERNAL_ERROR,
  JSON_RPC_INVALID_PARAMS,
  JSON_RPC_METHOD_NOT_FOUND,
  JSON_RPC_PARSE_ERROR,
} from './json-rpc.ts';

//region isJsonRpcMessage -- validates minimum JSON-RPC 2.0 shape

describe('isJsonRpcMessage', () => {
  test('accepts a valid request with id and method', () => {
    expect.assertions(1);
    const message = { jsonrpc: '2.0', id: 1, method: 'tools/list' };
    expect(isJsonRpcMessage(message)).toBe(true);
  });

  test('accepts a valid notification without id', () => {
    expect.assertions(1);
    const notification = { jsonrpc: '2.0', method: 'notifications/initialized' };
    expect(isJsonRpcMessage(notification)).toBe(true);
  });

  test('accepts a request with params', () => {
    expect.assertions(1);
    const message = { jsonrpc: '2.0', id: 'abc', method: 'tools/call', params: { name: 'test' } };
    expect(isJsonRpcMessage(message)).toBe(true);
  });

  test('rejects null', () => {
    expect.assertions(1);
    expect(isJsonRpcMessage(null)).toBe(false);
  });

  test('rejects undefined', () => {
    expect.assertions(1);
    expect(isJsonRpcMessage(undefined)).toBe(false);
  });

  test('rejects a string', () => {
    expect.assertions(1);
    expect(isJsonRpcMessage('hello')).toBe(false);
  });

  test('rejects a number', () => {
    expect.assertions(1);
    expect(isJsonRpcMessage(42)).toBe(false);
  });

  test('rejects an array', () => {
    expect.assertions(1);
    expect(isJsonRpcMessage([1, 2, 3])).toBe(false);
  });

  test('rejects object without jsonrpc field', () => {
    expect.assertions(1);
    expect(isJsonRpcMessage({ method: 'tools/list' })).toBe(false);
  });

  test('rejects object with wrong jsonrpc version', () => {
    expect.assertions(1);
    expect(isJsonRpcMessage({ jsonrpc: '1.0', method: 'tools/list' })).toBe(false);
  });

  test('rejects object without method field', () => {
    expect.assertions(1);
    expect(isJsonRpcMessage({ jsonrpc: '2.0', id: 1 })).toBe(false);
  });

  test('rejects object with non-string method', () => {
    expect.assertions(1);
    expect(isJsonRpcMessage({ jsonrpc: '2.0', method: 42 })).toBe(false);
  });

  test('rejects empty object', () => {
    expect.assertions(1);
    expect(isJsonRpcMessage({})).toBe(false);
  });
});

//endregion isJsonRpcMessage

//region error code constants -- verify expected values

describe('error code constants', () => {
  test('JSON_RPC_METHOD_NOT_FOUND is -32601', () => {
    expect.assertions(1);
    expect(JSON_RPC_METHOD_NOT_FOUND).toBe(-32_601);
  });

  test('JSON_RPC_INVALID_PARAMS is -32602', () => {
    expect.assertions(1);
    expect(JSON_RPC_INVALID_PARAMS).toBe(-32_602);
  });

  test('JSON_RPC_INTERNAL_ERROR is -32603', () => {
    expect.assertions(1);
    expect(JSON_RPC_INTERNAL_ERROR).toBe(-32_603);
  });

  test('JSON_RPC_PARSE_ERROR is -32700', () => {
    expect.assertions(1);
    expect(JSON_RPC_PARSE_ERROR).toBe(-32_700);
  });
});

//endregion error code constants
