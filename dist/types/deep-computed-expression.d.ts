import { Expression, Scope, Binding } from "aurelia-binding";
export declare class ComputedExpression extends Expression {
    readonly name: string;
    readonly dependencies: Expression[];
    isAssignable: boolean;
    constructor(name: string, dependencies: Expression[]);
    evaluate(scope: Scope, lookupFunctions: any): any;
    assign(scope: Scope, value: any, lookupFunctions: any): void;
    accept(visitor: any): void;
    connect(binding: Binding, scope: Scope): void;
    getDeps(scope: Scope): any[];
}
