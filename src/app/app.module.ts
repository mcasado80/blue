import { NgModule, LOCALE_ID } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import localeEsCL from '@angular/common/locales/es-CL';
import localeEsAR from '@angular/common/locales/es-AR';
import { AppComponent } from './app.component';
import { ToastComponent } from './components/toast/toast.component';
import { ServiceWorkerModule } from '@angular/service-worker';
import { environment } from '../environments/environment';
import { AppUpdateService } from './services/update.service';
import { CurrencyConverterComponent } from './components/currency-converter/currency-converter.component';
import { ProductSearchComponent } from './components/product-search/product-search.component';
import {
  LucideAngularModule,
  Wifi,
  WifiOff,
  CircleArrowLeft,
  History,
  Search,
  X,
  Trash2,
  Moon,
  Sun,
  Star,
  Clock,
  Trophy,
  Loader2,
  AlertTriangle,
  CircleDollarSign,
  ExternalLink,
} from 'lucide-angular';

registerLocaleData(localeEs);
registerLocaleData(localeEsCL);
registerLocaleData(localeEsAR);

@NgModule({
  declarations: [],
  imports: [
    BrowserModule,
    CommonModule,
    HttpClientModule,
    ReactiveFormsModule,
    AppComponent,
    ToastComponent,
    CurrencyConverterComponent,
    ProductSearchComponent,
    ServiceWorkerModule.register('ngsw-worker.js', {
      enabled: environment.production,
      // Register the ServiceWorker as soon as the application is stable
      // or after 30 seconds (whichever comes first).
      registrationStrategy: 'registerWhenStable:30000',
    }),
    LucideAngularModule.pick({
      Wifi,
      WifiOff,
      CircleArrowLeft,
      History,
      Search,
      X,
      Trash2,
      Moon,
      Sun,
      Star,
      Clock,
      Trophy,
      Loader2,
      AlertTriangle,
      CircleDollarSign,
      ExternalLink,
    }),
  ],
  providers: [AppUpdateService, { provide: LOCALE_ID, useValue: 'es' }],
  bootstrap: [AppComponent],
})
export class AppModule {}
