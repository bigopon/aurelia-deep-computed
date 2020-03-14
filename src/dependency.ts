import {
  ICollectionObserverSplice,
} from 'aurelia-binding';
import {
  IPropertyObserver,
  ICollectionObserver,
  IDependency,
  IComputedObserver,
  ICollectionDependency
} from './definitions';

/**@internal */
export const releaseDep = (dep: IDependency) => {
  dep.release();
};

/**@internal */
export const observeDep = (dep: IDependency) => {
  dep.observe();
};

// for Aurelia binding subscriber, a context is required if it's not a function
const objectPropDepContext = 'context:object_prop_dep';
const arrayDepContext = 'context:array_dep';
const setDepContext = 'context:set_dep';
const mapDepContext = 'context:map_dep';

class ObjectDependency implements IDependency {
  deps: Map<string | number, IDependency> = new Map();
  connected: boolean = false;
  constructor(
    public owner: IComputedObserver,
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

const emptyMap = new Map<unknown, IDependency>();

class ObjectPropertyDependency implements IDependency {
  // object property has only 1 dep, there's no need to create a map
  // so use an empty map instead
  deps = emptyMap;
  observer: IPropertyObserver;
  connected: boolean = false;

  dep: IDependency;

  constructor(
    public owner: IComputedObserver,
    public parent: ObjectDependency,
    public property: string,
    public value: any
  ) {}

  collect(): void {
    this.dep = void 0;
    const owner = this.owner;
    const deep = owner.deep;
    if (!deep) {
      return;
    }
    const valueDep = getDependency(owner, this, this.value);
    if (valueDep == null) {
      return;
    }
    this.dep = valueDep;
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
    const dep = this.dep;
    if (dep != null) {
      dep.observe();
    }
    this.connected = true;
  }

  release(): void {
    const observer = this.observer;
    if (observer != null) {
      observer.unsubscribe(objectPropDepContext, this);
      this.observer = void 0;
    }
    const dep = this.dep;
    if (dep != null) {
      dep.release();
      this.dep = void 0;
    }
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
    this.owner.handleChange(this);
  }
}

abstract class BaseCollectionDependency implements ICollectionDependency {

  owner: IComputedObserver;
  parent: IDependency | null;
  value: any[] | Map<any, any> | Set<any>;

  deps: Map<string | number, IDependency> = new Map();
  observer: ICollectionObserver;
  connected: boolean = false;

  abstract subscribeContext: string;

  abstract collect(): void;

  abstract getObserver(): ICollectionObserver;

  observe() {
    let observer = this.observer;
    if (observer == null) {
      observer = this.observer = this.getObserver();
    }
    observer.subscribe(this.subscribeContext, this);
    this.deps.forEach(observeDep);
    this.connected = true;
  }

  release(): void {
    const observer = this.observer;
    if (observer != null) {
      observer.unsubscribe(this.subscribeContext, this);
      this.observer = void 0;
    }
    this.deps.forEach(releaseDep);
    this.deps.clear();
    this.connected = false;
  }

  // todo: more efficient dep recollection
  call(context: string, changeRecords: ICollectionObserverSplice[]): void {
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

class ArrayDependency extends BaseCollectionDependency {

  subscribeContext = arrayDepContext;

  constructor(
    public owner: IComputedObserver,
    public parent: IDependency | null,
    public value: any[]
  ) {
    super();
  }

  getObserver(): ICollectionObserver {
    return this
      .owner
      .observerLocator
      .getArrayObserver(this.value);
  }

  collect(): void {
    const owner = this.owner;
    const deep = owner.deep;
    const deps = this.deps;
    if (!deep) {
      return;
    }
    for (let i = 0, arr = this.value, ii = arr.length; ii > i; ++i) {
      let value = arr[i];
      const dep = getDependency(owner, this, value);
      // if an index is not observable
      // just ignore
      if (dep == void 0) {
        return;
      }
      const existingDep = deps.get(i);
      if (existingDep) {
        existingDep.release();
      }
      deps.set(i, dep);
      dep.collect();
    }
  }
}

class MapDependency extends BaseCollectionDependency {

  subscribeContext = mapDepContext;

  constructor(
    public owner: IComputedObserver,
    public parent: IDependency | null,
    public value: Map<any, any>
  ) {
    super();
  }

  getObserver(): ICollectionObserver {
    return this
      .owner
      .observerLocator
      .getMapObserver(this.value);
  }

  collect(): void {
    const owner = this.owner;
    const deep = owner.deep;
    const deps = this.deps;
    if (!deep) {
      return;
    }
    this.value.forEach((value, key) => {
      const dep = getDependency(owner, this, value);
      if (dep == void 0) {
        return;
      }
      const existingDep = deps.get(key);
      if (existingDep) {
        existingDep.release();
      }
      // incorrect to typings, but safe
      deps.set(key, dep);
      dep.collect();
    });
  }
}

class SetDependency extends BaseCollectionDependency {

  subscribeContext = setDepContext;

  constructor(
    public owner: IComputedObserver,
    public parent: IDependency | null,
    public value: Set<any>
  ) {
    super();
  }

  getObserver(): ICollectionObserver {
    return this
      .owner
      .observerLocator
      .getSetObserver(this.value);
  }

  collect(): void {
    const owner = this.owner;
    const deep = owner.deep;
    const deps = this.deps;
    if (!deep) {
      return;
    }
    this.value.forEach(value => {
      const dep = getDependency(owner, this, value);
      if (dep == void 0) {
        return;
      }
      const existingDep = deps.get(value);
      if (existingDep) {
        existingDep.release();
      }
      deps.set(value, dep);
      if (deep) {
        dep.collect();
      }
    });
  }
}

export function getDependency(owner: IComputedObserver, parent: IDependency, value: unknown): IDependency {
  const valueType = typeof value;
  if (value == null || valueType === 'boolean' || valueType === 'number' || valueType === 'string' || valueType === 'symbol' || valueType === 'bigint' || typeof value === 'function') {
    return;
  }
  if (Array.isArray(value)) {
    return new ArrayDependency(owner, parent, value);
  }
  if (value instanceof Map) {
    return new MapDependency(owner, parent, value);
  }
  if (value instanceof Set) {
    return new SetDependency(owner, parent, value);
  }
  return new ObjectDependency(owner, parent, value as object);
}
