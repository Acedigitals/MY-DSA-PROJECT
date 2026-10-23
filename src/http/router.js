function normalisePath(path) {
  const value = typeof path === 'string' && path !== '' ? path : '/';
  const pathname = value.split('?')[0];
  if (pathname === '/') return pathname;
  return pathname.replace(/\/+$/, '');
}

function splitPath(path) {
  return normalisePath(path).split('/').filter(Boolean);
}

function matchPattern(pattern, path) {
  const patternParts = splitPath(pattern);
  const pathParts = splitPath(path);
  if (patternParts.length !== pathParts.length) return null;

  const params = {};
  for (let index = 0; index < patternParts.length; index += 1) {
    const expected = patternParts[index];
    const actual = pathParts[index];
    if (expected.startsWith(':')) {
      try {
        params[expected.slice(1)] = decodeURIComponent(actual);
      } catch {
        return null;
      }
    } else if (expected !== actual) {
      return null;
    }
  }
  return params;
}

export class Router {
  #routes = [];

  add(method, path, handler) {
    if (typeof method !== 'string' || typeof path !== 'string' || typeof handler !== 'function') {
      throw new TypeError('A route requires a method, path and handler');
    }
    this.#routes.push({
      method: method.toUpperCase(),
      path: normalisePath(path),
      handler
    });
    return this;
  }

  get(path, handler) {
    return this.add('GET', path, handler);
  }

  post(path, handler) {
    return this.add('POST', path, handler);
  }

  match(method, path) {
    for (const route of this.#routes) {
      if (route.method !== String(method).toUpperCase()) continue;
      const params = matchPattern(route.path, path);
      if (params !== null) return { handler: route.handler, params };
    }
    return null;
  }
}

export function createRouter() {
  return new Router();
}
