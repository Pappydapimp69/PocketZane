import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LLM_PROVIDER } from './llm.tokens';
import { GemmaProvider } from './providers/gemma.provider';
import { AnthropicProvider, OpenAiProvider } from './providers/stubs';
import type { AppConfig } from '../config/configuration';
import type { LlmProvider } from './providers/provider.interface';

@Global()
@Module({
  providers: [
    GemmaProvider,
    AnthropicProvider,
    OpenAiProvider,
    {
      provide: LLM_PROVIDER,
      inject: [ConfigService, GemmaProvider, AnthropicProvider, OpenAiProvider],
      useFactory: (
        config: ConfigService<AppConfig, true>,
        gemma: GemmaProvider,
        anthropic: AnthropicProvider,
        openai: OpenAiProvider,
      ): LlmProvider => {
        switch (config.get('LLM_PROVIDER', { infer: true })) {
          case 'anthropic':
            return anthropic;
          case 'openai':
            return openai;
          case 'gemma':
          default:
            return gemma;
        }
      },
    },
  ],
  exports: [LLM_PROVIDER],
})
export class LlmModule {}
