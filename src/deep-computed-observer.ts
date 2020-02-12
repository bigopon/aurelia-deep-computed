import {
  ObserverLocator,
  subscriberCollection,
  ICollectionObserverSplice,
  Expression,
  connectable as $connectable,
  Scope,
  createOverrideContext,
  Binding,
  Disposable
} from 'aurelia-binding';
import {
  DeepComputedFromPropertyDescriptor,
  ICallable,
  IPropertyObserver,
  ICollectionObserver
} from './definitions';
import { ComputedExpression } from './deep-computed-expression';

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

// it looks better using @...(), so we cast
const connectable = $connectable as any;

const emptyLookupFunctions = {
  valueConverters: name => null,
  bindingBehaviors: name => null,
};

const unset = {};

@connectable()
@subscriberCollection()
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
    public observerLocator: ObserverLocator
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
  handleChange(dep: IDependency, collect: boolean): void {
    if (this.isQueued) {
      return;
    }
    if (this.notifyingDeps.indexOf(dep) === -1) {
      this.notifyingDeps.push(dep);
    }
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

export interface IDependency {
  /**
   * Root observer/dep of this dep
   */
  owner: DeepComputedObserver;
  /**
   * The parent dep of this dep. Represents the owner object of the object associated with this dep
   */
  parent: IDependency | null;
  /**
   * The sub dependencies of this dependency
   */
  deps: Map<unknown, IDependency>;
  /**
   * Indicates whther the dependency is observing
   */
  connected: boolean;
  /**
   * collect sub dependencies of this dependency value
   */
  collect(): void;
  /**
   * Start observing: Connect all sub dependencies to the root observer
   */
  observe(): void;
  /**
   * Release all sub dependencies of this dependency
   */
  release(): void;
}

const releaseDep = (dep: IDependency) => {
  dep.release();
};
const observeDep = (dep: IDependency) => {
  dep.observe();
}

// for Aurelia binding subscriber, a context is required if it's not a function
const objectPropDepContext = 'context:object_prop_dep';
const arrayDepContext = 'context:array_dep';

class ObjectDependency implements IDependency {

  deps: Map<string | number, IDependency> = new Map();
  connected: boolean = false;

  constructor(
    public owner: DeepComputedObserver,
    public parent: IDependency | null,
    public value: object
  ) { }

  collect(): void {
    const value = this.value;
    Object.keys(value).forEach(prop => {
      const propertyDep = new ObjectPropertyDependency(this.owner, this, prop, value[prop]);
      this.deps.set(prop, propertyDep);
      propertyDep.collect();
    });
  }

  observe() {
    this.deps.forEach(observeDep);
    this.connected = true;
  }

  release(): void {
    this.deps.forEach(releaseDep);
    this.connected = false;
  }
}

class ObjectPropertyDependency implements IDependency {
  deps = new Map<any, IDependency>();

  observer: IPropertyObserver;

  connected: boolean = false;

  constructor(
    public owner: DeepComputedObserver,
    public parent: ObjectDependency,
    public property: string,
    public value: any
  ) {

  }

  collect(): void {
    const valueDep = getDependency(this.owner, this, this.value);
    if (valueDep == null) {
      return;
    }
    this.deps.set(this, valueDep);
    valueDep.collect();
  }

  observe(): void {
    let observer = this.observer;
    if (observer == null) {
      observer
        = this.observer
        = this
          .owner
          .observerLocator
          .getObserver(this.parent.value, this.property);
    }

    observer.subscribe(objectPropDepContext, this);
    this.deps.forEach(observeDep);
    this.connected = true;
  }

  release(): void {
    const observer = this.observer;
    if (observer != null) {
      observer.unsubscribe(objectPropDepContext, this);
      this.observer = void 0;
    }
    this.deps.forEach(releaseDep);
    this.deps.clear();
    this.connected = false;
  }

  call(): void {
    // when property change
    // 1. release all sub-deps
    this.release();
    // 2. re-evaluate the value
    this.value = this.parent.value[this.property];
    // 3. re-collect deps
    this.collect();
    this.observe();
    // 4. notify the owner
    this.owner.handleChange(this, /* should recollect everything? */false);
  }
}

class ArrayDependency implements IDependency {
  deps: Map<string | number, IDependency> = new Map();

  observer: ICollectionObserver;
  connected: boolean = false;

  constructor(
    public owner: DeepComputedObserver,
    public parent: IDependency | null,
    public value: any[],
  ) { }

  collect(): void {
    for (let i = 0, arr = this.value, ii = arr.length; ii > i; ++i) {
      let value = arr[i];
      const dep = getDependency(this.owner, this, value);
      // if an index is not observable
      // just ignore
      if (dep == void 0) {
        return;
      }
      this.deps.set(i, dep);
      dep.collect();
    }
  }

  observe() {
    let observer = this.observer;
    if (observer == null) {
      observer
        = this.observer
        = this
          .owner
          .observerLocator
          .getArrayObserver(this.value);
    }

    observer.subscribe(arrayDepContext, this);

    this.deps.forEach(observeDep);
    this.connected = true;
  }

  release(): void {
    const observer = this.observer;
    if (observer != null) {
      observer.unsubscribe(arrayDepContext, this);
      this.observer = void 0;
    }
    this.deps.forEach(releaseDep);
    this.deps.clear();
    this.connected = false;
  }

  call(changeRecords: ICollectionObserverSplice[]): void {
    // when array is mutated
    // 1. release
    this.release();
    // 2. recollect
    this.collect();
    this.observe();
    // 3. notify owner
    this.owner.handleChange(this, true);
  }
}

class SetDependency implements IDependency {
  deps: Map<string | number, IDependency> = new Map();
  connected: boolean = false;

  constructor(
    public owner: DeepComputedObserver,
    public parent: IDependency | null,
    public set: Set<any>,
  ) { }

  collect(): void {
    this.set.forEach(value => {
      const dep = getDependency(this.owner, this, value);
      if (dep == void 0) {
        return;
      }
      dep.collect();
      // incorrect to typings, but safe
      this.deps.set(value as any, dep);
    });
  }

  observe(): void {
    this.deps.forEach(observeDep);
    this.connected = true;
  }

  release(): void {
    this.deps.forEach(releaseDep);
    this.deps.clear();
    this.connected = false;
  }
}

const dependencyMap = new WeakMap();
const raw2Dep = new WeakMap();

function getDependency(owner: DeepComputedObserver, parent: IDependency, value: unknown): IDependency {
  const valueType = typeof value;
  if (value == null || valueType === 'boolean' || valueType === 'number' || valueType === 'string' || valueType === 'symbol' || valueType === 'bigint' || typeof value === 'function') {
    return;
  }
  if (Array.isArray(value)) {
    return new ArrayDependency(owner, parent, value);
  }

  if (value instanceof Set) {
    return new SetDependency(owner, parent, value);
  }

  return new ObjectDependency(owner, parent, value as object);
}
