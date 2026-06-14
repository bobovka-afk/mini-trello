export type SessionPlatformInfo = {
  os: string;
  browser: string;
};

export function parseSessionUserAgent(
  userAgent: string | null | undefined,
  deviceLabel: string | null | undefined,
): SessionPlatformInfo {
  const ua = userAgent ?? '';

  let os = deviceLabel ?? 'Неизвестно';
  if (/iPhone|iPad/i.test(ua)) os = 'iOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac OS X|Macintosh/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';
  else if (deviceLabel === 'Mobile device') os = 'Мобильное устройство';

  let browser = 'Браузер';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) browser = 'Opera';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Chrome\//i.test(ua)) browser = 'Chrome';
  else if (/Safari\//i.test(ua)) browser = 'Safari';
  else if (/MSIE|Trident/i.test(ua)) browser = 'Internet Explorer';

  return { os, browser };
}
