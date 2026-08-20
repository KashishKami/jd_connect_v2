type RouteHandler = (params: Record<string, string>) => void;

const routes: Map<string, RouteHandler> = new Map();

export function addRoute(path: string, handler: RouteHandler): void {
  routes.set(path, handler);
}

export function navigate(path: string): void {
  window.history.pushState({}, '', path);
  handleRoute();
}

export function handleRoute(): void {
  const currentPath = window.location.pathname;
  const handler = routes.get(currentPath) || routes.get('*');
  if (handler) {
    handler({});
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', handleRoute);
}
