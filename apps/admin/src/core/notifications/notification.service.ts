import { inject, Injectable } from '@angular/core';
import { MessageService } from 'primeng/api';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly message = inject(MessageService);

  success(detail: string): void {
    this.message.add({ severity: 'success', summary: 'Success', detail, life: 3000 });
  }

  error(detail: string): void {
    this.message.add({ severity: 'error', summary: 'Error', detail, life: 5000 });
  }

  warn(detail: string): void {
    this.message.add({ severity: 'warn', summary: 'Warning', detail });
  }

  info(detail: string): void {
    this.message.add({ severity: 'info', summary: 'Info', detail });
  }
}
