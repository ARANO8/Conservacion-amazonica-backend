import { ApiProperty } from '@nestjs/swagger';

export class PoaActivityEntity {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'UUID of the POA activity',
  })
  id: string;

  @ApiProperty({ example: '1111', description: 'Control code' })
  code: string;

  @ApiProperty({ example: '1', description: 'OG', required: false })
  og?: string | null;

  @ApiProperty({ example: '1', description: 'OE', required: false })
  oe?: string | null;

  @ApiProperty({ example: '1', description: 'OP', required: false })
  op?: string | null;

  @ApiProperty({ example: '1', description: 'AC', required: false })
  ac?: string | null;

  @ApiProperty({ example: 'RAINFOREST', description: 'Project name' })
  project: string;

  @ApiProperty({ example: 'SERVICIOS', description: 'Group', required: false })
  group?: string | null;

  @ApiProperty({
    example: 'CONSULTORES',
    description: 'POA Budget Line',
    required: false,
  })
  poaBudgetLine?: string | null;

  @ApiProperty({
    example: 'A1.1',
    description: 'System activity code',
    required: false,
    nullable: true,
  })
  activityCode?: string | null;

  @ApiProperty({
    example: 'Construcción de Zonificaciones',
    description: 'Activity detail/description',
  })
  description: string;

  @ApiProperty({ example: 1000, description: 'Unit Cost', required: false })
  unitCost?: number | null;

  @ApiProperty({ example: 5000, description: 'Total Cost', required: false })
  totalCost?: number | null;

  constructor(partial: Partial<PoaActivityEntity>) {
    Object.assign(this, partial);
  }
}
