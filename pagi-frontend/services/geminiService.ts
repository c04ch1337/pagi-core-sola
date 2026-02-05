/** One RLM step result from /rlm-multi-turn. */
export interface RLMSummaryItem {
  summary: string;
  converged: boolean;
}

/** Payload for POST /rlm-multi-turn. */
export interface RLMMultiTurnPayload {
  query: string;
  context?: string;
  depth?: number;
  max_turns?: number;
  vertical_use_case?: string; // research | codegen | code_review | personal
  /** Personal sub-features: health, finance, social, email. Sent to bridge for SYSTEM_PROMPT. */
  feature_flags?: Record<string, boolean>;
  /** When false, force real RLM (structured/LLM path) even if bridge has PAGI_MOCK_MODE=true. Omit to use bridge env. */
  mock_mode?: boolean;
}

export interface LLMGatewayMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMGatewayRequest {
  /** OpenRouter-style model id, e.g. deepseek/deepseek-v3.2 */
  model?: string;
  /** Sampling temperature */
  temperature?: number;
  /** OpenAI-compatible messages */
  messages: LLMGatewayMessage[];
  /** Whether to stream (SSE) */
  stream?: boolean;
  /** Optional API key from Settings; when set, bridge uses it for this request (else uses PAGI_OPENROUTER_API_KEY from env) */
  api_key?: string;
}

export class GeminiService {
  /** Get bridge base URL from phoenix_config (same as pagiBridgeService). */
  getBridgeUrl(): string {
    try {
      const saved = localStorage.getItem('phoenix_config');
      const config = saved ? JSON.parse(saved) : {};
      const url = config.bridgeUrl ?? 'http://127.0.0.1:8001';
      return String(url).replace(/\/$/, '');
    } catch {
      return 'http://127.0.0.1:8001';
    }
  }

  /**
   * POST to bridge /rlm-multi-turn; returns list of RLMSummary dicts.
   * Use when PAGI_ALLOW_LOCAL_DISPATCH or bridge is available.
   */
  async rlmMultiTurn(payload: RLMMultiTurnPayload): Promise<RLMSummaryItem[]> {
    const base = this.getBridgeUrl();
    const body: Record<string, unknown> = {
      query: payload.query,
      context: payload.context ?? '',
      depth: payload.depth ?? 0,
      max_turns: payload.max_turns ?? 5,
    };
    if (payload.vertical_use_case) body.vertical_use_case = payload.vertical_use_case;
    if (payload.feature_flags && Object.keys(payload.feature_flags).length > 0) body.feature_flags = payload.feature_flags;
    if (payload.mock_mode !== undefined) body.mock_mode = payload.mock_mode;
    const res = await fetch(`${base}/rlm-multi-turn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `RLM multi-turn failed: ${res.status}`);
    }
    return res.json();
  }

  /**
   * Streams a chat response from PAGI Core Sola (Sola).
   * Sovereign mode: route ALL LLM inference via the backend bridge (/llm-gateway) so
   * provider API keys never live in the browser.
   */
  async *streamChat(message: string, history: { role: string; content: string }[]) {
    // 1. Fetch current configuration from localStorage
    const savedConfig = localStorage.getItem('phoenix_config');
    let config = {
      model: 'deepseek/deepseek-v3.2',
      provider: 'openrouter',
      backendUrl: 'https://openrouter.ai/api/v1',
      persona: 'professional',
      creativity: 0.7,
      thinkingBudget: 0,
      responseDepth: 0.5,
      customDirectives: ''
    };

    if (savedConfig) {
      try {
        config = { ...config, ...JSON.parse(savedConfig) };
      } catch (e) {
        console.error("Config fetch error:", e);
      }
    }

    // 2. Build the System Instruction
    let personaInstruction = "You are Sola (PAGI Core Sola), a highly advanced, professional, and efficient personal AGI orchestrator.";
    switch (config.persona) {
      case 'clinical':
        personaInstruction = "You are Sola operating in Clinical Mode. Provide highly structured, cold, analytical, and objective data.";
        break;
      case 'creative':
        personaInstruction = "You are Sola operating in Creative Mode. Be imaginative and use rich metaphors.";
        break;
      case 'empathetic':
        personaInstruction = "You are Sola operating in Empathetic Mode. Focus on emotional state and support.";
        break;
    }

    const verbosityInstruction = config.responseDepth > 0.8 
      ? "Your responses should be comprehensive and detailed." 
      : config.responseDepth < 0.3 
      ? "Your responses must be ultra-concise." 
      : "Maintain a balanced length.";

    const fullSystemInstruction = `
      ${personaInstruction} 
      Your goal is to provide a 'Somatic Calm' experience. 
      Use Non-Violent Communication (NVC) principles. 
      ${verbosityInstruction}
      ${config.customDirectives ? `ADDITIONAL USER DIRECTIVES: ${config.customDirectives}` : ''}
      Always use Markdown.
    `.trim();

    // 3. Backend-mediated gateway call (SSE streaming)
    yield* this.streamBridgeGateway(message, history, config, fullSystemInstruction);
  }

  private async *streamBridgeGateway(message: string, history: any[], config: any, systemInstruction: string) {
    try {
      const base = this.getBridgeUrl();
      const body: LLMGatewayRequest = {
        model: config.model,
        temperature: config.creativity,
        stream: true,
        messages: [
          { role: 'system', content: systemInstruction },
          ...history.map((h: any) => ({ role: h.role, content: h.content })),
          { role: 'user', content: message },
        ],
      };
      // Use API key from Settings when user has entered one (not the placeholder)
      if (config.apiKey && config.apiKey !== '••••••••••••••••') {
        body.api_key = config.apiKey;
      }

      const response = await fetch(`${base}/llm-gateway`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(text || `Bridge LLM Gateway Error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const cleanLine = line.replace(/^data: /, '').trim();
          if (cleanLine === '[DONE]') continue;
          if (!cleanLine) continue;

          try {
            const parsed = JSON.parse(cleanLine);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) yield content;
          } catch (e) {
            // Partial JSON or heartbeat
          }
        }
      }
    } catch (error) {
      console.error("Bridge Gateway Stream Error:", error);
      throw error;
    }
  }
}

export const gemini = new GeminiService();
