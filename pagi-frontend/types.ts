export enum View {
  CHAT = 'chat',
  PROJECTS = 'projects',
  REGISTRY = 'registry',
  SETTINGS = 'settings'
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  id: string;
}

export interface ProjectContext {
  id: string;
  title: string;
  description: string;
  isActive: boolean;
  category?: string;
}

export interface TelemetryRow {
  name: string;
  version: string;
  type: 'Knowledge Base' | 'Skill' | 'Agent' | 'Logic Engine';
  status: 'online' | 'optimizing' | 'offline';
  latency: string;
  lastPatch: string;
}

/**
 * PAGI Core Sola - Backend/Frontend Synchronization Contract v1.0.0
 */

export type KnowledgeBaseName = 'kb_core' | 'kb_skills' | 'kb_1' | 'kb_2' | 'kb_3' | 'kb_4' | 'kb_5' | 'kb_6';

export const KNOWLEDGE_BASE_NAMES: KnowledgeBaseName[] = [
  'kb_core', 'kb_skills', 'kb_1', 'kb_2', 'kb_3', 'kb_4', 'kb_5', 'kb_6'
];

export type MemoryLayer = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface MemoryAccessRequest {
  layer: MemoryLayer;
  key: string;
  operation: 'read' | 'write' | 'delete';
  payload?: any;
}

export interface MemoryAccessResponse {
  success: boolean;
  layer: MemoryLayer;
  data?: any;
  latency_ms: number;
}

export interface SearchHit {
  kb: KnowledgeBaseName;
  content: string;
  score: number;
  metadata: Record<string, any>;
}

export interface SearchRequest {
  query: string;
  top_k: number;
  targets: KnowledgeBaseName[];
}

export interface SearchResponse {
  hits: SearchHit[];
  latency_ms: number;
}

export type AgentEventKind = 
  | 'session_started'
  | 'thought'
  | 'action_planned'
  | 'action_started'
  | 'action_completed'
  | 'memory_read'
  | 'memory_written'
  | 'search_issued'
  | 'search_result'
  | 'converged'
  | 'error'
  | 'session_ended';

export interface AgentEvent {
  kind: AgentEventKind;
  reasoning_id: string;
  timestamp: string;
  payload: any;
}
