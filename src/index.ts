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
  IProcessedComputedOptions,
  IComputedOptions,
} from './definitions';
import { ComputedObserver } from './computed-observer';
import { ComputedExpression } from './deep-computed-expression';

export {
  ComputedObserver,
} from './computed-observer';

export {
  IDependency
} from './definitions';

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

export function deepComputedFrom(options: Partial<IComputedOptions>): MethodDecorator;
export function deepComputedFrom(...expressions: string[]): MethodDecorator;
export function deepComputedFrom(...args: (Partial<IComputedOptions> | string)[]) {
  return function (target: any, key: any, descriptor: PropertyDescriptor) {
    (descriptor as DeepComputedFromPropertyDescriptor).get.computed = buildOptions(args, true);
    return descriptor;
  } as MethodDecorator;
}

export function shallowComputedFrom(options: Partial<IComputedOptions>): MethodDecorator;
export function shallowComputedFrom(...expressions: string[]): MethodDecorator;
export function shallowComputedFrom(...args: (Partial<IComputedOptions> | string)[]) {
  return function (target: any, key: any, descriptor: PropertyDescriptor) {
    (descriptor as DeepComputedFromPropertyDescriptor).get.computed = buildOptions(args, false);
    return descriptor;
  };
}

function buildOptions(args: (Partial<IComputedOptions> | string)[], deep: boolean): IComputedOptions {
  const isConfigObject = args.length === 1 && typeof args[0] === 'object';
  const deps = isConfigObject
    ? (args[0] as IComputedOptions).deps || []
    : (args as string[]);
  const computedOptions: IComputedOptions = {
    deep: deep,
    deps: typeof deps === 'string' /* could be string when using config object, i.e deps: 'data' */
      ? [deps]
      : deps,
    cache: isConfigObject ? (args[0] as IComputedOptions).cache : false
  };
  return computedOptions;
}

function createComputedObserver(
  obj: any,
  propertyName: string,
  descriptor: DeepComputedFromPropertyDescriptor,
  observerLocator: ObserverLocator,
  parser: Parser,
) {
  const getterFn = descriptor.get;
  const computedOptions = getterFn.computed as IProcessedComputedOptions;
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

  return new ComputedObserver(
    obj,
    computedExpression,
    observerLocator,
    descriptor,
    computedOptions.deep,
    computedOptions.cache
  );
}
