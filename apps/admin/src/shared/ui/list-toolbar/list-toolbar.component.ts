import { Component } from '@angular/core';

@Component({
  selector: 'app-list-toolbar',
  standalone: true,
  template: `
    <div class="list-toolbar mb-4 flex flex-wrap items-center gap-2">
      <ng-content />
    </div>
  `,
})
export class ListToolbarComponent {}
