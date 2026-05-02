-- CreateEnum
CREATE TYPE "WorkspaceActivityType" AS ENUM (
  'WORKSPACE_CREATED',
  'WORKSPACE_UPDATED',
  'MEMBER_INVITED',
  'INVITE_CANCELLED',
  'INVITE_ACCEPTED',
  'INVITE_DECLINED',
  'MEMBER_REMOVED',
  'MEMBER_LEFT'
);

-- CreateTable
CREATE TABLE "WorkspaceActivity" (
    "id" SERIAL NOT NULL,
    "workspace_id" INTEGER NOT NULL,
    "actor_user_id" INTEGER NOT NULL,
    "type" "WorkspaceActivityType" NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkspaceActivity_workspace_id_created_at_idx" ON "WorkspaceActivity"("workspace_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "WorkspaceActivity" ADD CONSTRAINT "WorkspaceActivity_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceActivity" ADD CONSTRAINT "WorkspaceActivity_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
