
import { AgentEvent, AgentEventKind } from '../types';

/**
 * MockBackendService
 * Simulates the PAGI Core Sola (Sola) reasoning bus for frontend development.
 */
export class MockBackendService {
  private listeners: ((event: AgentEvent) => void)[] = [];

  onEvent(cb: (e: AgentEvent) => void) {
    this.listeners.push(cb);
  }

  /**
   * Simulates a reasoning sequence for a user message.
   */
  async simulateReasoning(message: string) {
    const reasoning_id = `req_${Math.random().toString(36).slice(2, 9)}`;
    const timestamp = () => new Date().toISOString();

    const emit = (kind: AgentEventKind, payload: any) => {
      this.listeners.forEach(l => l({ kind, reasoning_id, timestamp: timestamp(), payload }));
    };

    // 1. Session Start
    emit('session_started', { model_id: 'mock-pagi-v1' });
    await this.delay(300);

    // 2. Thought
    emit('thought', { text: "Analyzing query for semantic vectors..." });
    await this.delay(600);

    // 3. Search Issued
    emit('search_issued', { query: message, k: 5 });
    await this.delay(400);

    // 4. Search Result
    emit('search_result', { hits: [{ kb: 'kb_core', score: 0.92, content: "Context matched in core registry." }] });
    await this.delay(400);

    // 5. Action Planned
    emit('action_planned', { tool_name: 'memory_retrieve', args: { layer: 2 } });
    await this.delay(300);

    // 6. Final Converge
    const response = `I have processed your query: "${message}". The PAGI Core Sola bridge is currently operating in **Mock Mode**. All telemetry shown is simulated to verify contract v1.0.0 compliance.`;
    emit('converged', { text: response });
    
    // 7. End
    emit('session_ended', { duration_ms: 2000 });
  }

  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const mockBackend = new MockBackendService();
