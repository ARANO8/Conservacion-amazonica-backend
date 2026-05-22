import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUrl,
  IsDateString,
} from 'class-validator';

export class DesembolsarSolicitudDto {
  @ApiProperty({
    example: 'TR4500',
    description: 'Número de cheque o código de comprobante de desembolso',
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

  @ApiPropertyOptional({
    example: 'Bisa 34-6839-020-4',
    description: 'Banco y número de cuenta desde donde se emite el cheque',
  })
  @IsOptional()
  @IsString()
  banco?: string;

  @ApiPropertyOptional({
    example: '2026-04-27T00:00:00Z',
    description: 'Fecha de emisión del cheque',
  })
  @IsOptional()
  @IsDateString()
  fechaDesembolso?: string;
}
