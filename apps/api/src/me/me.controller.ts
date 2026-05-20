import { Controller, Delete, Get, HttpCode, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { MeService } from './me.service';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/guards/supabase-auth.guard';

@Controller('me')
@UseGuards(SupabaseAuthGuard)
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get('export')
  async export(@CurrentUser() user: AuthenticatedUser, @Res() res: Response): Promise<void> {
    const payload = await this.me.exportData(user.id);
    res
      .setHeader('content-type', 'application/json')
      .setHeader('content-disposition', `attachment; filename="signal-export-${user.id}.json"`)
      .send(JSON.stringify(payload, null, 2));
  }

  @Delete()
  @HttpCode(204)
  async deleteAll(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.me.deleteAccount(user.id);
  }
}
