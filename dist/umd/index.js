(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('aurelia-binding')) :
  typeof define === 'function' && define.amd ? define(['exports', 'aurelia-binding'], factory) :
  (global = global || self, factory((global.au = global.au || {}, global.au.deepComputed = {}), global.au));
}(this, (function (exports, aureliaBinding) { 'use strict';

  // it looks better using @...(), so we cast to any instead of ClassDecorator
  // aurelia decorators support both usage: with and without parens
  var connectable = aureliaBinding.connectable;
  // by default, it does not support value converters & binding behaviors in the expressions
  // but maybe it should. TODO
  var emptyLookupFunctions = {
      valueConverters: function (name) { return null; },
      bindingBehaviors: function (name) { return null; },
  };
  var unset = {};
  var DeepComputedObserver = /** @class */ (function () {
      function DeepComputedObserver(obj, 
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
      DeepComputedObserver.prototype.getValue = function () {
          return this.expression.evaluate(this.scope, emptyLookupFunctions);
      };
      DeepComputedObserver.prototype.setValue = function (newValue) {
          this.expression.assign(this.scope, newValue, emptyLookupFunctions);
      };
      DeepComputedObserver.prototype.subscribe = function (context, callable) {
          var _this = this;
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
                  dispose: function () {
                      _this.unsubscribe(context, callable);
                  }
              };
          }
      };
      DeepComputedObserver.prototype.unsubscribe = function (context, callable) {
          if (this.removeSubscriber(context, callable) && !this.hasSubscribers()) {
              this.unobserveDeps();
              this.unobserve(true);
              this.oldValue = unset;
              this.notifyingDeps.length = 0;
          }
      };
      DeepComputedObserver.prototype.call = function () {
          var newValue = this.expression.evaluate(this.scope, emptyLookupFunctions);
          var oldValue = this.oldValue;
          if (newValue !== oldValue) {
              this.oldValue = newValue;
              this.callSubscribers(newValue, oldValue);
          }
          if (this.isQueued) {
              this.notifyingDeps.forEach(function (dep) {
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
      };
      /**
       * @internal
       */
      DeepComputedObserver.prototype.handleChange = function (dep, collect) {
          if (this.isQueued) {
              return;
          }
          if (this.notifyingDeps.indexOf(dep) === -1) {
              this.notifyingDeps.push(dep);
          }
          this.observerLocator.taskQueue.queueMicroTask(this);
      };
      /**
       * @internal
       */
      DeepComputedObserver.prototype.observeDeps = function () {
          var _this = this;
          var values = this.expression.getDeps(this.scope);
          var rootDeps = this.rootDeps;
          if (rootDeps == null) {
              rootDeps = this.rootDeps = values.map(function (v) { return getDependency(_this, null, v); }).filter(Boolean);
          }
          rootDeps.forEach(function (dep) {
              dep.collect();
              dep.observe();
          });
      };
      /**
       * @internal
       */
      DeepComputedObserver.prototype.unobserveDeps = function () {
          var rootDeps = this.rootDeps;
          if (rootDeps != null) {
              rootDeps.forEach(releaseDep);
              this.rootDeps = void 0;
          }
      };
      return DeepComputedObserver;
  }());
  // use this instead of decorator to avoid extra generated code
  connectable()(DeepComputedObserver);
  aureliaBinding.subscriberCollection()(DeepComputedObserver);
  var releaseDep = function (dep) {
      dep.release();
  };
  var observeDep = function (dep) {
      dep.observe();
  };
  // for Aurelia binding subscriber, a context is required if it's not a function
  var objectPropDepContext = 'context:object_prop_dep';
  var arrayDepContext = 'context:array_dep';
  var ObjectDependency = /** @class */ (function () {
      function ObjectDependency(owner, parent, value) {
          this.owner = owner;
          this.parent = parent;
          this.value = value;
          this.deps = new Map();
          this.connected = false;
      }
      ObjectDependency.prototype.collect = function () {
          var _this = this;
          var value = this.value;
          Object.keys(value).forEach(function (prop) {
              var propertyDep = new ObjectPropertyDependency(_this.owner, _this, prop, value[prop]);
              _this.deps.set(prop, propertyDep);
              propertyDep.collect();
          });
      };
      ObjectDependency.prototype.observe = function () {
          this.deps.forEach(observeDep);
          this.connected = true;
      };
      ObjectDependency.prototype.release = function () {
          this.deps.forEach(releaseDep);
          this.connected = false;
      };
      return ObjectDependency;
  }());
  var ObjectPropertyDependency = /** @class */ (function () {
      function ObjectPropertyDependency(owner, parent, property, value) {
          this.owner = owner;
          this.parent = parent;
          this.property = property;
          this.value = value;
          this.deps = new Map();
          this.connected = false;
      }
      ObjectPropertyDependency.prototype.collect = function () {
          var valueDep = getDependency(this.owner, this, this.value);
          if (valueDep == null) {
              return;
          }
          this.deps.set(this, valueDep);
          valueDep.collect();
      };
      ObjectPropertyDependency.prototype.observe = function () {
          var observer = this.observer;
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
      };
      ObjectPropertyDependency.prototype.release = function () {
          var observer = this.observer;
          if (observer != null) {
              observer.unsubscribe(objectPropDepContext, this);
              this.observer = void 0;
          }
          this.deps.forEach(releaseDep);
          this.deps.clear();
          this.connected = false;
      };
      ObjectPropertyDependency.prototype.call = function () {
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
      };
      return ObjectPropertyDependency;
  }());
  var ArrayDependency = /** @class */ (function () {
      function ArrayDependency(owner, parent, value) {
          this.owner = owner;
          this.parent = parent;
          this.value = value;
          this.deps = new Map();
          this.connected = false;
      }
      ArrayDependency.prototype.collect = function () {
          for (var i = 0, arr = this.value, ii = arr.length; ii > i; ++i) {
              var value = arr[i];
              var dep = getDependency(this.owner, this, value);
              // if an index is not observable
              // just ignore
              if (dep == void 0) {
                  return;
              }
              this.deps.set(i, dep);
              dep.collect();
          }
      };
      ArrayDependency.prototype.observe = function () {
          var observer = this.observer;
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
      };
      ArrayDependency.prototype.release = function () {
          var observer = this.observer;
          if (observer != null) {
              observer.unsubscribe(arrayDepContext, this);
              this.observer = void 0;
          }
          this.deps.forEach(releaseDep);
          this.deps.clear();
          this.connected = false;
      };
      ArrayDependency.prototype.call = function (changeRecords) {
          // when array is mutated
          // 1. release
          this.release();
          // 2. recollect
          this.collect();
          this.observe();
          // 3. notify owner
          this.owner.handleChange(this, true);
      };
      return ArrayDependency;
  }());
  var SetDependency = /** @class */ (function () {
      function SetDependency(owner, parent, set) {
          this.owner = owner;
          this.parent = parent;
          this.set = set;
          this.deps = new Map();
          this.connected = false;
      }
      SetDependency.prototype.collect = function () {
          var _this = this;
          this.set.forEach(function (value) {
              var dep = getDependency(_this.owner, _this, value);
              if (dep == void 0) {
                  return;
              }
              dep.collect();
              // incorrect to typings, but safe
              _this.deps.set(value, dep);
          });
      };
      SetDependency.prototype.observe = function () {
          this.deps.forEach(observeDep);
          this.connected = true;
      };
      SetDependency.prototype.release = function () {
          this.deps.forEach(releaseDep);
          this.deps.clear();
          this.connected = false;
      };
      return SetDependency;
  }());
  function getDependency(owner, parent, value) {
      var valueType = typeof value;
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

  /*! *****************************************************************************
  Copyright (c) Microsoft Corporation. All rights reserved.
  Licensed under the Apache License, Version 2.0 (the "License"); you may not use
  this file except in compliance with the License. You may obtain a copy of the
  License at http://www.apache.org/licenses/LICENSE-2.0

  THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
  KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
  WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
  MERCHANTABLITY OR NON-INFRINGEMENT.

  See the Apache Version 2.0 License for specific language governing permissions
  and limitations under the License.
  ***************************************************************************** */
  /* global Reflect, Promise */

  var extendStatics = function(d, b) {
      extendStatics = Object.setPrototypeOf ||
          ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
          function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
      return extendStatics(d, b);
  };

  function __extends(d, b) {
      extendStatics(d, b);
      function __() { this.constructor = d; }
      d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
  }

  var ComputedExpression = /** @class */ (function (_super) {
      __extends(ComputedExpression, _super);
      function ComputedExpression(name, dependencies) {
          var _this = _super.call(this) || this;
          _this.name = name;
          _this.dependencies = dependencies;
          // this is to signal aurelia binding that it's ok trying to invoke .assign on this expression
          _this.isAssignable = true;
          return _this;
      }
      ComputedExpression.prototype.evaluate = function (scope, lookupFunctions) {
          return scope.bindingContext[this.name];
      };
      ComputedExpression.prototype.assign = function (scope, value, lookupFunctions) {
          scope.bindingContext[this.name] = value;
      };
      ComputedExpression.prototype.accept = function (visitor) {
          throw new Error('not implemented');
      };
      ComputedExpression.prototype.connect = function (binding, scope) {
          var dependencies = this.dependencies;
          var i = dependencies.length;
          while (i--) {
              dependencies[i].connect(binding, scope);
          }
      };
      ComputedExpression.prototype.getDeps = function (scope) {
          return this.dependencies.map(function (dep) { return dep.evaluate(scope); });
      };
      return ComputedExpression;
  }(aureliaBinding.Expression));

  function configure(config) {
      // need to run at post task to ensure we don't resolve everything too early
      config.postTask(function () {
          var observerLocator = config.container.get(aureliaBinding.ObserverLocator);
          var parser = config.container.get(aureliaBinding.Parser);
          observerLocator.addAdapter({
              getObserver: function (obj, propertyName, descriptor) {
                  if (descriptor.get.deep) {
                      return createComputedObserver(obj, propertyName, descriptor, observerLocator, parser);
                  }
                  return null;
              }
          });
      });
  }
  function deepComputedFrom() {
      var expressions = [];
      for (var _i = 0; _i < arguments.length; _i++) {
          expressions[_i] = arguments[_i];
      }
      return function (target, key, descriptor) {
          var $descriptor = descriptor;
          var getterFn = $descriptor.get;
          getterFn.deep = true;
          getterFn.deps = expressions;
          getterFn.computedExpression = void 0;
          return descriptor;
      };
  }
  function createComputedObserver(obj, propertyName, descriptor, observerLocator, parser) {
      var computedExpression = descriptor.get.computedExpression;
      if (!(computedExpression instanceof ComputedExpression)) {
          var dependencies = descriptor.get.deps;
          var i = dependencies.length;
          var parsedDeps = descriptor.get.parsedDeps = Array(dependencies.length);
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
