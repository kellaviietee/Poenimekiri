import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { ShoppingService } from '../../services/shopping.service';
import { NONE_CATEGORY_ID } from '../../models/models';

@Component({
  selector: 'app-item-manager',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatAutocompleteModule,
  ],
  templateUrl: './item-manager.component.html',
  styleUrl: './item-manager.component.css',
})
export class ItemManagerComponent implements OnInit {
  readonly service = inject(ShoppingService);
  private readonly route = inject(ActivatedRoute);

  readonly NONE_ID = NONE_CATEGORY_ID;

  selectedCategoryId: string = NONE_CATEGORY_ID;
  itemLabel: string = '';

  get nonNoneCategories() {
    return this.service
      .categories()
      .filter(c => c.id !== NONE_CATEGORY_ID)
      .sort((a, b) => (a.priority ?? Infinity) - (b.priority ?? Infinity));
  }

  get filteredMasterItems(): string[] {
    const filter = this.itemLabel.toLowerCase();
    const all = this.service.masterItems().map(m => m.label);
    if (!filter) return all;
    return all.filter(l => l.toLowerCase().includes(filter));
  }

  ngOnInit(): void {
    // Deep-link: ?item=<label>
    this.route.queryParamMap.subscribe(params => {
      const item = params.get('item');
      if (item) {
        this.itemLabel = item;
        this.onItemSelect(item);
      }
    });
  }

  onItemSelect(label: string): void {
    this.itemLabel = label;
    const mi = this.service.getMasterItemByLabel(label);
    if (mi) {
      this.selectedCategoryId = mi.categoryId ?? NONE_CATEGORY_ID;
    }
  }

  saveItem(): void {
    const label = this.itemLabel.trim();
    if (!label || !this.selectedCategoryId) return;
    this.service.saveOrUpdateMasterItem(label, this.selectedCategoryId);
    this.resetForm();
  }

  removeItem(): void {
    const label = this.itemLabel.trim();
    if (!label) return;
    this.service.removeMasterItem(label);
    this.resetForm();
  }

  private resetForm(): void {
    this.itemLabel = '';
    this.selectedCategoryId = NONE_CATEGORY_ID;
  }
}

