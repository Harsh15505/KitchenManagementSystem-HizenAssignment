import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { defineAbilityFor } from '@fernleaf/shared';
import type { CookieOptions } from 'express';
import { loadEnv } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUserInfo } from './current-user';

export const SESSION_COOKIE = 'fl_session';

interface SessionClaims {
  sub: string;
  /** Token version: bumped on deactivation, role change or password reset (BR-ACC-02). */
  tv: number;
}

@Injectable()
export class SessionService {
  private readonly env = loadEnv();

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  issue(user: { id: string; tokenVersion: number }): Promise<string> {
    const claims: SessionClaims = { sub: user.id, tv: user.tokenVersion };
    return this.jwt.signAsync(claims, { expiresIn: `${this.env.SESSION_TTL_HOURS}h` });
  }

  /**
   * httpOnly: not readable by JS. SameSite=Lax + same-origin proxy: no cross-site sends (CSRF).
   * No Domain attribute: the cookie belongs to the web origin that proxies /api (ADR-003).
   */
  cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: this.env.SESSION_TTL_HOURS * 3600 * 1000,
    };
  }

  /** Resolves a token to the live user; null if invalid, expired, revoked or inactive. */
  async resolve(token: string | undefined): Promise<CurrentUserInfo | null> {
    if (!token) return null;
    let claims: SessionClaims;
    try {
      claims = await this.jwt.verifyAsync<SessionClaims>(token);
    } catch {
      return null;
    }

    // Loaded on every request so deactivation and role changes apply immediately (BR-ACC-02).
    const user = await this.prisma.user.findUnique({
      where: { id: claims.sub },
      include: { role: true },
    });
    if (!user || !user.isActive || user.tokenVersion !== claims.tv) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: { key: user.role.key, name: user.role.name },
      permissions: user.role.permissions,
      ability: defineAbilityFor({ id: user.id, permissions: user.role.permissions }),
    };
  }
}
