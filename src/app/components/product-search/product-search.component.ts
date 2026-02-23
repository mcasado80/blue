import {
  Component,
  OnInit,
  Input,
  Output,
  EventEmitter,
  HostListener,
  inject,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import {
  Currency,
  CURRENCIES,
  ExchangeRates,
} from '../../services/exchange-rate.service';
import {
  ProductSearchService,
  ProductSearchResult,
  SearchHistoryItem,
  SearchFavorite,
} from '../../services/product-search.service';
import { ToastService } from '../../services/toast.service';
import { ConnectivityService } from '../../services/connectivity.service';
import { TranslationService } from '../../services/translation.service';

@Component({
  selector: 'app-product-search',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule],
  templateUrl: './product-search.component.html',
  styleUrls: ['./product-search.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class ProductSearchComponent implements OnInit {
  // Inputs from parent
  @Input() selectedCurrencies: Currency[] = ['clp', 'usd', 'ars'];
  @Input() exchangeRates: ExchangeRates = {} as ExchangeRates;
  @Input() isOnline = true;
  @Input() isActive = false;

  // Outputs to parent
  @Output() flipRequested = new EventEmitter<void>();
  @Output() priceSelected = new EventEmitter<{
    currency: Currency;
    value: number;
  }>();

  // Services
  private productSearchService = inject(ProductSearchService);
  private toastService = inject(ToastService);
  private connectivityService = inject(ConnectivityService);
  translationService = inject(TranslationService);

  // Search state
  searchForm: FormGroup = new FormGroup({
    query: new FormControl({ value: '', disabled: false }),
  });
  searchResult: ProductSearchResult | null = null;
  isSearching = false;

  // History and favorites
  searchHistory: SearchHistoryItem[] = [];
  searchFavorites: SearchFavorite[] = [];
  showSearchHistory = false;

  ngOnInit(): void {
    this.loadSearchHistory();
  }

  // Keyboard handler
  @HostListener('document:keydown.escape', ['$event'])
  handleEscapeKey(event: Event) {
    if (!this.isActive) return;
    const keyboardEvent = event as KeyboardEvent;
    keyboardEvent.preventDefault();
    this.clearSearch();
  }

  // Search methods
  searchProduct() {
    const query = this.searchForm.get('query')?.value?.trim();
    if (!query) {
      this.toastService.warning('Ingresa un producto para buscar');
      return;
    }

    if (query.length > 200) {
      this.toastService.warning(
        'La búsqueda es demasiado larga (máx. 200 caracteres)'
      );
      return;
    }

    if (!this.isOnline) {
      this.toastService.error(
        'La búsqueda con IA requiere conexión a internet'
      );
      return;
    }

    if (!this.connectivityService.isConnectionSuitableForSearch()) {
      this.toastService.warning(
        'Conexión lenta - La búsqueda puede tardar más tiempo'
      );
    }

    const cached = this.productSearchService.getCachedResult(query);
    if (cached) {
      this.searchResult = cached;
      this.toastService.info('Resultado desde caché');
      return;
    }

    this.isSearching = true;
    this.searchResult = null;

    this.searchForm.get('query')?.disable();

    this.productSearchService.searchProduct(query).subscribe({
      next: (result) => {
        this.searchResult = result;
        this.isSearching = false;
        this.searchForm.get('query')?.enable();

        if (result.confidence > 0) {
          this.productSearchService.cacheResult(query, result);
          this.loadSearchHistory();
          this.toastService.success(
            `Producto encontrado (${result.confidence}% confianza)`
          );
        } else {
          this.toastService.error(
            'No se pudo obtener información del producto'
          );
        }
      },
      error: () => {
        this.isSearching = false;
        this.searchForm.get('query')?.enable();
        this.toastService.error(
          'Error al buscar el producto. Intenta nuevamente.'
        );
      },
    });
  }

  onSearchKeyPress(event: Event) {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.key === 'Enter') {
      this.searchProduct();
    }
  }

  clearSearch() {
    this.searchForm.reset();
    this.searchResult = null;
    this.showSearchHistory = false;
    this.triggerHaptic(25);
  }

  // History and Favorites
  loadSearchHistory(): void {
    this.searchHistory = this.productSearchService.getSearchHistory();
    this.searchFavorites = this.productSearchService.getFavorites();
  }

  toggleSearchHistory(): void {
    this.showSearchHistory = !this.showSearchHistory;
    if (this.showSearchHistory) {
      this.loadSearchHistory();
    }
    this.triggerHaptic(25);
  }

  searchFromHistory(historyItem: SearchHistoryItem): void {
    this.showSearchHistory = false;
    this.searchForm.patchValue({ query: historyItem.query });

    if (!this.isOnline) {
      this.searchResult = historyItem.result;
      this.toastService.info(
        'Sin conexión - Mostrando resultado guardado'
      );
      return;
    }

    this.isSearching = true;
    this.searchResult = null;

    this.productSearchService.searchFromHistory(historyItem).subscribe({
      next: (result) => {
        this.searchResult = result;
        this.isSearching = false;

        if (result.confidence > 0) {
          this.toastService.success(
            `${historyItem.query} - Resultado actualizado`
          );
        } else {
          this.toastService.error(
            'No se pudo obtener información actualizada'
          );
        }
      },
      error: () => {
        this.isSearching = false;
        this.toastService.error('Error al buscar desde historial');
      },
    });
  }

  toggleFavorite(historyItem: SearchHistoryItem): void {
    if (historyItem.isFavorite) {
      this.productSearchService.removeFromFavorites(historyItem.id);
      this.toastService.info('Eliminado de favoritos');
    } else {
      this.productSearchService.addToFavorites(historyItem);
      this.toastService.success('Agregado a favoritos');
    }

    this.loadSearchHistory();
    this.triggerHaptic(25);
  }

  clearSearchHistory(): void {
    if (
      confirm(
        '¿Estás seguro de que quieres borrar todo el historial de búsquedas?'
      )
    ) {
      this.productSearchService.clearHistory();
      this.loadSearchHistory();
      this.toastService.info('Historial de búsquedas borrado');
      this.triggerHaptic(50);
    }
  }

  getRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) {
      return 'Ahora';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m`;
    } else if (diffHours < 24) {
      return `${diffHours}h`;
    } else if (diffDays < 7) {
      return `${diffDays}d`;
    } else {
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
      });
    }
  }

  trackByHistoryId(_index: number, item: SearchHistoryItem): string {
    return item.id;
  }

  trackByFavoriteId(_index: number, item: SearchFavorite): string {
    return item.id;
  }

  getHistoryItemById(id: string): SearchHistoryItem {
    return (
      this.searchHistory.find((item) => item.id === id) ||
      this.searchHistory[0]
    );
  }

  // Price comparison methods
  getSearchResultPrice(
    result: ProductSearchResult,
    currency: Currency
  ): number {
    if (!result) return 0;

    if (currency === 'btc') {
      const usdPrice = this.getSearchResultPrice(result, 'usd');
      if (usdPrice > 0) {
        const btcRate = this.getExchangeRate('btc');
        return usdPrice * btcRate;
      }
      return 0;
    }

    if (result.prices && result.prices[currency]) {
      return result.prices[currency];
    }

    const legacyMapping: Partial<Record<Currency, keyof ProductSearchResult>> =
      {
        clp: 'chile',
        ars: 'argentina',
        usd: 'usa',
        brl: 'brazil',
        gbp: 'uk',
        eur: 'eu',
      };

    const legacyProperty = legacyMapping[currency];
    if (legacyProperty && result[legacyProperty]) {
      return result[legacyProperty] as number;
    }

    return 0;
  }

  getCheapestPrice(
    result: ProductSearchResult
  ): { currency: Currency; price: number } | null {
    if (!result) return null;

    const prices: { currency: Currency; price: number }[] = [];

    this.selectedCurrencies.forEach((currency) => {
      if (currency === 'btc') return;

      const price = this.getSearchResultPrice(result, currency);
      if (price > 0) {
        const rate = this.getExchangeRate(currency);
        const usdPrice = price / rate;
        prices.push({ currency, price: usdPrice });
      }
    });

    if (prices.length === 0) return null;

    const cheapest = prices.reduce((min, current) =>
      current.price < min.price ? current : min
    );

    return cheapest;
  }

  getPriceDifference(
    result: ProductSearchResult,
    currency: Currency
  ): number | null {
    if (!result) return null;
    if (currency === 'btc') return null;

    const cheapest = this.getCheapestPrice(result);
    if (!cheapest) return null;

    const currentPrice = this.getSearchResultPrice(result, currency);
    if (currentPrice <= 0) return null;

    const currentRate = this.getExchangeRate(currency);
    const currentUsdPrice = currentPrice / currentRate;

    const difference =
      ((currentUsdPrice - cheapest.price) / cheapest.price) * 100;

    return Math.round(difference);
  }

  isCheapestOption(result: ProductSearchResult, currency: Currency): boolean {
    if (currency === 'btc') return false;

    const difference = this.getPriceDifference(result, currency);
    return difference === 0;
  }

  // URL methods
  getProductUrl(
    result: ProductSearchResult,
    currency: Currency
  ): string | undefined {
    if (!result.urls) return undefined;
    return result.urls[currency];
  }

  openProductUrl(url: string): void {
    if (url) {
      window.open(url, '_blank');
      this.triggerHaptic(25);
    }
  }

  // Price selection → emit to parent
  onPriceClick(currency: Currency, value: number): void {
    this.priceSelected.emit({ currency, value });
    this.triggerHaptic(50);
  }

  // Helpers
  getCurrencyInfo(currency: Currency) {
    return CURRENCIES[currency];
  }

  getExchangeRate(currency: Currency): number {
    const rate = this.exchangeRates[currency];
    return typeof rate === 'number' ? rate : 1;
  }

  // Haptic feedback
  private triggerHaptic(pattern: number | number[] = 50) {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }

  onButtonClick(type: 'light' | 'medium' | 'heavy' = 'light') {
    switch (type) {
      case 'light':
        this.triggerHaptic(25);
        break;
      case 'medium':
        this.triggerHaptic(50);
        break;
      case 'heavy':
        this.triggerHaptic(100);
        break;
    }
  }

  // Translation wrapper
  translate(key: string): string {
    return this.translationService.translate(key);
  }
}
