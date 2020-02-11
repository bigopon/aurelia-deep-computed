import {
  ObserverLocator,
  PropertyObserver,
  InternalCollectionObserver,
  CollectionObserver,
  subscriberCollection,
  InternalPropertyObserver,
  Disposable,
  ICollectionObserverSplice
} from 'aurelia-binding';
import {
  TaskQueue
} from 'aurelia-task-queue';

type IPropertyObserver = InternalCollectionObserver  & {
  subscribe(context: string | ICallable, callable?: ICallable): Disposable;
  unsubscribe(context: string | ICallable, callable?: ICallable): void;
};

type ICollectionObserver = InternalCollectionObserver & {
  subscribe(context: string | ICallable, callable?: ICallable): Disposable;
  unsubscribe(context: string | ICallable, callable?: ICallable): void;
}

/**
 * @internal
 */
declare module 'aurelia-binding' {
  interface ObserverLocator {
    taskQueue: TaskQueue;
    getObserver(obj: object, propertyName: string): IPropertyObserver;
    getArrayObserver(arr: any[]): ICollectionObserver;
    getSetObserver(set: Set<any>): ICollectionObserver;
    getMapObserver(map: Map<any, any>): ICollectionObserver;
  }
}

export interface ICallable {
  call(...args: any[]): void;
}

/**
 * @internal
 */
declare global {
  interface ObjectConstructor {
    getPropertyDescriptor(obj: object, propertyName: string | symbol): DeepComputedFromPropertyDescriptor;
  }
}

interface DeepComputedFromPropertyDescriptor extends PropertyDescriptor {
  get?: (() => any) & { __deep: boolean; __obj: any; }
} 

ObserverLocator.prototype['createPropertyObserver'] = ((fn) => {
  return function(obj: object, propertyName: string | symbol, descriptor: DeepComputedFromPropertyDescriptor) {
    descriptor = Object.getPropertyDescriptor(obj, propertyName);
    if (descriptor && descriptor.get && descriptor.get.__deep === true) {
      return new DeepObserver(obj[descriptor.get.__obj], this);
    }
    return fn.call(this, obj, propertyName, descriptor);
  }
})(ObserverLocator.prototype['createPropertyObserver']);

export function deepComputedFrom(prop: string) {
  return function (target: any, key: any, descriptor: PropertyDescriptor) {
    const $descriptor = descriptor as DeepComputedFromPropertyDescriptor;
    $descriptor.get.__deep = true;
    $descriptor.get.__obj = prop;
    return descriptor;
  } as MethodDecorator;
}

// a deep observer needsd to be able to
// - observe all properties, recursively without boundary
// - detect a path of observer change

export interface DeepObserver {
  addSubscriber(callable: (...args: any[]) => void): boolean;
  addSubscriber(context: string, callable: ICallable): boolean;
  addSubscriber(context: string | ICallable, callable?: ICallable): boolean;
  callSubscribers(newValue: any): void;
  hasSubscriber(context: string | ICallable, callable?: ICallable): boolean;
  hasSubscribers(): boolean;
}

@subscriberCollection()
export class DeepObserver {

  isQueued: boolean = false;

  constructor(
    public obj: object,
    public observerLocator: ObserverLocator,
  ) {
    this.handleChange = this.handleChange.bind(this);
  }

  subscribe(context: string | ICallable, callable?: ICallable) {
    const hasSubscribers = this.hasSubscribers();
    if (this.addSubscriber(context, callable) && !hasSubscribers) {
      this.observe(this.obj);
    }
  }

  call() {
    this.isQueued = false;
    this.callSubscribers(this.obj);
  }

  handleChange(dep: IDependency): void {
    if (this.isQueued) {
      return;
    }
    this.observerLocator.taskQueue.queueMicroTask(this);
    this.isQueued = true;
  }

  private observe(value: unknown): void {
    const rootDependency = getDependency(this, null, this.obj)!;
    rootDependency.collect();
    rootDependency.observe();
  }
}

interface IDependency {
  /**
   * Root observer/dep of this dep
   */
  owner: DeepObserver;
  /**
   * The parent dep of this dep. Represents the owner object of the object associated with this dep
   */
  parent: IDependency | null;
  /**
   * The sub dependencies of this dependency
   */
  deps: Map<unknown, IDependency>;
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

  constructor(
    public owner: DeepObserver,
    public parent: IDependency | null,
    public value: object
  ) {}

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
  }

  release(): void {
    this.deps.forEach(releaseDep);
  }
}

class ObjectPropertyDependency implements IDependency {
  deps = new Map<any, IDependency>();

  observer: IPropertyObserver;

  constructor(
    public owner: DeepObserver,
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
  }

  release(): void {
    const observer = this.observer;
    if (observer != null) {
      observer.unsubscribe(objectPropDepContext, this);
      this.observer = void 0;
    }
    this.deps.forEach(releaseDep);
    this.deps.clear();
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
    this.owner.handleChange(this);
  }
}

class ArrayDependency implements IDependency {
  deps: Map<string | number, IDependency> = new Map();

  observer: ICollectionObserver;

  constructor(
    public owner: DeepObserver,
    public parent: IDependency | null,
    public value: any[],
  ) {}

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
  }

  release(): void {
    const observer = this.observer;
    if (observer != null) {
      observer.unsubscribe(arrayDepContext, this);
      this.observer = void 0;
    }
    this.deps.forEach(releaseDep);
    this.deps.clear();
  }

  call(changeRecords: ICollectionObserverSplice[]): void {
    // when array is mutated
    // 1. release
    this.release();
    // 2. recollect
    this.collect();
    this.observe();
    // 3. notify owner
    this.owner.handleChange(this);
  }
}

class SetDependency implements IDependency {
  deps: Map<string | number, IDependency> = new Map();

  constructor(
    public owner: DeepObserver,
    public parent: IDependency | null,
    public set: Set<any>,
  ) {}

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

  }

  release(): void {

  }
}

const dependencyMap = new WeakMap();
const raw2Dep = new WeakMap();

function getDependency(owner: DeepObserver, parent: IDependency, value: unknown): IDependency {
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
