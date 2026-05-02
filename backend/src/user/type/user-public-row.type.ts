import type { User } from '../../generated/prisma/client';

export type UserPublicRow = Pick<
  User,
  'id' | 'email' | 'name' | 'avatarPath' | 'passwordHash' | 'createdAt'
>;
