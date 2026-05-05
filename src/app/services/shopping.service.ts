import { Injectable, inject, signal } from '@angular/core';
import {
  Category,
  MasterItem,
  NONE_CATEGORY,
  NONE_CATEGORY_ID,
  ShoppingItem,
} from '../models/models';
import { FirebaseService } from './firebase.service';

@Injectable({ providedIn: 'root' })
export class ShoppingService {
  private fb = inject(FirebaseService);

  readonly shoppingList = signal<ShoppingItem[]>([]);
  readonly masterItems = signal<MasterItem[]>([]);
  readonly categories = signal<Category[]>([]);
  /** True while the initial Firestore data is loading. */
  readonly loading = signal(true);

  // ── Startup ───────────────────────────────────────────────────────────────

  /**
   * Must be called once on app startup (AppComponent.ngOnInit).
   * Signs in anonymously, connects real-time Firestore listeners for all
   * three collections, waits for the first data snapshot, then runs
   * post-init setup.
   */
  async init(): Promise<void> {
    await this.fb.signIn();

    await new Promise<void>(resolve => {
      const loaded = { shopping: false, master: false, cats: false };
      let resolved = false;

      const checkDone = () => {
        if (resolved || !loaded.shopping || !loaded.master || !loaded.cats) return;
        resolved = true;
        resolve();
      };

      this.fb.subscribe<ShoppingItem>('shoppingList', items => {
        // Sort by createdAt so insertion order is preserved regardless of
        // the key order Firebase returns. Items without a createdAt (legacy)
        // fall back to 0 and appear first.
        this.shoppingList.set(
          [...items].sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
        );
        if (!loaded.shopping) { loaded.shopping = true; checkDone(); }
      });

      this.fb.subscribe<MasterItem>('masterItems', items => {
        this.masterItems.set(items);
        if (!loaded.master) { loaded.master = true; checkDone(); }
      });

      this.fb.subscribe<Category>('categories', cats => {
        this.categories.set(cats);
        if (!loaded.cats) { loaded.cats = true; checkDone(); }
      });
    });

    this.ensureNoneCategory();
    this.syncCategoriesFromMaster();
    this.ensureBlankRow();
    this.loading.set(false);
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  saveShoppingList(): void {
    this.fb.batchUpsert('shoppingList', this.shoppingList() as { id: string }[])
      .catch(console.error);
  }

  saveMasterItems(): void {
    this.fb.batchUpsert('masterItems', this.masterItems() as { id: string }[])
      .catch(console.error);
  }

  saveCategories(): void {
    this.fb.batchUpsert('categories', this.categories() as { id: string }[])
      .catch(console.error);
  }

  // ── Init helpers ─────────────────────────────────────────────────────────

  private ensureNoneCategory(): void {
    if (!this.categories().find(c => c.id === NONE_CATEGORY_ID)) {
      this.categories.update(cats => [NONE_CATEGORY, ...cats]);
      this.saveCategories();
    }
  }

  private ensureBlankRow(): void {
    if (this.shoppingList().length === 0) {
      const blank = this.createBlankItem();
      this.shoppingList.set([blank]);
      this.fb.batchUpsert('shoppingList', [blank]).catch(console.error);
    }
  }

  private createBlankItem(): ShoppingItem {
    return {
      id: crypto.randomUUID(),
      label: '',
      quantity: 1,
      isChecked: false,
      categoryId: null,
      createdAt: Date.now(),
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  capitalise(s: string): string {
    if (!s) return s;
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }

  getCategoryById(id: string | null): Category | null {
    if (!id || id === NONE_CATEGORY_ID) return null;
    return this.categories().find(c => c.id === id) ?? null;
  }

  getMasterItemByLabel(label: string): MasterItem | undefined {
    return this.masterItems().find(
      m => m.label.toLowerCase() === label.toLowerCase()
    );
  }

  syncCategoriesFromMaster(): void {
    const master = this.masterItems();
    this.shoppingList.update(list =>
      list.map(item => {
        if (!item.label) return item;
        const mi = master.find(
          m => m.label.toLowerCase() === item.label.toLowerCase()
        );
        return mi ? { ...item, categoryId: mi.categoryId } : item;
      })
    );
  }

  isCategorised(item: ShoppingItem): boolean {
    if (!item.label) return false;
    const mi = this.getMasterItemByLabel(item.label);
    if (!mi) return false;
    return mi.categoryId !== null;
  }

  // ── Shopping list operations ──────────────────────────────────────────────

  addBlankRow(): string {
    const item = this.createBlankItem();
    this.shoppingList.update(list => [...list, item]);
    this.fb.batchUpsert('shoppingList', [item]).catch(console.error);
    return item.id;
  }

  deleteItem(id: string): void {
    this.shoppingList.update(list => list.filter(i => i.id !== id));
    this.fb.remove('shoppingList', id).catch(console.error);
    // No batchUpsert needed — the remaining items haven't changed
  }

  toggleChecked(id: string): void {
    this.shoppingList.update(list =>
      list.map(i => (i.id === id ? { ...i, isChecked: !i.isChecked } : i))
    );
    const updated = this.shoppingList().find(i => i.id === id);
    if (updated) this.fb.batchUpsert('shoppingList', [updated]).catch(console.error);
  }

  updateQuantity(id: string, quantity: number): void {
    const safe = Math.max(1, isNaN(quantity) ? 1 : quantity);
    this.shoppingList.update(list =>
      list.map(i => (i.id === id ? { ...i, quantity: safe } : i))
    );
    const updated = this.shoppingList().find(i => i.id === id);
    if (updated) this.fb.batchUpsert('shoppingList', [updated]).catch(console.error);
  }

  commitLabel(id: string, rawLabel: string, focusNext: boolean): string | null {
    const trimmed = rawLabel.trim();
    if (!trimmed) return null;

    const capitalised = this.capitalise(trimmed);
    const mi = this.getMasterItemByLabel(capitalised);
    const categoryId = mi?.categoryId ?? null;

    const list = this.shoppingList();
    const currentIndex = list.findIndex(i => i.id === id);

    // Duplicate detection
    const dupIndex = list.findIndex(
      (i, idx) =>
        idx !== currentIndex &&
        i.label.toLowerCase() === capitalised.toLowerCase()
    );

    if (dupIndex !== -1) {
      // Merge: add current quantity on top of duplicate, remove current row
      const currentQty = list[currentIndex]?.quantity ?? 1;
      const merged = list
        .map((i, idx) =>
          idx === dupIndex ? { ...i, quantity: i.quantity + currentQty } : i
        )
        .filter(i => i.id !== id);
      this.shoppingList.set(merged);
      // Delete the merged-out item; upsert the merged-into item (updated qty)
      this.fb.remove('shoppingList', id).catch(console.error);
      const mergedInto = merged[dupIndex < currentIndex ? dupIndex : Math.min(dupIndex - 1, merged.length - 1)];
      if (mergedInto) this.fb.batchUpsert('shoppingList', [mergedInto]).catch(console.error);
      return merged[Math.min(dupIndex, merged.length - 1)]?.id ?? null;
    }

    // No duplicate – update this item
    this.shoppingList.update(l =>
      l.map(i => (i.id === id ? { ...i, label: capitalised, categoryId } : i))
    );
    const updated = this.shoppingList().find(i => i.id === id);
    if (updated) this.fb.batchUpsert('shoppingList', [updated]).catch(console.error);

    if (focusNext) {
      const updList = this.shoppingList();
      const updIdx = updList.findIndex(i => i.id === id);
      if (updIdx < updList.length - 1) {
        return updList[updIdx + 1].id;
      }
    }
    return this.addBlankRow();
  }

  sortList(): void {
    this.shoppingList.update(list =>
      [...list].sort((a, b) => {
        if (!a.label && !b.label) return 0;
        if (!a.label) return 1;
        if (!b.label) return -1;
        const catA = this.getCategoryById(a.categoryId);
        const catB = this.getCategoryById(b.categoryId);
        const prioA = catA?.priority ?? Infinity;
        const prioB = catB?.priority ?? Infinity;
        if (prioA !== prioB) return prioA - prioB;
        return a.label.toLowerCase().localeCompare(b.label.toLowerCase());
      })
    );
    // Sort doesn't change any doc content, only display order — no Firestore write needed
  }

  // ── Category operations ───────────────────────────────────────────────────

  addCategory(name: string, priority: number | null): Category {
    if (priority !== null) this.shiftPriorities(priority);
    const newCat: Category = { id: crypto.randomUUID(), name, priority };
    this.categories.update(cats => [...cats, newCat]);
    this.saveCategories(); // upserts all (including shifted ones)
    return newCat;
  }

  updateCategory(id: string, name: string, priority: number | null): void {
    const existing = this.categories().find(c => c.id === id);
    if (!existing) return;
    if (priority !== null && priority !== existing.priority) {
      this.shiftPriorities(priority, id);
    }
    this.categories.update(cats =>
      cats.map(c => (c.id === id ? { ...c, name, priority } : c))
    );
    this.saveCategories(); // upserts all (including shifted ones)
  }

  private shiftPriorities(fromPriority: number, excludeId?: string): void {
    this.categories.update(cats =>
      cats.map(c => {
        if (c.id === NONE_CATEGORY_ID) return c;
        if (excludeId && c.id === excludeId) return c;
        if (c.priority !== null && c.priority >= fromPriority)
          return { ...c, priority: c.priority + 1 };
        return c;
      })
    );
  }

  removeCategory(id: string): void {
    if (id === NONE_CATEGORY_ID) return;
    this.categories.update(cats => cats.filter(c => c.id !== id));
    this.shoppingList.update(list =>
      list.map(i => (i.categoryId === id ? { ...i, categoryId: null } : i))
    );
    this.masterItems.update(items =>
      items.map(i => (i.categoryId === id ? { ...i, categoryId: null } : i))
    );
    // Delete the category doc; upsert affected shopping items & master items
    this.fb.remove('categories', id).catch(console.error);
    this.saveShoppingList();
    this.saveMasterItems();
  }

  removeAllCategories(): void {
    // Capture IDs to delete BEFORE mutating the signal
    const idsToDelete = this.categories()
      .filter(c => c.id !== NONE_CATEGORY_ID)
      .map(c => c.id);

    this.categories.set([NONE_CATEGORY]);
    this.shoppingList.update(list =>
      list.map(i => ({ ...i, categoryId: null }))
    );
    this.masterItems.update(items =>
      items.map(i => ({ ...i, categoryId: null }))
    );

    this.fb.batchRemove('categories', idsToDelete).catch(console.error);
    this.fb.batchUpsert('categories', [NONE_CATEGORY]).catch(console.error);
    this.saveShoppingList();
    this.saveMasterItems();
  }

  // ── Master item operations ────────────────────────────────────────────────

  saveOrUpdateMasterItem(label: string, categoryId: string | null): void {
    const cap = this.capitalise(label.trim());
    const effectiveId = categoryId === NONE_CATEGORY_ID ? null : categoryId;
    const existing = this.getMasterItemByLabel(cap);
    if (existing) {
      this.masterItems.update(items =>
        items.map(i => (i.id === existing.id ? { ...i, categoryId: effectiveId } : i))
      );
    } else {
      this.masterItems.update(items => [
        ...items,
        { id: crypto.randomUUID(), label: cap, categoryId: effectiveId },
      ]);
    }
    this.saveMasterItems();
    // Reflect category change in active shopping list
    this.shoppingList.update(list =>
      list.map(i =>
        i.label.toLowerCase() === cap.toLowerCase()
          ? { ...i, categoryId: effectiveId }
          : i
      )
    );
    this.saveShoppingList();
  }

  removeMasterItem(label: string): void {
    const toRemove = this.masterItems().find(
      i => i.label.toLowerCase() === label.toLowerCase()
    );
    this.masterItems.update(items =>
      items.filter(i => i.label.toLowerCase() !== label.toLowerCase())
    );
    if (toRemove) {
      this.fb.remove('masterItems', toRemove.id).catch(console.error);
    }
    // Remaining master items don't need an upsert — we only deleted one
  }

  ensureMasterItem(label: string): void {
    if (!label.trim()) return;
    const cap = this.capitalise(label.trim());
    if (!this.getMasterItemByLabel(cap)) {
      const newItem = { id: crypto.randomUUID(), label: cap, categoryId: null };
      this.masterItems.update(items => [...items, newItem]);
      this.fb.batchUpsert('masterItems', [newItem]).catch(console.error);
    }
  }
}

