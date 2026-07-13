import { retryUntilValidJson, retryUntilValid, stripCodeFences } from '../src/lib/retry';

describe('stripCodeFences', () => {
  test('strips json code fence', () => {
    const input = '```json\n[{"a":1}]\n```';
    expect(stripCodeFences(input)).toBe('[{"a":1}]');
  });

  test('strips js code fence', () => {
    const input = '```js\nconsole.log(1)\n```';
    expect(stripCodeFences(input)).toBe('console.log(1)');
  });

  test('passes through clean JSON', () => {
    const input = '[{"a":1}]';
    expect(stripCodeFences(input)).toBe('[{"a":1}]');
  });
});

describe('retryUntilValidJson', () => {
  test('succeeds on first attempt with valid JSON', async () => {
    const call = jest.fn().mockResolvedValue('[{"description":"test","confidence":"structural"}]');
    const isArray = (x: unknown): x is unknown[] => Array.isArray(x);
    const result = await retryUntilValidJson(call, isArray, 3);
    expect(result.attempts).toBe(1);
    expect(Array.isArray(result.value)).toBe(true);
  });

  test('retries on invalid JSON then succeeds', async () => {
    const call = jest.fn()
      .mockResolvedValueOnce('not json')
      .mockResolvedValueOnce('[{"ok":true}]');
    const isArray = (x: unknown): x is unknown[] => Array.isArray(x);
    const result = await retryUntilValidJson(call, isArray, 3);
    expect(result.attempts).toBe(2);
  });

  test('throws after all attempts fail', async () => {
    const call = jest.fn().mockResolvedValue('still not json');
    const isArray = (x: unknown): x is unknown[] => Array.isArray(x);
    await expect(retryUntilValidJson(call, isArray, 2)).rejects.toThrow();
    expect(call).toHaveBeenCalledTimes(2);
  });

  test('handles markdown-fenced JSON', async () => {
    const call = jest.fn().mockResolvedValue('```json\n[{"a":1}]\n```');
    const isArray = (x: unknown): x is unknown[] => Array.isArray(x);
    const result = await retryUntilValidJson(call, isArray, 1);
    expect(result.value).toEqual([{ a: 1 }]);
  });
});

describe('retryUntilValid', () => {
  test('succeeds on first attempt', async () => {
    const call = jest.fn().mockResolvedValue('valid output');
    const result = await retryUntilValid(call, (s: string) => s.length > 5, 3);
    expect(result.attempts).toBe(1);
  });

  test('throws if all attempts produce invalid results', async () => {
    const call = jest.fn().mockResolvedValue('bad');
    await expect(retryUntilValid(call, (s: string) => s.length > 10, 2)).rejects.toThrow();
  });
});
