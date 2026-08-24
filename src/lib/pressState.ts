import { useCallback, useState } from 'react';

/**
 * Press feedback for `Pressable`, as STATE rather than as a style callback.
 *
 * ⛔ WHY THIS EXISTS — `style={({ pressed }) => …}` IS SILENTLY DELETED.
 *
 * NativeWind's interop SPREADS the `style` prop of an RN primitive. Spreading a
 * FUNCTION yields `{}`, so a callback style is dropped at runtime and the
 * component renders with NO style at all. Nothing warns; nothing throws.
 *
 * What that looked like in this app (both found on 2026-08-21):
 *   - `app/(auth)/pending.tsx` — the primary CTA lost `backgroundColor: FOREST`
 *     while its label kept `color:'#fff'` (a plain style, so it survived).
 *     White text on a white card: an INVISIBLE button, on the one screen where a
 *     not-yet-approved user has exactly one thing to do.
 *   - `app/(lab)/processing.tsx` — same shape on the Retry button, the only way
 *     out of an error screen.
 *
 * ⚠️ JEST CANNOT CATCH IT. The interop is not registered when
 * `NODE_ENV === 'test'`, so the callback runs normally under test and the styles
 * appear correct. That is how it shipped past a fully green suite — the tests are
 * not lying, they simply exercise a different code path than the device.
 *
 * The rule: keep the static styles in a plain array/object, and drive the pressed
 * variation from state fed by `onPressIn` / `onPressOut`.
 *
 *   const [pressed, pressProps] = usePressed();
 *   <Pressable {...pressProps} style={[styles.btn, pressed && styles.pressed]} />
 */
export function usePressed(): [boolean, { onPressIn: () => void; onPressOut: () => void }] {
  const [pressed, setPressed] = useState(false);
  const onPressIn = useCallback(() => setPressed(true), []);
  const onPressOut = useCallback(() => setPressed(false), []);
  return [pressed, { onPressIn, onPressOut }];
}

/**
 * The same thing for a LIST of pressables rendered by one component (a `.map`),
 * where a single boolean would light every row at once. One key is pressed at a
 * time, which is all a finger can do.
 *
 *   const [pressedKey, pressPropsFor] = usePressedKey();
 *   items.map((it) => (
 *     <Pressable key={it.id} {...pressPropsFor(it.id)}
 *       style={[styles.row, pressedKey === it.id && styles.pressed]} />
 *   ))
 */
export function usePressedKey(): [
  string | null,
  (key: string) => { onPressIn: () => void; onPressOut: () => void },
] {
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  const propsFor = useCallback(
    (key: string) => ({
      onPressIn: () => setPressedKey(key),
      onPressOut: () => setPressedKey(null),
    }),
    [],
  );
  return [pressedKey, propsFor];
}
