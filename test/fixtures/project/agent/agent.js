import { defineAgent } from 'eve';

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};
export default defineAgent({
  modelContextWindowTokens: 8192,
  model: {
    specificationVersion: 'v3',
    provider: 'even-contract',
    modelId: 'deterministic',
    supportedUrls: {},
    async doGenerate() {
      return {
        content: [{ type: 'text', text: 'Even fixture reply' }],
        finishReason: { unified: 'stop', raw: 'stop' },
        usage, warnings: [],
      };
    },
    async doStream() {
      return {
        stream: new ReadableStream({
          start(controller) {
            for (const event of [
              { type: 'stream-start', warnings: [] },
              { type: 'text-start', id: 'text' },
              { type: 'text-delta', id: 'text', delta: 'Even fixture reply' },
              { type: 'text-end', id: 'text' },
              { type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage },
            ]) controller.enqueue(event);
            controller.close();
          },
        }),
      };
    },
  },
});
