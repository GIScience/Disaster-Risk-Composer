/**
 * Detects whether the app is running inside an iframe on another page
 * (e.g. the HDX embed), as opposed to being opened directly.
 */
export function useIsEmbedded(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}
