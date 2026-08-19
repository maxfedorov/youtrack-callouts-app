/**
 * Renders callout blocks in an issue description whenever the description changes.
 *
 * The guard mirrors JetBrains' own "Import from Pastebin" sample rule: fire on a newly reported
 * issue, or on an existing one whose description was edited. Field-only changes are ignored so the
 * rule does no work on the overwhelming majority of updates.
 */

import {Issue} from '@jetbrains/youtrack-scripting-api/entities';
import {requirements} from '../requirements';
import {isDisabled, renderForProject} from '../utils/apply';

export const rule = Issue.onChange({
  title: 'Render callouts in issue description',
  guard: (ctx) => {
    const issue = ctx.issue;
    if (isDisabled(issue.extensionProperties?.calloutsDisabled)) {
      return false;
    }
    return Boolean(issue.becomesReported || (issue.isReported && issue.isChanged('description')));
  },
  action: (ctx) => {
    const issue = ctx.issue;
    const description = issue.description;
    if (!description) {
      return;
    }
    try {
      const {result, autoConvert} = renderForProject(
        description,
        issue.project?.extensionProperties?.calloutTypes,
      );
      if (autoConvert && result.changed) {
        issue.description = result.text;
      }
    } catch (e) {
      // Never block the user's save because of this app.
      console.warn('[callouts] issue render skipped:', (e as Error)?.message);
    }
  },
  requirements,
});
