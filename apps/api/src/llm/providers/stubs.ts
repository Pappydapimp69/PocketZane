import { Injectable } from '@nestjs/common';
import type { ExtractionResult } from '@signal/shared';
import type { LlmProvider } from './provider.interface';

abstract class NotImplementedProvider implements LlmProvider {
  abstract readonly providerName: string;
  readonly embeddingModel: string;
  readonly embeddingDimensions = 768;

  protected constructor(name: string) {
    this.embeddingModel = `${name}-embedding-not-implemented`;
  }

  async extract(): Promise<ExtractionResult> {
    throw new Error(`${this.providerName} provider is not implemented in V1; set LLM_PROVIDER=gemma.`);
  }
  async embed(): Promise<number[]> {
    throw new Error(`${this.providerName} provider is not implemented in V1; set LLM_PROVIDER=gemma.`);
  }
  async generate(): Promise<string> {
    throw new Error(`${this.providerName} provider is not implemented in V1; set LLM_PROVIDER=gemma.`);
  }
}

@Injectable()
export class AnthropicProvider extends NotImplementedProvider {
  readonly providerName = 'anthropic';
  constructor() {
    super('anthropic');
  }
}

@Injectable()
export class OpenAiProvider extends NotImplementedProvider {
  readonly providerName = 'openai';
  constructor() {
    super('openai');
  }
}
