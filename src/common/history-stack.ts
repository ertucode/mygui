export class HistoryStack<T> {
  private items: T[] = [];
  private index: number = -1;

  constructor(initialItems: T[]) {
    this.items = initialItems;
    this.index = initialItems.length - 1;
  }

  get hasPrev(): boolean {
    return this.index > 0;
  }

  get hasNext(): boolean {
    return this.index < this.items.length - 1;
  }

  goNew(item: T): void {
    if (this.index < this.items.length - 1) {
      this.items = this.items.slice(0, this.index + 1);
    }

    this.items.push(item);
    this.index = this.items.length - 1;
  }

  goPrev(): T {
    if (!this.hasPrev) {
      throw new Error("No previous item");
    }
    this.index--;
    return this.items[this.index];
  }

  goNext(): T {
    if (!this.hasNext) {
      throw new Error("No next item");
    }
    this.index++;
    return this.items[this.index];
  }
}
