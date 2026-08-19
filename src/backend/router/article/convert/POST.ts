import {DISABLED, isDisabled, renderForProject, revert} from '../../../utils/apply';
import {canWriteArticle} from '../../../utils/auth';

/**
 * @zod-to-schema
 */
export type ArticleConvertReq = {
  articleId: string;
};

/**
 * @zod-to-schema
 */
export type ArticleConvertBody = {
  mode: 'render' | 'revert';
};

/**
 * @zod-to-schema
 */
export type ArticleConvertRes = {
  changed: boolean;
  count: number;
  /** True while automatic rendering is switched off for this article. */
  disabled: boolean;
  error?: string;
};

export default function handle(
  ctx: CtxPost<ArticleConvertBody, ArticleConvertRes, ArticleConvertReq, 'article'>,
): void {
  const article = ctx.article;
  if (!canWriteArticle(ctx.currentUser, article)) {
    ctx.response.code = 403;
    ctx.response.json({
      changed: false,
      count: 0,
      disabled: isDisabled(article.extensionProperties.calloutsDisabled),
      error: 'Update article permission is required',
    });
    return;
  }

  const revertMode = ctx.request.json().mode === 'revert';
  const content = article.content ?? '';
  const outcome = revertMode
    ? revert(content)
    : renderForProject(content, article.project?.extensionProperties?.calloutTypes).result;

  // Reverting also stops the rule from converting this article again, otherwise the very next save
  // would undo the revert. Rendering explicitly opts the article back in.
  article.extensionProperties.calloutsDisabled = revertMode ? DISABLED : '';
  if (outcome.changed) {
    article.content = outcome.text;
  }
  ctx.response.json({changed: outcome.changed, count: outcome.count, disabled: revertMode});
}

export type Handle = typeof handle;
