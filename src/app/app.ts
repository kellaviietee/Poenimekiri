import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ShoppingService } from './services/shopping.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    @if (service.loading()) {
      <div class="init-screen">
        <div class="init-spinner"></div>
        <p>Laadin...</p>
      </div>
    } @else {
      <router-outlet />
    }
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100vh; }

    .init-screen {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: 16px;
      color: #666;
      font-family: Roboto, sans-serif;
    }

    .init-spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #e0e0e0;
      border-top-color: #1976d2;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `],
})
export class App implements OnInit {
  readonly service = inject(ShoppingService);

  async ngOnInit(): Promise<void> {
    await this.service.init();
  }
}
