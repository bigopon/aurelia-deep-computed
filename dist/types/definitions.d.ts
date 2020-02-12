import { InternalCollectionObserver, Disposable, InternalPropertyObserver, Expression } from "aurelia-binding";
import { ComputedExpression } from "./deep-computed-expression";
export declare type IPropertyObserver = InternalPropertyObserver & {
    subscribe(context: string | ICallable, callable?: ICallable): Disposable;
    unsubscribe(context: string | ICallable, callable?: ICallable): void;
};
export declare type ICollectionObserver = InternalCollectionObserver & {
    subscribe(context: string | ICallable, callable?: ICallable): Disposable;
    unsubscribe(context: string | ICallable, callable?: ICallable): void;
};
export interface DeepComputedFromPropertyDescriptor extends PropertyDescriptor {
    get?: (() => any) & {
        deep: boolean;
        deps: string[];
        parsedDeps: Expression[];
        computedExpression: ComputedExpression;
    };
}
export declare type ICallable = Function | {
    call(...args: any[]): void;
};
