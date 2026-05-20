import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CreateFeedbackInput, type Insight, type InsightFeedback } from '@signal/shared';
import { InsightsService } from './insights.service';
import { FeedbackService } from '../feedback/feedback.service';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodBodyPipe } from '../common/pipes/zod-body.pipe';
import type { AuthenticatedUser } from '../common/guards/supabase-auth.guard';

@Controller('insights')
@UseGuards(SupabaseAuthGuard)
export class InsightsController {
  constructor(
    private readonly insights: InsightsService,
    private readonly feedback: FeedbackService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser): Promise<Insight[]> {
    return this.insights.listForUser(user.id);
  }

  @Get(':id')
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<Insight> {
    return this.insights.getById(user.id, id);
  }

  @Post(':id/feedback')
  @HttpCode(201)
  async submitFeedback(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodBodyPipe(CreateFeedbackInput)) input: CreateFeedbackInput,
  ): Promise<InsightFeedback> {
    return this.feedback.submit(user.id, id, input);
  }
}
