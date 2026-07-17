import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { renderHook, act } from '@testing-library/react-native';

// Glitch-audit G1/G2 regression suite: the inset must recover from EVERY
// combination of missed native callbacks, because the two keyboard channels
// (insets animation vs discrete events) were observed failing INDEPENDENTLY.

// ── Controllable fakes ──────────────────────────────────────────────────────
type Listener = (e?: { height: number }) => void;
const mockListeners = new Map<string, Listener>();
const mockKbHeight = { value: 0 }; // the library's animated height (channel 1)
let mockControllerState: { isVisible: boolean; height: number } | undefined;

jest.mock('react-native-keyboard-controller', () => ({
  useReanimatedKeyboardAnimation: () => ({ height: mockKbHeight, progress: { value: 0 } }),
  KeyboardEvents: {
    addListener: (name: string, cb: Listener) => {
      mockListeners.set(name, cb);
      return { remove: () => mockListeners.delete(name) };
    },
  },
  KeyboardController: {
    isVisible: () => !!mockControllerState?.isVisible,
    state: () => (mockControllerState ? { height: mockControllerState.height } : undefined),
  },
}));

// AppState is spied (not module-mocked) — a full 'react-native' mock breaks the
// jest-expo preset (Platform.select in expo-modules-core setup).
const mockAppStateListeners = new Set<(s: string) => void>();
import { AppState } from 'react-native';
jest
  .spyOn(AppState, 'addEventListener')
  .mockImplementation(((_: string, cb: (s: string) => void) => {
    mockAppStateListeners.add(cb);
    return { remove: () => mockAppStateListeners.delete(cb) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any);

// Reanimated: shared values are plain boxes; withTiming resolves instantly to
// its target (we assert converged states, not animation frames);
// useAnimatedReaction re-runs on each render pass (mirrors "a frame arrived").
let mockReactions: { prepare: () => number; react: (v: number, p: number | null) => void }[] = [];
jest.mock('react-native-reanimated', () => ({
  useSharedValue: (v: number) => ({ value: v }),
  withTiming: (v: number) => v,
  useAnimatedReaction: (prepare: () => number, react: (v: number, p: number | null) => void) => {
    mockReactions.push({ prepare, react });
    react(prepare(), null);
  },
}));

import { useKeyboardInset } from '../useKeyboardInset';

/** Simulate an animation frame delivery (channel 1 working). */
const pumpAnimation = () => mockReactions.forEach((r) => r.react(r.prepare(), null));

beforeEach(() => {
  mockListeners.clear();
  mockAppStateListeners.clear();
  mockReactions = [];
  mockKbHeight.value = 0;
  mockControllerState = undefined;
});

describe('useKeyboardInset — three-channel reconciliation', () => {
  it('follows the animation channel when it works', () => {
    const { result } = renderHook(() => useKeyboardInset());
    act(() => {
      mockKbHeight.value = -300; // library reports negative translation
      pumpAnimation();
    });
    expect(result.current.value).toBe(300);
    act(() => {
      mockKbHeight.value = 0;
      pumpAnimation();
    });
    expect(result.current.value).toBe(0);
  });

  it('G1 regression: hide WITHOUT an animation frame → didHide event clamps to 0', () => {
    const { result } = renderHook(() => useKeyboardInset());
    act(() => {
      mockKbHeight.value = -300;
      pumpAnimation(); // keyboard opened normally
    });
    expect(result.current.value).toBe(300);
    // IME hidden by a hardware-key dismissal: NO animation frame arrives —
    // mockKbHeight stays stale at -300. Only the discrete event fires.
    act(() => mockListeners.get('keyboardDidHide')?.());
    expect(result.current.value).toBe(0);
  });

  it('G2-mirror: show WITHOUT an animation frame → didShow event raises the inset', () => {
    const { result } = renderHook(() => useKeyboardInset());
    act(() => mockListeners.get('keyboardDidShow')?.({ height: 280 }));
    expect(result.current.value).toBe(280);
  });

  it('both channels dead across a background hop → AppState resync converges', () => {
    const { result } = renderHook(() => useKeyboardInset());
    act(() => {
      mockKbHeight.value = -300;
      pumpAnimation();
    });
    expect(result.current.value).toBe(300);
    // Neither an animation frame nor a didHide event arrives; app comes back
    // to the foreground and the sync query says the keyboard is closed.
    mockControllerState = { isVisible: false, height: 0 };
    act(() => mockAppStateListeners.forEach((cb) => cb('active')));
    expect(result.current.value).toBe(0);
  });

  it('agreeing channels are a no-op (clamp does not fight the animation)', () => {
    const { result } = renderHook(() => useKeyboardInset());
    act(() => {
      mockKbHeight.value = -300;
      pumpAnimation();
      mockListeners.get('keyboardDidShow')?.({ height: 300 });
    });
    expect(result.current.value).toBe(300);
  });
});
