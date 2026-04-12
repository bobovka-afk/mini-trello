import type { UserPublic } from '../../user/interface';
import type { AuthTokens } from '../interface';

export type RefreshTokensResult = { user: UserPublic } & AuthTokens;
