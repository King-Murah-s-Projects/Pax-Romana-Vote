import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigService } from '@nestjs/config';

const mockConfigService = { get: jest.fn().mockReturnValue('test') };

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('getStatus returns an operational status object', () => {
    const result = appController.getStatus();
    expect(result).toMatchObject({ status: 'operational' });
  });

  it('getHealthCheck returns status ok', () => {
    const result = appController.getHealthCheck();
    expect(result).toMatchObject({ status: 'ok' });
  });

  it('getElectionTimeline returns current phase and deadlines', () => {
    const result = appController.getElectionTimeline();
    expect(result).toHaveProperty('phase');
    expect(result).toHaveProperty('currentTime');
    expect(result).toHaveProperty('deadlines');
  });
});
