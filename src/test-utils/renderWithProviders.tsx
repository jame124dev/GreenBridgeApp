// Shared render entry for chat component tests (PR-0). Today it is a thin
// passthrough to @testing-library/react-native; later PRs add the ChatProvider
// / ThemeProvider wrapper here so every component test resolves theme + actions
// the same way. Re-exports the RTL surface so tests import from one place.
import type { ReactElement } from 'react';
import { render, type RenderOptions } from '@testing-library/react-native';

export function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  return render(ui, options);
}

export * from '@testing-library/react-native';
