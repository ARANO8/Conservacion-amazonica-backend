import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsString,
  ValidateNested,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRequestItemDto {
  @ApiProperty({ description: 'Monto del ítem', example: 100.5 })
  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @ApiProperty({
    description: 'Descripción del ítem',
    example: 'Compra de papel',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

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

  @ApiProperty({ type: [CreateRequestItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRequestItemDto)
  items: CreateRequestItemDto[];
}
