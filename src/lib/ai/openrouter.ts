/**
 * OpenRouter API client with model tier routing, retry logic, and token tracking.
 */

export type ModelTier = "fast" | "standard" | "premium";

const MODEL_MAP: Record<ModelTier, string> = {
  fast: "meta-llama/llama-3.1-8b-instruct",
  standard: "openai/gpt-4o-mini",
  premium: "anthropic/claude-sonnet-4",
};

interface OpenRouterConfig {
  tier: ModelTier;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

interface OpenRouterResponse<T = unknown> {
  data: T;
  model: string;
  tokensUsed: number;
  latencyMs: number;
}

const MAX_RETRIES = 2;
const DEFAULT_TIMEOUT = 30_000;

export async function callOpenRouter<T = unknown>(
  config: OpenRouterConfig,
  systemPrompt: string,
  userPrompt: string,
  responseSchema?: Record<string, unknown>
): Promise<OpenRouterResponse<T>> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY environment variable is not set");
  }

  const model = MODEL_MAP[config.tier];
  const timeout = config.timeoutMs ?? DEFAULT_TIMEOUT;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const start = Date.now();

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      const body: Record<string, unknown> = {
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: config.temperature ?? 0.1,
        max_tokens: config.maxTokens ?? 4096,
      };

      // Request structured JSON output
      if (responseSchema) {
        body.response_format = {
          type: "json_schema",
          json_schema: {
            name: "response",
            strict: true,
            schema: responseSchema,
          },
        };
      } else {
        body.response_format = { type: "json_object" };
      }

      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://crm.whop.com",
          "X-Title": "Whop CRM Gatekeeper",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timer);
      const latencyMs = Date.now() - start;

      if (!res.ok) {
        const errorBody = await res.text();
        // Retry on 429 (rate limit) and 5xx errors
        if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
          const backoff = Math.min(1000 * Math.pow(2, attempt), 8000);
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }
        throw new Error(`OpenRouter API error ${res.status}: ${errorBody}`);
      }

      const json = await res.json();
      const content = json.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("No content in OpenRouter response");
      }

      const tokensUsed =
        (json.usage?.prompt_tokens ?? 0) + (json.usage?.completion_tokens ?? 0);

      let parsed: T;
      try {
        parsed = JSON.parse(content) as T;
      } catch {
        throw new Error(`Failed to parse JSON response: ${content.slice(0, 200)}`);
      }

      return {
        data: parsed,
        model,
        tokensUsed,
        latencyMs,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < MAX_RETRIES && lastError.name === "AbortError") {
        continue;
      }
      if (attempt >= MAX_RETRIES) break;
    }
  }

  throw lastError ?? new Error("OpenRouter call failed after retries");
}

/**
 * Estimate cost in USD for a given number of tokens on a model tier.
 */
export function estimateCost(tier: ModelTier, tokens: number): number {
  // Rough per-token costs (combined input+output average)
  const costs: Record<ModelTier, number> = {
    fast: 0.0000002,    // ~$0.20/M tokens
    standard: 0.0000003, // ~$0.30/M tokens
    premium: 0.000006,   // ~$6.00/M tokens
  };
  return tokens * costs[tier];
}
