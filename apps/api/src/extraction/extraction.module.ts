import { Module } from '@nestjs/common';
import { ExtractionProcessor } from './extraction.processor';

@Module({
  providers: [ExtractionProcessor],
})
export class ExtractionModule {}
