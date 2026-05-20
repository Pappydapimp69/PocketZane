import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { CreateEntryInput, type Entry } from '@signal/shared';
import { EntriesService, type EntryDetail } from './entries.service';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodBodyPipe } from '../common/pipes/zod-body.pipe';
import type { AuthenticatedUser } from '../common/guards/supabase-auth.guard';

@Controller('entries')
@UseGuards(SupabaseAuthGuard)
export class EntriesController {
  constructor(private readonly entries: EntriesService) {}

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBodyPipe(CreateEntryInput)) input: CreateEntryInput,
  ): Promise<Entry> {
    return this.entries.create(user.id, input);
  }

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser): Promise<Entry[]> {
    return this.entries.listForUser(user.id);
  }

  @Get(':id')
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<EntryDetail> {
    return this.entries.getById(user.id, id);
  }
}
