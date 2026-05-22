import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsArray,
  ValidateNested,
  IsNotEmpty,
  Min,
  ArrayMinSize,
  IsEmail,
  IsDateString,
  IsEnum,
  IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TipoCotizacion } from '@prisma/client';

export class CreateLineaCotizacionDto {
  @ApiProperty({ example: 2, minimum: 0 })
  @IsNumber()
  @Min(0)
  cantidad: number;

  @ApiPropertyOptional({ example: 'Pza' })
  @IsOptional()
  @IsString()
  unidad?: string;

  @ApiProperty({ example: 'Laptop Dell Inspiron 15 i5 8GB' })
  @IsString()
  @IsNotEmpty()
  detalle: string;

  @ApiProperty({ example: 4500.0, minimum: 0 })
  @IsNumber()
  @Min(0)
  precioUnitario: number;
}

export class CreateCotizacionDto {
  @ApiPropertyOptional({
    example: '2026-05-18T00:00:00Z',
    description: 'Fecha del formulario. Si se omite, se usa la fecha actual.',
  })
  @IsOptional()
  @IsDateString()
  fecha?: string;

  @ApiProperty({ example: 'Importadora XYZ S.R.L.' })
  @IsString()
  @IsNotEmpty()
  proveedorNombre: string;

  @ApiPropertyOptional({ example: '+591 70000000' })
  @IsOptional()
  @IsString()
  proveedorTelefono?: string;

  @ApiPropertyOptional({ example: 'Av. Siempre Viva #123, La Paz' })
  @IsOptional()
  @IsString()
  proveedorDireccion?: string;

  @ApiPropertyOptional({ example: 'ventas@proveedor.com' })
  @IsOptional()
  @IsEmail()
  proveedorCorreo?: string;

  @ApiPropertyOptional({ example: '12 meses' })
  @IsOptional()
  @IsString()
  garantia?: string;

  @ApiPropertyOptional({ example: 'Inmediata' })
  @IsOptional()
  @IsString()
  disponibilidad?: string;

  @ApiPropertyOptional({ example: '30 días' })
  @IsOptional()
  @IsString()
  duracionCotizacion?: string;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  emiteFactura?: boolean;

  @ApiPropertyOptional({ example: 'Entrega en oficina central.' })
  @IsOptional()
  @IsString()
  observaciones?: string;

  @ApiPropertyOptional({
    enum: TipoCotizacion,
    default: TipoCotizacion.PROPIA,
    description:
      'PROPIA = formulario interno | EXTERNA = documento adjunto externo',
  })
  @IsOptional()
  @IsEnum(TipoCotizacion)
  tipo?: TipoCotizacion;

  @ApiPropertyOptional({
    example: 'https://drive.google.com/file/d/...',
    description: 'URL del documento externo (obligatorio cuando tipo=EXTERNA)',
  })
  @IsOptional()
  @IsUrl({}, { message: 'La URL del adjunto no es válida' })
  adjuntoUrl?: string;

  @ApiProperty({ type: [CreateLineaCotizacionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateLineaCotizacionDto)
  lineas: CreateLineaCotizacionDto[];
}
