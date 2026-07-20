import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Capacitor } from '@capacitor/core';
import App from './App';
import { backend, initBackend, getCapacitorBackend } from './backend';
import { availableClientPlugins } from './plugins';
import { initCompendium, installPluginRuntime } from './compendium';
import { syncManager } from './sync/manager';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

async function bootstrap() {
  await initBackend();
  const config = await backend().getConfig();
  const enabledIds = new Set(config.plugins.filter((p) => p.enabled).map((p) => p.id));
  installPluginRuntime();
  await initCompendium(availableClientPlugins, enabledIds);

  // On-device cross-device sync (Android only); never blocks startup on network.
  const capacitorBackend = getCapacitorBackend();
  if (Capacitor.isNativePlatform() && capacitorBackend) {
    void syncManager.init(capacitorBackend, queryClient);
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App config={config} />
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
}

void bootstrap();
