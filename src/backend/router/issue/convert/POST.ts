import {DISABLED, isDisabled, renderForProject, revert} from '../../../utils/apply';

/**
 * @zod-to-schema
 */
export type IssueConvertReq = {
  issueId: string;
};

/**
 * @zod-to-schema
 */
export type IssueConvertBody = {
  mode: 'render' | 'revert';
};

/**
 * @zod-to-schema
 */
export type IssueConvertRes = {
  changed: boolean;
  count: number;
  /** True while automatic rendering is switched off for this issue. */
  disabled: boolean;
  error?: string;
};

export default function handle(
  ctx: CtxPost<IssueConvertBody, IssueConvertRes, IssueConvertReq, 'issue'>,
): void {
  if (!ctx.currentUser.hasPermission('UPDATE_ISSUE', ctx.project)) {
    ctx.response.code = 403;
    ctx.response.json({
      changed: false,
      count: 0,
      disabled: isDisabled(ctx.issue.extensionProperties.calloutsDisabled),
      error: 'Update issue permission is required',
    });
    return;
  }

  const revertMode = ctx.request.json().mode === 'revert';
  const description = ctx.issue.description ?? '';
  const outcome = revertMode
    ? revert(description)
    : renderForProject(description, ctx.project.extensionProperties.calloutTypes).result;

  // Reverting also stops the rule from converting this issue again, otherwise the very next save
  // would undo the revert. Rendering explicitly opts the issue back in.
  ctx.issue.extensionProperties.calloutsDisabled = revertMode ? DISABLED : '';
  if (outcome.changed) {
    ctx.issue.description = outcome.text;
  }
  ctx.response.json({changed: outcome.changed, count: outcome.count, disabled: revertMode});
}

export type Handle = typeof handle;
