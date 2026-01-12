import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsString,
  ValidateNested,
  IsUUID,
  IsOptional,
  IsDate,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTravelExpenseDto {
  @ApiProperty({ description: 'Concepto del viático', example: 'Alimentación' })
  @IsString()
  @IsNotEmpty()
  concept: string;

  @ApiProperty({ description: 'Ciudad', example: 'La Paz', required: false })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiProperty({
    description: 'Destino',
    example: 'Rurrenabaque',
    required: false,
  })
  @IsString()
  @IsOptional()
  destination?: string;

  @ApiProperty({
    description: 'Tipo de transporte',
    example: 'Aéreo',
    required: false,
  })
  @IsString()
  @IsOptional()
  transportType?: string;

  @ApiProperty({ description: 'Días', example: 3, required: false })
  @IsInt()
  @IsOptional()
  days?: number;

  @ApiProperty({
    description: 'Cantidad de personas',
    example: 2,
    required: false,
  })
  @IsInt()
  @IsOptional()
  peopleCount?: number;
}

export class CreateRequestItemDto {
  @ApiProperty({ description: 'Monto Total del ítem', example: 100.5 })
  @IsNumber()
  @IsNotEmpty()
  amount: number; // Frontend sends 'amount', mapped to totalAmount

  @ApiProperty({ description: 'Cantidad', example: 1, default: 1 })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  quantity: number;

  @ApiProperty({ description: 'Costo Unitario', example: 100.5 })
  @IsNumber()
  @IsNotEmpty()
  unitCost: number;

  @ApiProperty({
    description: 'Descripción del ítem',
    example: 'Compra de papel',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ description: 'Glosa/Detalle', required: false })
  @IsString()
  @IsOptional()
  detail?: string;

  @ApiProperty({ description: 'Número de Documento', required: false })
  @IsString()
  @IsOptional()
  documentNumber?: string;

  @ApiProperty({ description: 'ID de la partida presupuestaria' })
  @IsUUID()
  @IsNotEmpty()
  budgetLineId: string;

  @ApiProperty({ description: 'ID de la fuente de financiamiento' })
  @IsUUID()
  @IsNotEmpty()
  financingSourceId: string;
}

export class CreateRequestDto {
  @ApiProperty({
    description: 'Título de la solicitud',
    example: 'Compra de Materiales',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Descripción detallada',
    example: 'Materiales para el taller X',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ description: 'Código POA', example: '1.2.3', required: false })
  @IsString()
  @IsOptional()
  poaCode?: string;

  @ApiProperty({ description: 'Lugar del viaje', required: false })
  @IsString()
  @IsOptional()
  place?: string;

  @ApiProperty({ description: 'Fecha Inicio', required: false })
  @IsDate()
  @IsOptional()
  @Type(() => Date)
  startDate?: Date;

  @ApiProperty({ description: 'Fecha Fin', required: false })
  @IsDate()
  @IsOptional()
  @Type(() => Date)
  endDate?: Date;

  @ApiProperty({ description: 'A (Destinatario)', required: false })
  @IsString()
  @IsOptional()
  receiverName?: string;

  @ApiProperty({ type: [CreateRequestItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRequestItemDto)
  items: CreateRequestItemDto[];

  @ApiProperty({ type: [CreateTravelExpenseDto], required: false })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateTravelExpenseDto)
  viaticos?: CreateTravelExpenseDto[];
}
