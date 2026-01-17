import { Test, TestingModule } from '@nestjs/testing';
import { PoaService } from './poa.service';

describe('PoaService', () => {
  let service: PoaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PoaService],
    }).compile();

    service = module.get<PoaService>(PoaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
