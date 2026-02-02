/**
 * Exchange Rate Service
 * Fetches real-time USD/CNY exchange rates from external APIs
 */

// Cache configuration
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds
interface RateCache {
  rate: number;
  timestamp: number;
}

// API response type
interface ExchangeRateResponse {
  rates?: {
    CNY?: number;
    [key: string]: number | undefined;
  };
}

let rateCache: RateCache | null = null;

/**
 * Fetch USD/CNY exchange rate from open.er-api.com (free, no API key required)
 * Fallback to exchangerate-api.com if primary fails
 */
async function fetchUSDCNYRate(): Promise<number> {
  const DEFAULT_RATE = 7.3;

  try {
    // Primary API: open.er-api.com (Frankfurter) - free, no key
    const response = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!response.ok) {
      throw new Error(`Primary API failed: ${response.statusText}`);
    }

    const data = (await response.json()) as ExchangeRateResponse;

    if (data.rates && data.rates.CNY) {
      const rate = data.rates.CNY;
      console.log(`✅ Fetched USD/CNY rate from primary API: ${rate}`);
      return rate;
    }
  } catch (error) {
    console.warn('⚠️ Primary exchange rate API failed:', error);
  }

  try {
    // Fallback API: exchangerate-api.com (free tier, no key required for basic usage)
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    if (!response.ok) {
      throw new Error(`Fallback API failed: ${response.statusText}`);
    }

    const data = (await response.json()) as ExchangeRateResponse;

    if (data.rates && data.rates.CNY) {
      const rate = data.rates.CNY;
      console.log(`✅ Fetched USD/CNY rate from fallback API: ${rate}`);
      return rate;
    }
  } catch (error) {
    console.warn('⚠️ Fallback exchange rate API failed:', error);
  }

  console.warn('⚠️ All exchange rate APIs failed, using default rate');
  return DEFAULT_RATE;
}

/**
 * Get USD/CNY exchange rate with caching
 * Returns cached rate if not expired, otherwise fetches new rate
 */
export async function getUSDCNYRate(): Promise<number> {
  const now = Date.now();

  // Return cached rate if still valid
  if (rateCache && (now - rateCache.timestamp) < CACHE_DURATION) {
    console.log(`📦 Using cached USD/CNY rate: ${rateCache.rate} (age: ${Math.round((now - rateCache.timestamp) / 1000 / 60)} minutes)`);
    return rateCache.rate;
  }

  // Fetch new rate
  const rate = await fetchUSDCNYRate();

  // Update cache
  rateCache = {
    rate,
    timestamp: now,
  };

  return rate;
}

/**
 * Force refresh the exchange rate cache
 * Useful for manual refresh buttons
 */
export async function refreshExchangeRate(): Promise<number> {
  rateCache = null;
  return getUSDCNYRate();
}

/**
 * Get current cached rate without fetching (if available)
 * Returns null if no cache exists
 */
export function getCachedRate(): number | null {
  if (rateCache && (Date.now() - rateCache.timestamp) < CACHE_DURATION) {
    return rateCache.rate;
  }
  return null;
}
