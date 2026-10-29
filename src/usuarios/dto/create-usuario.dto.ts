import { ApiProperty } from '@nestjs/swagger';
import {
  MaxLength,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Rol, Sede } from '@prisma/client';

export class CreateUsuarioDto {
  @ApiProperty({
    example: 'user@conservacion.gob.bo',
    description: 'Correo electrónico institucional del usuario',
  })
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  email: string;

  @ApiProperty({
    example: 'password123',
    description: 'Contraseña de acceso (mínimo 6 caracteres)',
    minLength: 6,
  })
  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;

  @ApiProperty({
    example: 'Juan Perez',
    description: 'Nombre completo del usuario',
  })
  @IsString()
  nombreCompleto: string;

  @ApiProperty({
    example: 'Director de Area',
    description: 'Cargo o posición del usuario',
    required: false,
  })
  @IsOptional()
  @IsString()
  cargo?: string;

  @ApiProperty({
    example: '4876543 LP',
    description: 'Cédula de identidad; se imprime en el ANEXO 5',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  ci?: string;

  @ApiProperty({
    enum: Sede,
    example: Sede.LA_PAZ,
    description:
      'Sede de trabajo; propone el lugar de emisión de sus documentos',
    required: false,
  })
  @IsOptional()
  @IsEnum(Sede, { message: 'La sede proporcionada no es válida' })
  sede?: Sede;

  @ApiProperty({
    enum: Rol,
    example: Rol.USUARIO,
    description: 'Rol asignado al usuario en el sistema',
  })
  @IsEnum(Rol, { message: 'El rol proporcionado no es válido' })
  rol: Rol;
}
