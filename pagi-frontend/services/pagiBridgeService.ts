
import { AgentEvent, SearchRequest, SearchResponse, MemoryAccessRequest, MemoryAccessResponse } from '../types';

export class PagiBridgeService {
  private socket: WebSocket | null = null;
  private eventListeners: ((event: AgentEvent) => void)[] = [];

  /**
   * Connects to the intelligence bridge via WebSocket.
   * Uses bridgeUrl from config or ws://127.0.0.1:8001.
   */
  connect(url?: string) {
    const base = this.getBridgeBaseUrl().replace(/^http/, 'ws');
    const wsUrl = url ?? `${base}/ws/agent`;
    if (this.socket) this.socket.close();

    this.socket = new WebSocket(url);
    this.socket.onmessage = (e) => {
      try {
        const event: AgentEvent = JSON.parse(e.data);
        this.eventListeners.forEach(listener => listener(event));
      } catch (err) {
        console.error("Malformed Agent Event:", err);
      }
    };

    this.socket.onclose = () => {
      console.warn("PAGI Bridge connection lost.");
    };
  }

  onEvent(callback: (event: AgentEvent) => void) {
    this.eventListeners.push(callback);
    return () => {
      this.eventListeners = this.eventListeners.filter(l => l !== callback);
    };
  }

  /** Base URL for PAGI bridge (search, memory, ws). Defaults to http://127.0.0.1:8001 */
  private getBridgeBaseUrl(): string {
    try {
      const saved = localStorage.getItem('phoenix_config');
      const config = saved ? JSON.parse(saved) : {};
      const url = config.bridgeUrl ?? 'http://127.0.0.1:8001';
      return String(url).replace(/\/$/, '');
    } catch {
      return 'http://127.0.0.1:8001';
    }
  }

