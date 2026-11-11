// Reuse the local TUI's identity selection without claiming terminal capabilities.
export async function createEveClient(adapter, serverUrl, headers) {
  const [{ Client }, { resolveLocalDevelopmentClientOptions }, { resolveLinkedDevelopmentOidcToken }] =
    await Promise.all([
      adapter.internal('client/index.js'),
      adapter.internal('services/dev-client/client-options.js'),
      adapter.internal('services/dev-client/request-headers.js'),
    ]);
  return new Client(resolveLocalDevelopmentClientOptions({
    serverUrl,
    headers,
    token: () => resolveLinkedDevelopmentOidcToken(adapter.environmentRoot ?? adapter.project),
  }));
}
