/**
 * Project-level configuration: which callout types exist, what they are called, how they look, and
 * whether the automatic rewrite is on.
 *
 * The preview under each row is rendered with the same `renderCalloutHtml` the workflow rule uses,
 * so what an admin sees here is exactly what authors will get.
 *
 * No permission gating happens in this component on purpose: the widget only appears on the project
 * settings screen, which is already restricted to project administrators. The endpoint behind it
 * still checks `UPDATE_PROJECT` itself, because that is the actual security boundary — a widget
 * being hidden stops nobody from calling the endpoint directly.
 */

import React, {memo, useCallback, useEffect, useState} from 'react';
import Button from '@jetbrains/ring-ui-built/components/button/button';
import ButtonSet from '@jetbrains/ring-ui-built/components/button-set/button-set';
import Checkbox from '@jetbrains/ring-ui-built/components/checkbox/checkbox';
import Input from '@jetbrains/ring-ui-built/components/input/input';
import Loader from '@jetbrains/ring-ui-built/components/loader/loader';
import Text from '@jetbrains/ring-ui-built/components/text/text';
import Toggle from '@jetbrains/ring-ui-built/components/toggle/toggle';
import Heading from '@jetbrains/ring-ui-built/components/heading/heading';
import {createApi} from '@/api';
import {
  BUILTIN_TYPES,
  isTransparent,
  MAX_TITLE,
  safeIcon,
  safeTitle,
  TRANSPARENT,
  type CalloutType,
} from '@/common/callouts/types';
import {renderCalloutHtml} from '@/common/callouts/render';

const host = await YTApp.register();
const api = createApi(host);

const PREVIEW_BODY = 'Body text with **bold** and a [link](https://example.com).';
const KEY_PATTERN = /^[A-Z]{1,24}$/;
const MAX_KEY = 24;

const NEW_TYPE_ACCENT = 'var(--ring-main-color, #3369d6)';
const NEW_TYPE_BACKGROUND = 'rgba(51, 105, 214, 0.10)';

/**
 * The fill the transparent checkbox puts back when it is unticked and this session never saw a
 * colour for the row — a type that was saved as transparent and then reopened.
 */
function opaqueDefault(key: string): string {
  return BUILTIN_TYPES.find((type) => type.key === key)?.background ?? NEW_TYPE_BACKGROUND;
}

/** Room for a numeric entity such as &#x1F512; while typing; it collapses to one symbol on blur. */
const ICON_INPUT_MAX = 12;

/**
 * Filters applied while typing. They only remove characters that can never be part of a valid
 * value — no trimming and no collapsing, because doing that on every keystroke stops the user from
 * typing a space between two words. Normalisation proper happens on blur and again on the server.
 */
const asKey = (value: string): string => value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, MAX_KEY);
const asTitle = (value: string): string => value.replace(/[^\p{L}\p{N} -]/gu, '').slice(0, MAX_TITLE);

/** A stable identity per row, so editing a not-yet-named custom type does not remount the inputs. */
interface Row {
  uid: string;
  type: CalloutType;
}

let uidCounter = 0;

function nextUid(): string {
  uidCounter += 1;
  return `row-${uidCounter}`;
}

function toRows(types: CalloutType[]): Row[] {
  return types.map((type) => ({uid: nextUid(), type}));
}

interface RowProps {
  type: CalloutType;
  isBuiltin: boolean;
  onChange: (patch: Partial<CalloutType>) => void;
  onRemove: () => void;
}

const TypeRowComponent: React.FunctionComponent<RowProps> = ({type, isBuiltin, onChange, onRemove}) => {
  // Whether the row is transparent is derived from the background rather than stored beside it, so
  // typing a colour over the word `transparent` unticks the box on its own. Only the colour to
  // restore has to be remembered.
  const transparent = isTransparent(type.background);
  const [lastColour, setLastColour] = useState(() =>
    transparent ? opaqueDefault(type.key) : type.background,
  );

  const toggleTransparent = (checked: boolean): void => {
    if (checked) {
      setLastColour(type.background);
    }
    onChange({background: checked ? TRANSPARENT : lastColour});
  };

  return (
    <div className="type-row">
      <div className="type-head">
        <Checkbox
          checked={type.enabled}
          label={type.key || 'New type'}
          onChange={(event) => onChange({enabled: event.target.checked})}
        />
        <Button danger text onClick={onRemove}>{'Remove'}</Button>
      </div>
      <div className="type-fields">
        <Input
          label="Syntax key"
          value={type.key}
          disabled={isBuiltin}
          maxLength={MAX_KEY}
          error={KEY_PATTERN.test(type.key) ? undefined : 'Letters only'}
          onChange={(event) => onChange({key: asKey(event.target.value)})}
        />
        <Input
          label="Title"
          value={type.title}
          maxLength={MAX_TITLE}
          placeholder="No heading"
          title="Leave empty to put the text next to the icon with no heading above it"
          onChange={(e) => onChange({title: asTitle(e.target.value)})}
          onBlur={() => onChange({title: safeTitle(type.title, '')})}
        />
        <Input label="Accent colour" value={type.accent} onChange={(e) => onChange({accent: e.target.value})}/>
        {/* The switch shares the background field's grid cell instead of taking one of its own,
            which would push the icon onto the next column and break the alignment the grid is for. */}
        <div className="field-with-toggle">
          <Input
            label="Background"
            value={type.background}
            onChange={(e) => onChange({background: e.target.value})}
          />
          <Checkbox
            checked={transparent}
            label="Transparent"
            onChange={(event) => toggleTransparent(event.target.checked)}
          />
        </div>
        <Input
          label="Icon"
          value={type.icon}
          maxLength={ICON_INPUT_MAX}
          placeholder="ℹ"
          title="A symbol, or its code such as &#9888;"
          onChange={(e) => onChange({icon: e.target.value})}
          onBlur={() => onChange({icon: safeIcon(type.icon, 'ℹ')})}
        />
      </div>
      <div className="type-preview">
        <div dangerouslySetInnerHTML={{__html: renderCalloutHtml(type, PREVIEW_BODY)}}/>
      </div>
    </div>
  );
};

