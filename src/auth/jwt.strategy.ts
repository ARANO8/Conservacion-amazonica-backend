import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsuariosService } from '../usuarios/usuarios.service';

interface JwtPayload {
  sub: number;
  email: string;
  rol: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private usuariosService: UsuariosService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'secretKey',
    });
  }

  async validate(payload: JwtPayload) {
    const usuario = await this.usuariosService.findOne(payload.sub);

    if (!usuario || usuario.deletedAt) {
      throw new UnauthorizedException('Usuario no válido o eliminado');
    }

    return {
      userId: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
    };
  }
}
