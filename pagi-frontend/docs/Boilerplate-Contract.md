# PAGI Core Sola: Boilerplate Contract (v1.0.0)

## 1. Scope
Single source of truth for the PAGI Core Sola (Sola) orchestrator interface.

## 2. Shared Constants
- **KnowledgeBaseName**: `kb_core | kb_skills | kb_1 | kb_2 | kb_3 | kb_4 | kb_5 | kb_6`
- **Memory Layers**: 1 (Transient) through 7 (Archive).
- **Contract Version**: 1.0.0

## 3. Data Shapes
- **SearchRequest**: `{ query: string, top_k: number, targets: KnowledgeBaseName[] }`
- **AgentEvent**: `{ kind: AgentEventKind, reasoning_id: string, timestamp: string, payload: any }`
- **ExecuteAction**: Request/Response pairs for tool use.

## 4. Sync Rules
Any architectural change must follow the 3-step synchronization rule:
1. Update this **Contract Document**.
2. Synchronize `contract/types.ts` (Frontend).
3. Update the **Mock Provider** logic.

## 5. Deployment
The desktop client defaults to `http://127.0.0.1:8001` for the bridge and `ws://127.0.0.1:8001/ws/agent` for the reasoning bus.
