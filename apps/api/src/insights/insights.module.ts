import { Module } from '@nestjs/common';
import { InsightsController } from './insights.controller';
import { InsightsService } from './insights.service';
import { InsightsProcessor } from './insights.processor';
import { RecurrenceGenerator } from './generators/recurrence.generator';
import { TemporalPatternGenerator } from './generators/temporal-pattern.generator';
import { EmotionalShiftGenerator } from './generators/emotional-shift.generator';
import { ResurfacedThemeGenerator } from './generators/resurfaced-theme.generator';
import { ContradictionGenerator } from './generators/contradiction.generator';
import { FeedbackModule } from '../feedback/feedback.module';

@Module({
  imports: [FeedbackModule],
  controllers: [InsightsController],
  providers: [
    InsightsService,
    InsightsProcessor,
    RecurrenceGenerator,
    TemporalPatternGenerator,
    EmotionalShiftGenerator,
    ResurfacedThemeGenerator,
    ContradictionGenerator,
  ],
  exports: [InsightsService],
})
export class InsightsModule {}
