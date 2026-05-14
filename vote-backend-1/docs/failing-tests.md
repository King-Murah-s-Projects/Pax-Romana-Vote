# Failing Tests

All 16 failures are pre-existing broken stubs — they were broken before the cleanup branch. Every one is a simple fix.

They fall into two categories:

---

## Category A — Wrong import paths / missing exports (4 suites)

These spec files import from module names that don't exist or export names that are wrong.

| File | Problem | Fix |
|---|---|---|
| `src/app.controller.spec.ts` | Calls `appController.getHello()` — method does not exist on `AppController` | Remove the test or add a `getHello()` method to `AppController` |
| `src/modules/admin/admin.controller.spec.ts` | Imports from `'./admin.controllers'` (plural, wrong) | Change import to `'./controllers/super-admin.controller'` or whichever controller is being tested |
| `src/modules/nominations/nominations.controller.spec.ts` | Imports `NominationsController` (wrong name) and `'./nominations.service'` (doesn't exist) | Fix export name to `NominationController`; remove or mock the service import |
| `src/modules/real-time/real-time.controller.spec.ts` | Imports from `'./real-time.controller'` which doesn't exist | Delete the spec or create the controller |

---

## Category B — Services registered without mocks (12 suites)

These spec files create a `TestingModule` with the real service class but don't provide mocks for its dependencies. NestJS can't resolve the dependency graph.

The fix is the same for all of them: provide a mock for each dependency using `{ provide: TheClass, useValue: mockObject }`.

| File | Unresolved dependency | What to mock |
|---|---|---|
| `src/modules/caches/cache.service.spec.ts` | `CACHE_MANAGER` token | `{ provide: CACHE_MANAGER, useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() } }` |
| `src/modules/caches/cache.controller.spec.ts` | `CACHE_MANAGER` (via `CacheService`) | Same as above, plus `{ provide: CacheService, useValue: mockCacheService }` |
| `src/modules/nominations/nominations.service.spec.ts` | `PrismaService`, `DeadlineService`, `UsersService`, `CloudinaryService` | Mock all 4 |
| `src/modules/users/users.service.spec.ts` | `PrismaService` | `{ provide: PrismaService, useValue: { user: { findUnique: jest.fn(), ... } } }` |
| `src/modules/users/users.controller.spec.ts` | `UsersService` | `{ provide: UsersService, useValue: mockUsersService }` |
| `src/modules/results/results.service.spec.ts` | `VoteCountingService`, `CertificationService`, `ExportService`, `RealTimeService`, `CacheService` | Mock all 5 |
| `src/modules/results/results.controller.spec.ts` | Same as results.service (ResultsService depends on all of them) | Mock `ResultsService` directly |
| `src/modules/auth/auth.service.spec.ts` | `JwtService`, `ConfigService`, `UsersService`, `PrismaService`, `NotificationService` | Mock all 5 |
| `src/modules/auth/auth.controller.spec.ts` | Same as auth.service (via `AuthService`) | Mock `AuthService` directly |
| `src/modules/notifications/notifications.service.spec.ts` | `MnotifySmsService`, `EmailService`, `PrismaService`, `NotificationQueueService`, `AdminNotificationsService` | Mock all 5 — see `notification.service.spec.ts` for the working pattern |
| `src/modules/notifications/notifications.controller.spec.ts` | Same as above (via `NotificationService`) | Mock `NotificationService` directly |
| `src/modules/admin/admin.service.spec.ts` | `PrismaService`, `NotificationService` | Mock both |

---

## Working Example (from this branch)

`src/modules/notifications/notification.service.spec.ts` shows the correct pattern:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notification.service';
import { MnotifySmsService } from './service/mnotify-sms.service';
import { EmailService } from './service/email.service';
import { PrismaService } from '../../../db';
import { NotificationQueueService } from './service/notification-queue.service';
import { AdminNotificationsService } from './service/admin-notifications.service';

const mockSmsService = { sendSms: jest.fn(), ... };
// ... one mock object per dependency ...

beforeEach(async () => {
    const module = await Test.createTestingModule({
        providers: [
            NotificationService,
            { provide: MnotifySmsService, useValue: mockSmsService },
            { provide: EmailService, useValue: mockEmailService },
            { provide: PrismaService, useValue: mockPrisma },
            { provide: NotificationQueueService, useValue: mockQueueService },
            { provide: AdminNotificationsService, useValue: mockAdminNotificationsService },
        ],
    }).compile();
    service = module.get<NotificationService>(NotificationService);
});
```

Apply this same pattern to each Category B spec file.
