import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { LoginInput, MeResponse } from '@fernleaf/shared';
import bcrypt from 'bcryptjs';
import { DomainError } from '../common/domain-error';
import type { CurrentUserInfo } from '../authz/current-user';
import { SessionService } from '../authz/session.service';
import { PrismaService } from '../prisma/prisma.service';

// Compared against when the email is unknown, so both failure paths take the same time
// (no user-enumeration by timing). A real hash of a random secret, computed once at startup.
const DUMMY_HASH = bcrypt.hashSync(randomBytes(16).toString('hex'), 10);

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
  ) {}

  /** Returns a session token. Same error for unknown email, wrong password and inactive user. */
  async login(input: LoginInput): Promise<{ token: string; me: MeResponse }> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      include: { role: true },
    });
    const passwordOk = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !passwordOk || !user.isActive) {
      throw new DomainError('UNAUTHENTICATED', 'Email or password is incorrect.');
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const token = await this.sessions.issue(user);
    return {
      token,
      me: {
        user: { id: user.id, email: user.email, name: user.name },
        role: { key: user.role.key, name: user.role.name },
        permissions: user.role.permissions,
      },
    };
  }

  toMe(user: CurrentUserInfo): MeResponse {
    return {
      user: { id: user.id, email: user.email, name: user.name },
      role: user.role,
      permissions: user.permissions,
    };
  }
}
