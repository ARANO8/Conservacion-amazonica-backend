import { Test, TestingModule } from '@nestjs/testing';
import { PoaController } from './poa.controller';
import { PoaService } from './poa.service';

describe('PoaController', () => {
  let controller: PoaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PoaController],
      providers: [PoaService],
    }).compile();

    controller = module.get<PoaController>(PoaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
