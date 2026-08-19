import {findTypeProblem, parseRegistry, serializeRegistry} from '@/common/callouts/types';

/**
 * @zod-to-schema
 */
export type ProjectTypesPOSTReq = {
  projectId: string;
};

/**
 * @zod-to-schema
 */
export type ProjectTypesPOSTBody = {
  autoConvert: boolean;
  types: Array<{
    key: string;
    title: string;
    accent: string;
    background: string;
    icon: string;
    enabled: boolean;
  }>;
};

/**
 * @zod-to-schema
 */
export type ProjectTypesPOSTRes = {
  saved: boolean;
  error?: string;
};

export default function handle(
  ctx: CtxPost<ProjectTypesPOSTBody, ProjectTypesPOSTRes, ProjectTypesPOSTReq, 'project'>,
): void {
  // Extension endpoints run with the app's rights, not the caller's, so this check is the only
  // thing standing between a read-only user and rewriting project configuration.
  if (!ctx.currentUser.hasPermission('UPDATE_PROJECT', ctx.project)) {
    ctx.response.code = 403;
    ctx.response.json({saved: false, error: 'Update project permission is required'});
    return;
  }

  const body = ctx.request.json();
  // Rejected rather than quietly cleaned: storing something other than what was sent would hide
  // both client bugs and deliberate probing. The read and render paths still repair whatever they
  // find, because they also serve data this endpoint never saw.
  const problem = findTypeProblem(body?.types);
  if (problem) {
    ctx.response.code = 400;
    ctx.response.json({saved: false, error: problem});
    return;
  }

  ctx.project.extensionProperties.calloutTypes = serializeRegistry(
    parseRegistry(JSON.stringify(body)),
  );
  ctx.response.json({saved: true});
}

export type Handle = typeof handle;
