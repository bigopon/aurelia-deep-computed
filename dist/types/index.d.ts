import { FrameworkConfiguration } from 'aurelia-framework';
export { DeepComputedObserver, } from './deep-computed-observer';
export { IDependency } from './definitions';
export declare function configure(config: FrameworkConfiguration): void;
export declare function deepComputedFrom(...expressions: string[]): MethodDecorator;
export declare function shallowComputedFrom(...expressions: string[]): MethodDecorator;
