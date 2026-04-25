import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getEnvConfig, type Environment } from "./env";

export type { Environment };

let currentEnv: Environment = "main";
let client: SupabaseClient | null = null;

export function getSupabaseClient(env?: Environment): SupabaseClient {
  const targetEnv = env || currentEnv;
  if (!client || targetEnv !== currentEnv) {
    currentEnv = targetEnv;
    const config = getEnvConfig(targetEnv);
    // Use service key if available (bypasses RLS for admin reads)
    // Falls back to anon key
    const key = config.serviceKey || config.anonKey;
    client = createClient(config.url, key);
  }
  return client;
}

export function switchEnvironment(env: Environment): SupabaseClient {
  client = null;
  return getSupabaseClient(env);
}

export function getCurrentEnvironment(): Environment {
  return currentEnv;
}

export function getEnvironmentConfig(env?: Environment) {
  return getEnvConfig(env || currentEnv);
}

export async function fetchView<T = Record<string, unknown>>(
  viewName: string,
  options?: {
    select?: string;
    limit?: number;
    offset?: number;
    order?: { column: string; ascending?: boolean };
    filters?: Array<{ column: string; operator: string; value: unknown }>;
  }
): Promise<T[]> {
  const supabase = getSupabaseClient();
  let query = supabase
    .from(viewName)
    .select(options?.select || "*");

  if (options?.filters) {
    for (const filter of options.filters) {
      query = query.filter(filter.column, filter.operator, filter.value);
    }
  }

  if (options?.order) {
    query = query.order(options.order.column, {
      ascending: options.order.ascending ?? false,
    });
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(
      options.offset,
      options.offset + (options?.limit || 50) - 1
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error(`Error fetching ${viewName}:`, error);
    throw error;
  }

  return (data as T[]) || [];
}

export async function callEdgeFunction<T = unknown>(
  functionName: string,
  body?: Record<string, unknown>
): Promise<T> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke(functionName, {
    body,
  });

  if (error) {
    console.error(`Edge function error (${functionName}):`, error);
    throw error;
  }

  return data as T;
}
