import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  Observable,
  of,
  throwError,
  combineLatest,
  BehaviorSubject,
} from 'rxjs';
import { map, catchError, retry, timeout, tap } from 'rxjs/operators';

export type Currency = 'ars' | 'clp' | 'usd' | 'brl' | 'gbp' | 'eur' | 'btc';

export interface CurrencyInfo {
  code: Currency;
  name: string;
  symbol: string;
  flag: string;
  country: string;
}

export interface ExchangeRates {
  [key: string]: number | Date; // All rates relative to USD, plus timestamp
  timestamp: Date;
}

export interface CachedRates extends ExchangeRates {
  expiry: number;
}

// Currency information
export const CURRENCIES: Record<Currency, CurrencyInfo> = {
  ars: {
    code: 'ars',
    name: 'Argentine Peso',
    symbol: 'ARS',
    flag: 'https://cdn.ipregistry.co/flags/emojitwo/ar.svg',
    country: 'Argentina',
  },
  clp: {
    code: 'clp',
    name: 'Chilean Peso',
    symbol: 'CLP',
    flag: 'https://cdn.ipregistry.co/flags/emojitwo/cl.svg',
    country: 'Chile',
  },
  usd: {
    code: 'usd',
    name: 'US Dollar',
    symbol: 'USD',
    flag: 'https://cdn.ipregistry.co/flags/emojitwo/us.svg',
    country: 'United States',
  },
  brl: {
    code: 'brl',
    name: 'Brazilian Real',
    symbol: 'BRL',
    flag: 'https://cdn.ipregistry.co/flags/emojitwo/br.svg',
    country: 'Brazil',
  },
  gbp: {
    code: 'gbp',
    name: 'British Pound',
    symbol: 'GBP',
    flag: 'https://cdn.ipregistry.co/flags/emojitwo/gb.svg',
    country: 'United Kingdom',
  },
  eur: {
    code: 'eur',
    name: 'Euro',
    symbol: 'EUR',
    flag: 'https://emojigraph.org/media/joypixels/flag-european-union_1f1ea-1f1fa.png',
    country: 'European Union',
  },
  btc: {
    code: 'btc',
    name: 'Bitcoin',
    symbol: '₿',
    flag: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Bitcoin.svg',
    country: 'Global',
  },
};

// Default fallback rates for completely offline scenarios (all relative to USD)
export const DEFAULT_RATES: ExchangeRates = {
  ars: 1200, // Blue rate
  clp: 900,
  usd: 1,
  brl: 5.5,
  gbp: 0.8,
  eur: 0.92,
  btc: 0.0000085, // ~$118K per BTC
  timestamp: new Date('2024-01-01'),
};

interface BlueResponse {
  blue: { value_sell: number };
}

interface ClpResponse {
  serie: { valor: number }[];
}

@Injectable({
  providedIn: 'root',
})
export class ExchangeRateService {
  private readonly corsProxy = 'https://api.allorigins.win/raw?url=';
  private readonly blueApiUrl = 'https://api.bluelytics.com.ar/v2/latest';
  private readonly clpApiUrl = 'https://mindicador.cl/api/dolar';
  private readonly currencyApiUrl =
    'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@';
  private readonly CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
  private readonly CACHE_PREFIX = 'bluecoinverse_';
  private readonly REQUEST_TIMEOUT = 10000; // 10 seconds
  private readonly INDIVIDUAL_API_TIMEOUT = 8000; // 8 seconds per API call
  private readonly MAX_RETRIES = 3;

  private http = inject(HttpClient);

  // BehaviorSubject para emitir tasas actualizadas sin bloquear
  private ratesSubject = new BehaviorSubject<ExchangeRates>(DEFAULT_RATES);
  public rates$ = this.ratesSubject.asObservable();

  // Flag para evitar múltiples actualizaciones simultáneas
  public isUpdating = false;

  constructor() {
    // Inicializar con tasas en caché si están disponibles
    const cachedRates = this.getCachedRates();
    if (cachedRates) {
      this.ratesSubject.next(cachedRates);
    }
  }

