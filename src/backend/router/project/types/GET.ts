import {parseRegistry, BUILTIN_TYPES} from '@/common/callouts/types';

/**
 * @zod-to-schema
 */
export type ProjectTypesGETReq = {
  projectId: string;
};

/**
 * @zod-to-schema
 */
export type ProjectTypesGETRes = {
  autoConvert: boolean;
  types: Array<{
    key: string;
    title: string;
    accent: string;
    background: string;
    icon: string;
    enabled: boolean;
  }>;
  builtinKeys: string[];
};

/**
 * Readable by anyone who can read the project: the callout widget needs the palette to render a
 * panel for an ordinary reader. Nothing here is sensitive — writing is what is gated, in POST.
 */
export default function handle(ctx: CtxGet<ProjectTypesGETRes, ProjectTypesGETReq, 'project'>): void {
  const registry = parseRegistry(ctx.project.extensionProperties.calloutTypes);
  ctx.response.json({
    autoConvert: registry.autoConvert,
    types: registry.types,
    builtinKeys: BUILTIN_TYPES.map((type) => type.key),
  });
}

export type Handle = typeof handle;
