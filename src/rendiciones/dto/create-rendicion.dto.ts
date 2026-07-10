import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDate,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  ValidateNested,
} from 'class-validator';

export enum TipoDocumentoRendicionDto {
  FACTURA = 'FACTURA',
  RECIBO = 'RECIBO',
  BOLETA = 'BOLETA',
}

export enum EstadoGastoRendicionDto {
  PENDIENTE = 'PENDIENTE',
  COMPROBADO = 'COMPROBADO',
  RECHAZADO = 'RECHAZADO',
}

export enum TipoRetencionDto {
  BIEN = 'BIEN',
  SERVICIO = 'SERVICIO',
  ALQUILER = 'ALQUILER',
}

export class CreateGastoRendicionDto {
  @ApiPropertyOptional({
    example: 12,
    description: 'ID del item original de solicitud al que se imputa',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  solicitudItemId?: number;

  @ApiProperty({ example: 'Compra de materiales de campo' })
  @IsString()
  @IsNotEmpty()
  concepto: string;

  @ApiPropertyOptional({ example: 'Incluye útiles y material impreso' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  detalle?: string;

  @ApiProperty({ enum: TipoDocumentoRendicionDto, example: 'FACTURA' })
  @IsEnum(TipoDocumentoRendicionDto)
  tipoDocumento: TipoDocumentoRendicionDto;

  @ApiPropertyOptional({ example: '0001-2026-0001234' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  numeroDocumento?: string;

  @ApiPropertyOptional({ example: 'Proveedor S.R.L.' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  proveedor?: string;

  @ApiPropertyOptional({
    example: '2026-03-10T00:00:00.000Z',
    description: 'Fecha del documento respaldo',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  fechaDocumento?: Date;

  @ApiProperty({
    example: 1160.5,
    description: 'Monto total bruto del comprobante',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  montoBruto: number;

  @ApiProperty({
    example: 185.68,
    description: 'Monto de impuestos/retenciones aplicados al comprobante',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  montoImpuestos: number;

  @ApiPropertyOptional({
    example: 1160.5,
    description:
      'Alias de compatibilidad para frontend: monto total bruto del comprobante',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  montoTotal?: number;

  @ApiProperty({
    example: 974.82,
    description: 'Monto neto del comprobante luego de retenciones',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  montoNeto: number;

  @ApiPropertyOptional({ enum: EstadoGastoRendicionDto, example: 'PENDIENTE' })
  @IsOptional()
  @IsEnum(EstadoGastoRendicionDto)
  estado?: EstadoGastoRendicionDto;

  @ApiProperty({
    example: 15,
    description:
      'ID del registro SolicitudPresupuesto (presupuestos[].id de la solicitud), no confundir con Partida.id del catálogo',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  partidaId: number;

  @ApiPropertyOptional({ enum: TipoRetencionDto, example: 'SERVICIO' })
  @IsOptional()
  @IsEnum(TipoRetencionDto)
  tipoRetencion?: TipoRetencionDto;
}

export class CreateActividadInformeDto {
  @ApiProperty({
    example: '2026-03-12T00:00:00.000Z',
    description: 'Fecha de la actividad',
  })
  @Type(() => Date)
  @IsDate()
  fecha: Date;

  @ApiProperty({ example: 'Cobija' })
  @IsString()
  @IsNotEmpty()
  lugar: string;

  @ApiProperty({ example: 'Gobierno Autónomo Municipal de Cobija' })
  @IsString()
  @IsNotEmpty()
  personaInstitucion: string;

  @ApiProperty({
    example:
      'Reunión de coordinación con actores locales y validación de agenda.',
  })
  @IsString()
  @IsNotEmpty()
  actividadesRealizadas: string;
}

export class CreateInformeGastosDto {
  @ApiProperty({
    example: '2026-03-10T00:00:00.000Z',
    description: 'Fecha de inicio del viaje',
  })
  @Type(() => Date)
  @IsDate()
  fechaInicio: Date;

  @ApiProperty({
    example: '2026-03-14T00:00:00.000Z',
    description: 'Fecha de fin del viaje',
  })
  @Type(() => Date)
  @IsDate()
  fechaFin: Date;

  @ApiProperty({ type: [CreateActividadInformeDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateActividadInformeDto)
  actividades: CreateActividadInformeDto[];
}

export class CreateRendicionDto {
  @ApiProperty({ example: 123 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  solicitudId: number;

  @ApiProperty({
    example: '2026-03-18T00:00:00.000Z',
    description: 'Fecha de registro de la rendición',
  })
  @Type(() => Date)
  @IsDate()
  fechaRendicion: Date;

  @ApiProperty({
    example: 2,
    description: 'Usuario responsable de la revisión inicial de la rendición',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  aprobadorActualId: number;

  @ApiProperty({ type: [CreateGastoRendicionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGastoRendicionDto)
  gastos: CreateGastoRendicionDto[];

  @ApiPropertyOptional({ type: CreateInformeGastosDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateInformeGastosDto)
  informeGastos?: CreateInformeGastosDto;

  @ApiProperty({
    example: 'https://drive.google.com/drive/folders/abc123',
    description:
      'URL obligatoria con los comprobantes digitales adjuntos de toda la rendición',
  })
  @IsUrl()
  @IsNotEmpty()
  comprobanteUrl: string;

  @ApiPropertyOptional({
    example: 'Observaciones adicionales del responsable de la rendición',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  observaciones?: string;
}
