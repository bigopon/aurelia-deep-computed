(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('aurelia-binding')) :
  typeof define === 'function' && define.amd ? define(['exports', 'aurelia-binding'], factory) :
  (global = global || self, factory((global.au = global.au || {}, global.au.deepComputed = {}), global.au));
}(this, (function (exports, aureliaBinding) { 'use strict';

  /**@internal */
  const releaseDep = (dep) => {
      dep.release();
  };
  /**@internal */
  const observeDep = (dep) => {
      dep.observe();
  };
  // for Aurelia binding subscriber, a context is required if it's not a function
  const objectPropDepContext = 'context:object_prop_dep';
  const arrayDepContext = 'context:array_dep';
  const setDepContext = 'context:set_dep';
  const mapDepContext = 'context:map_dep';
  class ObjectDependency {
      constructor(owner, parent, value) {
          this.owner = owner;
          this.parent = parent;
          this.value = value;
          this.deps = new Map();
          this.connected = false;
      }
      collect() {
          const value = this.value;
          Object.keys(value).forEach(prop => {
              const propertyDep = new ObjectPropertyDependency(this.owner, this, prop, value[prop]);
              this.deps.set(prop, propertyDep);
              propertyDep.collect();
          });
      }
      observe() {
          this.deps.forEach(observeDep);
          this.connected = true;
      }
      release() {
          this.deps.forEach(releaseDep);
          this.connected = false;
      }
  }
  const emptyMap = new Map();
  class ObjectPropertyDependency {
      constructor(owner, parent, property, value) {
          this.owner = owner;
          this.parent = parent;
          this.property = property;
          this.value = value;
          // object property has only 1 dep, there's no need to create a map
          // so use an empty map instead
          this.deps = emptyMap;
          this.connected = false;
      }
      collect() {
          this.dep = void 0;
          const owner = this.owner;
          const deep = owner.deep;
          if (!deep) {
              return;
          }
          const valueDep = getDependency(owner, this, this.value);
          if (valueDep == null) {
              return;
          }
          this.dep = valueDep;
          valueDep.collect();
      }
      observe() {
          let observer = this.observer;
          if (observer == null) {
              observer
                  = this.observer
                      = this
                          .owner
                          .observerLocator
                          .getObserver(this.parent.value, this.property);
          }
          observer.subscribe(objectPropDepContext, this);
          const dep = this.dep;
          if (dep != null) {
              dep.observe();
          }
          this.connected = true;
      }
      release() {
          const observer = this.observer;
          if (observer != null) {
              observer.unsubscribe(objectPropDepContext, this);
              this.observer = void 0;
          }
          const dep = this.dep;
          if (dep != null) {
              dep.release();
              this.dep = void 0;
          }
          this.connected = false;
      }
      call() {
          // when property change
          // 1. release all sub-deps
          this.release();
          // 2. re-evaluate the value
          this.value = this.parent.value[this.property];
          // 3. re-collect deps
          this.collect();
          this.observe();
          // 4. notify the owner
          this.owner.handleChange(this);
      }
  }
  class BaseCollectionDependency {
      constructor() {
          this.deps = new Map();
          this.connected = false;
      }
      observe() {
          let observer = this.observer;
          if (observer == null) {
              observer = this.observer = this.getObserver();
          }
          observer.subscribe(this.subscribeContext, this);
          this.deps.forEach(observeDep);
          this.connected = true;
      }
      release() {
          const observer = this.observer;
          if (observer != null) {
              observer.unsubscribe(arrayDepContext, this);
              this.observer = void 0;
          }
          this.deps.forEach(releaseDep);
          this.deps.clear();
          this.connected = false;
      }
      // todo: more efficient dep recollection
      call(context, changeRecords) {
          // when array is mutated
          // 1. release
          this.release();
          // 2. recollect
          this.collect();
          this.observe();
          // 3. notify owner
          this.owner.handleChange(this);
      }
  }
  class ArrayDependency extends BaseCollectionDependency {
      constructor(owner, parent, value) {
          super();
          this.owner = owner;
          this.parent = parent;
          this.value = value;
          this.subscribeContext = arrayDepContext;
      }
      getObserver() {
          return this
              .owner
              .observerLocator
              .getArrayObserver(this.value);
      }
      collect() {
          const owner = this.owner;
          const deep = owner.deep;
          const deps = this.deps;
          if (!deep) {
              return;
          }
          for (let i = 0, arr = this.value, ii = arr.length; ii > i; ++i) {
              let value = arr[i];
              const dep = getDependency(owner, this, value);
              // if an index is not observable
              // just ignore
              if (dep == void 0) {
                  return;
              }
              const existingDep = deps.get(i);
              if (existingDep) {
                  existingDep.release();
              }
              deps.set(i, dep);
              dep.collect();
          }
      }
  }
  class MapDependency extends BaseCollectionDependency {
      constructor(owner, parent, value) {
          super();
          this.owner = owner;
          this.parent = parent;
          this.value = value;
          this.subscribeContext = mapDepContext;
      }
      getObserver() {
          return this
              .owner
              .observerLocator
              .getMapObserver(this.value);
      }
      collect() {
          const owner = this.owner;
          const deep = owner.deep;
          const deps = this.deps;
          if (!deep) {
              return;
          }
          this.value.forEach((value, key) => {
              const dep = getDependency(owner, this, value);
              if (dep == void 0) {
                  return;
              }
              const existingDep = deps.get(key);
              if (existingDep) {
                  existingDep.release();
              }
              // incorrect to typings, but safe
              deps.set(key, dep);
              dep.collect();
          });
      }
  }
  class SetDependency extends BaseCollectionDependency {
      constructor(owner, parent, value) {
          super();
          this.owner = owner;
          this.parent = parent;
          this.value = value;
          this.subscribeContext = setDepContext;
      }
      getObserver() {
          return this
              .owner
              .observerLocator
              .getSetObserver(this.value);
      }
      collect() {
          const owner = this.owner;
          const deep = owner.deep;
          const deps = this.deps;
          if (!deep) {
              return;
          }
          this.value.forEach(value => {
              const dep = getDependency(owner, this, value);
              if (dep == void 0) {
                  return;
              }
              const existingDep = deps.get(value);
              if (existingDep) {
                  existingDep.release();
              }
              deps.set(value, dep);
              if (deep) {
                  dep.collect();
              }
          });
      }
  }
  function getDependency(owner, parent, value) {
      const valueType = typeof value;
      if (value == null || valueType === 'boolean' || valueType === 'number' || valueType === 'string' || valueType === 'symbol' || valueType === 'bigint' || typeof value === 'function') {
          return;
      }
      if (Array.isArray(value)) {
          return new ArrayDependency(owner, parent, value);
      }
      if (value instanceof Map) {
          return new MapDependency(owner, parent, value);
      }
      if (value instanceof Set) {
          return new SetDependency(owner, parent, value);
      }
      return new ObjectDependency(owner, parent, value);
  }

  // it looks better using @...(), so we cast to any instead of ClassDecorator
  // aurelia decorators support both usage: with and without parens
  const connectable = aureliaBinding.connectable;
  // by default, it does not support value converters & binding behaviors in the expressions
  // but maybe it should. TODO
  const emptyLookupFunctions = {
      valueConverters: name => null,
      bindingBehaviors: name => null,
  };
  const unset = {};
  class DeepComputedObserver {
      constructor(obj, 
      /**
       * The expression that will be used to evaluate
       */
      // this expression has 2 purposes:
      //  - a thin layer wrapping around getting/setting value of the targeted computed property
      //  - an abstraction for dealing with a list of declared dependencies and their corresponding value
      //    that uses existing Aurelia binding capabilities
      expression, observerLocator, deep) {
          this.obj = obj;
          this.expression = expression;
          this.observerLocator = observerLocator;
          this.deep = deep;
          /**
           * @internal
           */
          this.isQueued = false;
          /**
           * @internal
           */
          this.oldValue = unset;
          /**
           * @internal
           */
          this.notifyingDeps = [];
          this.scope = { bindingContext: obj, overrideContext: aureliaBinding.createOverrideContext(obj) };
      }
      getValue() {
          return this.expression.evaluate(this.scope, emptyLookupFunctions);
      }
      setValue(newValue) {
          this.expression.assign(this.scope, newValue, emptyLookupFunctions);
      }
      subscribe(context, callable) {
          if (!this.hasSubscribers()) {
              this.oldValue = this.expression.evaluate(this.scope, emptyLookupFunctions);
              this.expression.connect(
              /* @connectable makes this class behave as Binding */ this, this.scope);
              this.observeDeps();
          }
          this.addSubscriber(context, callable);
          // scenario where this observer is created manually via ObserverLocator.getObserver
          if (arguments.length === 1 && typeof context === 'function') {
              return {
                  dispose: () => {
                      this.unsubscribe(context, callable);
                  }
              };
          }
      }
      unsubscribe(context, callable) {
          if (this.removeSubscriber(context, callable) && !this.hasSubscribers()) {
              this.unobserveDeps();
              this.unobserve(true);
              this.oldValue = unset;
              this.notifyingDeps.length = 0;
          }
      }
      call() {
          let newValue = this.expression.evaluate(this.scope, emptyLookupFunctions);
          let oldValue = this.oldValue;
          if (newValue !== oldValue) {
              this.oldValue = newValue;
              this.callSubscribers(newValue, oldValue);
          }
          if (this.isQueued) {
              this.notifyingDeps.forEach(dep => {
                  if (!dep.connected) {
                      return;
                  }
                  dep.release();
                  dep.collect();
                  dep.observe();
              });
              this.isQueued = false;
          }
          else {
              this.unobserveDeps();
              this.observeDeps();
          }
          this.notifyingDeps.length = 0;
          this._version++;
          this.expression.connect(/* @connectable makes this class behave as Binding */ this, this.scope);
          this.unobserve(false);
      }
      /**
       * @internal
       */
      handleChange(dep) {
          const notifyingDeps = this.notifyingDeps;
          if (notifyingDeps.indexOf(dep) === -1) {
              notifyingDeps.push(dep);
          }
          if (this.isQueued) {
              return;
          }
          this.isQueued = true;
          this.observerLocator.taskQueue.queueMicroTask(this);
      }
      /**
       * @internal
       */
      observeDeps() {
          const values = this.expression.getDeps(this.scope);
          let rootDeps = this.rootDeps;
          if (rootDeps == null) {
              rootDeps = this.rootDeps = values.map(v => getDependency(this, null, v)).filter(Boolean);
          }
          rootDeps.forEach(dep => {
              dep.collect();
              dep.observe();
          });
      }
      /**
       * @internal
       */
      unobserveDeps() {
          const rootDeps = this.rootDeps;
          if (rootDeps != null) {
              rootDeps.forEach(releaseDep);
              this.rootDeps = void 0;
          }
      }
  }
  // use this instead of decorator to avoid extra generated code
  connectable()(DeepComputedObserver);
  aureliaBinding.subscriberCollection()(DeepComputedObserver);

  class ComputedExpression extends aureliaBinding.Expression {
      constructor(name, dependencies) {
          super();
          this.name = name;
          this.dependencies = dependencies;
          // this is to signal aurelia binding that it's ok trying to invoke .assign on this expression
          this.isAssignable = true;
      }
      evaluate(scope, lookupFunctions) {
          return scope.bindingContext[this.name];
      }
      assign(scope, value, lookupFunctions) {
          scope.bindingContext[this.name] = value;
      }
      accept(visitor) {
          throw new Error('not implemented');
      }
      connect(binding, scope) {
          let dependencies = this.dependencies;
          let i = dependencies.length;
          while (i--) {
              dependencies[i].connect(binding, scope);
          }
      }
      getDeps(scope) {
          return this.dependencies.map(dep => dep.evaluate(scope));
      }
  }

  function configure(config) {
      // need to run at post task to ensure we don't resolve everything too early
      config.postTask(() => {
          const container = config.container;
          const observerLocator = container.get(aureliaBinding.ObserverLocator);
          const parser = container.get(aureliaBinding.Parser);
          // addAdapter is a hook from observer locator to deal with computed properties (getter/getter + setter)
          observerLocator.addAdapter({
              getObserver: (obj, propertyName, descriptor) => {
                  const computedOptions = descriptor.get.computed;
                  if (computedOptions) {
                      return createComputedObserver(obj, propertyName, descriptor, observerLocator, parser);
                  }
                  return null;
              }
          });
      });
  }
  function deepComputedFrom(...expressions) {
      return function (target, key, descriptor) {
          descriptor.get.computed = {
              deep: true,
              deps: expressions,
          };
          return descriptor;
      };
  }
  function shallowComputedFrom(...expressions) {
      return function (target, key, descriptor) {
          descriptor.get.computed = {
              deep: false,
              deps: expressions
          };
          return descriptor;
      };
  }
  function createComputedObserver(obj, propertyName, descriptor, observerLocator, parser) {
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

  exports.DeepComputedObserver = DeepComputedObserver;
  exports.configure = configure;
  exports.deepComputedFrom = deepComputedFrom;
  exports.shallowComputedFrom = shallowComputedFrom;

  Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=index.js.map
