import React from 'react';
import { usePlayground } from './PlaygroundProvider';
import type { PlaygroundRenderProps } from './types';

export const PlaygroundRender: React.FC<PlaygroundRenderProps> = ({ height = '100%', className, style }) => {
  const { isCompiling, error, renderedComponent, renderedDomModule, runtime } = usePlayground();

  return (
    <div
      className={className}
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: 12,
        overflow: 'auto',
        position: 'relative',
        height,
        ...style
      }}
    >
      {isCompiling && <StatusBanner message="Compiling..." tone="info" />}
      {error && <StatusBanner message={error} tone="error" />}
      {!error && !isCompiling && runtime === 'react' && renderedComponent && <RenderSurface component={renderedComponent} />}
      {!error && !isCompiling && runtime === 'dom' && renderedDomModule && <DomRenderSurface module={renderedDomModule} />}
    </div>
  );
};

const RenderSurface: React.FC<{ component: React.ComponentType }> = ({ component: Component }) => {
  return (
    <div style={{ width: '100%', height: '100%', color: '#0f172a' }}>
      <Component />
    </div>
  );
};

const DomRenderSurface: React.FC<{ module: { mount: (el: HTMLElement) => any; unmount?: () => any } }> = ({ module }) => {
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const result = module.mount(el);
    return () => {
      if (typeof module.unmount === 'function') {
        module.unmount();
        return;
      }
      if (typeof result === 'function') {
        result();
      }
      el.replaceChildren();
    };
  }, [module]);

  return <div ref={ref} style={{ width: '100%', height: '100%' }} />;
};

const StatusBanner: React.FC<{ message: string; tone: 'info' | 'error' }> = ({ message, tone }) => {
  const colors =
    tone === 'error'
      ? { background: '#fef2f2', border: '#fecdd3', text: '#991b1b' }
      : { background: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' };

  return (
    <div
      style={{
        background: colors.background,
        border: `1px solid ${colors.border}`,
        color: colors.text,
        padding: '10px 12px',
        borderRadius: 10,
        fontSize: 14,
        marginBottom: 8
      }}
    >
      {message}
    </div>
  );
};
