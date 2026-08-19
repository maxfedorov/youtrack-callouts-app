/**
 * The configuration form for one inserted callout.
 *
 * It lives in its own component so that mounting it is what switches the host into config mode:
 * YouTrack then shows the widget in a roomy dialog instead of the small inline box the rendered
 * panel occupies. Unmounting returns the widget to its normal size. This mirrors how
 * `pocket-status-app` drives `enterConfigMode` / `exitConfigMode`.
 */

import React, {memo, useEffect, useState} from 'react';
import Button from '@jetbrains/ring-ui-built/components/button/button';
import ButtonSet from '@jetbrains/ring-ui-built/components/button-set/button-set';
import Input, {Size} from '@jetbrains/ring-ui-built/components/input/input';
import Text from '@jetbrains/ring-ui-built/components/text/text';
import type {CalloutType} from '@/common/callouts/types';
import {renderCalloutHtml} from '@/common/callouts/render';
import {EMPTY_BODY_HINT} from '../shared/host-utils';

interface Props {
  palette: CalloutType[];
  initialType: CalloutType;
  initialBody: string;
  canCancel: boolean;
  host: {enterConfigMode: () => void; exitConfigMode: () => void};
  onSave: (type: CalloutType, body: string) => Promise<void> | void;
  onCancel: () => void;
}

/**
 * Measured on a rendered panel: 10px padding top and bottom, and a 24px line box for the heading and
 * for each body line. A widget cannot resize itself — `reportWidgetSize` is ignored for MARKDOWN
 * widgets — so the best the form can do is tell the author the number to drag to.
 */
const PANEL_PADDING = 20;
const LINE_HEIGHT = 24;
const DEFAULT_HEIGHT = PANEL_PADDING + LINE_HEIGHT * 2;

function estimateHeight(body: string, hasHeading: boolean): number {
  const lines = body.split('\n').filter((line) => line.trim().length > 0).length || 1;
  return PANEL_PADDING + LINE_HEIGHT * (lines + (hasHeading ? 1 : 0));
}

const CalloutEditorComponent: React.FunctionComponent<Props> = ({
  palette,
  initialType,
  initialBody,
  canCancel,
  host,
  onSave,
  onCancel,
}) => {
  const [selected, setSelected] = useState<CalloutType>(initialType);
  const [body, setBody] = useState(initialBody);
  const [saving, setSaving] = useState(false);
  const neededHeight = estimateHeight(body, selected.title !== '');

  useEffect(() => {
    host.enterConfigMode();
    return () => host.exitConfigMode();
  }, [host]);

  const save = async (): Promise<void> => {
    setSaving(true);
    try {
      await onSave(selected, body);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="callout-editor">
      <div className="editor-field">
        <Text info>{'Type'}</Text>
        <div className="type-picker">
          {palette.map((type) => (
            <Button
              key={type.key}
              active={type.key === selected.key}
              onClick={() => setSelected(type)}
            >
              {type.title || type.key}
            </Button>
          ))}
        </div>
      </div>

      <Input
        multiline
        size={Size.FULL}
        rows={5}
        value={body}
        placeholder={EMPTY_BODY_HINT}
        label="Text"
        onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setBody(event.target.value)}
      />
      <Text info size="s">
        {'Bold, italic, links, inline code and lists are supported.'}
      </Text>
      {neededHeight > DEFAULT_HEIGHT && (
        <Text info size="s">
          {`This callout needs about ${neededHeight}px. The inserted block starts at ${DEFAULT_HEIGHT}px and a widget cannot resize itself, so drag its bottom edge if the text looks cut off.`}
        </Text>
      )}

      <div className="editor-field">
        <Text info>{'Preview'}</Text>
        <div dangerouslySetInnerHTML={{__html: renderCalloutHtml(selected, body || 'Preview text')}}/>
      </div>

      <ButtonSet>
        <Button primary loader={saving} disabled={body.trim().length === 0} onClick={save}>
          {'Save'}
        </Button>
        {canCancel ? <Button onClick={onCancel}>{'Cancel'}</Button> : null}
      </ButtonSet>
    </div>
  );
};

export const CalloutEditor = memo(CalloutEditorComponent);
