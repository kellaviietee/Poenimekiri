import {
  Component,
  ElementRef,
  inject,
  OnInit,
  QueryList,
  ViewChildren,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ShoppingService } from '../../services/shopping.service';
import { ShoppingItem } from '../../models/models';

@Component({
  selector: 'app-shopping-list',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatAutocompleteModule,
    MatTooltipModule,
  ],
  templateUrl: './shopping-list.component.html',
  styleUrl: './shopping-list.component.css',
})
export class ShoppingListComponent implements OnInit {
  readonly service = inject(ShoppingService);
  private readonly router = inject(Router);

  /** Tracks current typed value per item id (for autocomplete filtering) */
  inputValues: Record<string, string> = {};

  /** Id of the item we want to focus after the next render */
  private pendingFocusId: string | null = null;

  @ViewChildren('labelInput') labelInputs!: QueryList<ElementRef<HTMLInputElement>>;

  ngOnInit(): void {
    this.service.syncCategoriesFromMaster();
  }

  get shoppingList() {
    return this.service.shoppingList;
  }

  // ── Autocomplete ──────────────────────────────────────────────────────────

  onLabelInput(id: string, value: string): void {
    this.inputValues[id] = value;
  }

  getSuggestions(id: string): string[] {
    const filter = (this.inputValues[id] ?? '').toLowerCase();
    if (filter.length < 1) return [];
    return this.service
      .masterItems()
      .map(m => m.label)
      .filter(l => l.toLowerCase().startsWith(filter))
      .slice(0, 10);
  }

  onAutocompleteSelect(id: string, value: string): void {
    delete this.inputValues[id];
    const nextId = this.service.commitLabel(id, value, false);
    if (nextId) this.focusItem(nextId);
  }

  // ── Keyboard ──────────────────────────────────────────────────────────────

  onEnter(id: string, value: string, event: Event, idx: number): void {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return; // blank → no-op

    delete this.inputValues[id];
    const list = this.service.shoppingList();
    const isLast = idx === list.length - 1;
    // "Next" if not last row, "Done" if last row
    const nextId = this.service.commitLabel(id, trimmed, !isLast);
    if (nextId) this.focusItem(nextId);
  }

  // ── Row actions ───────────────────────────────────────────────────────────

  toggleChecked(id: string): void {
    this.service.toggleChecked(id);
  }

  updateQuantity(id: string, value: number): void {
    this.service.updateQuantity(id, value);
  }

  deleteItem(id: string): void {
    this.service.deleteItem(id);
    const list = this.service.shoppingList();
    if (list.length === 0) {
      const blankId = this.service.addBlankRow();
      this.focusItem(blankId);
    }
  }

  isCategorised(item: ShoppingItem): boolean {
    return this.service.isCategorised(item);
  }

  onStatusClick(id: string, label: string): void {
    if (!label.trim()) return;
    this.service.ensureMasterItem(label);
    this.router.navigate(['/items'], { queryParams: { item: label } });
  }

  sortList(): void {
    this.service.sortList();
    // Clear focus after sorting to avoid quantity field stealing focus
    (document.activeElement as HTMLElement)?.blur();
  }

  // ── Focus management ──────────────────────────────────────────────────────

  private focusItem(id: string): void {
    this.pendingFocusId = id;
    // Wait one tick for *ngFor / @for to render the new row
    setTimeout(() => {
      this.doFocus(id);
    }, 50);
  }

  private doFocus(id: string): void {
    const list = this.service.shoppingList();
    const idx = list.findIndex(i => i.id === id);
    const inputs = this.labelInputs.toArray();
    if (idx !== -1 && inputs[idx]) {
      inputs[idx].nativeElement.focus();
    }
    this.pendingFocusId = null;
  }
}




