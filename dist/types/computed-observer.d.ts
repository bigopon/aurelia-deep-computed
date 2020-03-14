import { ObserverLocator, Disposable } from 'aurelia-binding';
import { ICallable, IComputedOptions } from './definitions';
import { ComputedExpression } from './computed-expression';
export declare class ComputedObserver {
    obj: object;
    /**
     * The expression that will be used to evaluate
     */
    expression: ComputedExpression;
    observerLocator: ObserverLocator;
    deep: boolean;
    cache: boolean;
    constructor(obj: object, 
    /**
     * The expression that will be used to evaluate
     */
    expression: ComputedExpression, observerLocator: ObserverLocator, descriptor: PropertyDescriptor, computedOptions: IComputedOptions);
    getValue(): any;
    setValue(newValue: any): void;
    subscribe(context: string | ICallable, callable?: ICallable): void | Disposable;
    unsubscribe(context: string | ICallable, callable?: ICallable): void;
    call(): void;
}
