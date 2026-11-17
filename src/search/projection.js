import { searchContent } from './content.js';
// Eve owns identity, deduplication and wrapper/execution pairing. This module
// projects their output into searchable values with the original source intact.
export const fold = (value) => String(value ?? '').toLowerCase();

export function projectTrace(agentId, traceId, rawSpans, helpers) {
  const spans = helpers.uniqueLocalTraceSpans(rawSpans);
  const byId = new Map(spans.map((span) => [span.spanId, span]));
  const canonical = helpers.localTraceOperations(spans);
  const operations = canonical
    .filter((op) => op.category === 'tool')
    .map(({ span }) => {
      const raw = byId.get(span.spanId);
      const wrapper = byId.get(raw?.parentSpanId);
      const paired =
        raw?.attributes['gen_ai.operation.name'] === 'execute_tool' &&
        wrapper?.name === 'agent.action' &&
        helpers.traceToolName(raw) === helpers.traceToolName(wrapper);
      return {
        spanId: span.spanId,
        name: span.name,
        tool: helpers.traceToolName(span),
        status: span.statusCode,
        toolSource: raw.attributes['gen_ai.tool.name']
          ? 'gen_ai.tool.name'
          : 'agent.action.name',
        statusSpanId:
          paired && wrapper.statusCode === 2 ? wrapper.spanId : span.spanId,
        sourceSpanIds: paired ? [span.spanId, wrapper.spanId] : [span.spanId],
      };
    });
  const opBySource = new Map(
    operations.flatMap((op) => op.sourceSpanIds.map((id) => [id, op]))
  );
  const documents = [];
  for (const span of spans) {
    const op = opBySource.get(span.spanId);
    const attributes = span.attributes;
    for (const [field, source] of [
      ['input', 'agent.channel.delivery.input'],
      ['context', 'gen_ai.input.messages'],
      ['output', 'gen_ai.tool.call.result'],
      ['arguments', 'gen_ai.tool.call.arguments'],
      ['reply', 'gen_ai.output.messages'],
    ]) {
      if (attributes[source] === undefined) continue;
      // Keep payload leaves separate: phrases must not cross message boundaries
      // or synthesize a match from adjacent unrelated JSON fields.
      for (const leaf of searchContent(
        attributes[source],
        '$',
        0,
        field === 'context' || field === 'reply'
      ))
        documents.push({
          ...leaf,
          field,
          source,
          spanId: span.spanId,
          operationSpanId: op?.spanId,
          operation: op?.name ?? span.name,
        });
    }
    if (span.statusMessage)
      documents.push({
        field: 'error',
        source: 'statusMessage',
        text: span.statusMessage,
        spanId: span.spanId,
        operationSpanId: op?.spanId,
        operation: op?.name ?? span.name,
      });
    for (const [eventIndex, event] of span.events.entries()) {
      for (const key of ['exception.message', 'exception.stacktrace']) {
        const text = event.attributes[key];
        if (typeof text === 'string')
          documents.push({
            field: 'error',
            source: `events[${eventIndex}].${key}`,
            text,
            spanId: span.spanId,
            operationSpanId: op?.spanId,
            operation: op?.name ?? span.name,
            eventIndex,
          });
      }
    }
  }
  const summary = { ...helpers.summarizeLocalTrace(traceId, spans), agentId };
  const title = spans
    .map((span) => span.attributes['agent.session.title'])
    .find((value) => typeof value === 'string' && value.length);
  const firstError = spans.find((span) => span.statusCode === 2);
  if (firstError)
    summary.firstError = { spanId: firstError.spanId, name: firstError.name };
  summary.label = (
    title ??
    spans.find((span) => !span.parentSpanId)?.name ??
    traceId
  ).slice(0, 256);
  const hasContent = documents.some((doc) => doc.field !== 'error');
  const policies = spans.flatMap((span) =>
    ['agent.trace.content.input', 'agent.trace.content.output'].map(
      (key) => span.attributes[key]
    )
  );
  summary.contentAvailability = hasContent
    ? 'captured'
    : policies.includes(false)
      ? 'not-recorded'
      : 'unknown';
  const names = [
    ['trace', traceId],
    ['label', summary.label],
    ['agent', agentId],
    ...summary.agentNames.map((name) => ['agent', name]),
    ...summary.sessionIds.map((id) => ['session', id]),
  ];
  return { summary, names, operations, documents };
}
