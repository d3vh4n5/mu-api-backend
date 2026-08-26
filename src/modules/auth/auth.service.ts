import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { EmailService } from 'src/common/email/email.service';
import { UserService } from '../user/user.service';
import { LoginDto } from './dto/login.dto';

type ResetPayload = {
  userId: number;
  email: string;
  expiresAt: number;
  nonce: string;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userService: UserService,
    private readonly emailService: EmailService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const credentials = await this.userService.findCredentialsByLogin(
      dto.login,
    );

    if (!credentials || credentials.controlCode === '1') {
      throw new UnauthorizedException('Usuario o contraseña inválidos');
    }

    const passwordMatches = credentials.password.startsWith('$2')
      ? await bcrypt.compare(dto.password, credentials.password)
      : dto.password === credentials.password;

    if (!passwordMatches) {
      throw new UnauthorizedException('Usuario o contraseña inválidos');
    }

    const roles = ['user'];
    if (credentials.controlCode === '8' || credentials.controlCode === '32') {
      roles.push('admin');
    }

    const payload = {
      sub: credentials.id,
      username: credentials.username,
      name: credentials.name,
      email: credentials.email,
      accountLevel: credentials.accountLevel,
      roles,
    };

    return {
      access_token: await this.jwtService.signAsync(payload),
      token_type: 'Bearer',
      expires_in: 3600,
      user: {
        id: credentials.id,
        username: credentials.username,
        name: credentials.name,
        email: credentials.email,
        accountLevel: credentials.accountLevel,
        roles,
      },
    };
  }

  async forgotPassword(email: string) {
    const user = await this.userService.findByEmail(email);

    if (user) {
      const token = this.createResetToken({
        userId: user.id,
        email: user.email,
        expiresAt: Date.now() + 60 * 60 * 1000,
        nonce: randomBytes(16).toString('hex'),
      });

      await this.emailService.sendPasswordResetEmail(
        { email: user.email, name: user.name },
        token,
      );
      this.logger.log(`Password reset email sent to ${user.email}`);
    }

    return {
      message:
        'Si existe una cuenta con ese correo, recibirás instrucciones para recuperar la contraseña.',
    };
  }

  async resetPassword(token: string) {
    const payload = this.verifyResetToken(token);
    const user = await this.userService.findByEmail(payload.email);

    if (!user || user.id !== payload.userId) {
      throw new BadRequestException('El enlace de recuperación no es válido');
    }

    const newPassword = this.userService.randomNumber();

    await this.userService.updatePassword(user.id, newPassword.toString());

    return {
      message: 'La contraseña fue actualizada correctamente',
      newPassword,
    };
  }

  private createResetToken(payload: ResetPayload): string {
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
      'base64url',
    );
    return `${encodedPayload}.${this.sign(encodedPayload)}`;
  }

  private verifyResetToken(token: string): ResetPayload {
    const [encodedPayload, signature] = token.split('.');

    if (!encodedPayload || !signature) {
      throw new BadRequestException('El enlace de recuperación no es válido');
    }

    const expected = Buffer.from(this.sign(encodedPayload), 'base64url');
    const received = Buffer.from(signature, 'base64url');

    if (
      received.length !== expected.length ||
      !timingSafeEqual(received, expected)
    ) {
      throw new BadRequestException('El enlace de recuperación no es válido');
    }

    try {
      const payload = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString('utf8'),
      ) as ResetPayload;

      if (
        !Number.isInteger(payload.userId) ||
        typeof payload.email !== 'string' ||
        typeof payload.expiresAt !== 'number' ||
        payload.expiresAt <= Date.now()
      ) {
        throw new Error('Invalid payload');
      }

      return payload;
    } catch {
      throw new BadRequestException('El enlace de recuperación no es válido');
    }
  }

  private sign(value: string): string {
    const secret = process.env.AUTH_RESET_SECRET;

    if (!secret) {
      throw new Error('AUTH_RESET_SECRET no está definida');
    }

    return createHmac('sha256', secret).update(value).digest('base64url');
  }
}
