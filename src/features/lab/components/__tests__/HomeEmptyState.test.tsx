/**
 * Owner-reported 2026-08-13: "the app home screen looks empty ... when a new user
 * signs up and comes for the first time he doesn't have a draft listing or
 * listing, so that section is blank."
 *
 * Both Home sections used to `return null` when they had no data, so a brand-new
 * account saw a greeting, a text box, and nothing else. These tests pin the
 * replacement: the empty case must TEACH, and every control in it must do
 * something real.
 */
import { render, screen, fireEvent } from '@testing-library/react-native';

import { HomeEmptyState } from '../HomeEmptyState';

describe('HomeEmptyState', () => {
  describe('sell mode', () => {
    it('explains the AI flow instead of showing nothing', () => {
      render(<HomeEmptyState mode="sell" onStartListing={() => {}} onSuggestion={() => {}} />);
      expect(screen.getByText(/turn a photo into a listing/i)).toBeTruthy();
      // The three steps are the "why bother" — all must be present.
      expect(screen.getByText(/take a photo/i)).toBeTruthy();
      expect(screen.getByText(/ai drafts the listing/i)).toBeTruthy();
      expect(screen.getByText(/check it and publish/i)).toBeTruthy();
    });

    it('has exactly ONE primary action, and it fires', () => {
      const onStartListing = jest.fn();
      render(
        <HomeEmptyState mode="sell" onStartListing={onStartListing} onSuggestion={() => {}} />,
      );
      fireEvent.press(screen.getByText(/photograph equipment/i));
      expect(onStartListing).toHaveBeenCalledTimes(1);
    });

    it('does not show buyer starter searches', () => {
      render(<HomeEmptyState mode="sell" onStartListing={() => {}} onSuggestion={() => {}} />);
      expect(screen.queryByText(/not sure where to start/i)).toBeNull();
    });
  });

  describe('buy mode', () => {
    it('offers tappable starter searches', () => {
      render(<HomeEmptyState mode="buy" onStartListing={() => {}} onSuggestion={() => {}} />);
      expect(screen.getByText(/not sure where to start/i)).toBeTruthy();
      expect(screen.getByText('centrifuge')).toBeTruthy();
      expect(screen.getByText('HPLC system')).toBeTruthy();
    });

    it('a suggestion runs a REAL search with that query (not a placeholder)', () => {
      const onSuggestion = jest.fn();
      render(<HomeEmptyState mode="buy" onStartListing={() => {}} onSuggestion={onSuggestion} />);
      fireEvent.press(screen.getByText('centrifuge'));
      expect(onSuggestion).toHaveBeenCalledWith('centrifuge');
    });

    it('tells the buyer what to do when nothing matches', () => {
      render(<HomeEmptyState mode="buy" onStartListing={() => {}} onSuggestion={() => {}} />);
      expect(screen.getByText(/alert you when it's listed/i)).toBeTruthy();
    });

    it('does not show the seller pitch', () => {
      render(<HomeEmptyState mode="buy" onStartListing={() => {}} onSuggestion={() => {}} />);
      expect(screen.queryByText(/turn a photo into a listing/i)).toBeNull();
    });
  });
});
