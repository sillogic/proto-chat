'use client';

import { type StoreApiWithSelector } from '@lobechat/types';
import { subscribeWithSelector } from 'zustand/middleware';
import { shallow } from 'zustand/shallow';
import { createWithEqualityFn } from 'zustand/traditional';
import { createContext } from 'zustand-utils';

import { type Store } from './action';
import { store } from './action';
import { type State } from './initialState';

export type { PublicState, State } from './initialState';

export const createStore = (initState?: Partial<State>) =>
  createWithEqualityFn(subscribeWithSelector(store(initState)), shallow);

export const {
  useStore: useChatInputStore,
  useStoreApi,
  Provider,
} = createContext<StoreApiWithSelector<Store>>();

/**
 * Optional version of useStoreApi that returns undefined instead of throwing
 * when used outside of ChatInputProvider (e.g., in Portal-rendered components
 * like ModelSwitchPanel in the chat header).
 *
 * This is safe with React hooks rules: useStoreApi internally calls useContext()
 * (which always executes), then throws if the value is undefined. The try-catch
 * catches that post-hook throw, not a conditional hook call.
 */
export const useOptionalStoreApi = (): StoreApiWithSelector<Store> | undefined => {
  try {
    return useStoreApi();
  } catch {
    return undefined;
  }
};

export { selectors } from './selectors';
