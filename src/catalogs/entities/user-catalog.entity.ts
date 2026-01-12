import { ApiProperty } from '@nestjs/swagger';

export class UserCatalogEntity {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440002',
    description: 'UUID of the user',
  })
  id: string;

  @ApiProperty({ example: 'Alan Brito', description: 'Full name of the user' })
  name: string;

  @ApiProperty({
    example: 'ESPECIALISTA EN SIG',
    description: 'User position',
    required: false,
    nullable: true,
  })
  position?: string | null;

  @ApiProperty({
    example: 'CIENCIA Y TECNOLOGÍA',
    description: 'User area',
    required: false,
    nullable: true,
  })
  area?: string | null;

  constructor(partial: Partial<UserCatalogEntity>) {
    Object.assign(this, partial);
  }
}
