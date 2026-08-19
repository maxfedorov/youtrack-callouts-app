/**
 * Glue between stored project configuration and the text transform, shared by the workflow rules
 * and the manual HTTP handlers so both behave identically.
 */

import {indexEnabled, parseRegistry} from '@/common/callouts/types';
import type {ConvertResult} from '@/common/callouts/convert';
import {renderCallouts, revertCallouts} from '@/common/callouts/convert';

export interface RenderOutcome {
  result: ConvertResult;
  /** False when an admin turned the automatic rewrite off for this project. */
  autoConvert: boolean;
}

export function renderForProject(text: string, registryJson?: string | null): RenderOutcome {
  const registry = parseRegistry(registryJson);
  return {
    result: renderCallouts(text ?? '', indexEnabled(registry.types)),
    autoConvert: registry.autoConvert,
  };
}

export function revert(text: string): ConvertResult {
  return revertCallouts(text ?? '');
}

/** Flag value stored on an issue or article to keep the rule away from it. */
export const DISABLED = 'true';

export function isDisabled(flag?: string | null): boolean {
  return flag === DISABLED;
}
