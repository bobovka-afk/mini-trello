-- Rename columns to snake_case (Prisma @map) — были camelCase из прошлых миграций

-- User
ALTER TABLE "User" RENAME COLUMN "emailVerifiedAt" TO "email_verified_at";
ALTER TABLE "User" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "User" RENAME COLUMN "updatedAt" TO "updated_at";

-- AuthToken
ALTER TABLE "AuthToken" RENAME COLUMN "userId" TO "user_id";
ALTER TABLE "AuthToken" RENAME COLUMN "tokenHash" TO "token_hash";
ALTER TABLE "AuthToken" RENAME COLUMN "expiresAt" TO "expires_at";
ALTER TABLE "AuthToken" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "AuthToken" RENAME COLUMN "usedAt" TO "used_at";

-- Workspace
ALTER TABLE "Workspace" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "Workspace" RENAME COLUMN "updatedAt" TO "updated_at";

-- WorkspaceMember
ALTER TABLE "WorkspaceMember" RENAME COLUMN "workspaceId" TO "workspace_id";
ALTER TABLE "WorkspaceMember" RENAME COLUMN "userId" TO "user_id";
ALTER TABLE "WorkspaceMember" RENAME COLUMN "createdAt" TO "created_at";

-- WorkspaceInvite
ALTER TABLE "WorkspaceInvite" RENAME COLUMN "workspaceId" TO "workspace_id";
ALTER TABLE "WorkspaceInvite" RENAME COLUMN "invitedByUserId" TO "invited_by_user_id";
ALTER TABLE "WorkspaceInvite" RENAME COLUMN "tokenHash" TO "token_hash";
ALTER TABLE "WorkspaceInvite" RENAME COLUMN "expiresAt" TO "expires_at";
ALTER TABLE "WorkspaceInvite" RENAME COLUMN "usedAt" TO "used_at";
ALTER TABLE "WorkspaceInvite" RENAME COLUMN "createdAt" TO "created_at";

-- Board
ALTER TABLE "Board" RENAME COLUMN "workspaceId" TO "workspace_id";
ALTER TABLE "Board" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "Board" RENAME COLUMN "updatedAt" TO "updated_at";

-- List
ALTER TABLE "List" RENAME COLUMN "boardId" TO "board_id";
ALTER TABLE "List" RENAME COLUMN "colorPreset" TO "color_preset";
ALTER TABLE "List" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "List" RENAME COLUMN "updatedAt" TO "updated_at";

-- Card
ALTER TABLE "Card" RENAME COLUMN "listId" TO "list_id";
ALTER TABLE "Card" RENAME COLUMN "dueDate" TO "due_date";
ALTER TABLE "Card" RENAME COLUMN "assigneeId" TO "assignee_id";
ALTER TABLE "Card" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "Card" RENAME COLUMN "updatedAt" TO "updated_at";

-- Флаг «выполнена» (если колонки ещё не было)
ALTER TABLE "Card" ADD COLUMN IF NOT EXISTS "is_completed" BOOLEAN NOT NULL DEFAULT false;

-- Comment
CREATE TABLE "Comment" (
    "id" SERIAL NOT NULL,
    "card_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Comment_card_id_idx" ON "Comment"("card_id");
CREATE INDEX "Comment_user_id_idx" ON "Comment"("user_id");

ALTER TABLE "Comment" ADD CONSTRAINT "Comment_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
