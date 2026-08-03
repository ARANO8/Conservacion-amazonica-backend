import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsUrl, Min } from 'class-validator';

export class SolicitarPagoDto {
  @ApiProperty({
    example: 3,
    description: 'ID del usuario que debe aprobar este pago',
  })
  @IsInt()
  @Min(1)
  aprobadorId: number;

  @ApiProperty({
    example: 'https://drive.google.com/file/d/xxx',
    description: 'Comprobante del consultor (factura o recibo)',
  })
  @IsNotEmpty({ message: 'El comprobante del consultor es obligatorio' })
  @IsUrl({}, { message: 'La URL del comprobante no es válida' })
  urlComprobante: string;

  @ApiPropertyOptional({
    example: 'https://drive.google.com/file/d/yyy',
    description: 'Informe o producto entregado que habilita el pago',
  })
  @IsOptional()
  @IsUrl({}, { message: 'La URL del informe no es válida' })
  urlInforme?: string;
}
