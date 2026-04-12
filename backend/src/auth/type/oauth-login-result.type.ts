import type { User } from '../../generated/prisma/client';
import type { AuthTokens } from '../interface';

export type OAuthLoginResult = { user: User } & AuthTokens;
