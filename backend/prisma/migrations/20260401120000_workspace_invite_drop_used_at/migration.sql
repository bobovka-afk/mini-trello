-- Drop unused column: invites are deleted on accept/decline/revoke instead of marking usedAt.
ALTER TABLE "WorkspaceInvite" DROP COLUMN IF EXISTS "used_at";
