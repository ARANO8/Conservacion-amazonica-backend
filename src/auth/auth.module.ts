import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { JwtStrategy } from './jwt.strategy';
import { getJwtSecret } from './jwt-secret.util';

const DEFAULT_JWT_EXPIRES_IN = '24h';

@Module({
  imports: [
    UsuariosModule,
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: getJwtSecret(),
        signOptions: {
          expiresIn: (process.env.JWT_EXPIRES_IN ??
            DEFAULT_JWT_EXPIRES_IN) as `${number}${'h' | 'm' | 's' | 'd'}`,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
