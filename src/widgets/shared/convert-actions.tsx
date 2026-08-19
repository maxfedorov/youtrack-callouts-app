/**
 * The manual commands, shared by the issue and the article menu widgets.
 *
 * `Render` converts the callout syntax now and opts this entity back into automatic conversion.
 * `Revert` restores the markdown stashed beside each generated panel and switches automatic
 * conversion off for this entity — without that second half the next save would immediately undo
 * the revert.
 */

import React, {memo, useCallback, useEffect, useRef, useState} from 'react';
import Button from '@jetbrains/ring-ui-built/components/button/button';
import ButtonSet from '@jetbrains/ring-ui-built/components/button-set/button-set';
import Text from '@jetbrains/ring-ui-built/components/text/text';
import {reloadHostPage, reportHeight} from './host-utils';

export type ConvertMode = 'render' | 'revert';

interface ConvertOutcome {
  changed: boolean;
  count: number;
  disabled: boolean;
  error?: string;
}

interface Props {
  entityLabel: string;
  run: (mode: ConvertMode) => Promise<ConvertOutcome>;
  notify: (message: string, type?: string) => void;
  /** Passed in so the popup can shrink to the content instead of keeping its declared height. */
  host: {reportWidgetSize?: (size: {width: number; height: number}) => void};
}

function describe(mode: ConvertMode, outcome: ConvertOutcome, entityLabel: string): string {
  const noun = outcome.count === 1 ? 'callout' : 'callouts';
  if (mode === 'render') {
    return outcome.changed
      ? `Rendered ${outcome.count} ${noun}`
      : 'No callout syntax found to render';
  }
  const head = outcome.changed
    ? `Reverted ${outcome.count} ${noun} to source`
    : 'Nothing to revert';
  return `${head}. Automatic rendering is now off for this ${entityLabel}.`;
}

const ConvertActionsComponent: React.FunctionComponent<Props> = ({entityLabel, run, notify, host}) => {
  const [busy, setBusy] = useState<ConvertMode | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => reportHeight(host as never, rootRef.current));

  const execute = useCallback(
    async (mode: ConvertMode) => {
      setBusy(mode);
      try {
        const outcome = await run(mode);
        if (outcome.error) {
          notify(outcome.error, 'error');
          return;
        }
        notify(describe(mode, outcome, entityLabel), outcome.changed ? 'success' : 'message');
        if (outcome.changed) {
          reloadHostPage();
        }
      } catch (error) {
        notify(error instanceof Error ? error.message : 'Callout conversion failed', 'error');
      } finally {
        setBusy(null);
      }
    },
    [run, notify, entityLabel],
  );

  return (
    <div className="widget" ref={rootRef}>
      <Text info className="hint">
        {`Turn "> [!NOTE]" blocks in this ${entityLabel} into highlighted panels. Reverting restores the original markdown and stops converting this ${entityLabel} until you render again.`}
      </Text>
      <ButtonSet>
        <Button
          primary
          loader={busy === 'render'}
          disabled={busy !== null}
          onClick={() => execute('render')}
        >
          {'Render callouts'}
        </Button>
        <Button loader={busy === 'revert'} disabled={busy !== null} onClick={() => execute('revert')}>
          {'Revert to source'}
        </Button>
      </ButtonSet>
    </div>
  );
};

export const ConvertActions = memo(ConvertActionsComponent);
