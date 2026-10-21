import { ref, watch } from "vue";
import type { Ref } from "vue";

/**
 * Checks once per page load whether an external address still works, so a source can be
 * shown as a link while it does and as plain text when it doesn't (e.g. a provider moved the
 * page). Only works for sites that let browsers read the response (CORS); for others the
 * check fails and the text stays plain.
 */
const cache = new Map<string, Promise<boolean>>();
const TIMEOUT_MS = 8000;

// A plain GET: some servers (e.g. NOAA) drop HEAD requests from browsers entirely.
async function request(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { cache: "no-store", redirect: "follow", signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function check(url: string): Promise<boolean> {
  if (!cache.has(url)) {
    cache.set(
      url,
      (async () => {
        try {
          return (await request(url)).ok;
        } catch {
          return false; // network error, timeout, or the site doesn't allow the check (CORS)
        }
      })(),
    );
  }
  return cache.get(url)!;
}

/** `true` once the address has answered successfully; stays `false` until then. */
export function useLinkCheck(url: () => string | undefined): Ref<boolean> {
  const ok = ref(false);
  watch(
    url,
    async (u) => {
      ok.value = false;
      if (!u) return;
      const result = await check(u);
      if (url() === u) ok.value = result;
    },
    { immediate: true },
  );
  return ok;
}
