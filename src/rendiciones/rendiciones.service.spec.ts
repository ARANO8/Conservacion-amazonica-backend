import { Test, TestingModule } from '@nestjs/testing';
import { RendicionesService } from './rendiciones.service';

describe('RendicionesService', () => {
  let service: RendicionesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RendicionesService],
    }).compile();

    service = module.get<RendicionesService>(RendicionesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
