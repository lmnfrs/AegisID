import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { Ref } from 'react';

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const SITE_KEY = '0x4AAAAAAGIHmozfC27xfji7';

type TurnstileRenderOptions = {
  sitekey: string;
  action?: string;
  callback?: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: () => void;
  theme?: 'auto' | 'light' | 'dark';
};

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string | undefined;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

type TurnstileWindow = Window & { turnstile?: TurnstileApi };

export type TurnstileHandle = { reset: () => void };

type TurnstileProps = {
  action: string;
  onToken: (token: string | null) => void;
  ref?: Ref<TurnstileHandle>;
};

// One script load per page. A failed load clears the cache so a later mount retries.
let scriptPromise: Promise<TurnstileApi> | null = null;

function loadScript(): Promise<TurnstileApi> {
  if (!scriptPromise) {
    scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.async = true;
      script.onload = () => {
        const api = (window as TurnstileWindow).turnstile;
        if (api) {
          resolve(api);
        } else {
          script.remove();
          scriptPromise = null;
          reject(new Error('Turnstile API missing after load'));
        }
      };
      script.onerror = () => {
        script.remove();
        scriptPromise = null;
        reject(new Error('Failed to load Turnstile'));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

export function Turnstile({ action, onToken, ref }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<TurnstileApi | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const [loadFailed, setLoadFailed] = useState(false);

  // Keep the latest callback without re-rendering the widget when it changes.
  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;

    loadScript()
      .then((api) => {
        if (cancelled) return;
        apiRef.current = api;
        const id = api.render(container, {
          sitekey: SITE_KEY,
          action,
          theme: 'auto',
          callback: (token) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(null),
          'error-callback': () => onTokenRef.current(null),
        });
        if (cancelled) {
          if (id) api.remove(id);
          return;
        }
        widgetIdRef.current = id ?? null;
        setLoadFailed(false);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });

    return () => {
      cancelled = true;
      const api = apiRef.current;
      const id = widgetIdRef.current;
      if (api && id !== null) api.remove(id);
      widgetIdRef.current = null;
    };
  }, [action]);

  useImperativeHandle(
    ref,
    () => ({
      reset() {
        const api = apiRef.current;
        const id = widgetIdRef.current;
        if (api && id !== null) api.reset(id);
        onTokenRef.current(null);
      },
    }),
    [],
  );

  return (
    <div>
      <div ref={containerRef} />
      {loadFailed && (
        <p role="alert" style={{ margin: '0.5rem 0', fontSize: '0.875rem' }}>
          Bot check failed to load. Reload the page.
        </p>
      )}
    </div>
  );
}
