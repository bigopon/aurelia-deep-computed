import { ObserverLocator, Disposable } from 'aurelia-binding';
import { ICallable } from './definitions';
import { ComputedExpression } from './deep-computed-expression';
export declare class DeepComputedObserver {
    obj: object;
    /**
     * The expression that will be used to evaluate
     */
    expression: ComputedExpression;
    observerLocator: ObserverLocator;
    constructor(obj: object, 
    /**
     * The expression that will be used to evaluate
     */
    expression: ComputedExpression, observerLocator: ObserverLocator);
    getValue(): any;
    setValue(newValue: any): void;
    subscribe(context: (...args: any[]) => any): Disposable;
    unsubscribe(context: string | ICallable, callable?: ICallable): void;
    call(): void;
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
