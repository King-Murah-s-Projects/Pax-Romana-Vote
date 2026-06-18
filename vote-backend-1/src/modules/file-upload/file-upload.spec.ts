import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { FileUploadController } from './file-upload.controller';
import { ImageValidationService } from './services/image-validation.service';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp = require('sharp');

// --- guard metadata test ---

function guardsOn(handler: Function): Function[] {
  return Reflect.getMetadata('__guards__', handler) ?? [];
}
function rolesOn(handler: Function): string[] {
  return Reflect.getMetadata('roles', handler) ?? [];
}

describe('FileUploadController — GET /urls/:publicId is guarded', () => {
  it('requires JwtAuthGuard (inherits from controller)', () => {
    const ctrlGuards: Function[] = Reflect.getMetadata('__guards__', FileUploadController) ?? [];
    expect(ctrlGuards).toContain(JwtAuthGuard);
  });

  it('has Roles metadata restricting access to SUPER_ADMIN and EC_MEMBER', () => {
    const roles = rolesOn(FileUploadController.prototype.getPhotoUrls);
    expect(roles).toContain(UserRole.SUPER_ADMIN);
    expect(roles).toContain(UserRole.EC_MEMBER);
  });
});

// --- image dimension validation ---

describe('ImageValidationService.validateImageDimensions', () => {
  let service: ImageValidationService;

  beforeEach(() => { service = new ImageValidationService(); });

  it('accepts an image within the allowed dimensions', async () => {
    const buffer = await sharp({
      create: { width: 400, height: 400, channels: 3, background: '#fff' },
    }).jpeg().toBuffer();

    await expect(
      service.validateImageDimensions({ buffer, mimetype: 'image/jpeg' } as any),
    ).resolves.toBeUndefined();
  });

  it('rejects an image that is too small', async () => {
    const buffer = await sharp({
      create: { width: 50, height: 50, channels: 3, background: '#fff' },
    }).jpeg().toBuffer();

    await expect(
      service.validateImageDimensions({ buffer, mimetype: 'image/jpeg' } as any),
    ).rejects.toThrow(/too small/i);
  });

  it('rejects an image that is too large', async () => {
    const buffer = await sharp({
      create: { width: 3000, height: 3000, channels: 3, background: '#fff' },
    }).jpeg().toBuffer();

    await expect(
      service.validateImageDimensions({ buffer, mimetype: 'image/jpeg' } as any),
    ).rejects.toThrow(/too large/i);
  });
});
