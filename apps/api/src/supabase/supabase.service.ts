import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import type { AppConfig } from '../config/configuration';

@Injectable()
export class SupabaseService {
  private readonly serviceRoleClient: SupabaseClient;
  private readonly anonClient: SupabaseClient;

  constructor(private readonly config: ConfigService<AppConfig, true>) {
    const url = this.config.get('SUPABASE_URL', { infer: true });
    const serviceKey = this.config.get('SUPABASE_SERVICE_ROLE_KEY', { infer: true });
    const anonKey = this.config.get('SUPABASE_ANON_KEY', { infer: true });

    this.serviceRoleClient = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    this.anonClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  /** Service-role client. Bypasses RLS — use only for worker jobs and trusted server code. */
  admin(): SupabaseClient {
    return this.serviceRoleClient;
  }

  /** Anon client + a user JWT — RLS applies as that user. */
  asUser(jwt: string): SupabaseClient {
    return createClient(
      this.config.get('SUPABASE_URL', { infer: true }),
      this.config.get('SUPABASE_ANON_KEY', { infer: true }),
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${jwt}` } },
      },
    );
  }

  anon(): SupabaseClient {
    return this.anonClient;
  }
}
