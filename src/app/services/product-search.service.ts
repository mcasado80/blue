import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, timeout } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface ProductSearchResult {
  product: string;
  prices: Record<string, number>;
  urls?: Record<string, string>; // URLs de referencia por moneda
  confidence: number;
  source: string;
  timestamp: Date;

  // Legacy properties for backward compatibility
  chile?: number;
  argentina?: number;
  usa?: number;
  brazil?: number;
  uk?: number;
  eu?: number;
}

export interface SearchHistoryItem {
  id: string;
  query: string;
  result: ProductSearchResult;
  timestamp: Date;
  isFavorite: boolean;
}

export interface SearchFavorite {
  id: string;
  query: string;
  displayName: string;
  timestamp: Date;
}

export interface DeepSeekRequest {
  model: string;
  messages: {
    role: 'system' | 'user' | 'assistant';
    content: string;
  }[];
  temperature: number;
  max_tokens: number;
}

export interface DeepSeekResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

@Injectable({
  providedIn: 'root',
})
export class ProductSearchService {
  private readonly DEEPSEEK_API_URL =
    'https://api.deepseek.com/v1/chat/completions';
  private readonly DEEPSEEK_API_KEY = environment.deepseekApiKey;

  // Cache and storage keys
  private readonly CACHE_KEY = 'product_search_cache';
  private readonly HISTORY_KEY = 'search_history';
  private readonly FAVORITES_KEY = 'search_favorites';
  private readonly CACHE_EXPIRY = 60 * 60 * 1000; // 1 hour
  private readonly MAX_HISTORY_ITEMS = 50;
  private readonly MAX_FAVORITES = 20;

  // In-memory cache
  private cache = new Map<
    string,
    { result: ProductSearchResult; timestamp: number }
  >();

  private http = inject(HttpClient);

