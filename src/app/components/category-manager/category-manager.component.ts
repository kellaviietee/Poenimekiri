import { Component, computed, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { ShoppingService } from '../../services/shopping.service';
import { NONE_CATEGORY_ID } from '../../models/models';

@Component({
  selector: 'app-category-manager',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
  ],
  templateUrl: './category-manager.component.html',
  styleUrl: './category-manager.component.css',
})
export class CategoryManagerComponent implements OnInit {
  readonly service = inject(ShoppingService);

  readonly NONE_ID = NONE_CATEGORY_ID;

  selectedCategoryId: string = NONE_CATEGORY_ID;
  categoryName: string = '';
  categoryPriority: number | null = null;

  readonly nonNoneCategories = computed(() =>
    this.service.categories().filter(c => c.id !== NONE_CATEGORY_ID)
  );

  readonly sortedCategories = computed(() =>
    [...this.service.categories()].sort((a, b) => {
      if (a.id === NONE_CATEGORY_ID) return 1;
      if (b.id === NONE_CATEGORY_ID) return -1;
      const pa = a.priority ?? Infinity;
      const pb = b.priority ?? Infinity;
      return pa - pb;
    })
  );

  ngOnInit(): void {}

  onCategorySelect(id: string): void {
    if (id === NONE_CATEGORY_ID) {
      this.categoryName = '';
      this.categoryPriority = null;
      return;
    }
    const cat = this.service.categories().find(c => c.id === id);
    if (cat) {
      this.categoryName = cat.name;
      this.categoryPriority = cat.priority;
    }
  }

  saveCategory(): void {
    const name = this.categoryName.trim();
    if (!name) return;

    if (this.selectedCategoryId === NONE_CATEGORY_ID) {
      // Create new
      this.service.addCategory(name, this.categoryPriority);
    } else {
      // Update existing
      this.service.updateCategory(
        this.selectedCategoryId,
        name,
        this.categoryPriority
      );
    }
    this.resetForm();
  }

  removeCategory(): void {
    if (this.selectedCategoryId === NONE_CATEGORY_ID) return;
    this.service.removeCategory(this.selectedCategoryId);
    this.resetForm();
  }

  removeAllCategories(): void {
    this.service.removeAllCategories();
    this.resetForm();
  }

  private resetForm(): void {
    this.selectedCategoryId = NONE_CATEGORY_ID;
    this.categoryName = '';
    this.categoryPriority = null;
  }
}


