import { z } from 'zod';

// ---- Plugin System ----

export interface Plugin {
  name: string;
  description: string;
  version: string;
  actions: Action[];
  auth?: AuthConfig;
  setup?: () => Promise<void>;
  teardown?: () => Promise<void>;
}

export interface Action {
  name: string;
  description: string;
  parameters: z.ZodType<any>;
  execute: (params: any, context: ActionContext) => Promise<ActionResult>;
  confirm?: boolean;
}

export interface ActionResult {
  success: boolean;
  data?: any;
  message: string;
  followUp?: string;
}

export interface ActionContext {
  session: Session;
  auth?: Record<string, string>;
  ask: (question: string) => Promise<string>;
}

// ---- Auth ----

export interface AuthConfig {
  type: 'api_key' | 'oauth2' | 'custom';
  fields: AuthField[];
}

export interface AuthField {
  name: string;
  description: string;
  required: boolean;
  secret?: boolean;
}

// ---- Session / Conversation ----

export interface Session {
  id: string;
  messages: Message[];
  metadata: Record<string, any>;
}

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  pluginName: string;
  actionName: string;
  parameters: Record<string, any>;
}

export interface ToolResult {
  toolCallId: string;
  result: ActionResult;
}

// ---- LLM Provider ----

export interface LLMProvider {
  name: string;
  chat(messages: Message[], tools: LLMTool[]): Promise<LLMResponse>;
}

export interface LLMTool {
  name: string;
  description: string;
  parameters: Record<string, any>; // JSON Schema
}

export interface LLMResponse {
  text?: string;
  toolCalls?: ToolCall[];
}

// ---- Engine Config ----

export interface AgentBridgeConfig {
  llmProvider: LLMProvider;
  plugins?: Plugin[];
  systemPrompt?: string;
  /** Max number of tool definitions sent to the model per turn. */
  maxToolsPerTurn?: number;
}
