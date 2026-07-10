import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import {
  ACCESS_TOKEN_COOKIE,
  buildAccessTokenCookieOptions,
} from './auth-cookie.util';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Iniciar sesión en el sistema' })
  @ApiResponse({
    status: 200,
    description:
      'Login exitoso. Setea el JWT en una cookie httpOnly y devuelve los datos del usuario (y el token, por compatibilidad).',
  })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(loginDto);

    // El JWT viaja en una cookie httpOnly (no accesible por JS, mitiga XSS).
    // Se mantiene accessToken en el body por compatibilidad durante la
    // transición del frontend.
    res.cookie(
      ACCESS_TOKEN_COOKIE,
      result.accessToken,
      buildAccessTokenCookieOptions(),
    );

    return result;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cerrar sesión (limpia la cookie de autenticación)',
  })
  @ApiResponse({ status: 200, description: 'Sesión cerrada' })
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(ACCESS_TOKEN_COOKIE, buildAccessTokenCookieOptions());
    return { message: 'Sesión cerrada' };
  }
}
