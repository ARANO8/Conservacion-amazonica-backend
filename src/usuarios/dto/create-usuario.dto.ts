import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Rol } from '@prisma/client';

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
    enum: Rol,
    example: Rol.USUARIO,
    description: 'Rol asignado al usuario en el sistema',
  })
  @IsEnum(Rol, { message: 'El rol proporcionado no es válido' })
  rol: Rol;
}
