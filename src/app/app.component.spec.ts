import { TestBed, ComponentFixture } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { AppComponent } from './app.component';
import { AppUpdateService } from './services/update.service';
import { ExchangeRateService } from './services/exchange-rate.service';
import { ToastService } from './services/toast.service';
import { ConnectivityService } from './services/connectivity.service';
import { TranslationService } from './services/translation.service';
import { ServiceWorkerModule } from '@angular/service-worker';
import { of } from 'rxjs';

describe('AppComponent', () => {
  let component: AppComponent;
  let fixture: ComponentFixture<AppComponent>;
  let exchangeRateService: jasmine.SpyObj<ExchangeRateService>;
  let toastService: jasmine.SpyObj<ToastService>;
  let connectivityService: jasmine.SpyObj<ConnectivityService>;
  let translationService: jasmine.SpyObj<TranslationService>;

  beforeEach(async () => {
    const exchangeRateServiceSpy = jasmine.createSpyObj('ExchangeRateService', [
      'getExchangeRates',
      'getCachedRates',
      'saveCachedRates',
      'getDefaultRates',
      'getCurrentRates',
      'forceUpdate',
    ], {
      rates$: of(null),
    });
    const toastServiceSpy = jasmine.createSpyObj('ToastService', [
      'success',
      'error',
      'info',
      'warning',
    ]);
    const updateServiceSpy = jasmine.createSpyObj('AppUpdateService', [
      'checkForUpdate',
    ]);
    const connectivityServiceSpy = jasmine.createSpyObj('ConnectivityService', [
      'getConnectivityStatus',
      'getConnectionStatusMessage',
      'isConnectionSuitableForSearch',
    ]);
    const translationServiceSpy = jasmine.createSpyObj(
      'TranslationService',
      ['translate', 'setLanguage', 'getLanguageFlag', 'getLanguageName'],
      {
        currentLanguage$: of('es'),
      }
    );

    await TestBed.configureTestingModule({
      imports: [
        AppComponent,
        HttpClientTestingModule,
        ServiceWorkerModule.register('ngsw-worker.js', { enabled: false }),
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        { provide: ExchangeRateService, useValue: exchangeRateServiceSpy },
        { provide: ToastService, useValue: toastServiceSpy },
        { provide: AppUpdateService, useValue: updateServiceSpy },
        { provide: ConnectivityService, useValue: connectivityServiceSpy },
        { provide: TranslationService, useValue: translationServiceSpy },
      ],
    }).compileComponents();

    exchangeRateService = TestBed.inject(
      ExchangeRateService
    ) as jasmine.SpyObj<ExchangeRateService>;
    toastService = TestBed.inject(ToastService) as jasmine.SpyObj<ToastService>;
    connectivityService = TestBed.inject(
      ConnectivityService
    ) as jasmine.SpyObj<ConnectivityService>;
    translationService = TestBed.inject(
      TranslationService
    ) as jasmine.SpyObj<TranslationService>;
  });

  beforeEach(() => {
    exchangeRateService.getCachedRates.and.returnValue({
      clp: 900,
      usd: 1000,
      ars: 1000,
      brl: 5.5,
      gbp: 0.8,
      eur: 0.9,
      btc: 0.000024,
      timestamp: new Date(),
    });

    connectivityService.getConnectivityStatus.and.returnValue(of(true));
    connectivityService.getConnectionStatusMessage.and.returnValue('Connected');
    translationService.translate.and.callFake((key: string) => key);

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Flip Orchestration', () => {
    it('should toggle flip state', () => {
      expect(component.isFlipped).toBe(false);
      component.toggleFlip();
      expect(component.isFlipped).toBe(true);
      component.toggleFlip();
      expect(component.isFlipped).toBe(false);
    });

    it('should handle price selected from search', () => {
      component.isFlipped = true;
      component.onPriceSelected({ currency: 'usd', value: 100 });
      expect(component.selectedPrice).toEqual({ currency: 'usd', value: 100 });
      expect(component.isFlipped).toBe(false);
    });
  });

  describe('Auto Refresh', () => {
    beforeEach(() => {
      jasmine.clock().install();
    });

    afterEach(() => {
      jasmine.clock().uninstall();
    });

    it('should refresh rates every 5 minutes', () => {
      const mockRates = {
        clp: 900,
        usd: 1000,
        ars: 1000,
        brl: 5.5,
        gbp: 0.8,
        eur: 0.9,
        btc: 0.000024,
        timestamp: new Date(),
      };

      exchangeRateService.getExchangeRates.and.returnValue(of(mockRates));
      exchangeRateService.getCurrentRates.and.returnValue(mockRates);
      spyOn(component, 'getRates').and.callThrough();

      component.ngOnInit();

      expect(component.getRates).toHaveBeenCalledTimes(1);

      jasmine.clock().tick(5 * 60 * 1000);

      expect(component.getRates).toHaveBeenCalledTimes(2);
    });

    it('should clear interval on destroy', () => {
      exchangeRateService.getExchangeRates.and.returnValue(
        of({
          clp: 900,
          usd: 1000,
          ars: 1000,
          brl: 5.5,
          gbp: 0.8,
          eur: 0.9,
          btc: 0.000024,
          timestamp: new Date(),
        })
      );
      exchangeRateService.getCurrentRates.and.returnValue(null as any);

      component.ngOnInit();
      expect(component.refreshInterval).toBeDefined();

      const intervalId = component.refreshInterval;
      component.ngOnDestroy();

      expect(component.refreshInterval).toBe(intervalId);
    });
  });
});