  /**
   * Obtiene tasas de cambio de forma no bloqueante
   * Retorna inmediatamente las tasas en caché si están disponibles
   * y actualiza en segundo plano
   */
  getExchangeRates(): Observable<ExchangeRates> {
    // Si ya estamos actualizando, solo retornar el observable actual
    if (this.isUpdating) {
      return this.rates$;
    }

    // Retornar tasas en caché inmediatamente si están disponibles
    const cachedRates = this.getCachedRates();
    if (cachedRates) {
      // Emitir tasas en caché inmediatamente
      this.ratesSubject.next(cachedRates);

      // Actualizar en segundo plano si el caché está expirado
      if (this.isCacheExpired(cachedRates)) {
        this.updateRatesInBackground();
      }

      return this.rates$;
    }

    // Si no hay caché, hacer la actualización completa
    return this.updateRatesInBackground();
  }

  /**
   * Actualiza las tasas en segundo plano sin bloquear
   */
  private updateRatesInBackground(): Observable<ExchangeRates> {
    if (this.isUpdating) {
      return this.rates$;
    }

    this.isUpdating = true;
    const today = new Date().toISOString().split('T')[0];

    return combineLatest([
      this.getBlueRate(),
      this.getClpRate(),
      this.getCurrencyRates(today),
      this.getBitcoinRate(today),
    ]).pipe(
      timeout(this.REQUEST_TIMEOUT),
      map(([blueRate, clpRate, currencyRates, btcRate]) => {
        const rates: ExchangeRates = {
          ars: blueRate || (DEFAULT_RATES.ars as number),
          clp: clpRate || (DEFAULT_RATES.clp as number),
          usd: 1, // Base currency
          brl: currencyRates?.brl || (DEFAULT_RATES.brl as number),
          gbp: currencyRates?.gbp || (DEFAULT_RATES.gbp as number),
          eur: currencyRates?.eur || (DEFAULT_RATES.eur as number),
          btc: btcRate || (DEFAULT_RATES.btc as number),
          timestamp: new Date(),
        };

        return rates;
      }),
      tap((rates) => {
        // Guardar en caché y emitir nuevas tasas
        this.saveCachedRates(rates);
        this.ratesSubject.next(rates);
        this.isUpdating = false;
      }),
      catchError((error) => {
        this.isUpdating = false;

        // En caso de error, usar tasas por defecto
        const defaultRates = this.getDefaultRates();
        this.ratesSubject.next(defaultRates);

        return throwError({
          message: 'Error al obtener las tasas de cambio',
          originalError: error,
          timestamp: new Date(),
        });
      })
    );
  }

  /**
   * Verifica si el caché está expirado
   */
  private isCacheExpired(rates: ExchangeRates): boolean {
    const now = Date.now();
    const cacheAge = now - rates.timestamp.getTime();
    return cacheAge > this.CACHE_EXPIRY_MS;
  }

  /**
   * Fuerza una actualización de las tasas (útil para refresh manual)
   */
  forceUpdate(): Observable<ExchangeRates> {
    this.isUpdating = false; // Reset flag
    return this.updateRatesInBackground();
  }

  /**
   * Obtiene las tasas actuales sin hacer llamadas a la API
   */
  getCurrentRates(): ExchangeRates {
    return this.ratesSubject.value;
  }

  private getBlueRate(): Observable<number> {
    return this.http
      .get<BlueResponse>(
        `${this.corsProxy}${encodeURIComponent(this.blueApiUrl)}`
      )
      .pipe(
        timeout(this.INDIVIDUAL_API_TIMEOUT),
        retry(this.MAX_RETRIES - 1),
        map((response) => response.blue.value_sell),
        catchError(() => {
          return of(DEFAULT_RATES.ars as number);
        })
      );
  }

  private getClpRate(): Observable<number> {
    return this.http
      .get<ClpResponse>(
        `${this.corsProxy}${encodeURIComponent(this.clpApiUrl)}`
      )
      .pipe(
        timeout(this.INDIVIDUAL_API_TIMEOUT),
        retry(this.MAX_RETRIES - 1),
        map((response) => response.serie[0]?.valor),
        catchError(() => {
          return of(DEFAULT_RATES.clp as number);
        })
      );
  }

  private getCurrencyRates(
    date: string
  ): Observable<{ brl: number; gbp: number; eur: number }> {
    const url = `${this.currencyApiUrl}${date}/v1/currencies/usd.json`;
    return this.http
      .get<{ usd: { brl: number; gbp: number; eur: number } }>(url)
      .pipe(
        timeout(this.INDIVIDUAL_API_TIMEOUT),
        retry(this.MAX_RETRIES - 1),
        map((response) => {
          const usdRates = response?.usd;
          if (!usdRates) {
            throw new Error('Invalid currency API response');
          }
          return {
            brl: usdRates.brl,
            gbp: usdRates.gbp,
            eur: usdRates.eur,
          };
        }),
        catchError(() => {
          return of({
            brl: DEFAULT_RATES.brl as number,
            gbp: DEFAULT_RATES.gbp as number,
            eur: DEFAULT_RATES.eur as number,
          });
        })
      );
  }

