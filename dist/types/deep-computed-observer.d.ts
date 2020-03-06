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
    deep: boolean;
    constructor(obj: object, 
    /**
     * The expression that will be used to evaluate
     */
    expression: ComputedExpression, observerLocator: ObserverLocator, deep: boolean);
    getValue(): any;
    setValue(newValue: any): void;
    subscribe(context: (...args: any[]) => any): Disposable;
    unsubscribe(context: string | ICallable, callable?: ICallable): void;
    call(): void;
}
