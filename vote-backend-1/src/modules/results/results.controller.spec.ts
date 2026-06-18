import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ResultsController } from './results.controller';

// Guard-metadata tests: verify the route handler's guard decoration without
// spinning up a full HTTP server.
describe('ResultsController — guard coverage', () => {
  const reflector = new Reflector();

  function guardsOn(handler: Function): Function[] {
    return Reflect.getMetadata('__guards__', handler) ?? [];
  }

  it('GET /winners is protected by JwtAuthGuard and RolesGuard', () => {
    const guards = guardsOn(ResultsController.prototype.getWinnerAnnouncements);
    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(RolesGuard);
  });

  it('GET /public is intentionally public (no guards)', () => {
    const guards = guardsOn(ResultsController.prototype.getPublicResults);
    expect(guards).not.toContain(JwtAuthGuard);
  });
});
