import {
  ObserverLocator,
  subscriberCollection,
  connectable as $connectable,
  Scope,
  createOverrideContext,
  Binding,
  Disposable,
  sourceContext
} from 'aurelia-binding';
import {
  ICallable,
  IDependency,
  IComputedOptions,
  ComputedFromPropertyDescriptor
} from './definitions';
import { ComputedExpression } from './computed-expression';
import { getDependency, releaseDep } from './dependency';

// a deep observer needsd to be able to
// - observe all properties, recursively without boundary
// - detect a path of observer change

/**
 * @internal The interface describes methods added by `connectable` & `subscriberCollection` decorators
 */
export interface ComputedObserver extends Binding {
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

export class ComputedObserver {

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

  /**
   * Only used when the observer is config to cache read
   * @internal
   */
  private currentValue: any;

  /**
   * @internal
   */
  private $get: () => any;

  /**
   * @internal
   */
  private observing: boolean;

  public deep: boolean;

  public cache: boolean;

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
    descriptor: PropertyDescriptor,
    computedOptions: IComputedOptions
  ) {
    this.scope = { bindingContext: obj, overrideContext: createOverrideContext(obj) };
    this.deep = computedOptions.deep;
    this.cache = computedOptions.cache;
    if (computedOptions.cache) {
      const propertyName = expression.name;
      const getterFn = (() => 
        // not observing === no track === no confidence that the current value is correct
        this.observing ? this.currentValue : this.$get()
      ) as ComputedFromPropertyDescriptor['get'];
      getterFn.computed = computedOptions;
      Object.defineProperty(obj, propertyName, {
        get: getterFn,
        set: descriptor.set,
        configurable: true,
        enumerable: true
      });
      this.$get = () => {
        return descriptor.get.call(obj);
      };
    } else {
      this.$get = () => {
        return expression.evaluate(this.scope, emptyLookupFunctions);
      };
    }
  }

  getValue(): any {
    return this.cache && this.observing
      ? this.currentValue
      : this.$get();
  }

  setValue(newValue: any): void {
    // supports getter
    this.expression.assign(this.scope, newValue, emptyLookupFunctions);
  }

  subscribe(context: string | ICallable, callable?: ICallable): void | Disposable {
    if (!this.hasSubscribers()) {
      this.oldValue = this.$get();
      this.expression.connect(
        /* @connectable makes this class behave as Binding */this,
        this.scope
      );
      this.observeDeps();
      this.observing = true;
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
      this.observing = false;
      this.unobserveDeps();
      this.notifyingDeps.length = 0;
      this.unobserve(true);
      this.oldValue = unset;
    }
  }

  call() {
    let newValue = this.currentValue = this.$get();
    let oldValue = this.oldValue;
    if (newValue !== oldValue) {
      this.oldValue = newValue;
      this.callSubscribers(newValue, oldValue === unset ? void 0 : oldValue);
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
connectable()(ComputedObserver);
subscriberCollection()(ComputedObserver);
