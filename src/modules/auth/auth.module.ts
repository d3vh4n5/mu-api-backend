import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserModule } from '../user/user.module';
import { EmailModule } from '../../common/email/email.module';

@Module({
  controllers: [AuthController],
  providers: [AuthService],
  imports: [UserModule, EmailModule],
})
export class AuthModule {}