  private getBitcoinRate(date: string): Observable<number> {
    const url = `${this.currencyApiUrl}${date}/v1/currencies/btc.json`;
    return this.http.get<{ btc: { usd: number } }>(url).pipe(
      timeout(8000),
      retry(this.MAX_RETRIES - 1),
      map((response) => {
        const btcRates = response?.btc;
        if (!btcRates || !btcRates.usd) {
          throw new Error('Invalid Bitcoin API response');
        }
        // Convert from "1 BTC = X USD" to "1 USD = X BTC"
        return 1 / btcRates.usd;
      }),
      catchError(() => {
        return of(DEFAULT_RATES.btc as number);
      })
    );
  }

  private handleError(error: unknown): Observable<never> {
    return throwError({
      message: 'Error al obtener las tasas de cambio',
      error: error,
      timestamp: new Date(),
    });
  }

  getCachedRates(allowExpired = false): ExchangeRates | null {
    try {
      const cachedData = this.getFromStorage('exchangeRates');
      const expiry = this.getFromStorage('ratesExpiry');

      if (cachedData) {
        const rates = JSON.parse(cachedData);

        // Check if cache is still valid or if we allow expired
        if (expiry && (Date.now() < parseInt(expiry) || allowExpired)) {
          rates.timestamp = new Date(rates.timestamp);
          return rates;
        } else if (!expiry) {
          // Legacy cache without expiry - still return it
          rates.timestamp = new Date(rates.timestamp);
          return rates;
        }
      }

      // Try legacy format
      const blueRate = this.getFromStorage('blueRate');
      const clpRate = this.getFromStorage('clpRate');
      const timestamp = this.getFromStorage('lastUpdate');

      if (blueRate && clpRate && timestamp) {
        return {
          ars: parseFloat(blueRate),
          clp: parseFloat(clpRate),
          usd: 1,
          brl: DEFAULT_RATES.brl as number,
          gbp: DEFAULT_RATES.gbp as number,
          eur: DEFAULT_RATES.eur as number,
          btc: DEFAULT_RATES.btc as number,
          timestamp: new Date(timestamp),
        };
      }
    } catch {
      // Fallback to null if cache read fails
    }

    return null;
  }

  saveCachedRates(rates: ExchangeRates): void {
    try {
      const expiry = Date.now() + this.CACHE_EXPIRY_MS;

      this.setToStorage('exchangeRates', JSON.stringify(rates));
      this.setToStorage('ratesExpiry', expiry.toString());

      // Keep legacy format for backward compatibility
      this.setToStorage('blueRate', rates.ars?.toString() || '0');
      this.setToStorage('clpRate', rates.clp?.toString() || '0');
      this.setToStorage('lastUpdate', rates.timestamp.toISOString());
    } catch {
      // Silent fail - caching is non-critical
    }
  }

  /**
   * Get default rates for completely offline scenarios
   */
  getDefaultRates(): ExchangeRates {
    return {
      ...DEFAULT_RATES,
      timestamp: new Date(),
    };
  }

  /**
   * Check if we have any cached data (even if expired)
   */
  hasAnyCachedData(): boolean {
    return !!(
      this.getFromStorage('exchangeRates') ||
      (this.getFromStorage('blueRate') && this.getFromStorage('clpRate'))
    );
  }

  /**
   * Safe localStorage getter with error handling
   */
  private getFromStorage(key: string): string | null {
    try {
      return localStorage.getItem(this.CACHE_PREFIX + key);
    } catch {
      return null;
    }
  }

  /**
   * Safe localStorage setter with error handling
   */
  private setToStorage(key: string, value: string): void {
    localStorage.setItem(this.CACHE_PREFIX + key, value);
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    try {
      localStorage.removeItem(this.CACHE_PREFIX + 'exchangeRates');
      localStorage.removeItem(this.CACHE_PREFIX + 'blueRate');
      localStorage.removeItem(this.CACHE_PREFIX + 'clpRate');
      localStorage.removeItem(this.CACHE_PREFIX + 'lastUpdate');
      localStorage.removeItem(this.CACHE_PREFIX + 'ratesExpiry');
    } catch {
      // Silent fail - cache clearing is non-critical
    }
  }
}
