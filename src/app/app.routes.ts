import { Routes } from '@angular/router';
import { ShoppingListComponent } from './components/shopping-list/shopping-list.component';
import { CategoryManagerComponent } from './components/category-manager/category-manager.component';
import { ItemManagerComponent } from './components/item-manager/item-manager.component';

export const routes: Routes = [
  { path: '', component: ShoppingListComponent },
  { path: 'categories', component: CategoryManagerComponent },
  { path: 'items', component: ItemManagerComponent },
  { path: '**', redirectTo: '' },
];
