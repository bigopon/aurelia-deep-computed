import { Expression, Scope, Binding } from "aurelia-binding";

export class ComputedExpression extends Expression {

  // this is to signal aurelia binding that it's ok trying to invoke .assign on this expression
  isAssignable: boolean = true;

  constructor(
    public readonly name: string,
    public readonly dependencies: Expression[]
  ) {
    super();
  }

  evaluate(scope: Scope, lookupFunctions: any) {
    return scope.bindingContext[this.name];
  }

  assign(scope: Scope, value: any, lookupFunctions: any): void {
    scope.bindingContext[this.name] = value;
  }

  accept(visitor: any) {
    throw new Error('not implemented');
  }

  connect(binding: Binding, scope: Scope) {
    let dependencies = this.dependencies;
    let i = dependencies.length;
    while (i--) {
      dependencies[i].connect(binding, scope);
    }
  }

  getDeps(scope: Scope): any[] {
    return this.dependencies.map(dep => dep.evaluate(scope));
  }
}