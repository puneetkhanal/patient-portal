import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load environment variables from .env file
 * This should be called before any other imports that use process.env
 */
export function loadEnv(): void {
  // Try to load .env.prod first (for production)
  const envProdPath = resolve(__dirname, '../../env.prod');
  config({ path: envProdPath });

  // Try to load .env from project root
  const envPath = resolve(__dirname, '../../.env');
  config({ path: envPath });

  // Also load from current directory as fallback
  config();
}

// Auto-load on import
loadEnv();

