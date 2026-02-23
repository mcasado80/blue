import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { ToastService, Toast } from '../../services/toast.service';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-toast',
  templateUrl: './toast.component.html',
  styleUrls: ['./toast.component.scss'],
  standalone: true,
  imports: [CommonModule],
})
export class ToastComponent implements OnInit, OnDestroy {
  toasts: Toast[] = [];
  private subscription!: Subscription;

  private toastService = inject(ToastService);

  ngOnInit() {
    this.subscription = this.toastService.toast$.subscribe((toast) => {
      this.toasts.push(toast);
      setTimeout(() => this.removeToast(toast), toast.duration || 3000);
    });
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  removeToast(toast: Toast) {
    this.toasts = this.toasts.filter((t) => t !== toast);
  }

  getToastClass(type: string): string {
    return `toast toast-${type}`;
  }

  hide() {
    // Remove the most recent toast or implement hide logic
    if (this.toasts.length > 0) {
      this.removeToast(this.toasts[this.toasts.length - 1]);
    }
  }
}
