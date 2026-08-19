/**
 * Authorization helpers.
 *
 * Extension endpoints are reached through an entity URL, so YouTrack only checks that the caller
 * may *read* that entity. Writes performed inside a handler run with the app's rights and are not
 * checked against the caller, which makes these checks the actual security boundary.
 */

interface PermissionHolder {
  hasPermission: (permission: string, project?: unknown) => boolean;
  ringId?: string;
  login?: string;
}

interface ArticleLike {
  author?: {ringId?: string; login?: string};
  project?: unknown;
}

/**
 * Mirrors YouTrack's own rule for articles: an update "requires Create Article permission for the
 * article's reporter and Update Article permission otherwise".
 *
 * Two traps this avoids. `user.id` is undefined in handler contexts, so authorship has to be
 * compared on `ringId` or `login` and only when the field is actually set — otherwise `undefined
 * === undefined` makes every caller the author. And an absent project must not fall through the
 * guard: a draft with no project yet is reached only through the caller's own drafts URL, so
 * authorship alone is sufficient there, while an unknown project on a published article is denied.
 */
export function canWriteArticle(user: PermissionHolder, article: ArticleLike): boolean {
  const author = article.author;
  const isAuthor = Boolean(
    author &&
      ((author.ringId && author.ringId === user.ringId) ||
        (author.login && author.login === user.login)),
  );

  if (!article.project) {
    return isAuthor;
  }
  return (
    user.hasPermission('UPDATE_ARTICLE', article.project) ||
    (isAuthor && user.hasPermission('CREATE_ARTICLE', article.project))
  );
}
