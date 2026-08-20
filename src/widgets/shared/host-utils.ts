/**
 * Small helpers shared by the widgets. Kept out of component files because the lint step runs with
 * `--max-warnings 0` and `react-refresh/only-export-components` fires on any module that exports
 * both a component and something else.
 */

import type {CalloutType} from '@/common/callouts/types';

interface MinimalHost {
  fetchYouTrack: <T = unknown>(url: string, params?: unknown) => Promise<T>;
  reportWidgetSize?: (size: {width: number; height: number}) => void;
}

/**
 * Resolves the project of the entity the widget is embedded in. A MARKDOWN widget only receives
 * `{id, type}`, so the project has to be fetched.
 */
export async function resolveProjectId(host: MinimalHost): Promise<string | null> {
  const entity = YTApp.entity;
  if (!entity?.id) {
    return null;
  }
  if (entity.type === 'project') {
    return entity.id;
  }
  const path = entity.type === 'article' ? 'articles' : 'issues';
  try {
    const result = await host.fetchYouTrack<{project?: {id?: string}}>(
      `${path}/${entity.id}?fields=project(id)`,
    );
    return result?.project?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Reports the rendered height to the host.
 *
 * Verified to have **no effect on a MARKDOWN widget**: its iframe is sized solely by the
 * `{width= height=}` attributes on the `![](widget:…)` placeholder, and a widget asking for 220px
 * stayed at the height written in the text. Kept for the menu widgets, where the popup is the host's
 * own container.
 */
export function reportHeight(host: MinimalHost, element: HTMLElement | null): void {
  if (!element || typeof host.reportWidgetSize !== 'function') {
    return;
  }
  const height = Math.ceil(element.getBoundingClientRect().height);
  if (height > 0) {
    host.reportWidgetSize({width: element.scrollWidth, height});
  }
}

/**
 * Navigates the parent frame back to the page the widget was opened from. Widgets cannot call
 * `window.parent.location.reload()` across origins, but they can assign a location, which is how a
 * menu action makes its change visible without the user refreshing by hand.
 */
export function reloadHostPage(): void {
  const target = document.referrer;
  if (target) {
    window.parent.location.href = target;
  }
}

export const EMPTY_BODY_HINT = 'Type the text that should appear inside the panel.';

/** The subset of a type the widget freezes into its own configuration. */
export type CalloutStyleSnapshot = Pick<
  CalloutType,
  'key' | 'title' | 'accent' | 'background' | 'icon'
>;

/**
 * Repairs a style snapshot on its way back out of the host's widget storage.
 *
 * An empty title does not survive that round trip: the widget writes `title: ""` for a heading-less
 * type, and what comes back has no `title` at all. The renderer reads a missing title as "not
 * supplied" and falls back to the built-in name, so a panel the author deliberately left bare grew a
 * "Note" heading the first time the issue was saved and the widget reloaded from storage. The
 * colours were unaffected, which is what pointed at the title fallback rather than at the config
 * being lost wholesale.
 *
 * Absence is therefore not ambiguous here the way it is in the project registry: the widget always
 * writes every field, so a title that is missing on read is one that was empty on write.
 */
export function restoreSnapshot<T extends CalloutStyleSnapshot>(stored: T): T {
  return {...stored, title: typeof stored.title === 'string' ? stored.title : ''};
}
