import {
  FrameworkConfiguration,
} from 'aurelia-framework';
import {
  ObserverLocator,
  Parser,
  InternalPropertyObserver,
} from 'aurelia-binding';
import {
  DeepComputedFromPropertyDescriptor,
  IDependency,
} from './definitions';
import { DeepComputedObserver } from './deep-computed-observer';
import { ComputedExpression } from './deep-computed-expression';

export {
  DeepComputedObserver,
} from './deep-computed-observer';

export function configure(config: FrameworkConfiguration): void {
  // need to run at post task to ensure we don't resolve everything too early
  config.postTask(() => {
    const container = config.container;
    const observerLocator = container.get(ObserverLocator);
    const parser = container.get(Parser);
    // addAdapter is a hook from observer locator to deal with computed properties (getter/getter + setter)
    observerLocator.addAdapter({
      getObserver: (obj, propertyName, descriptor: DeepComputedFromPropertyDescriptor): InternalPropertyObserver => {
        const computedOptions = descriptor.get.computed;
        if (computedOptions) {
          return createComputedObserver(obj, propertyName, descriptor, observerLocator, parser);
        }
        return null;
      }
    });
  });
}

export function deepComputedFrom(...expressions: string[]) {
  return function (target: any, key: any, descriptor: PropertyDescriptor) {
    (descriptor as DeepComputedFromPropertyDescriptor).get.computed = {
      deep: true,
      deps: expressions,
    }
    return descriptor;
  } as MethodDecorator;
}

export function shallowComputedFrom(...expressions: string[]) {
  return function (target: any, key: any, descriptor: PropertyDescriptor) {
    (descriptor as DeepComputedFromPropertyDescriptor).get.computed = {
      deep: false,
      deps: expressions
    };
    return descriptor;
  } as MethodDecorator;
}

function createComputedObserver(
  obj: any,
  propertyName: string,
  descriptor: DeepComputedFromPropertyDescriptor,
  observerLocator: ObserverLocator,
  parser: Parser,
) {
  const getterFn = descriptor.get;
  const computedOptions = getterFn.computed;
  let computedExpression = computedOptions.computedExpression;
  if (!(computedExpression instanceof ComputedExpression)) {
    let dependencies = computedOptions.deps;
    let i = dependencies.length;
    const parsedDeps = computedOptions.parsedDeps = Array(dependencies.length);
    while (i--) {
      parsedDeps[i] = parser.parse(dependencies[i]);
    }
    computedExpression = computedOptions.computedExpression = new ComputedExpression(propertyName, parsedDeps);
  }

  return new DeepComputedObserver(obj, computedExpression, observerLocator, computedOptions.deep);
}
