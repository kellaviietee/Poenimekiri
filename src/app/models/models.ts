export const NONE_CATEGORY_ID = 'none';

export interface Category {
  id: string;
  name: string;
  priority: number | null;
}

export const NONE_CATEGORY: Category = {
  id: NONE_CATEGORY_ID,
  name: 'None',
  priority: null,
};

export interface ShoppingItem {
  id: string;
  label: string;
  quantity: number;
  isChecked: boolean;
  categoryId: string | null;
  /** Unix ms timestamp used to preserve insertion order across Firebase syncs */
  createdAt: number;
}

export interface MasterItem {
  id: string;
  label: string;
  categoryId: string | null;
}

