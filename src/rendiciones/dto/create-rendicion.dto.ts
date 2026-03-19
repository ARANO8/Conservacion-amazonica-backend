import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
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
  concepto: string;

  @ApiPropertyOptional({ example: 'Incluye útiles y material impreso' })
  @IsOptional()
  @IsString()
  detalle?: string;

  @ApiProperty({ enum: TipoDocumentoRendicionDto, example: 'FACTURA' })
  @IsEnum(TipoDocumentoRendicionDto)
  tipoDocumento: TipoDocumentoRendicionDto;

  @ApiPropertyOptional({ example: '0001-2026-0001234' })
  @IsOptional()
  @IsString()
  numeroDocumento?: string;

  @ApiPropertyOptional({ example: 'Proveedor S.R.L.' })
  @IsOptional()
  @IsString()
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
    description: 'ID de la partida presupuestaria seleccionada',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  partidaId: number;

  @ApiProperty({
    example: 'https://drive.google.com/file/d/abc/view',
    description: 'URL del comprobante digital',
  })
  @IsUrl()
  urlComprobante: string;

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
  lugar: string;

  @ApiProperty({ example: 'Gobierno Autónomo Municipal de Cobija' })
  @IsString()
  personaInstitucion: string;

  @ApiProperty({
    example:
      'Reunión de coordinación con actores locales y validación de agenda.',
  })
  @IsString()
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

export class CreateGastoSinRespaldoDto {
  @ApiPropertyOptional({
    example: '2026-03-13T00:00:00.000Z',
    description: 'Fecha del gasto sin respaldo',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  fechaGasto?: Date;

  @ApiProperty({ example: 'Pago de taxi urbano en zona sin facturación' })
  @IsString()
  detalle: string;

  @ApiProperty({ example: 35.5 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  monto: number;
}

export class CreateDeclaracionJuradaDto {
  @ApiProperty({
    example: true,
    description: 'Confirmación de veracidad de los datos de rendición',
  })
  @IsBoolean()
  confirmaDatosVeridicos: boolean;

  @ApiProperty({
    example: true,
    description: 'Aceptación de la política de devolución de saldos',
  })
  @IsBoolean()
  aceptaPoliticaDevolucion: boolean;

  @ApiPropertyOptional({
    example: 'COMPLETA',
    description: 'Tipo de declaración jurada seleccionada por frontend',
  })
  @IsOptional()
  @IsString()
  tipoDeclaracion?: string;

  @ApiPropertyOptional({
    example: 0,
    description: 'Monto declarado a devolver',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  montoADevolver?: number;

  @ApiPropertyOptional({
    example: 'La rendición incluye gastos menores por contingencia.',
  })
  @IsOptional()
  @IsString()
  observaciones?: string;
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

  @ApiProperty({ type: [CreateGastoRendicionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGastoRendicionDto)
  gastos: CreateGastoRendicionDto[];

  @ApiPropertyOptional({ type: [CreateGastoSinRespaldoDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGastoSinRespaldoDto)
  gastosSinRespaldo?: CreateGastoSinRespaldoDto[];

  @ApiPropertyOptional({ type: CreateInformeGastosDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateInformeGastosDto)
  informeGastos?: CreateInformeGastosDto;

  @ApiPropertyOptional({ type: CreateDeclaracionJuradaDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateDeclaracionJuradaDto)
  declaracionJurada?: CreateDeclaracionJuradaDto;

  @ApiPropertyOptional({
    example: 'Observaciones adicionales del responsable de la rendición',
  })
  @IsOptional()
  @IsString()
  observaciones?: string;
}
