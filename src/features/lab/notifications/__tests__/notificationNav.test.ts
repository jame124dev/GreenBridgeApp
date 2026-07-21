import { describe, it, expect } from '@jest/globals';

import { routeForType } from '@/features/lab/notifications/notificationNav';

describe('routeForType', () => {
  it('maps recognition_draft_ready to the drafts screen', () => {
    expect(routeForType('recognition_draft_ready')).toBe('/scan/drafts');
  });
});
