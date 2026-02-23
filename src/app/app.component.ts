import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { AppUpdateService } from './services/update.service';
import {
  ExchangeRateService,
  Currency,
  ExchangeRates,
} from './services/exchange-rate.service';
import { ToastService } from './services/toast.service';
import { ToastComponent } from './components/toast/toast.component';
import { ConnectivityService } from './services/connectivity.service';
import { TranslationService, Language } from './services/translation.service';
import { CurrencyConverterComponent } from './components/currency-converter/currency-converter.component';
import { ProductSearchComponent } from './components/product-search/product-search.component';
import { timer } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    ToastComponent,
    CurrencyConverterComponent,
    ProductSearchComponent,
  ],
  providers: [],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'BlueCoinVerse';

  // Shared state
  exchangeRates: ExchangeRates = {} as ExchangeRates;
  lastUpdate: Date = new Date();
  isLoading = false;
  isOnline = true;
  isFlipped = false;
  isDarkMode = false;

  // Bridge state: converter → search
  converterCurrencies: Currency[] = ['clp', 'usd', 'ars'];

  // Bridge state: search → converter
  selectedPrice: { currency: Currency; value: number } | null = null;

  // Connectivity
  connectionMessage = 'Conectado';
  lastOnlineCheck: Date = new Date();

  // Rates retry
  retryCount = 0;
  private readonly MAX_RETRIES = 3;
  private readonly AUTO_REFRESH_MS = 5 * 60 * 1000;
  private readonly RETRY_BASE_DELAY_MS = 1000;
  refreshInterval: ReturnType<typeof setInterval> | undefined;

  // Language
  currentLanguage: Language = 'es';
  languages: Language[] = ['es', 'en', 'pt'];
  showLanguageDropdown = false;

  // Touch/Swipe
  private touchStartX = 0;
  private touchStartY = 0;
  private touchEndX = 0;
  private touchEndY = 0;
  private minSwipeDistance = 100;
  private maxVerticalDistance = 100;

  // Services
  updateService = inject(AppUpdateService);
  exchangeRateService = inject(ExchangeRateService);
  toastService = inject(ToastService);
  connectivityService = inject(ConnectivityService);
  translationService = inject(TranslationService);

  ngOnInit(): void {
    this.loadCachedRates();
    this.initializeRatesSubscription();
    this.startAutoRefresh();
    this.initializeDarkMode();
    this.initializeConnectivityMonitoring();
    this.initializeLanguage();
  }

  ngOnDestroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  // === Rates Management ===

  private initializeRatesSubscription(): void {
    this.exchangeRateService.rates$.subscribe({
      next: (rates) => {
        if (rates) {
          this.exchangeRates = rates;
          this.lastUpdate = rates.timestamp;
          this.isLoading = false;

          if (this.retryCount > 0) {
            this.toastService.success(this.translate('toast.rates.updated'));
            this.retryCount = 0;
          }
        }
      },
      error: () => {
        this.isLoading = false;
      },
    });

    this.getRates();
  }

  private startAutoRefresh() {
    this.refreshInterval = setInterval(() => {
      this.getRates();
    }, this.AUTO_REFRESH_MS);
  }

  getRates(attempt = 0) {
    if (!this.isOnline) {
      this.toastService.info(this.translate('toast.no.connection.saved'));
      this.loadCachedRates();
      return;
    }

    const currentRates = this.exchangeRateService.getCurrentRates();
    if (!currentRates) {
      this.isLoading = true;
    }

    this.exchangeRateService.getExchangeRates().subscribe({
      next: () => {},
      error: () => {
        this.retryCount = attempt + 1;
        if (this.retryCount < this.MAX_RETRIES) {
          const delay =
            this.RETRY_BASE_DELAY_MS * Math.pow(this.retryCount, 2);
          timer(delay).subscribe(() => {
            this.getRates(this.retryCount);
          });
        } else {
          this.isLoading = false;

          const cachedRates = this.exchangeRateService.getCachedRates(true);
          if (cachedRates) {
            this.loadCachedRates();
            this.toastService.error(
              this.translate('toast.connection.error')
            );
          } else {
            const defaultRates = this.exchangeRateService.getDefaultRates();
            this.exchangeRates = defaultRates;
            this.lastUpdate = defaultRates.timestamp;
            this.toastService.error(
              this.translate('toast.no.saved.data')
            );
          }
          this.retryCount = 0;
        }
      },
    });
  }

  forceRefreshRates(): void {
    this.isLoading = true;
    this.retryCount = 0;

    this.exchangeRateService.forceUpdate().subscribe({
      next: () => {
        this.toastService.success('Actualización forzada completada');
      },
      error: () => {
        this.isLoading = false;
        this.toastService.error('Error en actualización forzada');
      },
    });
  }

  private loadCachedRates() {
    const cachedRates = this.exchangeRateService.getCachedRates();
    if (cachedRates) {
      this.exchangeRates = cachedRates;
      this.lastUpdate = cachedRates.timestamp;
    } else if (!this.isOnline) {
      this.exchangeRates = {
        clp: 1,
        usd: 1,
        ars: 1,
        brl: 1,
        gbp: 1,
        eur: 1,
        btc: 1,
        timestamp: new Date(),
      };
      this.lastUpdate = new Date();
      this.toastService.warning('No hay tasas guardadas disponibles');
    }
  }

  // === Connectivity ===

  private initializeConnectivityMonitoring(): void {
    this.connectivityService.getConnectivityStatus().subscribe((isOnline) => {
      const wasOffline = !this.isOnline;
      this.isOnline = isOnline;
      this.connectionMessage =
        this.connectivityService.getConnectionStatusMessage();
      this.lastOnlineCheck = new Date();

      if (isOnline && wasOffline) {
        this.toastService.success(
          this.translate('toast.connection.restored')
        );
        this.getRates();
      } else if (!isOnline) {
        this.toastService.warning(this.translate('toast.no.connection'));
        this.loadCachedRates();
      }
    });
  }

  isUsingDefaultRates(): boolean {
    return (
      this.lastUpdate &&
      this.lastUpdate.getFullYear() === 2024 &&
      this.lastUpdate.getMonth() === 0 &&
      this.lastUpdate.getDate() === 1
    );
  }

  getConnectionIcon(): string {
    if (this.isUsingDefaultRates()) {
      return 'alert-triangle';
    }
    return this.isOnline ? 'wifi' : 'wifi-off';
  }

  getConnectionStatusText(): string {
    if (this.isUsingDefaultRates()) {
      return this.translate('connection.using.defaults');
    }
    return this.isOnline
      ? this.translate('connection.online')
      : this.translate('connection.offline');
  }

  getWifiIcon(): string {
    if (this.isUsingDefaultRates()) {
      return 'wifi-off';
    }
    if (!this.isOnline) {
      return 'wifi-off';
    }
    return 'wifi';
  }

  getDetailedConnectionStatus(): string {
    if (this.isUsingDefaultRates()) {
      return (
        this.translate('connection.offline') +
        ' - ' +
        this.translate('connection.using.defaults')
      );
    }
    if (!this.isOnline) {
      return (
        this.translate('connection.offline') +
        ' - ' +
        this.translate('connection.using.defaults')
      );
    }

    const cacheAge = this.getCacheAge();
    if (cacheAge) {
      return `${this.translate('connection.online')} - ${this.translate(
        'connection.last.update'
      )}: ${cacheAge}`;
    }

    return (
      this.translate('connection.online') +
      ' - ' +
      this.translate('connection.last.update')
    );
  }

  private getCacheAge(): string | null {
    if (!this.lastUpdate) return null;

    const ageMs = Date.now() - this.lastUpdate.getTime();
    const ageMinutes = Math.floor(ageMs / 60000);
    const ageHours = Math.floor(ageMinutes / 60);
    const ageDays = Math.floor(ageHours / 24);

    if (ageDays > 0) {
      return `hace ${ageDays} día${ageDays > 1 ? 's' : ''}`;
    } else if (ageHours > 0) {
      return `hace ${ageHours} hora${ageHours > 1 ? 's' : ''}`;
    } else if (ageMinutes > 0) {
      return `hace ${ageMinutes} minuto${ageMinutes > 1 ? 's' : ''}`;
    } else {
      return 'hace menos de 1 minuto';
    }
  }

  // === Theme ===

  private initializeDarkMode() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      this.isDarkMode = savedTheme === 'dark';
    } else {
      this.isDarkMode =
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    this.updateTheme();

    if (window.matchMedia) {
      window
        .matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', (e) => {
          if (!localStorage.getItem('theme')) {
            this.isDarkMode = e.matches;
            this.updateTheme();
          }
        });
    }
  }

  toggleDarkMode() {
    this.isDarkMode = !this.isDarkMode;
    localStorage.setItem('theme', this.isDarkMode ? 'dark' : 'light');
    this.updateTheme();
  }

  private updateTheme() {
    if (this.isDarkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }

  // === Language ===

  initializeLanguage(): void {
    this.translationService.currentLanguage$.subscribe((lang) => {
      this.currentLanguage = lang;
    });
  }

  toggleLanguage(): void {
    const currentIndex = this.languages.indexOf(this.currentLanguage);
    const nextIndex = (currentIndex + 1) % this.languages.length;
    const nextLanguage = this.languages[nextIndex];
    this.translationService.setLanguage(nextLanguage);
    this.onButtonClick('light');
  }

  changeLanguage(language: Language): void {
    this.translationService.setLanguage(language);
    this.showLanguageDropdown = false;
    this.onButtonClick('light');
  }

  getFlag(language: Language): string {
    return this.translationService.getLanguageFlag(language);
  }

  getCurrentFlag(): string {
    return this.translationService.getLanguageFlag(this.currentLanguage);
  }

  translate(key: string): string {
    return this.translationService.translate(key);
  }

  // === Flip Orchestration ===

  toggleFlip() {
    this.isFlipped = !this.isFlipped;
  }

  onPriceSelected(event: { currency: Currency; value: number }): void {
    this.selectedPrice = { ...event };
    this.isFlipped = false;
    this.triggerHaptic(50);
    setTimeout(() => {
      this.toastService.success(
        `Valor cargado: ${event.currency.toUpperCase()} ${event.value.toLocaleString(
          'es-ES',
          { minimumFractionDigits: 2, maximumFractionDigits: 2 }
        )}`
      );
    }, 300);
  }

  // === Touch/Swipe ===

  onTouchStart(event: TouchEvent) {
    this.touchStartX = event.touches[0].clientX;
    this.touchStartY = event.touches[0].clientY;
  }

  onTouchEnd(event: TouchEvent) {
    this.touchEndX = event.changedTouches[0].clientX;
    this.touchEndY = event.changedTouches[0].clientY;
    this.handleSwipe();
  }

  private handleSwipe() {
    const deltaX = this.touchEndX - this.touchStartX;
    const deltaY = Math.abs(this.touchEndY - this.touchStartY);

    if (deltaY > this.maxVerticalDistance) {
      return;
    }

    if (Math.abs(deltaX) < this.minSwipeDistance) {
      return;
    }

    if (deltaX > 0) {
      if (this.isFlipped) {
        this.toggleFlip();
        this.triggerHaptic(50);
      }
    } else {
      if (!this.isFlipped) {
        this.toggleFlip();
        this.triggerHaptic(50);
      }
    }
  }

  // === Haptic ===

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
}
