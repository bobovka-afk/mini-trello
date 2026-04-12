import type { AuthTokens, AuthUserSnippet } from '../interface';

export type LoginResult = { user: AuthUserSnippet } & AuthTokens;
