import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNumber,
  IsString,
  IsOptional,
  IsDateString,
  Min,
} from 'class-validator';

export class CreateSolicitudDto {
  @ApiProperty({ example: 1, description: 'ID del registro POA vinculado' })
  @IsInt()
  poaId: number;

  @ApiProperty({ example: 1500.5, description: 'Monto total solicitado' })
  @IsNumber()
  @Min(0)
  montoSolicitado: number;

  @ApiProperty({
    example: 'Compra de suministros para comunidad',
    description: 'Descripción detallada',
  })
  @IsString()
  descripcion: string;

  @ApiProperty({ example: '2026-02-01T10:00:00Z', required: false })
  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @ApiProperty({ example: '2026-02-15T18:00:00Z', required: false })
  @IsOptional()
  @IsDateString()
  fechaFin?: string;

  @ApiProperty({
    example: 2,
    description: 'ID del usuario asignado para aprobar',
  })
  @IsInt()
  aprobadorId: number;
}
