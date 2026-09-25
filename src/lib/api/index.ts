import type { MarketingApi } from "./types";
import { MockApi } from "./mock-api";
import { HttpApi } from "./http-api";

export type { MarketingApi } from "./types";
export { ApiError } from "./types";

/**
 * Single entry point. Components never import this directly — they use hooks in /src/hooks,
 * which in turn call `api`. Switch implementation with NEXT_PUBLIC_USE_MOCKS (default: mocks).
 */
const useMocks = (process.env.NEXT_PUBLIC_USE_MOCKS ?? "true") !== "false";

let instance: MarketingApi | null = null;

export function getApi(): MarketingApi {
  if (!instance) instance = useMocks ? new MockApi() : new HttpApi();
  return instance;
}

export const api: MarketingApi = new Proxy({} as MarketingApi, {
  get(_t, prop: keyof MarketingApi) {
    const target = getApi();
    const value = target[prop];
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(target) : value;
  },
});
