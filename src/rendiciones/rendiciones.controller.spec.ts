import { Test, TestingModule } from '@nestjs/testing';
import { RendicionesController } from './rendiciones.controller';

describe('RendicionesController', () => {
  let controller: RendicionesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RendicionesController],
    }).compile();

    controller = module.get<RendicionesController>(RendicionesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
