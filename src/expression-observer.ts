import {
  connectable as $connectable,
  subscriberCollection,
  Expression,
  ObserverLocator,
  Scope
} from 'aurelia-binding';

export interface ExpressionObserver {
  _version: number;
}

const connectable = $connectable as any;

@connectable()
@subscriberCollection()
export class ExpressionObserver {
  scope: any;
  expression: any;
  observerLocator: any;
  lookupFunctions: any;
  oldValue: any;

  constructor(scope: Scope, expression: Expression, observerLocator: ObserverLocator, lookupFunctions) {
    this.scope = scope;
    this.expression = expression;
    this.observerLocator = observerLocator;
    this.lookupFunctions = lookupFunctions;
  }

  getValue() {
    return this.expression.evaluate(this.scope, this.lookupFunctions);
  }

  setValue(newValue) {
    this.expression.assign(this.scope, newValue);
  }

  subscribe(context, callable) {
    if (!this.hasSubscribers()) {
      this.oldValue = this.expression.evaluate(this.scope, this.lookupFunctions);
      this.expression.connect(this, this.scope);
    }
    this.addSubscriber(context, callable);
    if (arguments.length === 1 && context instanceof Function) {
      return {
        dispose: () => {
          this.unsubscribe(context, callable);
        }
      };
    }
  }
  hasSubscribers() {
    throw new Error("Method not implemented.");
  }
  addSubscriber(context: any, callable: any) {
    throw new Error("Method not implemented.");
  }

  unsubscribe(context, callable) {
    if (this.removeSubscriber(context, callable) && !this.hasSubscribers()) {
      this.unobserve(true);
      this.oldValue = undefined;
    }
  }
  removeSubscriber(context: any, callable: any) {
    throw new Error("Method not implemented.");
  }
  unobserve(arg0: boolean) {
    throw new Error("Method not implemented.");
  }

  call() {
    let newValue = this.expression.evaluate(this.scope, this.lookupFunctions);
    let oldValue = this.oldValue;
    if (newValue !== oldValue) {
      this.oldValue = newValue;
      this.callSubscribers(newValue, oldValue);
    }
    this._version++;
    this.expression.connect(this, this.scope);
    this.unobserve(false);
  }
  callSubscribers(newValue: any, oldValue: any) {
    throw new Error("Method not implemented.");
  }
}
