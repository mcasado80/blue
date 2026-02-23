import {
  Component,
  OnInit,
  OnChanges,
  SimpleChanges,
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
import { TranslationService } from '../../services/translation.service';

@Component({
  selector: 'app-currency-converter',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule],
  templateUrl: './currency-converter.component.html',
  styleUrls: ['./currency-converter.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CurrencyConverterComponent implements OnInit, OnChanges {
  // Inputs from parent
  @Input() exchangeRates: ExchangeRates = {} as ExchangeRates;
  @Input() lastUpdate: Date = new Date();
  @Input() isLoading = false;
  @Input() isOnline = true;
  @Input() isActive = true;
  @Input() incomingPrice: { currency: Currency; value: number } | null = null;

  // Outputs to parent
  @Output() flipRequested = new EventEmitter<void>();
  @Output() refreshRequested = new EventEmitter<void>();
  @Output() selectedCurrenciesChange = new EventEmitter<Currency[]>();

  // Services
  translationService = inject(TranslationService);

  // Currency configuration
  availableCurrencies: Currency[] = [
    'clp',
    'usd',
    'ars',
    'brl',
    'gbp',
    'eur',
    'btc',
  ];
  selectedCurrencies: Currency[] = ['clp', 'usd', 'ars'];

  blueForm: FormGroup = new FormGroup({
    currency1: new FormControl(''),
    currency2: new FormControl(''),
    currency3: new FormControl(''),
  });

  formatters: Record<string, Intl.NumberFormat> = {};
  error: string | null = null;

  // Input tracking
  private focusedInput = '';
  private hasSelectedAll = false;

  ngOnInit(): void {
    this.initializeSelectedCurrencies();
    this.setFormatters();
    this.selectedCurrenciesChange.emit(this.selectedCurrencies);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['incomingPrice'] && this.incomingPrice) {
      this.handleIncomingPrice(this.incomingPrice);
    }
  }

  private handleIncomingPrice(price: {
    currency: Currency;
    value: number;
  }): void {
    this.blueForm.reset();

    const currencyIndex = this.selectedCurrencies.indexOf(price.currency);
    if (currencyIndex >= 0) {
      const fieldName = `currency${currencyIndex + 1}`;
      this.blueForm.patchValue({
        [fieldName]: price.value.toString(),
      });

      setTimeout(() => {
        this.convert({
          target: { id: fieldName, value: price.value.toString() },
        });
      }, 100);
    }

    setTimeout(() => {
      this.convert({
        target: { id: price.currency, value: price.value.toString() },
      });
    }, 300);
  }

  // Keyboard handlers
  @HostListener('document:keydown.enter', ['$event'])
  handleEnterKey(event: KeyboardEvent) {
    if (!this.isActive) return;

    const target = event.target as HTMLElement;
    const isInConverterInput = target.id?.startsWith('currency');

    if (isInConverterInput || target.tagName !== 'INPUT') {
      event.preventDefault();

      if (isInConverterInput && target instanceof HTMLInputElement) {
        const fieldId = target.id;
        const fieldValue = target.value;
        if (fieldValue && fieldValue.trim() !== '') {
          const numericValue = this.parseNumber(fieldValue);
          const currencyIndex =
            parseInt(fieldId.replace('currency', '')) - 1;
          const currency = this.selectedCurrencies[currencyIndex];

          if (numericValue > 0 && currency) {
            const formattedValue = this.formatCurrency(
              numericValue,
              currency
            );
            target.value = formattedValue;
            this.blueForm
              .get(fieldId)
              ?.setValue(formattedValue, { emitEvent: false });
          }

          this.convert({ target: { id: fieldId, value: fieldValue } });
          target.blur();
        }
      } else {
        const currency1Value = this.blueForm.get('currency1')?.value;
        const currency2Value = this.blueForm.get('currency2')?.value;
        const currency3Value = this.blueForm.get('currency3')?.value;

        if (currency1Value) {
          this.convert({
            target: { id: 'currency1', value: currency1Value },
          });
        } else if (currency2Value) {
          this.convert({
            target: { id: 'currency2', value: currency2Value },
          });
        } else if (currency3Value) {
          this.convert({
            target: { id: 'currency3', value: currency3Value },
          });
        }
      }
      this.onButtonClick('medium');
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  handleEscapeKey(event: KeyboardEvent) {
    if (!this.isActive) return;
    event.preventDefault();
    this.blueForm.reset();
    this.onButtonClick('light');
  }

  // Conversion methods
  convert(event: { target?: { id?: string; value?: string } } | null) {
    if (!this.exchangeRates || !this.exchangeRates.timestamp) {
      return;
    }

    const sourceField = event?.target?.id;
    const sourceValue = event?.target?.value;

    if (!sourceField || !sourceValue) {
      return;
    }

    const numericValue = this.parseNumber(sourceValue);
    if (numericValue === 0) {
      return;
    }

    let sourceCurrency: Currency;
    if (sourceField.startsWith('currency')) {
      const index = parseInt(sourceField.replace('currency', '')) - 1;
      sourceCurrency = this.selectedCurrencies[index];
    } else {
      sourceCurrency = sourceField as Currency;
    }

    for (let i = 0; i < this.selectedCurrencies.length; i++) {
      const targetCurrency = this.selectedCurrencies[i];
      const targetFieldName = `currency${i + 1}`;

      if (targetCurrency === sourceCurrency) continue;

      const convertedValue = this.convertCurrency(
        numericValue,
        sourceCurrency,
        targetCurrency
      );

      const formattedValue = this.formatCurrency(
        convertedValue,
        targetCurrency
      );

      this.blueForm
        .get(targetFieldName)
        ?.setValue(formattedValue, { emitEvent: false });
    }
  }

  convertCurrency(
    amount: number,
    fromCurrency: Currency,
    toCurrency: Currency
  ): number {
    if (fromCurrency === toCurrency) return amount;

    const fromRate = this.getExchangeRate(fromCurrency);
    const toRate = this.getExchangeRate(toCurrency);

    if (fromRate === 0) return 0;

    return (amount / fromRate) * toRate;
  }

  formatCurrency(amount: number, currency: Currency): string {
    if (!this.formatters[currency]) {
      return `${amount.toFixed(2)}`;
    }

    return this.formatters[currency].format(amount);
  }

  parseNumber(value: string): number {
    if (!value) return 0;

    if (value.includes('<')) return 0;

    value = value
      .replace(/CLP|US\$|\$|€|EUR|£|GBP|R\$|BRL|ARS|\$|₿|BTC|Bitcoin/gi, '')
      .trim();

    value = value.replace(/\./g, '').replace(',', '.');

    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }

  setFormatters() {
    this.availableCurrencies.forEach((currency) => {
      const currencyCode = currency.toUpperCase();

      if (currency === 'btc') {
        this.formatters[currency] = new Intl.NumberFormat('es-AR', {
          style: 'decimal',
          minimumFractionDigits: 8,
          maximumFractionDigits: 8,
        });
      } else {
        this.formatters[currency] = new Intl.NumberFormat('es-AR', {
          style: 'currency',
          currency: currencyCode,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      }
    });
  }

  // Input handling
  onKeyDown(e: KeyboardEvent) {
    const charCode = e.which ? e.which : e.keyCode;

    if (charCode === 13 || charCode === 27) {
      return;
    }

    return this.restrictChars(e);
  }

  restrictChars(e: KeyboardEvent) {
    const charCode = e.which ? e.which : e.keyCode;

    if (
      this.hasSelectedAll &&
      this.focusedInput === (e.target as HTMLInputElement)?.id
    ) {
      if (
        (charCode >= 48 && charCode <= 57) ||
        (charCode >= 96 && charCode <= 105)
      ) {
        (e.target as HTMLInputElement).value = '';
        this.hasSelectedAll = false;
      }
    }

    if (
      [8, 9, 27, 13].indexOf(charCode) !== -1 ||
      (charCode === 65 && e.ctrlKey === true) ||
      (charCode === 67 && e.ctrlKey === true) ||
      (charCode === 86 && e.ctrlKey === true) ||
      (charCode === 88 && e.ctrlKey === true) ||
      (charCode >= 35 && charCode <= 39)
    ) {
      if (charCode >= 35 && charCode <= 39) {
        this.hasSelectedAll = false;
      }
      return true;
    }

    if (
      charCode === 46 ||
      charCode === 188 ||
      charCode === 190 ||
      charCode === 44 ||
      charCode === 110
    ) {
      const currentValue = (e.target as HTMLInputElement).value;
      if (
        this.hasSelectedAll &&
        this.focusedInput === (e.target as HTMLInputElement)?.id
      ) {
        (e.target as HTMLInputElement).value = '';
        this.hasSelectedAll = false;
      }

      if (
        currentValue.indexOf('.') === -1 &&
        currentValue.indexOf(',') === -1
      ) {
        return true;
      } else {
        return false;
      }
    }

    if (
      (charCode >= 48 && charCode <= 57) ||
      (charCode >= 96 && charCode <= 105)
    ) {
      return true;
    }

    return false;
  }

  onInputFocus(event: FocusEvent) {
    this.focusedInput = (event.target as HTMLInputElement).id;
    this.hasSelectedAll = true;

    setTimeout(() => {
      (event.target as HTMLInputElement).select();
    }, 0);
  }

  onInputChange(event: Event) {
    const inputEvent = event as InputEvent;
    if (
      this.hasSelectedAll &&
      this.focusedInput === (event.target as HTMLInputElement)?.id
    ) {
      this.hasSelectedAll = false;

      const newValue = inputEvent.data || '';
      if (newValue && /[0-9,.]/.test(newValue)) {
        (event.target as HTMLInputElement).value = newValue;
        return;
      }
    }
  }

  onInputBlur(event: FocusEvent) {
    this.hasSelectedAll = false;
    this.focusedInput = '';

    const target = event.target as HTMLInputElement;
    this.convert({ target: { id: target?.id, value: target?.value } });
  }

  // Currency management
  toggleCurrency(index: number, event?: Event): void {
    if (event) {
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT') {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    }

    const currentCurrency = this.selectedCurrencies[index];
    const nextCurrencies = this.getNextAvailableCurrencies(currentCurrency);

    if (nextCurrencies.length > 0) {
      const currentValues: Record<string, string> = {};
      this.selectedCurrencies.forEach((_, i) => {
        const fieldName = `currency${i + 1}`;
        const value = this.blueForm.get(fieldName)?.value;
        if (value && this.parseNumber(value) > 0) {
          currentValues[fieldName] = value;
        }
      });

      this.selectedCurrencies[index] = nextCurrencies[0];
      this.onButtonClick('light');

      this.saveCurrencySelection();
      this.selectedCurrenciesChange.emit([...this.selectedCurrencies]);

      const hasValues = Object.keys(currentValues).length > 0;
      if (hasValues) {
        const referenceField = 'currency2';
        const referenceValue = currentValues[referenceField];

        if (referenceValue) {
          const parsedValue = this.parseNumber(referenceValue);
          this.blueForm.reset();
          this.blueForm.patchValue({
            [referenceField]: parsedValue.toString(),
          });
          setTimeout(() => {
            this.convert({
              target: { id: referenceField, value: parsedValue.toString() },
            });
          }, 100);
        } else {
          const sourceField = Object.keys(currentValues)[0];
          const sourceValue = currentValues[sourceField];
          const parsedValue = this.parseNumber(sourceValue);
          this.blueForm.reset();
          this.blueForm.patchValue({
            [referenceField]: parsedValue.toString(),
          });
          setTimeout(() => {
            this.convert({
              target: { id: referenceField, value: parsedValue.toString() },
            });
          }, 100);
        }
      } else {
        this.blueForm.reset();
      }
    }
  }

  private getNextAvailableCurrencies(currentCurrency: Currency): Currency[] {
    const currentIndex = this.availableCurrencies.indexOf(currentCurrency);
    const availableOptions: Currency[] = [];

    for (let i = 1; i < this.availableCurrencies.length; i++) {
      const nextIndex = (currentIndex + i) % this.availableCurrencies.length;
      const nextCurrency = this.availableCurrencies[nextIndex];

      if (!this.selectedCurrencies.includes(nextCurrency)) {
        availableOptions.push(nextCurrency);
      }
    }

    return availableOptions;
  }

  getCurrencyInfo(currency: Currency) {
    return CURRENCIES[currency];
  }

  getExchangeRate(currency: Currency): number {
    const rate = this.exchangeRates[currency];
    return typeof rate === 'number' ? rate : 1;
  }

  private initializeSelectedCurrencies(): void {
    const saved = localStorage.getItem('selectedCurrencies');
    if (saved) {
      try {
        const parsedCurrencies = JSON.parse(saved);
        const validCurrencies = parsedCurrencies.filter(
          (currency: Currency) => this.availableCurrencies.includes(currency)
        );

        if (validCurrencies.length === 3) {
          this.selectedCurrencies = validCurrencies;
        } else {
          this.selectedCurrencies = ['clp', 'usd', 'ars'];
        }
      } catch {
        this.selectedCurrencies = ['clp', 'usd', 'ars'];
      }
    } else {
      this.selectedCurrencies = ['clp', 'usd', 'ars'];
      this.saveCurrencySelection();
    }
  }

  private saveCurrencySelection(): void {
    try {
      localStorage.setItem(
        'selectedCurrencies',
        JSON.stringify(this.selectedCurrencies)
      );
    } catch {
      // Save failed - continue silently
    }
  }

  resetCurrencySelection(): void {
    this.selectedCurrencies = ['clp', 'usd', 'ars'];
    this.saveCurrencySelection();
    this.blueForm.reset();
    this.selectedCurrenciesChange.emit([...this.selectedCurrencies]);
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
