export interface UserPublic {
  id: number;
  email: string;
  name: string;
  avatarPath: string | null;
  hasPassword: boolean;
  createdAt: Date;
}
