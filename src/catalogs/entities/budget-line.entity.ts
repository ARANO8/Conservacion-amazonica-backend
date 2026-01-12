import { ApiProperty } from '@nestjs/swagger';

export class BudgetLineEntity {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'UUID of the budget line',
  })
  id: string;

  @ApiProperty({ example: '39500', description: 'Budget line code' })
  code: string;

  @ApiProperty({
    example: 'ÚTILES DE ESCRITORIO',
    description: 'Budget line name',
  })
  name: string;

  @ApiProperty({
    example: 'MATERIALES Y SUMINISTROS',
    description: 'Budget line category',
    required: false,
    nullable: true,
  })
  category?: string | null;

  constructor(partial: Partial<BudgetLineEntity>) {
    Object.assign(this, partial);
  }
}
