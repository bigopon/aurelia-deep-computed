(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('aurelia-binding')) :
  typeof define === 'function' && define.amd ? define(['exports', 'aurelia-binding'], factory) :
  (global = global || self, factory((global.au = global.au || {}, global.au.deepComputed = {}), global.au));
}(this, (function (exports, aureliaBinding) { 'use strict';

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
      expression, observerLocator) {
          this.obj = obj;
          this.expression = expression;
          this.observerLocator = observerLocator;
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
      handleChange(dep, collect) {
          if (this.isQueued) {
              return;
          }
          if (this.notifyingDeps.indexOf(dep) === -1) {
              this.notifyingDeps.push(dep);
          }
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
  const releaseDep = (dep) => {
      dep.release();
  };
  const observeDep = (dep) => {
      dep.observe();
  };
  // for Aurelia binding subscriber, a context is required if it's not a function
  const objectPropDepContext = 'context:object_prop_dep';
  const arrayDepContext = 'context:array_dep';
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
  class ObjectPropertyDependency {
      constructor(owner, parent, property, value) {
          this.owner = owner;
          this.parent = parent;
          this.property = property;
          this.value = value;
          this.deps = new Map();
          this.connected = false;
      }
      collect() {
          const valueDep = getDependency(this.owner, this, this.value);
          if (valueDep == null) {
              return;
          }
          this.deps.set(this, valueDep);
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
          this.deps.forEach(observeDep);
          this.connected = true;
      }
      release() {
          const observer = this.observer;
          if (observer != null) {
              observer.unsubscribe(objectPropDepContext, this);
              this.observer = void 0;
          }
          this.deps.forEach(releaseDep);
          this.deps.clear();
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
          this.owner.handleChange(this, /* should recollect everything? */ false);
      }
  }
  class ArrayDependency {
      constructor(owner, parent, value) {
          this.owner = owner;
          this.parent = parent;
          this.value = value;
          this.deps = new Map();
          this.connected = false;
      }
      collect() {
          for (let i = 0, arr = this.value, ii = arr.length; ii > i; ++i) {
              let value = arr[i];
              const dep = getDependency(this.owner, this, value);
              // if an index is not observable
              // just ignore
              if (dep == void 0) {
                  return;
              }
              this.deps.set(i, dep);
              dep.collect();
          }
      }
      observe() {
          let observer = this.observer;
          if (observer == null) {
              observer
                  = this.observer
                      = this
                          .owner
                          .observerLocator
                          .getArrayObserver(this.value);
          }
          observer.subscribe(arrayDepContext, this);
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
      call(changeRecords) {
          // when array is mutated
          // 1. release
          this.release();
          // 2. recollect
          this.collect();
          this.observe();
          // 3. notify owner
          this.owner.handleChange(this, true);
      }
  }
  class SetDependency {
      constructor(owner, parent, set) {
          this.owner = owner;
          this.parent = parent;
          this.set = set;
          this.deps = new Map();
          this.connected = false;
      }
      collect() {
          this.set.forEach(value => {
              const dep = getDependency(this.owner, this, value);
              if (dep == void 0) {
                  return;
              }
              dep.collect();
              // incorrect to typings, but safe
              this.deps.set(value, dep);
          });
      }
      observe() {
          this.deps.forEach(observeDep);
          this.connected = true;
      }
      release() {
          this.deps.forEach(releaseDep);
          this.deps.clear();
          this.connected = false;
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
      if (value instanceof Set) {
          return new SetDependency(owner, parent, value);
      }
      return new ObjectDependency(owner, parent, value);
  }

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
          const observerLocator = config.container.get(aureliaBinding.ObserverLocator);
          const parser = config.container.get(aureliaBinding.Parser);
          observerLocator.addAdapter({
              getObserver: (obj, propertyName, descriptor) => {
                  if (descriptor.get.deep) {
                      return createComputedObserver(obj, propertyName, descriptor, observerLocator, parser);
                  }
                  return null;
              }
          });
      });
  }
  function deepComputedFrom(...expressions) {
      return function (target, key, descriptor) {
          const $descriptor = descriptor;
          const getterFn = $descriptor.get;
          getterFn.deep = true;
          getterFn.deps = expressions;
          getterFn.computedExpression = void 0;
          return descriptor;
      };
  }
  function createComputedObserver(obj, propertyName, descriptor, observerLocator, parser) {
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

  exports.DeepComputedObserver = DeepComputedObserver;
  exports.configure = configure;
  exports.deepComputedFrom = deepComputedFrom;

  Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=index.js.map
