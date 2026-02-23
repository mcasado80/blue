import { Injectable, inject } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs/operators';
@Injectable({
  providedIn: 'root',
})
export class AppUpdateService {
  private readonly updates = inject(SwUpdate);

  constructor() {
    this.updates.versionUpdates
      .pipe(
        filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY')
      )
      .subscribe(() => {
        this.showAppUpdateAlert();
      });
  }
  showAppUpdateAlert() {
    const message =
      'Actualización disponible. Presione Aceptar para actualizar.';
    if (confirm(message)) {
      this.doAppUpdate();
    }
  }
  doAppUpdate() {
    this.updates.activateUpdate().then(() => document.location.reload());
  }
}
