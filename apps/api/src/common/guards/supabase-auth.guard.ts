import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../supabase/supabase.service';
import type { AppConfig } from '../../config/configuration';
import type { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  email: string;
  jwt: string;
}

export interface AuthedRequest extends Request {
  user: AuthenticatedUser;
}

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    const jwt = header.slice('Bearer '.length).trim();
    if (!jwt) throw new UnauthorizedException('Empty bearer token');

    // Supabase validates the JWT and returns the user. This is one round-trip
    // per request; if it becomes hot, swap for jose.verify against
    // SUPABASE_JWT_SECRET.
    const { data, error } = await this.supabase.anon().auth.getUser(jwt);
    if (error || !data.user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    req.user = {
      id: data.user.id,
      email: data.user.email ?? '',
      jwt,
    };
    return true;
  }
}
