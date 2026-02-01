import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class DesembolsarSolicitudDto {
  @ApiProperty({
    example: 'CP-2026-0001',
    description: 'Código de comprobante de desembolso o cheque',
  })
  @IsString()
  @IsNotEmpty({ message: 'El código de desembolso es obligatorio' })
  codigoDesembolso: string;
}
