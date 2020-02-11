import {
  FrameworkConfiguration,
  ObserverLocator,
  Expression,
  Parser,
  createOverrideContext,
  InternalPropertyObserver,
} from 'aurelia-framework';
import { IPropertyObserver, DeepComputedFromPropertyDescriptor } from './definitions';
import { DeepComputedObserver } from './deep-computed-observer';
import { ComputedExpression } from './deep-computed-expression';

export function configure(config: FrameworkConfiguration): void {
  // need to run at post task to ensure we don't resolve everything too early
  config.postTask(() => {
    const observerLocator = config.container.get(ObserverLocator);
    const parser = config.container.get(Parser);
    observerLocator.addAdapter({
      getObserver: (obj, propertyName, descriptor: DeepComputedFromPropertyDescriptor): InternalPropertyObserver => {
        if (descriptor.get.deep) {
          return createComputedObserver(obj, propertyName, descriptor, observerLocator, parser);
        }
        return null;
      }
    })
  });
}

export function deepComputedFrom(...expressions: string[]) {
  return function (target: any, key: any, descriptor: PropertyDescriptor) {
    const $descriptor = descriptor as DeepComputedFromPropertyDescriptor;
    const getterFn = $descriptor.get;
    getterFn.deep = true;
    getterFn.deps = expressions;
    getterFn.computedExpression = void 0;
    return descriptor;
  } as MethodDecorator;
}

function createComputedObserver(
  obj: any,
  propertyName: string,
  descriptor: DeepComputedFromPropertyDescriptor,
  observerLocator: ObserverLocator,
  parser: Parser
) {
  let computedExpression = descriptor.get.computedExpression;
  if (!(computedExpression instanceof ComputedExpression)) {
    let dependencies = descriptor.get.deps;
    let i = dependencies.length;
    const parsedDeps = descriptor.get.parsedDeps = Array(dependencies.length);
    while (i--) {
      parsedDeps[i] = parser.parse(dependencies[i]);
    }
    computedExpression = descriptor.get.computedExpression = new ComputedExpression(propertyName, parsedDeps);
  }

  return new DeepComputedObserver(obj, computedExpression, observerLocator);
}
