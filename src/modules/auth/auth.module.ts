import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserModule } from '../user/user.module';
import { EmailModule } from '../../common/email/email.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@Module({
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, RolesGuard],
  imports: [
    UserModule,
    EmailModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret =
          configService.get<string>('JWT_SECRET') ??
          configService.get<string>('AUTH_RESET_SECRET');

        if (!secret) {
          throw new Error(
            'JWT_SECRET (o AUTH_RESET_SECRET) debe estar definida',
          );
        }

        return { secret, signOptions: { expiresIn: '1h' } };
      },
    }),
  ],
  exports: [JwtModule, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
