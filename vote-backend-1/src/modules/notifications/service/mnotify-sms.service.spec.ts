import { MnotifySmsService } from './mnotify-sms.service';

const make = (apiKey?: string, senderId?: string) =>
  new MnotifySmsService({
    get: (key: string) => {
      if (key === 'MNOTIFY_API_KEY') return apiKey;
      if (key === 'MNOTIFY_SENDER_ID') return senderId;
      return undefined;
    },
  } as any);

describe('MnotifySmsService', () => {
  it('throws on construction when MNOTIFY_API_KEY is not set', () => {
    expect(() => make(undefined)).toThrow('MNOTIFY_API_KEY is not configured');
  });

  it('throws when MNOTIFY_API_KEY is an empty string', () => {
    expect(() => make('')).toThrow('MNOTIFY_API_KEY is not configured');
  });

  it('constructs successfully when MNOTIFY_API_KEY is set', () => {
    expect(() => make('test-key')).not.toThrow();
  });
});
