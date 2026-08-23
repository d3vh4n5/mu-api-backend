import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { ApiKeyGuard } from 'src/common/guards/api-key.guard';

@Controller('auth')
@UseGuards(ApiKeyGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}

  @Post('/register')
  create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }
}
