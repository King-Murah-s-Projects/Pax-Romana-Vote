import { Test, TestingModule } from '@nestjs/testing';
import { NominationController } from './nominations.controller';
import { NominationService } from './services/nomination.service';
import { NominatorVerificationService } from './services/nominator-verification.service';
import { GuarantorVerificationService } from './services/guarantor-verification.service';

const mockNominationService = {
  create: jest.fn(),
  findAll: jest.fn().mockResolvedValue([]),
  findOne: jest.fn(),
  getStatistics: jest.fn().mockResolvedValue({}),
};
const mockNominatorVerificationService = {
  verifyNominator: jest.fn(),
  getVerificationDetails: jest.fn(),
};
const mockGuarantorVerificationService = {
  verifyGuarantor: jest.fn(),
  getVerificationDetails: jest.fn(),
};

describe('NominationController', () => {
  let controller: NominationController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NominationController],
      providers: [
        { provide: NominationService, useValue: mockNominationService },
        { provide: NominatorVerificationService, useValue: mockNominatorVerificationService },
        { provide: GuarantorVerificationService, useValue: mockGuarantorVerificationService },
      ],
    }).compile();

    controller = module.get<NominationController>(NominationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
