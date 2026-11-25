import { afterEach, beforeEach, vi } from 'vitest';
import { commands } from 'vitest/browser';

beforeEach(async () => {
  localStorage.clear();
  await commands.resetRoutes();
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
