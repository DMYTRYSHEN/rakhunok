// Node's native TS test runner resolves explicit .js literally; Vite/TypeScript
// resolve the adjacent .ts source. Keep this bridge logic-free.
export * from './checkout-contract.ts';