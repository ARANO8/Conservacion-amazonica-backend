import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsInt,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsNotEmpty,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrdenCompraItemDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  orden: number;

  @ApiProperty({ example: 'Alquiler de salón' })
  @IsString()
  @IsNotEmpty()
  item: string;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @Min(0)
  cantidad: number;

  @ApiPropertyOptional({ example: 'día' })
  @IsOptional()
  @IsString()
  unidad?: string;

  @ApiPropertyOptional({ example: 'Salón con capacidad para 50 personas' })
  @IsOptional()
  @IsString()
  detalle?: string;

  @ApiProperty({ example: 500.0 })
  @IsNumber()
  @Min(0)
  precioUnitario: number;

  @ApiPropertyOptional({
    example: 12,
    description: 'ID del CuadroItem de origen',
  })
  @IsOptional()
  @IsInt()
  cuadroItemId?: number;

  @ApiPropertyOptional({
    example: false,
    description: 'true si el ítem no tiene cuadro comparativo de respaldo',
  })
  @IsOptional()
  @IsBoolean()
  sinCuadro?: boolean;
}

export class CreateOrdenCompraDto {
  @ApiPropertyOptional({
    example: 5,
    description: 'ID del cuadro comparativo origen',
  })
  @IsOptional()
  @IsInt()
  cuadroComparativoId?: number;

  @ApiProperty({ example: 'MITRU Eventos S.R.L.' })
  @IsString()
  @IsNotEmpty()
  proveedorNombre: string;

  @ApiPropertyOptional({ example: 'Av. Montes 123, La Paz' })
  @IsOptional()
  @IsString()
  proveedorDireccion?: string;

  @ApiPropertyOptional({ example: '71234567' })
  @IsOptional()
  @IsString()
  proveedorTelefono?: string;

  @ApiPropertyOptional({ example: 'Oficinas ACEAA, Av. Arce 456' })
  @IsOptional()
  @IsString()
  lugarEntrega?: string;

  @ApiPropertyOptional({ example: 'Transferencia bancaria' })
  @IsOptional()
  @IsString()
  formaPago?: string;

  @ApiPropertyOptional({ example: 'N/A' })
  @IsOptional()
  @IsString()
  garantia?: string;

  @ApiPropertyOptional({ example: 'Entrega inmediata requerida.' })
  @IsOptional()
  @IsString()
  observaciones?: string;

  @ApiProperty({ type: [CreateOrdenCompraItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrdenCompraItemDto)
  items: CreateOrdenCompraItemDto[];
}
