import { Test, TestingModule } from '@nestjs/testing';
import { AdminDashboardController } from './controllers/admin-dashboard.controller';
import { AdminDashboardService } from './services/admin-dashboard.service';
import { NominationStatisticsService } from './services/nomination-statistics.service';

const mockDashboardService = {
  getDashboardData: jest.fn().mockResolvedValue({}),
  getStatistics: jest.fn().mockResolvedValue({}),
  getSystemHealth: jest.fn().mockResolvedValue({}),
};
const mockStatisticsService = {
  getStatistics: jest.fn().mockResolvedValue({}),
};

describe('AdminDashboardController', () => {
  let controller: AdminDashboardController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminDashboardController],
      providers: [
        { provide: AdminDashboardService, useValue: mockDashboardService },
        { provide: NominationStatisticsService, useValue: mockStatisticsService },
      ],
    }).compile();

    controller = module.get<AdminDashboardController>(AdminDashboardController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
