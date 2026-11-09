import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AccountService } from './account.service';
import { AddPointsDto } from './dto/add-points.dto';

type AuthenticatedRequest = { user?: { username?: unknown } };

/**
 * Panel de la cuenta logueada. Todas las acciones operan solo sobre la cuenta
 * del token: el usuario sale del JWT, nunca del body ni de la URL.
 */
@Controller('account')
@UseGuards(ApiKeyGuard, JwtAuthGuard)
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get()
  overview(@Req() req: AuthenticatedRequest) {
    return this.accountService.getOverview(this.username(req));
  }

  @Post('characters/:name/reset')
  @HttpCode(200)
  reset(@Req() req: AuthenticatedRequest, @Param('name') name: string) {
    return this.accountService.reset(this.username(req), name);
  }

  @Post('characters/:name/add-points')
  @HttpCode(200)
  addPoints(
    @Req() req: AuthenticatedRequest,
    @Param('name') name: string,
    @Body() dto: AddPointsDto,
  ) {
    return this.accountService.addPoints(this.username(req), name, dto);
  }

  @Post('characters/:name/pk-clear')
  @HttpCode(200)
  clearPk(@Req() req: AuthenticatedRequest, @Param('name') name: string) {
    return this.accountService.clearPk(this.username(req), name);
  }

  @Post('characters/:name/unstuck')
  @HttpCode(200)
  unstuck(@Req() req: AuthenticatedRequest, @Param('name') name: string) {
    return this.accountService.unstuck(this.username(req), name);
  }

  private username(req: AuthenticatedRequest): string {
    const username = req.user?.username;
    if (typeof username !== 'string' || !username) {
      throw new UnauthorizedException('Token sin usuario');
    }
    return username;
  }
}
