/**
 * provider.ts — AI model adapter. This is the ONLY file to change when swapping models.
 *
 * WHY ONE FILE:
 * Section 7 of the brief: "one provider module behind one interface, so the model
 * can be changed in one file."
 *
 * HOW TO SWAP THE MODEL:
 * See README.md → Change Recipe 5.
 * After swapping, run: pnpm test --filter ai
 * Add an entry in docs/DECISIONS.md with the date, old model, new model, and reason.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// The AiProvider interface — all callers depend on this, not on the implementation
export interface AiProvider {
  /**
   * Generate a text response given a prompt.
   *
   * @param prompt - The full prompt text
   * @returns The raw text response from the model
   * @throws AiProviderError if the call fails after retries
   */
  generateText(prompt: string): Promise<string>;
}

/**
 * Google Gemini implementation of AiProvider.
 * Uses the model name from the AI_MODEL_NAME environment variable.
 */
export class GeminiProvider implements AiProvider {
  private readonly client: GoogleGenerativeAI;
  private readonly modelName: string;

  constructor(apiKey: string, modelName: string) {
    this.client = new GoogleGenerativeAI(apiKey);
    this.modelName = modelName;
  }

  async generateText(prompt: string): Promise<string> {
    const model = this.client.getGenerativeModel({ model: this.modelName });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    if (!text) {
      throw new AiProviderError('AI model returned an empty response');
    }
    return text;
  }
}

/** Error thrown when the AI provider fails. Always has a specific message. */
export class AiProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiProviderError';
  }
}

/**
 * Factory: creates the configured AI provider from environment variables.
 * Import and call this in the worker, not in page requests.
 *
 * @throws If AI_API_KEY or AI_MODEL_NAME are not set
 */
export function createAiProvider(): AiProvider {
  const apiKey = process.env.AI_API_KEY;
  const modelName = process.env.AI_MODEL_NAME ?? 'gemini-1.5-pro';
  if (!apiKey) {
    throw new Error('AI_API_KEY environment variable is required');
  }
  return new GeminiProvider(apiKey, modelName);
}
