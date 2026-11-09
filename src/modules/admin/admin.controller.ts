import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { AdminActor, AdminService } from './admin.service';
import {
  AuditQueryDto,
  OptionalReasonDto,
  ReasonDto,
  SearchDto,
  SetVipDto,
} from './dto/admin.dto';

type AdminRequest = {
  user?: { username?: unknown };
  headers: Record<string, string | string[] | undefined>;
};

/**
 * Panel de administración. Requiere API key, JWT válido y que la cuenta sea
 * admin en la base (AdminGuard). Toda acción de escritura queda auditada.
 */
@Controller('admin')
@UseGuards(ApiKeyGuard, JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('search')
  search(@Query() query: SearchDto) {
    return this.adminService.search(query.q);
  }

  @Get('online')
  online() {
    return this.adminService.online();
  }

  @Get('audit')
  audit(@Query() query: AuditQueryDto) {
    return this.adminService.audit(Number(query.limit ?? 50), query.target);
  }

  @Get('accounts/:username')
  accountDetail(@Param('username') username: string) {
    return this.adminService.accountDetail(username);
  }

  @Post('accounts/:username/ban')
  @HttpCode(200)
  banAccount(
    @Req() req: AdminRequest,
    @Param('username') username: string,
    @Body() dto: ReasonDto,
  ) {
    return this.adminService.banAccount(this.actor(req), username, dto.reason);
  }

  @Post('accounts/:username/unban')
  @HttpCode(200)
  unbanAccount(
    @Req() req: AdminRequest,
    @Param('username') username: string,
    @Body() dto: OptionalReasonDto,
  ) {
    return this.adminService.unbanAccount(
      this.actor(req),
      username,
      dto.reason,
    );
  }

  @Post('accounts/:username/vip')
  @HttpCode(200)
  setVip(
    @Req() req: AdminRequest,
    @Param('username') username: string,
    @Body() dto: SetVipDto,
  ) {
    return this.adminService.setVip(this.actor(req), username, dto);
  }

  @Post('characters/:name/ban')
  @HttpCode(200)
  banCharacter(
    @Req() req: AdminRequest,
    @Param('name') name: string,
    @Body() dto: ReasonDto,
  ) {
    return this.adminService.banCharacter(this.actor(req), name, dto.reason);
  }

  @Post('characters/:name/unban')
  @HttpCode(200)
  unbanCharacter(
    @Req() req: AdminRequest,
    @Param('name') name: string,
    @Body() dto: OptionalReasonDto,
  ) {
    return this.adminService.unbanCharacter(this.actor(req), name, dto.reason);
  }

  @Post('characters/:name/gm')
  @HttpCode(200)
  grantGm(
    @Req() req: AdminRequest,
    @Param('name') name: string,
    @Body() dto: OptionalReasonDto,
  ) {
    return this.adminService.grantGm(this.actor(req), name, dto.reason);
  }

  @Post('characters/:name/ungm')
  @HttpCode(200)
  revokeGm(
    @Req() req: AdminRequest,
    @Param('name') name: string,
    @Body() dto: OptionalReasonDto,
  ) {
    return this.adminService.revokeGm(this.actor(req), name, dto.reason);
  }

  private actor(req: AdminRequest): AdminActor {
    const username = req.user?.username;
    if (typeof username !== 'string' || !username) {
      throw new UnauthorizedException('Token sin usuario');
    }
    // La web (proxy de Astro, autenticado con API key) informa la IP real del cliente
    const ip = req.headers['x-client-ip'];
    return { username, ip: Array.isArray(ip) ? ip[0] : ip };
  }
}
