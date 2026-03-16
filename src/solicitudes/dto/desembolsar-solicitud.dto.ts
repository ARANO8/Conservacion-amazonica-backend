import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsUrl } from 'class-validator';

export class DesembolsarSolicitudDto {
  @ApiProperty({
    example: 'CP-2026-0001',
    description: 'Código de comprobante de desembolso o cheque',
  })
  @IsString()
  @IsNotEmpty({ message: 'El código de desembolso es obligatorio' })
  codigoDesembolso: string;

  @ApiPropertyOptional({
    example: 'https://drive.google.com/file/d/abc123/view',
    description: 'URL del PDF escaneado del comprobante de depósito',
  })
  @IsOptional()
  @IsUrl({}, { message: 'La URL del comprobante no es válida' })
  urlComprobante?: string;
}
