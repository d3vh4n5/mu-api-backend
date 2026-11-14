import { Controller, Post, Body, UseGuards, Get, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}

  // Más estricto contra fuerza bruta (solo aplica si el BFF manda x-client-ip)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('/login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('/me')
  @UseGuards(JwtAuthGuard)
  me(@Req() request: { user: Record<string, unknown> }) {
    return request.user;
  }

  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @Post('/register')
  @UseGuards(ApiKeyGuard)
  create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }

  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @Post('/forgot-password')
  @UseGuards(ApiKeyGuard)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('/reset-password')
  @UseGuards(ApiKeyGuard)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token);
  }
}
