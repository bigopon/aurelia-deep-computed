import {
  InternalCollectionObserver,
  Disposable,
  InternalPropertyObserver,
  Expression,
  ObserverLocator
} from "aurelia-binding";
import { TaskQueue } from "aurelia-framework";
import { ComputedExpression } from "./deep-computed-expression";

export type IPropertyObserver = InternalPropertyObserver & {
  subscribe(context: string | ICallable, callable?: ICallable): Disposable;
  unsubscribe(context: string | ICallable, callable?: ICallable): void;
};

export type ICollectionObserver = InternalCollectionObserver & {
  subscribe(context: string | ICallable, callable?: ICallable): Disposable;
  unsubscribe(context: string | ICallable, callable?: ICallable): void;
}

export interface IComputedOptions {
  deep: boolean;
  deps: string[];
  parsedDeps?: Expression[];
  computedExpression?: ComputedExpression;
}

export interface DeepComputedFromPropertyDescriptor extends PropertyDescriptor {
  get?: (() => any) & { computed: IComputedOptions };
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

export type ICallable = Function | { call(...args: any[]): void; };

export interface IDeepComputedObserver {
  readonly observerLocator: ObserverLocator;
  handleChange(dep: IDependency): void;
}

export interface IDependency {
  /**
   * Root observer/dep of this dep
   */
  owner: IDeepComputedObserver;
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
  collect(deep?: boolean): void;
  /**
   * Start observing: Connect all sub dependencies to the root observer
   */
  observe(): void;
  /**
   * Release all sub dependencies of this dependency
   */
  release(): void;
}
