import '@testing-library/jest-dom';

// jsdom does not implement ResizeObserver — provide a minimal stub
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
