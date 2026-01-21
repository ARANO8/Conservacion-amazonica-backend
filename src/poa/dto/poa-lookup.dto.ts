import { ApiProperty } from '@nestjs/swagger';

export class PoaLookupDto {
  @ApiProperty({ description: 'Código POA' })
  codigo: string;
}