  searchProduct(query: string): Observable<ProductSearchResult> {
    // Check for offline
    if (!navigator.onLine) {
      const cached = this.getCachedResult(query, true); // Allow expired
      if (cached) {
        return of(cached);
      }
      const history = this.getSearchHistory();
      const matchingHistory = history.find(
        (item) => item.query.toLowerCase() === query.toLowerCase()
      );
      if (matchingHistory) {
        return of(matchingHistory.result);
      }
      throw new Error('Offline and no cached result available');
    }

    const prompt = this.buildSearchPrompt(query);

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.DEEPSEEK_API_KEY}`,
    });

    const requestBody: DeepSeekRequest = {
      model: 'deepseek-chat', // Using deepseek-chat for faster responses
      messages: [
        {
          role: 'system',
          content:
            'Eres un experto en precios internacionales de productos. Analiza cuidadosamente las diferencias de precios entre países considerando impuestos, aranceles y poder adquisitivo. Responde SIEMPRE con JSON válido y precios coherentes con el mercado actual.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2,
      max_tokens: 800,
    };

    return this.http
      .post<DeepSeekResponse>(this.DEEPSEEK_API_URL, requestBody, { headers })
      .pipe(
        timeout(60000), // Increased to 60 seconds timeout for DeepSeek V3.1
        map((response) => this.parseAIResponse(response)),
        catchError((error) => this.handleError(error, query))
      );
  }

  private buildSearchPrompt(query: string): string {
    const currentDate = new Date();
    const monthNames = [
      'enero',
      'febrero',
      'marzo',
      'abril',
      'mayo',
      'junio',
      'julio',
      'agosto',
      'septiembre',
      'octubre',
      'noviembre',
      'diciembre',
    ];
    const currentMonth = monthNames[currentDate.getMonth()];
    const currentYear = currentDate.getFullYear();

    return `Eres un experto en precios internacionales de productos tecnológicos y retail. Tu misión es proporcionar precios REALES y ACTUALIZADOS basados en datos de mercado de ${currentMonth} ${currentYear}.

PRODUCTO A BUSCAR: "${query}"

INSTRUCCIONES CRÍTICAS PARA PRECIOS COHERENTES:
1. Los precios deben reflejar valores REALES de mercado en cada país (no estimaciones)
2. IMPORTANTE: Para USD, GBP y EUR usa el formato con decimales (ej: 12.99, 9.99, 799.00)
3. Para CLP y ARS usa valores enteros sin decimales (ej: 7990, 15000)
4. Considera las diferencias económicas entre países:
   - Chile (CLP): Productos tech suelen costar 10-20% más que USA convertido
   - Argentina (ARS): Incluye impuesto PAIS (30%) y percepción (45%) en productos importados
   - USA (USD): Precios base sin tax (se agrega al comprar) - USA DECIMALES
   - Brasil (BRL): Productos importados tienen ~60% de impuestos - USA DECIMALES
   - UK (GBP): Incluye VAT 20% en el precio mostrado - USA DECIMALES
   - EU (EUR): Incluye VAT 19-21% en el precio mostrado - USA DECIMALES

REGLAS DE EXTRACCIÓN DE PRECIOS:
1. Busca el MISMO modelo exacto (misma generación, capacidad, año)
2. Si hay múltiples versiones, usa la configuración base/estándar
3. Precio debe ser de vendedores oficiales o grandes retailers
4. Para smartphones: misma capacidad de almacenamiento
5. Para notebooks: mismas specs principales (procesador, RAM, almacenamiento)
6. Si el producto no existe en un país, usa null (NO inventes precios)

VALIDACIÓN DE COHERENCIA (Precios aproximados ${currentMonth} ${currentYear}):
- Nescafé Gold 200g: Chile ~7.990 CLP, USA ~12.99 USD, Argentina ~15.000 ARS
- iPhone 15 Pro 128GB: Chile ~1.200.000 CLP, USA ~999 USD, Argentina ~2.000.000 ARS
- MacBook Air M2: Chile ~1.100.000 CLP, USA ~1099 USD, Brasil ~7.500 BRL
- PlayStation 5: Chile ~600.000 CLP, USA ~499 USD, UK ~480 GBP
- Samsung Galaxy S24: Chile ~900.000 CLP, USA ~799 USD, EU ~899 EUR

URLs DE REFERENCIA (usa el término de búsqueda correcto):
- Chile: https://www.falabella.com/falabella-cl/search?Ntt=${encodeURIComponent(
      query
    )}
- Argentina: https://listado.mercadolibre.com.ar/${encodeURIComponent(
      query
    ).replace(/%20/g, '-')}
- USA: https://www.amazon.com/s?k=${encodeURIComponent(query)}
- Brasil: https://www.americanas.com.br/s?q=${encodeURIComponent(query)}
- UK: https://www.amazon.co.uk/s?k=${encodeURIComponent(query)}
- EU: https://www.amazon.de/s?k=${encodeURIComponent(query)}

FORMATO JSON (sin espacios, una línea):
{
  "product": "nombre comercial exacto",
  "chile": precio_CLP_sin_puntos,
  "argentina": precio_ARS_sin_puntos,
  "usa": precio_USD_con_decimales,
  "brazil": precio_BRL_con_decimales,
  "uk": precio_GBP_con_decimales,
  "eu": precio_EUR_con_decimales,
  "urls": {
    "chile": "url_búsqueda",
    "argentina": "url_búsqueda",
    "usa": "url_búsqueda",
    "brazil": "url_búsqueda",
    "uk": "url_búsqueda",
    "eu": "url_búsqueda"
  },
  "confidence": 1-100_basado_en_certeza,
  "source": "retailers oficiales ${currentYear}",
  "last_checked": "${currentYear}-${(currentDate.getMonth() + 1)
      .toString()
      .padStart(2, '0')}-${currentDate.getDate().toString().padStart(2, '0')}"
}