  async search(req: SearchRequest): Promise<SearchResponse> {
    const base = this.getBridgeBaseUrl();
    const res = await fetch(`${base}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req)
    });
    return res.json();
  }

  async accessMemory(req: MemoryAccessRequest): Promise<MemoryAccessResponse> {
    const base = this.getBridgeBaseUrl();
    const res = await fetch(`${base}/api/memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req)
    });
    return res.json();
  }

  /** Upload text to personal KB (UpsertVectors). Gate by vertical "personal". */
  async kbUpload(content: string, kbName: string = 'kb_personal'): Promise<{ success: boolean; upserted_count?: number }> {
    const base = this.getBridgeBaseUrl();
    const res = await fetch(`${base}/api/memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kb_name: kbName, content })
    });
    return res.json();
  }

  /** Semantic search over personal KB (stub for SemanticSearch). */
  async kbSearch(query: string, kbName: string = 'kb_personal'): Promise<{ hits?: Array<{ content?: string; score?: number; metadata?: Record<string, unknown> }>; latency_ms?: number }> {
    const base = this.getBridgeBaseUrl();
    const url = new URL(`${base}/api/search`);
    url.searchParams.set('query', query);
    url.searchParams.set('kb_name', kbName);
    const res = await fetch(url.toString(), { method: 'GET' });
    return res.json();
  }

  /** POST /api/health/track – log health metrics to kb_health. Gate by personal vertical. */
  async healthTrack(metrics: Record<string, unknown>): Promise<{ success: boolean; id?: string }> {
    const base = this.getBridgeBaseUrl();
    const res = await fetch(`${base}/api/health/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metrics }),
    });
    return res.json();
  }

  /** GET /api/health/trends – semantic search over kb_health. Gate by personal vertical. */
  async healthTrends(query: string, periodDays: number = 30): Promise<{ trends: Array<{ content?: string; score?: number; metadata?: Record<string, unknown> }> }> {
    const base = this.getBridgeBaseUrl();
    const url = new URL(`${base}/api/health/trends`);
    url.searchParams.set('query', query);
    url.searchParams.set('period_days', String(periodDays));
    const res = await fetch(url.toString(), { method: 'GET' });
    return res.json();
  }

  /** POST /api/finance/track – log transactions to kb_finance. Gate by personal vertical. */
  async financeTrack(transactions: Record<string, unknown>[]): Promise<{ success: boolean; upserted_count?: number }> {
    const base = this.getBridgeBaseUrl();
    const res = await fetch(`${base}/api/finance/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactions }),
    });
    return res.json();
  }

  /** GET /api/finance/summary – semantic search over kb_finance for balance/trends. Gate by personal vertical. */
  async financeSummary(query: string, periodDays: number = 30): Promise<{ summary: Array<{ content?: string; score?: number; metadata?: Record<string, unknown> }> }> {
    const base = this.getBridgeBaseUrl();
    const url = new URL(`${base}/api/finance/summary`);
    url.searchParams.set('query', query);
    url.searchParams.set('period_days', String(periodDays));
    const res = await fetch(url.toString(), { method: 'GET' });
    return res.json();
  }

  /** POST /api/social/track – log social activity via track_social_activity skill. Gate by personal vertical. */
  async socialTrack(platform: string, action: string, contentSummary: string): Promise<{ success: boolean; message?: string }> {
    const base = this.getBridgeBaseUrl();
    const res = await fetch(`${base}/api/social/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, action, content_summary: contentSummary }),
    });
    return res.json();
  }

  /** GET /api/social/trends – query social trends via query_social_trends skill. Gate by personal vertical. */
  async socialTrends(periodDays: number = 30, platform?: string): Promise<{ trends: string }> {
    const base = this.getBridgeBaseUrl();
    const url = new URL(`${base}/api/social/trends`);
    url.searchParams.set('period_days', String(periodDays));
    if (platform) url.searchParams.set('platform', platform);
    const res = await fetch(url.toString(), { method: 'GET' });
    return res.json();
  }

  /** POST /api/social/sentiment – analyze sentiment via social_sentiment skill. Gate by personal vertical. */
  async socialSentiment(content: string): Promise<{ result: string }> {
    const base = this.getBridgeBaseUrl();
    const res = await fetch(`${base}/api/social/sentiment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    return res.json();
  }

  /** POST /api/email/track – log email event via track_email skill. Gate by personal vertical. */
  async emailTrack(payload: { action: string; subject: string; summary: string; sender?: string; recipient?: string }): Promise<{ success: boolean; message?: string }> {
    const base = this.getBridgeBaseUrl();
    const res = await fetch(`${base}/api/email/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  }

  /** GET /api/email/history – query email history via query_email_history skill. Gate by personal vertical. */
  async emailHistory(periodDays: number = 30, keyword?: string, sender?: string): Promise<{ history: string }> {
    const base = this.getBridgeBaseUrl();
    const url = new URL(`${base}/api/email/history`);
    url.searchParams.set('period_days', String(periodDays));
    if (keyword) url.searchParams.set('keyword', keyword);
    if (sender) url.searchParams.set('sender', sender);
    const res = await fetch(url.toString(), { method: 'GET' });
    return res.json();
  }

  /** POST /api/email/draft – generate draft via email_draft skill (log-only). Gate by personal vertical. */
  async emailDraft(recipient: string, subject: string, body: string): Promise<{ success: boolean; message?: string }> {
    const base = this.getBridgeBaseUrl();
    const res = await fetch(`${base}/api/email/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient, subject, body }),
    });
    return res.json();
  }

  /** POST /api/calendar/track – log calendar event via track_calendar_event skill. Gate by personal vertical. */
  async calendarTrack(payload: { title: string; start_time: string; end_time: string; description?: string; location?: string; recurring?: string; reminder_minutes?: number }): Promise<{ success: boolean; message?: string }> {
    const base = this.getBridgeBaseUrl();
    const res = await fetch(`${base}/api/calendar/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  }

  /** Search kb_calendar for recent events (uses existing /api/search with kb_name=kb_calendar). */
  async calendarSearch(query: string): Promise<{ hits?: Array<{ content?: string; score?: number; metadata?: Record<string, unknown> }> }> {
    return this.kbSearch(query, 'kb_calendar');
  }

  /** POST /api/config – push config overrides to bridge (requires PAGI_ALLOW_UI_CONFIG_OVERRIDE=true). Used by Settings sovereign section. */
  async pushConfig(overrides: Record<string, string | boolean>): Promise<{ success: boolean; applied?: Record<string, string> }> {
    const base = this.getBridgeBaseUrl();
    const res = await fetch(`${base}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overrides }),
    });
    return res.json();
  }

  private getConfig() {
    const saved = localStorage.getItem('phoenix_config');
    return saved ? JSON.parse(saved) : {};
  }
}

export const pagiBridge = new PagiBridgeService();