const TypeRow = memo(TypeRowComponent);

const AppComponent: React.FunctionComponent = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [autoConvert, setAutoConvert] = useState(true);
  const [builtinKeys, setBuiltinKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const projectId = YTApp.entity?.id ?? '';

  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        const result = await api.project.types.GET({projectId});
        setRows(toRows(result.types));
        setAutoConvert(result.autoConvert);
        setBuiltinKeys(result.builtinKeys);
      } catch (error) {
        host.alert(error instanceof Error ? error.message : 'Could not load settings', 'error');
      } finally {
        setLoading(false);
      }
    };
    load().catch(() => undefined);
  }, [projectId]);

  const patchType = useCallback((uid: string, patch: Partial<CalloutType>) => {
    setRows((current) =>
      current.map((row) => (row.uid === uid ? {...row, type: {...row.type, ...patch}} : row)),
    );
  }, []);

  const removeType = useCallback((uid: string) => {
    setRows((current) => current.filter((row) => row.uid !== uid));
  }, []);

  const addType = useCallback(() => {
    setRows((current) => [
      ...current,
      {
        uid: nextUid(),
        type: {
          key: '',
          title: '',
          accent: NEW_TYPE_ACCENT,
          background: NEW_TYPE_BACKGROUND,
          icon: 'ℹ',
          enabled: true,
        },
      },
    ]);
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const result = await api.project.types.POST({
        projectId,
        autoConvert,
        types: rows.map((row) => row.type),
      });
      host.alert(
        result.saved ? 'Callout settings saved' : (result.error ?? 'Not saved'),
        result.saved ? 'success' : 'error',
      );
    } catch (error) {
      host.alert(error instanceof Error ? error.message : 'Could not save settings', 'error');
    } finally {
      setSaving(false);
    }
  }, [projectId, autoConvert, rows]);

  const reset = useCallback(() => {
    setRows(toRows(BUILTIN_TYPES.map((type) => ({...type}))));
    setAutoConvert(true);
  }, []);

  if (loading) {
    return <Loader/>;
  }

  const invalid = rows.some((row) => !KEY_PATTERN.test(row.type.key));

  return (
    <div className="widget">
      <Heading level={2}>{'Callouts'}</Heading>
      <Text info>
        {'Authors write "> [!WARNING]" followed by quoted lines. Each enabled type below becomes an available keyword.'}
      </Text>

      <div className="toolbar">
        <Toggle checked={autoConvert} onChange={(event) => setAutoConvert(event.target.checked)}>
          {'Convert automatically when a description or article changes'}
        </Toggle>
      </div>
      {!autoConvert && (
        <Text info>
          {'Automatic conversion is off. Authors can still use the Callouts command in the issue or article menu.'}
        </Text>
      )}

      <div className="type-list">
        {rows.map((row) => (
          <TypeRow
            key={row.uid}
            type={row.type}
            isBuiltin={builtinKeys.includes(row.type.key)}
            onChange={(patch) => patchType(row.uid, patch)}
            onRemove={() => removeType(row.uid)}
          />
        ))}
      </div>

      <ButtonSet>
        <Button primary loader={saving} disabled={invalid} onClick={save}>{'Save'}</Button>
        <Button onClick={addType}>{'Add type'}</Button>
        <Button onClick={reset}>{'Reset to defaults'}</Button>
      </ButtonSet>
      {invalid && (
        <Text info className="footer-note">
          {'Every type needs a syntax key of letters only.'}
        </Text>
      )}
      <Text info className="footer-note">
        {'Titles take letters, digits, spaces and hyphens. An icon is one symbol — paste it, or type its code such as \u0026#9888; and it converts when you leave the field.'}
      </Text>
      <Text info className="footer-note">
        {'Transparent drops the fill and keeps the coloured bar on the left, so the panel sits directly on the page background. Clearing the title drops the heading, putting the text on the same row as the icon.'}
      </Text>
      {rows.length === 0 && (
        <Text info className="footer-note">
          {'No types left — authors cannot write callouts until you add one or reset to defaults.'}
        </Text>
      )}
    </div>
  );
};

export const App = memo(AppComponent);
