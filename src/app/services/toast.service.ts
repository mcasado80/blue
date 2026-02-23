import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface Toast {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toastSubject = new Subject<Toast>();
  public toast$ = this.toastSubject.asObservable();
  
  show(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info', duration = 3000) {
    this.toastSubject.next({ message, type, duration });
  }
  
  success(message: string, duration?: number) {
    this.show(message, 'success', duration);
  }
  
  error(message: string, duration?: number) {
    this.show(message, 'error', duration);
  }
  
  info(message: string, duration?: number) {
    this.show(message, 'info', duration);
  }
  
  warning(message: string, duration?: number) {
    this.show(message, 'warning', duration);
  }
}