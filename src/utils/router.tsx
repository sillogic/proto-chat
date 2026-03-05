'use client';

import { toast } from '@lobehub/ui';
import { type ComponentType, type ReactElement } from 'react';
import { createElement, lazy, memo, Suspense, useCallback, useEffect, useRef } from 'react';
import { Navigate, type RouteObject, Route, useNavigate, useRouteError } from 'react-router-dom';

import Loading from '@/components/Loading/BrandTextLoading';
import { useGlobalStore } from '@/store/global';

/**
 * Helper function to create a dynamic page element directly for router configuration
 * This eliminates the need to define const for each component
 *
 * @example
 * // Instead of:
 * // const ChatPage = dynamicPage(() => import('./chat'));
 * // element: <ChatPage />
 *
 * // You can now use:
 * // element: dynamicElement(() => import('./chat'))
 */
export function dynamicElement<P = NonNullable<unknown>>(
  importFn: () => Promise<{ default: ComponentType<P> } | ComponentType<P>>,
  debugId?: string,
): ReactElement {
  const LazyComponent = lazy(async () => {
    // eslint-disable-next-line @next/next/no-assign-module-variable
    const module = await importFn();
    if (typeof module === 'function') {
      return { default: module };
    }
    if ('default' in module) {
      return module as { default: ComponentType<P> };
    }
    return { default: module as unknown as ComponentType<P> };
  });

  // @ts-ignore
  return (
    <Suspense fallback={<Loading debugId={debugId || 'dynamicElement'} />}>
      {/* @ts-ignore */}
      <LazyComponent {...({} as P)} />
    </Suspense>
  );
}

/**
 * Error boundary component for React Router
 * Displays an error page and provides a reset function to navigate to a specific path
 *
 * @example
 * import { ErrorBoundary } from '@/utils/dynamicPage';
 *
 * // In router config:
 * {
 *   path: 'chat',
 *   errorElement: <ErrorBoundary resetPath="/chat" />
 * }
 */
export interface ErrorBoundaryProps {
  resetPath: string;
}

export const ErrorBoundary = ({ resetPath }: ErrorBoundaryProps) => {
  const ErrorCapture = require('@/components/Error').default;

  const error = useRouteError() as Error;
  const reloadRef = useRef(false);
  const navigate = useNavigate();
  const reset = useCallback(() => {
    navigate(resetPath);
  }, [navigate, resetPath]);
  let message = '';

  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  } else if (error && typeof error === 'object' && 'statusText' in error) {
    const statusText = (error as { statusText?: unknown }).statusText;
    if (typeof statusText === 'string') message = statusText;
  }

  if (
    typeof window !== 'undefined' &&
    message?.startsWith('Failed to fetch dynamically imported module') &&
    window.sessionStorage.getItem('reload') !== '1'
  ) {
    if (reloadRef.current) return null;

    toast.info('Web app has been updated so it needs to be reloaded.');
    window.sessionStorage.setItem('reload', '1');
    window.location.reload();
    reloadRef.current = true;

    return null;
  }

  return createElement(ErrorCapture, { error, reset });
};

/**
 * Component to register navigate function in global store
 * This allows navigation to be triggered from anywhere in the app, including stores
 *
 * @example
 * import { NavigatorRegistrar } from '@/utils/dynamicPage';
 *
 * // In router root layout:
 * const RootLayout = () => (
 *   <>
 *     <NavigatorRegistrar />
 *     <YourMainLayout />
 *   </>
 * );
 */
export const NavigatorRegistrar = memo(() => {
  const navigate = useNavigate();

  useEffect(() => {
    useGlobalStore.setState({ navigate });
    return () => {
      useGlobalStore.setState({ navigate: undefined });
    };
  }, [navigate]);

  return null;
});

/**
 * Route configuration object type (compatible with createBrowserRouter format)
 */
export interface RouteConfig {
  children?: RouteConfig[];
  element?: ReactElement;
  errorElement?: ReactElement;
  // HydrateFallback is ignored in declarative mode
  HydrateFallback?: ComponentType;
  index?: boolean;
  loader?: (args: { params: Record<string, string | undefined> }) => unknown;
  path?: string;
}

/**
 * Convert route config objects to declarative Route elements
 * This allows using createBrowserRouter-style config with BrowserRouter
 *
 * @example
 * const routes: RouteConfig[] = [
 *   {
 *     path: '/',
 *     element: <Layout />,
 *     children: [
 *       { path: 'chat', element: <Chat /> }
 *     ]
 *   }
 * ];
 *
 * <BrowserRouter>
 *   <Routes>{renderRoutes(routes)}</Routes>
 * </BrowserRouter>
 */
export function renderRoutes(routes: RouteObject[]): ReactElement[] {
  return routes.map((route, index) => {
    const { path, element, children, index: isIndex } = route as RouteConfig;

    const childRoutes = children ? renderRoutes(children) : undefined;

    if (isIndex) {
      return <Route index element={element} key={`index-${index}`} />;
    }

    return (
      <Route element={element} key={path || index} path={path}>
        {childRoutes}
      </Route>
    );
  });
}

/**
 * Create a redirect element for use in route config
 * Replaces loader: () => redirect('/path') in declarative mode
 */
export function redirectElement(to: string): ReactElement {
  return <Navigate replace to={to} />;
}
