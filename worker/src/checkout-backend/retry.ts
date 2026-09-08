/** Retry only explicit transaction-aborted PostgreSQL codes, never ambiguous I/O. */
export function isTransactionRetryable(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error &&
    ['55P03', '40P01', '40001'].includes(String(error.code));
}

export async function retryTransaction<T>(run: () => Promise<T>,
  pause: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms))): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await run(); }
    catch (error) {
      if (attempt >= 3 || !isTransactionRetryable(error)) throw error;
      await pause(20 * 2 ** attempt + Math.floor(Math.random() * 20));
    }
  }
}