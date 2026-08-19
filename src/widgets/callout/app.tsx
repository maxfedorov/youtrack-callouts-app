/**
 * The UI input mode: a MARKDOWN widget inserted from the editor's "Images and embedded content"
 * menu. Each inserted instance keeps its own configuration, so the same widget renders a different
 * panel in every place it appears.
 *
 * Configuration happens in a separate host dialog rather than inside the inline block — see
 * `editor.tsx`. The rendered panel needs a small box; the form needs a roomy one, and the host
 * gives us both only if we switch it into config mode.
 *
 * The panel is produced by the very same `renderCalloutHtml` the workflow rule uses for the text
 * mode, which is what guarantees the two modes look identical.
 */

import React, {memo, useCallback, useEffect, useState} from 'react';
import {createApi} from '@/api';
import {BUILTIN_TYPES, type CalloutType} from '@/common/callouts/types';
import {renderCalloutHtml} from '@/common/callouts/render';
import {resolveProjectId, type CalloutStyleSnapshot} from '../shared/host-utils';
import {CalloutEditor} from './editor';

interface CalloutConfig extends CalloutStyleSnapshot {
  body: string;
}

let requestEdit: (() => void) | null = null;

const host = await YTApp.register({onConfigure: () => requestEdit?.()});
const api = createApi(host);

function asType(config: CalloutConfig): CalloutType {
  return {...config, enabled: true};
}

const AppComponent: React.FunctionComponent = () => {
  const [config, setConfig] = useState<CalloutConfig | null>(null);
  const [palette, setPalette] = useState<CalloutType[]>(() => BUILTIN_TYPES.map((t) => ({...t})));
  const [editing, setEditing] = useState(false);
  const [ready, setReady] = useState(false);

  requestEdit = useCallback(() => setEditing(true), []);

  useEffect(() => {
    const load = async (): Promise<void> => {
      const stored = await host.readConfig<CalloutConfig>();
      if (stored?.key && typeof stored.body === 'string') {
        setConfig(stored);
      } else {
        // An unconfigured instance has to open the form itself. `onConfigure` is not called on
        // insertion, and in the Visual editor a click on the embedded block selects it rather than
        // reaching anything inside the iframe — so without this a freshly inserted widget could
        // never be configured. Opening the form enters config mode, which is what makes the host
        // show it as a dialog.
        setEditing(true);
      }
      setReady(true);

      const projectId = await resolveProjectId(host);
      if (!projectId) {
        return;
      }
      try {
        const result = await api.project.types.GET({projectId});
        const enabled = result.types.filter((type) => type.enabled);
        if (enabled.length > 0) {
          setPalette(enabled);
        }
      } catch {
        // The built-in palette stays in place when the project cannot be read.
      }
    };
    load().catch(() => undefined);
  }, []);

  const save = useCallback(async (type: CalloutType, body: string) => {
    const next: CalloutConfig = {
      key: type.key,
      title: type.title,
      accent: type.accent,
      background: type.background,
      icon: type.icon,
      body,
    };
    await host.storeConfig(next);
    setConfig(next);
    setEditing(false);
  }, []);

  const cancel = useCallback(() => setEditing(false), []);

  if (!ready) {
    return <div className="callout-widget"/>;
  }

  if (editing) {
    const current = config ? asType(config) : palette[0];
    return (
      <div className="callout-widget">
        <CalloutEditor
          palette={palette}
          initialType={palette.find((type) => type.key === current.key) ?? current}
          initialBody={config?.body ?? ''}
          canCancel={config !== null}
          host={host}
          onSave={save}
          onCancel={cancel}
        />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="callout-widget">
        <button type="button" className="callout-placeholder" onClick={() => setEditing(true)}>
          {'Callout — click to configure'}
        </button>
      </div>
    );
  }

  return (
    <div
      className="callout-widget"
      // The markup comes from this app's own renderer: colours are app-controlled and the body is
      // escaped by renderBody before it is interpolated.
      dangerouslySetInnerHTML={{__html: renderCalloutHtml(asType(config), config.body)}}
    />
  );
};

export const App = memo(AppComponent);
