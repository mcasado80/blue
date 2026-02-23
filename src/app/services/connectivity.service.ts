import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, fromEvent, merge, of } from 'rxjs';
import { map, startWith, distinctUntilChanged } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class ConnectivityService {
  private isOnlineSubject = new BehaviorSubject<boolean>(navigator.onLine);
  private connectionTypeSubject = new BehaviorSubject<string>('unknown');

  constructor() {
    this.initializeConnectivityMonitoring();
  }

  private initializeConnectivityMonitoring(): void {
    // Listen to online/offline events
    const online$ = fromEvent(window, 'online').pipe(map(() => true));
    const offline$ = fromEvent(window, 'offline').pipe(map(() => false));

    // Merge online/offline events
    merge(online$, offline$)
      .pipe(startWith(navigator.onLine), distinctUntilChanged())
      .subscribe((isOnline) => {
        this.isOnlineSubject.next(isOnline);
        this.updateConnectionType();
      });

    // Initial connection type check
    this.updateConnectionType();
  }

  private updateConnectionType(): void {
    if ('connection' in navigator) {
      const connection =
        (navigator as { connection?: { effectiveType?: string } }).connection ||
        (navigator as { webkitConnection?: { effectiveType?: string } })
          .webkitConnection ||
        (navigator as { mozConnection?: { effectiveType?: string } })
          .mozConnection;

      if (connection) {
        this.connectionTypeSubject.next(connection.effectiveType || 'unknown');
      }
    }
  }

  /**
   * Observable that emits current connectivity status
   */
  getConnectivityStatus(): Observable<boolean> {
    return this.isOnlineSubject.asObservable();
  }

  /**
   * Get current connectivity status synchronously
   */
  isOnline(): boolean {
    return this.isOnlineSubject.value;
  }

  /**
   * Get current connection type (4g, 3g, 2g, slow-2g)
   */
  getConnectionType(): Observable<string> {
    return this.connectionTypeSubject.asObservable();
  }

  /**
   * Check connectivity by attempting to reach a reliable endpoint
   */
  checkConnectivity(): Observable<boolean> {
    if (!navigator.onLine) {
      return of(false);
    }

    // Try to fetch a small, reliable resource
    return new Observable<boolean>((observer) => {
      const timeout = setTimeout(() => {
        observer.next(false);
        observer.complete();
      }, 5000);

      fetch('https://httpbin.org/status/200', {
        method: 'HEAD',
        cache: 'no-cache',
      })
        .then((response) => {
          clearTimeout(timeout);
          observer.next(response.ok);
          observer.complete();
        })
        .catch(() => {
          clearTimeout(timeout);
          observer.next(false);
          observer.complete();
        });
    });
  }

  /**
   * Get user-friendly connection status message
   */
  getConnectionStatusMessage(): string {
    if (!this.isOnline()) {
      return 'Sin conexi\u00f3n a internet';
    }

    const connectionType = this.connectionTypeSubject.value;
    switch (connectionType) {
      case 'slow-2g':
        return 'Conexi\u00f3n muy lenta';
      case '2g':
        return 'Conexi\u00f3n lenta';
      case '3g':
        return 'Conexi\u00f3n moderada';
      case '4g':
        return 'Conexi\u00f3n r\u00e1pida';
      default:
        return 'Conectado';
    }
  }

  /**
   * Check if connection is suitable for heavy operations (like AI search)
   */
  isConnectionSuitableForSearch(): boolean {
    if (!this.isOnline()) {
      return false;
    }

    const connectionType = this.connectionTypeSubject.value;
    // Allow search on 3g and better connections
    return !['slow-2g', '2g'].includes(connectionType);
  }
}
