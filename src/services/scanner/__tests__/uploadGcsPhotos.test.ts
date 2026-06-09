import { describe, it, expect, afterEach, jest } from '@jest/globals';

import { gcsUrlForAnalyze, getGcsRefsForItem } from '../gcsUrl';

// Mock the expo-constants `extra.GREENBIDZ_API_URL` since the helper reads from
// there. The default GREENBIDZ_API_URL in the test environment comes from
// jest.setup so we override per test.

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        GREENBIDZ_API_URL: 'https://api.example.com/api/v1',
      },
    },
  },
}));

afterEach(() => {
  delete process.env.EXPO_PUBLIC_GCS_USE_PROXY_URL;
});

describe('gcsUrlForAnalyze', () => {
  it('returns the raw url by default (matches web client behavior)', () => {
    const raw = 'https://storage.googleapis.com/bucket/sellers/574/2026/05/abc/0-photo.jpg';
    const url = gcsUrlForAnalyze({
      objectName: 'sellers/574/2026/05/abc/0-photo.jpg',
      url: raw,
    });
    expect(url).toBe(raw);
  });

  it('falls back to /gcs/serve proxy when raw url is missing', () => {
    const url = gcsUrlForAnalyze({
      objectName: 'sellers/574/2026/05/abc/0-photo.jpg',
      url: '',
    });
    expect(url).toBe(
      'https://api.example.com/api/v1/gcs/serve?path=sellers%2F574%2F2026%2F05%2Fabc%2F0-photo.jpg',
    );
  });

  it('forces /gcs/serve proxy when EXPO_PUBLIC_GCS_USE_PROXY_URL=1 is set', () => {
    process.env.EXPO_PUBLIC_GCS_USE_PROXY_URL = '1';
    const raw = 'https://storage.googleapis.com/bucket/sellers/574/2026/05/abc/0-photo.jpg';
    const url = gcsUrlForAnalyze({
      objectName: 'sellers/574/2026/05/abc/0-photo.jpg',
      url: raw,
    });
    expect(url).toContain('/gcs/serve?path=');
    expect(url).not.toBe(raw);
  });

  it('avoids double-encoding object names that already contain %20', () => {
    // Regression: backend's upload response returns object names with
    // spaces URL-encoded (e.g. `WALDRICH%20COBURG.pdf`). Re-encoding the
    // whole path used to produce `%2520` and the proxy returned 404.
    process.env.EXPO_PUBLIC_GCS_USE_PROXY_URL = '1';
    const url = gcsUrlForAnalyze({
      objectName: 'sellers/574/2026/06/xyz/WALDRICH%20COBURG.pdf',
      url: '',
    });
    expect(url).toContain('WALDRICH%20COBURG.pdf');
    expect(url).not.toContain('%2520');
  });

  // ─── getGcsRefsForItem (W5) ──────────────────────────────────────────────

  it('getGcsRefsForItem: returns null when gcs is absent', () => {
    const res = getGcsRefsForItem([{ uri: 'file://a.jpg' }], null);
    expect(res).toBeNull();
  });

  it('getGcsRefsForItem: returns null when ANY photo lacks an entry', () => {
    const res = getGcsRefsForItem(
      [{ uri: 'file://a.jpg' }, { uri: 'file://b.jpg' }, { uri: 'file://NEW.jpg' }],
      {
        sessionId: 'sess-1',
        objectNameByPhotoUri: {
          'file://a.jpg': 'sellers/574/a.jpg',
          'file://b.jpg': 'sellers/574/b.jpg',
          // 'file://NEW.jpg' deliberately missing (retake case)
        },
      },
    );
    expect(res).toBeNull();
  });

  it('getGcsRefsForItem: returns refs in photos[] order when all URIs are mapped', () => {
    const res = getGcsRefsForItem(
      [
        { uri: 'file://b.jpg' }, // intentionally not in upload order
        { uri: 'file://a.jpg' },
      ],
      {
        sessionId: 'sess-1',
        objectNameByPhotoUri: {
          'file://a.jpg': 'sellers/574/a.jpg',
          'file://b.jpg': 'sellers/574/b.jpg',
        },
      },
    );
    expect(res).toEqual({
      sessionId: 'sess-1',
      objectNames: ['sellers/574/b.jpg', 'sellers/574/a.jpg'],
    });
  });

  it('getGcsRefsForItem: returns null for an empty photos array', () => {
    expect(
      getGcsRefsForItem([], {
        sessionId: 'sess-1',
        objectNameByPhotoUri: {},
      }),
    ).toBeNull();
  });

  it('strips a trailing slash on the API base URL', () => {
    // Re-mock with trailing slash for this case only.
    jest.resetModules();
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: {
        expoConfig: {
          extra: { GREENBIDZ_API_URL: 'https://api.example.com/api/v1/' },
        },
      },
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { gcsUrlForAnalyze: helper } = require('../gcsUrl');
    const url = helper({ objectName: 'sellers/574/photo.jpg', url: '' });
    expect(url).toBe('https://api.example.com/api/v1/gcs/serve?path=sellers%2F574%2Fphoto.jpg');
  });
});
