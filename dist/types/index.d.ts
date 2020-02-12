import { FrameworkConfiguration } from 'aurelia-framework';
export { DeepComputedObserver, IDependency } from './deep-computed-observer';
export declare function configure(config: FrameworkConfiguration): void;
export declare function deepComputedFrom(...expressions: string[]): MethodDecorator;
