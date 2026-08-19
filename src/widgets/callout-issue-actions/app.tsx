import React, {memo, useCallback} from 'react';
import {createApi} from '@/api';
import {ConvertActions, type ConvertMode} from '../shared/convert-actions';

const host = await YTApp.register();
const api = createApi(host);

const AppComponent: React.FunctionComponent = () => {
  const run = useCallback(
    (mode: ConvertMode) => api.issue.convert.POST({issueId: YTApp.entity?.id ?? '', mode}),
    [],
  );
  const notify = useCallback((message: string, type?: string) => host.alert(message, type), []);

  return <ConvertActions entityLabel="issue" run={run} notify={notify} host={host}/>;
};

export const App = memo(AppComponent);
