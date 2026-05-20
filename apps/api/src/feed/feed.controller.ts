import { Controller, Get, UseGuards } from '@nestjs/common';
import type { FeedResponse } from '@signal/shared';
import { FeedService } from './feed.service';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/guards/supabase-auth.guard';

@Controller('feed')
@UseGuards(SupabaseAuthGuard)
export class FeedController {
  constructor(private readonly feed: FeedService) {}

  @Get()
  async get(@CurrentUser() user: AuthenticatedUser): Promise<FeedResponse> {
    return this.feed.build(user.id);
  }
}
