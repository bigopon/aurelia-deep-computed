import { InternalCollectionObserver, Disposable, InternalPropertyObserver, Expression, ObserverLocator, ICollectionObserverSplice } from "aurelia-binding";
import { ComputedExpression } from "./deep-computed-expression";
export declare type IPropertyObserver = InternalPropertyObserver & {
    subscribe(context: string | ICallable, callable?: ICallable): Disposable;
    unsubscribe(context: string | ICallable, callable?: ICallable): void;
};
export declare type ICollectionObserver = InternalCollectionObserver & {
    subscribe(context: string | ICallable, callable?: ICallable): Disposable;
    unsubscribe(context: string | ICallable, callable?: ICallable): void;
};
export interface IComputedOptions {
    deep: boolean;
    deps: string[];
    /**
     * Used to cache parsed expression from declared dependency
     */
    parsedDeps?: Expression[];
    /**
     * Used to store aggregated computed expression
     */
    computedExpression?: ComputedExpression;
}
export interface DeepComputedFromPropertyDescriptor extends PropertyDescriptor {
    get?: (() => any) & {
        computed: IComputedOptions;
    };
}
export declare type ICallable = Function | {
    call(...args: any[]): void;
};
export interface IComputedObserver {
    readonly deep: boolean;
    readonly observerLocator: ObserverLocator;
    handleChange(dep: IDependency): void;
}
export interface IDependency {
    /**
     * Root observer/dep of this dep
     */
    owner: IComputedObserver;
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
export interface ICollectionDependency extends IDependency {
    observer: ICollectionObserver;
    subscribeContext: string;
    call(context: string, changeRecords: ICollectionObserverSplice[]): void;
}
