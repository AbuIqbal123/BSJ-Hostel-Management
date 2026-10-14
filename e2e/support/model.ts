import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { grok } from 'e2e/oauth/grok';

/**
 * The model for `agent` steps. No API keys: SuperGrok through
 * `npx e2e login spacexai` (default), or a local Ollama model with
 * BSJ_E2E_MODEL=ollama:<model id>, e.g. ollama:qwen3:8b.
 */
export function agentModel() {
  const choice = process.env.BSJ_E2E_MODEL ?? 'grok';
  if (choice.startsWith('ollama:')) {
    const local = createOpenAICompatible({
      name: 'ollama',
      baseURL: process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434/v1',
      supportsStructuredOutputs: true,
    });
    return local.chatModel(choice.slice('ollama:'.length));
  }
  return grok(choice === 'grok' ? 'grok-4' : choice);
}
