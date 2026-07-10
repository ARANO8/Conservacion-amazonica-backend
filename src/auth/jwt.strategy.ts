import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { UsuariosService } from '../usuarios/usuarios.service';
import { getJwtSecret } from './jwt-secret.util';
import { ACCESS_TOKEN_COOKIE } from './auth-cookie.util';

interface JwtPayload {
  sub: number;
  email: string;
  rol: string;
}

// Lee el JWT primero de la cookie httpOnly; si no está, del header Authorization
// (compatibilidad con clientes que envían Bearer, por ejemplo Swagger).
function cookieExtractor(req: Request): string | null {
  const cookies = req?.cookies as Record<string, string> | undefined;
  return cookies?.[ACCESS_TOKEN_COOKIE] ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private usuariosService: UsuariosService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
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
