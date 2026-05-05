import { Injectable, inject, OnDestroy } from '@angular/core';
import { Auth, signInAnonymously } from '@angular/fire/auth';
import {
  Database,
  ref,
  update,
  remove,
  onValue,
  Unsubscribe,
} from '@angular/fire/database';

@Injectable({ providedIn: 'root' })
export class FirebaseService implements OnDestroy {
  private auth = inject(Auth);
  private db = inject(Database);
  private unsubs: Unsubscribe[] = [];

  /** Signs in anonymously. The anonymous UID persists in the browser until
   *  storage is cleared, so the same browser always gets the same user. */
  async signIn(): Promise<void> {
    await signInAnonymously(this.auth);
  }

  /**
   * Subscribes to a Realtime Database path with real-time updates.
   * Fires immediately with the current data, then again on every change.
   */
  subscribe<T>(colName: string, callback: (items: T[]) => void): void {
    const unsub = onValue(ref(this.db, colName), snapshot => {
      const val = snapshot.val();
      // val is an object keyed by id, or null when the collection is empty
      callback(val ? (Object.values(val) as T[]) : []);
    });
    this.unsubs.push(unsub);
  }

  /** Writes (creates or overwrites) multiple items in one atomic update. */
  async batchUpsert(colName: string, items: { id: string }[]): Promise<void> {
    if (!items.length) return;
    const updates: Record<string, unknown> = {};
    for (const item of items) {
      updates[`${colName}/${item.id}`] = item;
    }
    await update(ref(this.db), updates);
  }

  /** Deletes a single item. */
  async remove(colName: string, id: string): Promise<void> {
    await remove(ref(this.db, `${colName}/${id}`));
  }

  /** Deletes multiple items in one atomic update (sets them to null). */
  async batchRemove(colName: string, ids: string[]): Promise<void> {
    if (!ids.length) return;
    const updates: Record<string, null> = {};
    for (const id of ids) {
      updates[`${colName}/${id}`] = null;
    }
    await update(ref(this.db), updates);
  }

  ngOnDestroy(): void {
    this.unsubs.forEach(fn => fn());
  }
}
