import { ApiProperty } from '@nestjs/swagger';

export class FinancingSourceEntity {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440001',
    description: 'UUID of the financing source',
  })
  id: string;

  @ApiProperty({ example: 'BID-PV', description: 'Financing source code' })
  code: string;

  @ApiProperty({
    example: 'Banco Interamericano de Desarrollo',
    description: 'Financing source name',
  })
  name: string;

  constructor(partial: Partial<FinancingSourceEntity>) {
    Object.assign(this, partial);
  }
}
