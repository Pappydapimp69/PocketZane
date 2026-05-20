import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExtractionResult } from '@signal/shared';
import type { LlmProvider, GenerateOptions } from './provider.interface';
import type { AppConfig } from '../../config/configuration';
import {
  EXTRACTION_SYSTEM_PROMPT,
  EXTRACTION_RESPONSE_SCHEMA,
  buildExtractionUserPrompt,
} from '../../extraction/prompts/extraction.prompt';

interface GenerateContentResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
}

interface EmbedContentResponse {
  embedding?: { values?: number[] };
}

/**
 * Gemma 4 via Google AI Studio (Generative Language API).
 * Same endpoint family also serves Gemini embeddings, so this provider handles
 * both extraction (Gemma) and embeddings (Gemini text-embedding-004).
 */
@Injectable()
export class GemmaProvider implements LlmProvider {
  private readonly logger = new Logger(GemmaProvider.name);
  private readonly apiKey: string;
  private readonly model: string;
  readonly providerName = 'google';
  readonly embeddingModel: string;
  readonly embeddingDimensions = 768;

  constructor(config: ConfigService<AppConfig, true>) {
    const key = config.get('GOOGLE_AI_API_KEY', { infer: true });
    if (!key) {
      throw new Error('GOOGLE_AI_API_KEY is required when LLM_PROVIDER=gemma');
    }
    this.apiKey = key;
    this.model = config.get('GEMMA_MODEL', { infer: true });
    this.embeddingModel = config.get('GEMINI_EMBEDDING_MODEL', { infer: true });
  }

  async extract(text: string): Promise<ExtractionResult> {
    const userPrompt = buildExtractionUserPrompt(text);
    const body = {
      systemInstruction: { parts: [{ text: EXTRACTION_SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: EXTRACTION_RESPONSE_SCHEMA,
      },
    };

    const raw = await this.callGenerateContent(body);
    const parsed = this.tryParseJson(raw);
    const validated = ExtractionResult.safeParse(parsed);
    if (validated.success) return validated.data;

    this.logger.warn(`Extraction JSON failed validation, retrying once: ${validated.error.message}`);
    // One retry with a strict reminder.
    const retryBody = {
      ...body,
      contents: [
        ...body.contents,
        { role: 'model', parts: [{ text: raw }] },
        {
          role: 'user',
          parts: [
            {
              text: 'Your previous output failed schema validation. Return ONLY a single JSON object matching the schema exactly, no commentary.',
            },
          ],
        },
      ],
    };
    const rawRetry = await this.callGenerateContent(retryBody);
    const retryParsed = this.tryParseJson(rawRetry);
    return ExtractionResult.parse(retryParsed);
  }

  async embed(text: string): Promise<number[]> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.embeddingModel}:embedContent?key=${this.apiKey}`;
    const body = {
      model: `models/${this.embeddingModel}`,
      content: { parts: [{ text }] },
      taskType: 'SEMANTIC_SIMILARITY',
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Embed call failed: ${res.status} ${errText}`);
    }
    const json = (await res.json()) as EmbedContentResponse;
    const values = json.embedding?.values;
    if (!values || values.length !== this.embeddingDimensions) {
      throw new Error(`Unexpected embedding payload: ${JSON.stringify(json).slice(0, 200)}`);
    }
    return values;
  }

  async generate(prompt: string, options: GenerateOptions = {}): Promise<string> {
    const body: Record<string, unknown> = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: options.temperature ?? 0.4,
        maxOutputTokens: options.maxOutputTokens ?? 512,
        ...(options.jsonSchema
          ? { responseMimeType: 'application/json', responseSchema: options.jsonSchema }
          : {}),
      },
    };
    return this.callGenerateContent(body);
  }

  private async callGenerateContent(body: unknown): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemma call failed: ${res.status} ${errText}`);
    }
    const json = (await res.json()) as GenerateContentResponse;
    if (json.promptFeedback?.blockReason) {
      throw new Error(`Gemma blocked prompt: ${json.promptFeedback.blockReason}`);
    }
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error(`Gemma returned empty candidate: ${JSON.stringify(json).slice(0, 300)}`);
    }
    return text;
  }

  private tryParseJson(raw: string): unknown {
    const trimmed = raw.trim();
    try {
      return JSON.parse(trimmed);
    } catch {
      // The model occasionally wraps JSON in markdown despite instructions.
      const fenced = trimmed.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
      if (fenced?.[1]) return JSON.parse(fenced[1]);
      throw new Error(`Failed to parse JSON: ${trimmed.slice(0, 300)}`);
    }
  }
}