RESPONDE SOLO:
<JSON>{"product":"...","chile":...,"argentina":...,"usa":...,"brazil":...,"uk":...,"eu":...,"urls":{...},"confidence":...,"source":"...","last_checked":"..."}</JSON>`;
  }

  private parseAIResponse(response: DeepSeekResponse): ProductSearchResult {
    try {
      const content = response.choices[0]?.message?.content?.trim();

      if (!content) {
        throw new Error('Empty response from AI');
      }

      // Try to extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const jsonStr = jsonMatch[0];
      const parsed = JSON.parse(jsonStr);

      // Validate required fields
      if (!parsed.product) {
        throw new Error('Missing product name in AI response');
      }
      if (
        !parsed.confidence ||
        parsed.confidence < 0 ||
        parsed.confidence > 100
      ) {
        throw new Error('Invalid confidence value');
      }
      if (!parsed.source) {
        throw new Error('Missing source in AI response');
      }

      // Build prices object with all available currencies
      const prices: Record<string, number> = {};

      // Map response fields to currency codes
      const currencyMapping = {
        chile: 'clp',
        argentina: 'ars',
        usa: 'usd',
        brazil: 'brl',
        uk: 'gbp',
        eu: 'eur',
      };

      Object.entries(currencyMapping).forEach(([field, currency]) => {
        if (
          parsed[field] &&
          parsed[field] !== null &&
          Number(parsed[field]) > 0
        ) {
          prices[currency] = Number(parsed[field]);
        }
      });

      // Build URLs object if available
      const urls: Record<string, string> = {};
      if (parsed.urls && typeof parsed.urls === 'object') {
        Object.entries(currencyMapping).forEach(([field, currency]) => {
          if (
            parsed.urls[field] &&
            typeof parsed.urls[field] === 'string' &&
            parsed.urls[field].startsWith('http')
          ) {
            urls[currency] = parsed.urls[field];
          }
        });
      }

      return {
        product: parsed.product,
        prices: prices,
        urls: Object.keys(urls).length > 0 ? urls : undefined,
        confidence: Number(parsed.confidence) || 75,
        source: parsed.source || 'AI estimation',
        timestamp: new Date(),

        // Legacy properties for backward compatibility
        chile: parsed.chile !== null ? Number(parsed.chile) : 0,
        argentina: parsed.argentina !== null ? Number(parsed.argentina) : 0,
        usa: parsed.usa !== null ? Number(parsed.usa) : 0,
        brazil: parsed.brazil !== null ? Number(parsed.brazil) : 0,
        uk: parsed.uk !== null ? Number(parsed.uk) : 0,
        eu: parsed.eu !== null ? Number(parsed.eu) : 0,
      };
    } catch {
      throw new Error('Failed to parse AI response');
    }
  }

  private handleError(
    error: unknown,
    query: string
  ): Observable<ProductSearchResult> {
    // Return error result with no prices or URLs
    let errorMessage = 'Error de conexión';

    if ((error as { name?: string })?.name === 'TimeoutError') {
      errorMessage = 'Tiempo de espera agotado';
    } else if ((error as { status?: number })?.status === 401) {
      errorMessage = 'Error de autenticación';
    } else if (
      (error as { status?: number })?.status &&
      (error as { status: number }).status >= 500
    ) {
      errorMessage = 'Servicio no disponible';
    }

    return of({
      product: `Error buscando: ${query}`,
      prices: {},
      confidence: 0,
      source: errorMessage,
      timestamp: new Date(),

      // Legacy properties
      chile: 0,
      argentina: 0,
      usa: 0,
      brazil: 0,
      uk: 0,
      eu: 0,
    });
  }

  // Cache for recent searches
  private searchCache = new Map<string, ProductSearchResult>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  getCachedResult(
    query: string,
    allowExpired = false
  ): ProductSearchResult | null {
    const cached = this.searchCache.get(query.toLowerCase());
    if (cached) {
      const age = Date.now() - cached.timestamp.getTime();
      if (age < this.CACHE_TTL || allowExpired) {
        return cached;
      }
    }
    return null;
  }

  cacheResult(query: string, result: ProductSearchResult): void {
    this.searchCache.set(query.toLowerCase(), result);

    // Save to search history
    this.saveToHistory(query, result);

    // Clean old entries
    if (this.searchCache.size > 50) {
      const oldestKey = this.searchCache.keys().next().value;
      this.searchCache.delete(oldestKey!);
    }
  }

  // Search History Methods
  saveToHistory(query: string, result: ProductSearchResult): void {
    const historyItem: SearchHistoryItem = {
      id: this.generateId(),
      query: query.trim(),
      result: result,
      timestamp: new Date(),
      isFavorite: false,
    };

    const history = this.getSearchHistory();

    // Remove existing entry with same query (avoid duplicates)
    const filteredHistory = history.filter(
      (item) => item.query.toLowerCase() !== query.toLowerCase()
    );

    // Add new item at the beginning
    const updatedHistory = [historyItem, ...filteredHistory].slice(
      0,
      this.MAX_HISTORY_ITEMS
    );

    localStorage.setItem(this.HISTORY_KEY, JSON.stringify(updatedHistory));
  }

  getSearchHistory(): SearchHistoryItem[] {
    try {
      const stored = localStorage.getItem(this.HISTORY_KEY);
      if (!stored) return [];

      const history: SearchHistoryItem[] = JSON.parse(stored);

      // Convert timestamp strings back to Date objects
      return history.map((item) => ({
        ...item,
        timestamp: new Date(item.timestamp),
        result: {
          ...item.result,
          timestamp: new Date(item.result.timestamp),
        },
      }));
    } catch {
      return [];
    }
  }

  addToFavorites(item: SearchHistoryItem): void {
    // Update history item to mark as favorite
    const history = this.getSearchHistory();
    const updatedHistory = history.map((historyItem) =>
      historyItem.id === item.id
        ? { ...historyItem, isFavorite: true }
        : historyItem
    );

    localStorage.setItem(this.HISTORY_KEY, JSON.stringify(updatedHistory));

    // Add to favorites list
    const favorites = this.getFavorites();
    const favorite: SearchFavorite = {
      id: item.id,
      query: item.query,
      displayName: item.result.product || item.query,
      timestamp: new Date(),
    };

    // Check if already exists
    const existingIndex = favorites.findIndex(
      (fav) => fav.query.toLowerCase() === item.query.toLowerCase()
    );
    if (existingIndex === -1) {
      const updatedFavorites = [favorite, ...favorites].slice(
        0,
        this.MAX_FAVORITES
      );

      localStorage.setItem(
        this.FAVORITES_KEY,
        JSON.stringify(updatedFavorites)
      );
    }
  }

  removeFromFavorites(id: string): void {
    // Update history item
    const history = this.getSearchHistory();
    const updatedHistory = history.map((item) =>
      item.id === id ? { ...item, isFavorite: false } : item
    );

    localStorage.setItem(this.HISTORY_KEY, JSON.stringify(updatedHistory));

    // Remove from favorites list
    const favorites = this.getFavorites();
    const updatedFavorites = favorites.filter((fav) => fav.id !== id);

    localStorage.setItem(this.FAVORITES_KEY, JSON.stringify(updatedFavorites));
  }

  getFavorites(): SearchFavorite[] {
    try {
      const stored = localStorage.getItem(this.FAVORITES_KEY);
      if (!stored) return [];

      const favorites: SearchFavorite[] = JSON.parse(stored);

      // Convert timestamp strings back to Date objects
      return favorites.map((fav) => ({
        ...fav,
        timestamp: new Date(fav.timestamp),
      }));
    } catch {
      return [];
    }
  }

  clearHistory(): void {
    localStorage.removeItem(this.HISTORY_KEY);
    localStorage.removeItem(this.FAVORITES_KEY);
  }

  // Search from history/favorites
  searchFromHistory(
    historyItem: SearchHistoryItem
  ): Observable<ProductSearchResult> {
    // Check if result is still fresh (less than cache expiry)
    const age = Date.now() - historyItem.result.timestamp.getTime();
    if (age < this.CACHE_EXPIRY) {
      // Return cached result
      return of(historyItem.result);
    } else {
      // Perform fresh search
      return this.searchProduct(historyItem.query);
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}
