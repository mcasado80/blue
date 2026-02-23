import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type Language = 'es' | 'en' | 'pt';

type Translations = Record<
  string,
  {
    es: string;
    en: string;
    pt: string;
  }
>;

@Injectable({
  providedIn: 'root',
})
export class TranslationService {
  private currentLanguage = new BehaviorSubject<Language>('es');
  public currentLanguage$ = this.currentLanguage.asObservable();

  private translations: Translations = {
    // App name and branding
    'app.name': {
      es: 'BlueCoinVerse',
      en: 'BlueCoinVerse',
      pt: 'BlueCoinVerse',
    },
    'app.tagline': {
      es: 'Conversor universal de divisas',
      en: 'Universal currency converter',
      pt: 'Conversor universal de moedas',
    },
    // Header
    'skip.content': {
      es: 'Saltar al contenido principal',
      en: 'Skip to main content',
      pt: 'Pular para o conteúdo principal',
    },
    'theme.light': {
      es: 'Activar modo claro',
      en: 'Enable light mode',
      pt: 'Ativar modo claro',
    },
    'theme.dark': {
      es: 'Activar modo oscuro',
      en: 'Enable dark mode',
      pt: 'Ativar modo escuro',
    },

    // Connectivity
    'connection.online': {
      es: 'En línea',
      en: 'Online',
      pt: 'Online',
    },
    'connection.offline': {
      es: 'Sin conexión',
      en: 'Offline',
      pt: 'Sem conexão',
    },
    'connection.loading': {
      es: 'Cargando tasas de cambio...',
      en: 'Loading exchange rates...',
      pt: 'Carregando taxas de câmbio...',
    },
    'connection.using.defaults': {
      es: 'Usando valores por defecto',
      en: 'Using default values',
      pt: 'Usando valores padrão',
    },
    'connection.last.update': {
      es: 'Última actualización',
      en: 'Last update',
      pt: 'Última atualização',
    },
    'connection.update': {
      es: 'Actualizar ahora',
      en: 'Update now',
      pt: 'Atualizar agora',
    },
    'connection.refreshing': {
      es: 'Refrescando...',
      en: 'Refreshing...',
      pt: 'Atualizando...',
    },
    'connection.background.update': {
      es: 'Actualizando en segundo plano',
      en: 'Updating in background',
      pt: 'Atualizando em segundo plano',
    },

    // Currency Converter
    'converter.title': {
      es: 'Conversor de divisas',
      en: 'Currency converter',
      pt: 'Conversor de moedas',
    },
    'converter.amount': {
      es: 'Monto',
      en: 'Amount',
      pt: 'Valor',
    },
    'converter.amount.placeholder': {
      es: 'Ingrese el monto',
      en: 'Enter amount',
      pt: 'Digite o valor',
    },
    'converter.from': {
      es: 'De',
      en: 'From',
      pt: 'De',
    },
    'converter.to': {
      es: 'A',
      en: 'To',
      pt: 'Para',
    },
    'converter.convert': {
      es: 'Convertir',
      en: 'Convert',
      pt: 'Converter',
    },
    'converter.exchange.official': {
      es: 'Cambio oficial',
      en: 'Official rate',
      pt: 'Câmbio oficial',
    },
    'converter.exchange.blue': {
      es: 'Dólar Blue',
      en: 'Blue Dollar',
      pt: 'Dólar Blue',
    },
    'converter.clear': {
      es: 'Borrar',
      en: 'Clear',
      pt: 'Limpar',
    },
    'converter.search': {
      es: 'Buscar productos',
      en: 'Search products',
      pt: 'Buscar produtos',
    },

    // Product Search
    'search.title': {
      es: 'Búsqueda de Productos',
      en: 'Product Search',
      pt: 'Busca de Produtos',
    },
    'search.placeholder': {
      es: 'Buscar producto...',
      en: 'Search product...',
      pt: 'Buscar produto...',
    },
    'search.button': {
      es: 'Buscar',
      en: 'Search',
      pt: 'Buscar',
    },
    'search.back': {
      es: 'Volver al conversor',
      en: 'Back to converter',
      pt: 'Voltar ao conversor',
    },
    'search.searching': {
      es: 'Buscando productos...',
      en: 'Searching products...',
      pt: 'Buscando produtos...',
    },
    'search.result.confidence': {
      es: 'Confianza',
      en: 'Confidence',
      pt: 'Confiança',
    },
    'search.result.source': {
      es: 'Fuente',
      en: 'Source',
      pt: 'Fonte',
    },
    'search.history': {
      es: 'Historial de búsquedas',
      en: 'Search history',
      pt: 'Histórico de buscas',
    },
    'search.favorites': {
      es: 'Favoritos',
      en: 'Favorites',
      pt: 'Favoritos',
    },
    'search.clear.history': {
      es: 'Limpiar historial',
      en: 'Clear history',
      pt: 'Limpar histórico',
    },
    'search.cheapest': {
      es: 'Más barato',
      en: 'Cheapest',
      pt: 'Mais barato',
    },
    'currency.bitcoin': {
      es: 'Bitcoin',
      en: 'Bitcoin',
      pt: 'Bitcoin',
    },
    'currency.btc.volatile': {
      es: 'Precio muy volátil',
      en: 'Highly volatile price',
      pt: 'Preço muito volátil',
    },
    'search.no.results': {
      es: 'No se encontraron resultados',
      en: 'No results found',
      pt: 'Nenhum resultado encontrado',
    },

    // Errors
    'error.api': {
      es: 'Error al obtener datos',
      en: 'Error fetching data',
      pt: 'Erro ao buscar dados',
    },
    'error.search': {
      es: 'Error en la búsqueda',
      en: 'Search error',
      pt: 'Erro na busca',
    },

    // Toasts
    'toast.connection.restored': {
      es: 'Conexión restaurada - Actualizando tasas',
      en: 'Connection restored - Updating rates',
      pt: 'Conexão restaurada - Atualizando taxas',
    },
    'toast.no.connection': {
      es: 'Sin conexión - Usando datos guardados',
      en: 'No connection - Using saved data',
      pt: 'Sem conexão - Usando dados salvos',
    },
    'toast.rates.updated': {
      es: 'Tasas de cambio actualizadas',
      en: 'Exchange rates updated',
      pt: 'Taxas de câmbio atualizadas',
    },
    'toast.connection.error': {
      es: 'Error de conexión - Usando valores guardados',
      en: 'Connection error - Using saved values',
      pt: 'Erro de conexão - Usando valores salvos',
    },
    'toast.no.saved.data': {
      es: 'Sin conexión ni datos guardados - Valores aproximados',
      en: 'No connection or saved data - Approximate values',
      pt: 'Sem conexão ou dados salvos - Valores aproximados',
    },
    'toast.no.connection.saved': {
      es: 'Sin conexión - Usando tasas guardadas',
      en: 'No connection - Using saved rates',
      pt: 'Sem conexão - Usando taxas salvas',
    },

    // Countries and currencies
    'country.argentina': {
      es: 'Argentina',
      en: 'Argentina',
      pt: 'Argentina',
    },
    'country.chile': {
      es: 'Chile',
      en: 'Chile',
      pt: 'Chile',
    },
    'country.usa': {
      es: 'Estados Unidos',
      en: 'United States',
      pt: 'Estados Unidos',
    },
    'currency.ars': {
      es: 'Peso Argentino',
      en: 'Argentine Peso',
      pt: 'Peso Argentino',
    },
    'currency.clp': {
      es: 'Peso Chileno',
      en: 'Chilean Peso',
      pt: 'Peso Chileno',
    },
    'currency.usd': {
      es: 'Dólar USD',
      en: 'US Dollar',
      pt: 'Dólar Americano',
    },
    'currency.brl': {
      es: 'Real Brasileño',
      en: 'Brazilian Real',
      pt: 'Real Brasileiro',
    },
    'currency.gbp': {
      es: 'Libra Esterlina',
      en: 'British Pound',
      pt: 'Libra Esterlina',
    },
    'currency.eur': {
      es: 'Euro',
      en: 'Euro',
      pt: 'Euro',
    },
    'country.brazil': {
      es: 'Brasil',
      en: 'Brazil',
      pt: 'Brasil',
    },
    'country.uk': {
      es: 'Reino Unido',
      en: 'United Kingdom',
      pt: 'Reino Unido',
    },
    'country.eu': {
      es: 'Unión Europea',
      en: 'European Union',
      pt: 'União Europeia',
    },
  };

