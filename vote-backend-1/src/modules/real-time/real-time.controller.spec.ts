import { Test, TestingModule } from '@nestjs/testing';
import { RealTimeController } from './controllers/real-time.controller';
import { RealTimeService } from './services/real-time.service';

describe('RealTimeController', () => {
  let controller: RealTimeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RealTimeController],
      providers: [RealTimeService],
    }).compile();

    controller = module.get<RealTimeController>(RealTimeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
