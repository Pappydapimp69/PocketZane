import { Module } from '@nestjs/common';
import { EmbeddingsProcessor } from './embeddings.processor';

@Module({
  providers: [EmbeddingsProcessor],
})
export class EmbeddingsModule {}
