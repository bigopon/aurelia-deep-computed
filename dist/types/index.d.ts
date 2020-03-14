import { FrameworkConfiguration } from 'aurelia-framework';
import { IComputedOptions } from './definitions';
export { ComputedObserver, } from './computed-observer';
export { IDependency } from './definitions';
export declare function configure(config: FrameworkConfiguration): void;
export declare function deepComputedFrom(options: Partial<Omit<IComputedOptions, 'deep'>>): MethodDecorator;
export declare function deepComputedFrom(...expressions: string[]): MethodDecorator;
export declare function shallowComputedFrom(options: Partial<Omit<IComputedOptions, 'deep'>>): MethodDecorator;
export declare function shallowComputedFrom(...expressions: string[]): MethodDecorator;
