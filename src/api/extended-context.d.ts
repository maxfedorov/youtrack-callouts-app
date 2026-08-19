import type { ExtendedArticle, ExtendedIssue, ExtendedProject } from './extended-entities.js';

/**
 * Issue context with extended entity (includes extension properties)
 */
export type ExtendedIssueCtx<T extends import('@jetbrains/youtrack-apps-tools/dx').IssueCtx> =
  Omit<T, 'issue'> & { issue: ExtendedIssue };

/**
 * Project context with extended entity (includes extension properties)
 */
export type ExtendedProjectCtx<T extends import('@jetbrains/youtrack-apps-tools/dx').ProjectCtx> =
  Omit<T, 'project'> & { project: ExtendedProject };

/**
 * Article context with extended entity (includes extension properties)
 */
export type ExtendedArticleCtx<T extends import('@jetbrains/youtrack-apps-tools/dx').ArticleCtx> =
  Omit<T, 'article'> & { article: ExtendedArticle };


