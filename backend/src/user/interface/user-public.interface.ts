export interface UserPublic {
  id: number;
  email: string;
  name: string;
  avatarPath: string | null;
  createdAt: Date;
}
