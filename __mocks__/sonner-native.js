// Jest mock for sonner-native (auto-applied for this node_module). The real
// package pulls in reanimated easing internals at import time that the unit
// tests' reanimated mocks don't provide; components only need `toast` to be a
// callable no-op in tests.
const toast = Object.assign(() => undefined, {
  success: () => undefined,
  error: () => undefined,
  info: () => undefined,
  warning: () => undefined,
  dismiss: () => undefined,
  custom: () => undefined,
});

const Toaster = () => null;

module.exports = { __esModule: true, toast, Toaster };
