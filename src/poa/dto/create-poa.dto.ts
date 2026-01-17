import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsString, Min } from 'class-validator';

export class CreatePoaDto {
  @ApiProperty({ example: 'POA-2026-001' })
  @IsString()
  codigoPoa: string;

  @ApiProperty({ example: 10 })
  @IsInt()
  @Min(1)
  cantidad: number;

  @ApiProperty({ example: 500.5 })
  @IsNumber()
  @Min(0)
  costoUnitario: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  proyectoId: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  grupoId: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  partidaId: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  actividadId: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  codigoPresupuestarioId: number;
}
