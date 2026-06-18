import { ForbiddenException } from '@nestjs/common';
import { StationIpGuard } from './station-ip.guard';

const makeCtx = (ip: string) => ({
  switchToHttp: () => ({
    getRequest: () => ({ ip, headers: {} }),
  }),
  getHandler: () => ({}),
  getClass: () => ({}),
});

const makeConfig = (ips: string | undefined) => ({
  get: jest.fn().mockReturnValue(ips),
});

describe('StationIpGuard', () => {
  it('passes when ALLOWED_STATION_IPS is unset (dev mode)', () => {
    const guard = new StationIpGuard(makeConfig(undefined) as any);
    expect(guard.canActivate(makeCtx('1.2.3.4') as any)).toBe(true);
  });

  it('passes when ALLOWED_STATION_IPS is empty string (dev mode)', () => {
    const guard = new StationIpGuard(makeConfig('') as any);
    expect(guard.canActivate(makeCtx('1.2.3.4') as any)).toBe(true);
  });

  it('passes when IP is in the allowlist', () => {
    const guard = new StationIpGuard(makeConfig('10.0.0.1,10.0.0.2') as any);
    expect(guard.canActivate(makeCtx('10.0.0.1') as any)).toBe(true);
  });

  it('throws ForbiddenException when IP is not in allowlist', () => {
    const guard = new StationIpGuard(makeConfig('10.0.0.1,10.0.0.2') as any);
    expect(() => guard.canActivate(makeCtx('192.168.1.1') as any)).toThrow(ForbiddenException);
  });

  it('reads x-forwarded-for when request.ip is undefined', () => {
    const guard = new StationIpGuard(makeConfig('10.0.0.5') as any);
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ ip: undefined, headers: { 'x-forwarded-for': '10.0.0.5, 172.16.0.1' } }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    };
    expect(guard.canActivate(ctx as any)).toBe(true);
  });
});
