import {
  InternalCollectionObserver,
  Disposable,
  InternalPropertyObserver,
  Expression
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


export interface DeepComputedFromPropertyDescriptor extends PropertyDescriptor {
  get?: (() => any) & { deep: boolean; deps: string[]; parsedDeps: Expression[]; computedExpression: ComputedExpression; };
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