  constructor() {
    // Check for saved language preference
    const savedLanguage = localStorage.getItem('language') as Language;
    if (savedLanguage && ['es', 'en', 'pt'].includes(savedLanguage)) {
      this.currentLanguage.next(savedLanguage);
    } else {
      // Try to detect browser language
      const browserLang = navigator.language.toLowerCase();
      if (browserLang.startsWith('pt')) {
        this.currentLanguage.next('pt');
      } else if (browserLang.startsWith('en')) {
        this.currentLanguage.next('en');
      } else {
        this.currentLanguage.next('es');
      }
    }
  }

  getCurrentLanguage(): Language {
    return this.currentLanguage.value;
  }

  setLanguage(language: Language): void {
    this.currentLanguage.next(language);
    localStorage.setItem('language', language);
  }

  translate(key: string): string {
    const translation = this.translations[key];
    if (!translation) {
      return key;
    }
    return translation[this.currentLanguage.value];
  }

  getLanguageFlag(language: Language): string {
    const flags = {
      es: 'https://cdn.ipregistry.co/flags/emojitwo/ar.svg',
      en: 'https://cdn.ipregistry.co/flags/emojitwo/us.svg',
      pt: 'https://cdn.ipregistry.co/flags/emojitwo/br.svg',
    };
    return flags[language];
  }

  getLanguageName(language: Language): string {
    const names = {
      es: 'Español',
      en: 'English',
      pt: 'Português',
    };
    return names[language];
  }
}
