export const OFFLINE_LITE_PROVIDER = 'offline'
export const CODEX_CONNECTOR_PROVIDER = 'codex'

// Offline Lite can answer deterministic user requests, but it cannot perform the
// model-driven startup self-check or awakening exploration. Running those turns
// produces an endless-looking stream of no-op heartbeat activity in the UI.
export function getProviderRuntimePolicy(provider) {
  const offlineLite = String(provider || '').trim().toLowerCase() === OFFLINE_LITE_PROVIDER
  const codexConnector = String(provider || '').trim().toLowerCase() === CODEX_CONNECTOR_PROVIDER
  const interactiveOnly = offlineLite || codexConnector
  return {
    offlineLite,
    codexConnector,
    runImmediateStartupTick: !interactiveOnly,
    runStartupSelfCheck: !interactiveOnly,
    runAwakeningTicks: !interactiveOnly,
  }
}
