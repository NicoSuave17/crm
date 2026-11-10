import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "./helpers";
import { checkPermission, getRecordScope, getTeamMemberIds } from "./permissions";
import type { PermissionAction } from "./permissions";

interface PermissionContext {
  user: Awaited<ReturnType<typeof requireUser>>;
  scope: "all" | "own" | "team";
  teamMemberIds?: string[];
}

interface DetailPermissionContext extends PermissionContext {
  params: Record<string, string>;
}

type HandlerFn = (
  request: NextRequest,
  context: PermissionContext
) => Promise<NextResponse>;

type DetailHandlerFn = (
  request: NextRequest,
  context: DetailPermissionContext
) => Promise<NextResponse>;

/**
 * Wraps an API route handler with permission checking.
 * Returns 401 if not authenticated, 403 if not authorized.
 * Passes the user and their record scope to the handler.
 */
export function withPermission(
  entityType: string,
  action: PermissionAction,
  handler: HandlerFn
) {
  return async (request: NextRequest) => {
    try {
      const user = await requireUser();

      const allowed = await checkPermission(user.role, entityType, action);
      if (!allowed) {
        return NextResponse.json(
          { error: "You don't have permission to perform this action" },
          { status: 403 }
        );
      }

      const scope = await getRecordScope(user.role, entityType);
      let teamMemberIds: string[] | undefined;
      if (scope === "team") {
        teamMemberIds = await getTeamMemberIds(user.id);
      }

      return handler(request, { user, scope, teamMemberIds });
    } catch (error) {
      if (error instanceof Error && error.message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      console.error(`Permission check failed for ${entityType}/${action}:`, error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  };
}

/**
 * Wraps an API [id] route handler with permission checking.
 * Same as withPermission but passes through Next.js route params.
 */
export function withDetailPermission(
  entityType: string,
  action: PermissionAction,
  handler: DetailHandlerFn
) {
  return async (
    request: NextRequest,
    { params: paramsPromise }: { params: Promise<Record<string, string>> }
  ) => {
    try {
      const user = await requireUser();

      const allowed = await checkPermission(user.role, entityType, action);
      if (!allowed) {
        return NextResponse.json(
          { error: "You don't have permission to perform this action" },
          { status: 403 }
        );
      }

      const scope = await getRecordScope(user.role, entityType);
      const params = await paramsPromise;
      let teamMemberIds: string[] | undefined;
      if (scope === "team") {
        teamMemberIds = await getTeamMemberIds(user.id);
      }

      return handler(request, { user, scope, params, teamMemberIds });
    } catch (error) {
      if (error instanceof Error && error.message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      console.error(`Permission check failed for ${entityType}/${action}:`, error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  };
}
