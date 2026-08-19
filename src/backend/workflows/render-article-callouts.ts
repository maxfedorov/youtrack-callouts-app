/**
 * Renders callout blocks in a knowledge base article whenever its content changes.
 *
 * Articles have no `becomesReported` equivalent, so the guard keys off `content` alone.
 */

import {Article} from '@jetbrains/youtrack-scripting-api/entities';
import {requirements} from '../requirements';
import {isDisabled, renderForProject} from '../utils/apply';

export const rule = Article.onChange({
  title: 'Render callouts in article content',
  guard: (ctx) =>
    !isDisabled(ctx.article?.extensionProperties?.calloutsDisabled) &&
    Boolean(ctx.article?.isChanged('content')),
  action: (ctx) => {
    const article = ctx.article;
    const content = article.content;
    if (!content) {
      return;
    }
    try {
      const {result, autoConvert} = renderForProject(
        content,
        article.project?.extensionProperties?.calloutTypes,
      );
      if (autoConvert && result.changed) {
        article.content = result.text;
      }
    } catch (e) {
      console.warn('[callouts] article render skipped:', (e as Error)?.message);
    }
  },
  requirements,
});
