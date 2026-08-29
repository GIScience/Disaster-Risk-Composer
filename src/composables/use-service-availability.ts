import { ref } from "vue";
import { checkDataSourceAvailable } from "@/services/dataService";

const SESSION_KEY = "gaia-data-source-available";

type ServiceStatus = "checking" | "available" | "unavailable";

function readSessionFlag(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function writeSessionFlag() {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    // Ignore - worst case we re-run the check next time.
  }
}

// Module-scoped singleton: the check only needs to run once per session,
// regardless of how many components call this composable.
const status = ref<ServiceStatus>(readSessionFlag() ? "available" : "checking");
const isRetrying = ref(false);

async function runCheck() {
  const ok = await checkDataSourceAvailable();
  if (ok) {
    writeSessionFlag();
    status.value = "available";
  } else {
    status.value = "unavailable";
  }
}

if (status.value === "checking") {
  runCheck();
}

async function retry() {
  isRetrying.value = true;
  try {
    await runCheck();
  } finally {
    isRetrying.value = false;
  }
}

export function useServiceAvailability() {
  return { status, isRetrying, retry };
}
