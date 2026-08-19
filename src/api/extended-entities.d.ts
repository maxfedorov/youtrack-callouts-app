import type { Article, Issue, Project } from '@jetbrains/youtrack-workflow-types/workflowTypeScriptStubs';

/**
 * App-specific extension properties for Project
 */
export type ProjectExtensionProperties = {
  calloutTypes?: string;
};

/**
 * Extended Project with app-specific extension properties
 */
export type ExtendedProject = Omit<Project, 'extensionProperties'> & {
  extensionProperties: ProjectExtensionProperties;
};

/**
 * App-specific extension properties for Issue
 */
export type IssueExtensionProperties = {
  calloutsDisabled?: string;
};

/**
 * Extended Issue with app-specific extension properties
 */
export type ExtendedIssue = Omit<Issue, 'extensionProperties'> & {
  extensionProperties: IssueExtensionProperties;
};

/**
 * App-specific extension properties for Article
 */
export type ArticleExtensionProperties = {
  calloutsDisabled?: string;
};

/**
 * Extended Article with app-specific extension properties
 */
export type ExtendedArticle = Omit<Article, 'extensionProperties'> & {
  extensionProperties: ArticleExtensionProperties;
};

declare module '@jetbrains/youtrack-workflow-types/workflowTypeScriptStubs' {
  interface ExtensionPropertiesRegistry {
    Article: ArticleExtensionProperties;
    Issue: IssueExtensionProperties;
    Project: ProjectExtensionProperties;
  }
}

/**
 * Map of entity types to their extended versions
 * Extended types have extension properties, others are 'never'
 */
export type ExtendedProperties = {
  Issue: ExtendedIssue;
  Project: ExtendedProject;
  Article: ExtendedArticle;
  User: never;
  AppGlobalStorage: never;
};