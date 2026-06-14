import { describe, expect, it } from 'vitest';
import { parseSessionUserAgent } from './parseSessionUserAgent';

describe('parseSessionUserAgent', () => {
  it('parses Linux and Chrome', () => {
    const ua =
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    expect(parseSessionUserAgent(ua, 'Linux')).toEqual({ os: 'Linux', browser: 'Chrome' });
  });

  it('parses Windows and Edge', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
    expect(parseSessionUserAgent(ua, 'Windows')).toEqual({ os: 'Windows', browser: 'Edge' });
  });

  it('falls back when user agent is missing', () => {
    expect(parseSessionUserAgent(null, 'macOS')).toEqual({ os: 'macOS', browser: 'Браузер' });
    expect(parseSessionUserAgent(null, null)).toEqual({ os: 'Неизвестно', browser: 'Браузер' });
  });
});
