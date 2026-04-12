import type { UserBrief } from '../../common/interface';

export interface CommentWithUser {
  id: number;
  cardId: number;
  userId: number;
  body: string;
  createdAt: Date;
  updatedAt: Date;
  user: UserBrief;
}
