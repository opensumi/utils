export interface IDisposable {
  dispose(): void;
}

export class Disposable implements IDisposable {
  private disposables: IDisposable[] = [];

  get disposed() {
    return this.disposables.length === 0;
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }

  addDispose(...disposables: (IDisposable | undefined)[]) {
    this.disposables.push(...disposables);
  }
}
