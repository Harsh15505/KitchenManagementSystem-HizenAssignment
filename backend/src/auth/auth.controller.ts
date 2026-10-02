import { Body, Controller, Get, HttpCode, Post, Res, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { loginSchema, type MeResponse } from '@fernleaf/shared';
import type { Response } from 'express';
import { createZodDto } from 'nestjs-zod';
import { type CurrentUserInfo, CurrentUser } from '../authz/current-user';
import { AnyUser, Public } from '../authz/policies';
import { SESSION_COOKIE, SessionService } from '../authz/session.service';
import { AuthService } from './auth.service';

class LoginDto extends createZodDto(loginSchema) {}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
  ) {}

  @Post('login')
  @Public()
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } }) // brute-force protection per client IP
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MeResponse> {
    const { token, me } = await this.auth.login(body);
    res.cookie(SESSION_COOKIE, token, this.sessions.cookieOptions());
    return me;
  }

  /** Public so an expired session can still clear its cookie. */
  @Post('logout')
  @Public()
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response): void {
    const { maxAge: _maxAge, ...options } = this.sessions.cookieOptions();
    res.clearCookie(SESSION_COOKIE, options);
  }

  @Get('me')
  @AnyUser()
  me(@CurrentUser() user: CurrentUserInfo): MeResponse {
    return this.auth.toMe(user);
  }
}
