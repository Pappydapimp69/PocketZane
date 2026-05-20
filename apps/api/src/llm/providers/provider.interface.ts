import type { ExtractionResult } from '@signal/shared';

export interface GenerateOptions {
  /** 0..1, lower = more deterministic. */
  temperature?: number;
  maxOutputTokens?: number;
  /** When set, the provider should constrain JSON output to this shape. */
  jsonSchema?: Record<string, unknown>;
}

export interface LlmProvider {
  /** Run structured extraction over a single entry's text. */
  extract(text: string): Promise<ExtractionResult>;

  /** Produce a float vector embedding for the given text. */
  embed(text: string): Promise<number[]>;

  /** Free-form generation, used by insight body composition. */
  generate(prompt: string, options?: GenerateOptions): Promise<string>;

  /** Provider identifier persisted alongside embeddings. */
  readonly providerName: string;
  /** Model name persisted alongside embeddings. */
  readonly embeddingModel: string;
  /** Vector dimensionality, must match the entry_embeddings column. */
  readonly embeddingDimensions: number;
}
