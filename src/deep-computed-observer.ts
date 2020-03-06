import {
  ObserverLocator,
  subscriberCollection,
  connectable as $connectable,
  Scope,
  createOverrideContext,
  Binding,
  Disposable
} from 'aurelia-binding';
import {
  ICallable,
  IDependency
} from './definitions';
import { ComputedExpression } from './deep-computed-expression';
import { getDependency, releaseDep } from './dependency';

// a deep observer needsd to be able to
// - observe all properties, recursively without boundary
// - detect a path of observer change

/**
 * @internal The interface describes methods added by `connectable` & `subscriberCollection` decorators
 */
export interface DeepComputedObserver extends Binding {
  _version: number;
  addSubscriber(callable: (...args: any[]) => void): boolean;
  addSubscriber(context: string, callable: ICallable): boolean;
  addSubscriber(context: string | ICallable, callable?: ICallable): boolean;
  callSubscribers(newValue: any, oldValue?: any): void;
  hasSubscriber(context: string | ICallable, callable?: ICallable): boolean;
  hasSubscribers(): boolean;
  removeSubscriber(context: string | ICallable, callable?: ICallable): boolean;
  observe(): void;
  unobserve(all?: boolean): void;
}

// it looks better using @...(), so we cast to any instead of ClassDecorator
// aurelia decorators support both usage: with and without parens
const connectable = $connectable as any;

// by default, it does not support value converters & binding behaviors in the expressions
// but maybe it should. TODO
const emptyLookupFunctions = {
  valueConverters: name => null,
  bindingBehaviors: name => null,
};

const unset = {};

export class DeepComputedObserver {

  /**
   * @internal
   */
  private isQueued: boolean = false;
  /**
   * @internal
   */
  private oldValue: any = unset;

  /**
   * @internal
   */
  private rootDeps: IDependency[];

  /**
   * @internal
   */
  private readonly scope: Scope;

  /**
   * @internal
   */
  private readonly notifyingDeps: IDependency[] = [];

  constructor(
    public obj: object,
    /**
     * The expression that will be used to evaluate 
     */
    // this expression has 2 purposes:
    //  - a thin layer wrapping around getting/setting value of the targeted computed property
    //  - an abstraction for dealing with a list of declared dependencies and their corresponding value
    //    that uses existing Aurelia binding capabilities
    public expression: ComputedExpression,
    public observerLocator: ObserverLocator,
    public deep: boolean
  ) {
    this.scope = { bindingContext: obj, overrideContext: createOverrideContext(obj) };
  }

  getValue(): any {
    return this.expression.evaluate(this.scope, emptyLookupFunctions);
  }

  setValue(newValue: any): void {
    this.expression.assign(this.scope, newValue, emptyLookupFunctions);
  }

  subscribe(context: (...args: any[]) => any): Disposable;
  subscribe(context: string | ICallable, callable?: ICallable): void | Disposable {
    if (!this.hasSubscribers()) {
      this.oldValue = this.expression.evaluate(this.scope, emptyLookupFunctions);
      this.expression.connect(
        /* @connectable makes this class behave as Binding */this,
        this.scope
      );
      this.observeDeps();
    }
    this.addSubscriber(context, callable);
    // scenario where this observer is created manually via ObserverLocator.getObserver
    if (arguments.length === 1 && typeof context === 'function') {
      return {
        dispose: () => {
          this.unsubscribe(context, callable);
        }
      };
    }
  }

  unsubscribe(context: string | ICallable, callable?: ICallable): void {
    if (this.removeSubscriber(context, callable) && !this.hasSubscribers()) {
      this.unobserveDeps();
      this.unobserve(true);
      this.oldValue = unset;
      this.notifyingDeps.length = 0;
    }
  }

  call() {
    let newValue = this.expression.evaluate(this.scope, emptyLookupFunctions);
    let oldValue = this.oldValue;
    if (newValue !== oldValue) {
      this.oldValue = newValue;
      this.callSubscribers(newValue, oldValue);
    }
    if (this.isQueued) {
      this.notifyingDeps.forEach(dep => {
        if (!dep.connected) {
          return;
        }
        dep.release();
        dep.collect();
        dep.observe();
      });
      this.isQueued = false;
    } else {
      this.unobserveDeps();
      this.observeDeps();
    }
    this.notifyingDeps.length = 0;
    this._version++;
    this.expression.connect(/* @connectable makes this class behave as Binding */this, this.scope);
    this.unobserve(false);
  }

  /**
   * @internal
   */
  handleChange(dep: IDependency): void {
    const notifyingDeps = this.notifyingDeps;
    if (notifyingDeps.indexOf(dep) === -1) {
      notifyingDeps.push(dep);
    }
    if (this.isQueued) {
      return;
    }
    this.isQueued = true;
    this.observerLocator.taskQueue.queueMicroTask(this);
  }

  /**
   * @internal
   */
  private observeDeps(): void {
    const values = this.expression.getDeps(this.scope);
    let rootDeps = this.rootDeps;
    if (rootDeps == null) {
      rootDeps = this.rootDeps = values.map(v => getDependency(this, null, v)).filter(Boolean);
    }
    rootDeps.forEach(dep => {
      dep.collect();
      dep.observe();
    });
  }

  /**
   * @internal
   */
  private unobserveDeps(): void {
    const rootDeps = this.rootDeps;
    if (rootDeps != null) {
      rootDeps.forEach(releaseDep);
      this.rootDeps = void 0;
    }
  }
}

// use this instead of decorator to avoid extra generated code
connectable()(DeepComputedObserver);
subscriberCollection()(DeepComputedObserver);
