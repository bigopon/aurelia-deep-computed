'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var aureliaBinding = require('aurelia-binding');

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

/**@internal */
var releaseDep = function (dep) {
    dep.release();
};
/**@internal */
var observeDep = function (dep) {
    dep.observe();
};
// for Aurelia binding subscriber, a context is required if it's not a function
var objectPropDepContext = 'context:object_prop_dep';
var arrayDepContext = 'context:array_dep';
var setDepContext = 'context:set_dep';
var mapDepContext = 'context:map_dep';
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
var emptyMap = new Map();
var ObjectPropertyDependency = /** @class */ (function () {
    function ObjectPropertyDependency(owner, parent, property, value) {
        this.owner = owner;
        this.parent = parent;
        this.property = property;
        this.value = value;
        // object property has only 1 dep, there's no need to create a map
        // so use an empty map instead
        this.deps = emptyMap;
        this.connected = false;
    }
    ObjectPropertyDependency.prototype.collect = function () {
        this.dep = void 0;
        var owner = this.owner;
        var deep = owner.deep;
        if (!deep) {
            return;
        }
        var valueDep = getDependency(owner, this, this.value);
        if (valueDep == null) {
            return;
        }
        this.dep = valueDep;
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
        var dep = this.dep;
        if (dep != null) {
            dep.observe();
        }
        this.connected = true;
    };
    ObjectPropertyDependency.prototype.release = function () {
        var observer = this.observer;
        if (observer != null) {
            observer.unsubscribe(objectPropDepContext, this);
            this.observer = void 0;
        }
        var dep = this.dep;
        if (dep != null) {
            dep.release();
            this.dep = void 0;
        }
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
        this.owner.handleChange(this);
    };
    return ObjectPropertyDependency;
}());
var BaseCollectionDependency = /** @class */ (function () {
    function BaseCollectionDependency() {
        this.deps = new Map();
        this.connected = false;
    }
    BaseCollectionDependency.prototype.observe = function () {
        var observer = this.observer;
        if (observer == null) {
            observer = this.observer = this.getObserver();
        }
        observer.subscribe(this.subscribeContext, this);
        this.deps.forEach(observeDep);
        this.connected = true;
    };
    BaseCollectionDependency.prototype.release = function () {
        var observer = this.observer;
        if (observer != null) {
            observer.unsubscribe(this.subscribeContext, this);
            this.observer = void 0;
        }
        this.deps.forEach(releaseDep);
        this.deps.clear();
        this.connected = false;
    };
    // todo: more efficient dep recollection
    BaseCollectionDependency.prototype.call = function (context, changeRecords) {
        // when array is mutated
        // 1. release
        this.release();
        // 2. recollect
        this.collect();
        this.observe();
        // 3. notify owner
        this.owner.handleChange(this);
    };
    return BaseCollectionDependency;
}());
var ArrayDependency = /** @class */ (function (_super) {
    __extends(ArrayDependency, _super);
    function ArrayDependency(owner, parent, value) {
        var _this = _super.call(this) || this;
        _this.owner = owner;
        _this.parent = parent;
        _this.value = value;
        _this.subscribeContext = arrayDepContext;
        return _this;
    }
    ArrayDependency.prototype.getObserver = function () {
        return this
            .owner
            .observerLocator
            .getArrayObserver(this.value);
    };
    ArrayDependency.prototype.collect = function () {
        var owner = this.owner;
        var deep = owner.deep;
        var deps = this.deps;
        if (!deep) {
            return;
        }
        for (var i = 0, arr = this.value, ii = arr.length; ii > i; ++i) {
            var value = arr[i];
            var dep = getDependency(owner, this, value);
            // if an index is not observable
            // just ignore
            if (dep == void 0) {
                return;
            }
            var existingDep = deps.get(i);
            if (existingDep) {
                existingDep.release();
            }
            deps.set(i, dep);
            dep.collect();
        }
    };
    return ArrayDependency;
}(BaseCollectionDependency));
var MapDependency = /** @class */ (function (_super) {
    __extends(MapDependency, _super);
    function MapDependency(owner, parent, value) {
        var _this = _super.call(this) || this;
        _this.owner = owner;
        _this.parent = parent;
        _this.value = value;
        _this.subscribeContext = mapDepContext;
        return _this;
    }
    MapDependency.prototype.getObserver = function () {
        return this
            .owner
            .observerLocator
            .getMapObserver(this.value);
    };
    MapDependency.prototype.collect = function () {
        var _this = this;
        var owner = this.owner;
        var deep = owner.deep;
        var deps = this.deps;
        if (!deep) {
            return;
        }
        this.value.forEach(function (value, key) {
            var dep = getDependency(owner, _this, value);
            if (dep == void 0) {
                return;
            }
            var existingDep = deps.get(key);
            if (existingDep) {
                existingDep.release();
            }
            // incorrect to typings, but safe
            deps.set(key, dep);
            dep.collect();
        });
    };
    return MapDependency;
}(BaseCollectionDependency));
var SetDependency = /** @class */ (function (_super) {
    __extends(SetDependency, _super);
    function SetDependency(owner, parent, value) {
        var _this = _super.call(this) || this;
        _this.owner = owner;
        _this.parent = parent;
        _this.value = value;
        _this.subscribeContext = setDepContext;
        return _this;
    }
    SetDependency.prototype.getObserver = function () {
        return this
            .owner
            .observerLocator
            .getSetObserver(this.value);
    };
    SetDependency.prototype.collect = function () {
        var _this = this;
        var owner = this.owner;
        var deep = owner.deep;
        var deps = this.deps;
        if (!deep) {
            return;
        }
        this.value.forEach(function (value) {
            var dep = getDependency(owner, _this, value);
            if (dep == void 0) {
                return;
            }
            var existingDep = deps.get(value);
            if (existingDep) {
                existingDep.release();
            }
            deps.set(value, dep);
            if (deep) {
                dep.collect();
            }
        });
    };
    return SetDependency;
}(BaseCollectionDependency));
function getDependency(owner, parent, value) {
    var valueType = typeof value;
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
var connectable = aureliaBinding.connectable;
// by default, it does not support value converters & binding behaviors in the expressions
// but maybe it should. TODO
var emptyLookupFunctions = {
    valueConverters: function (name) { return null; },
    bindingBehaviors: function (name) { return null; },
};
var unset = {};
var ComputedObserver = /** @class */ (function () {
    function ComputedObserver(obj, 
    /**
     * The expression that will be used to evaluate
     */
    // this expression has 2 purposes:
    //  - a thin layer wrapping around getting/setting value of the targeted computed property
    //  - an abstraction for dealing with a list of declared dependencies and their corresponding value
    //    that uses existing Aurelia binding capabilities
    expression, observerLocator, descriptor, computedOptions) {
        var _this = this;
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
        this.deep = computedOptions.deep;
        this.cache = computedOptions.cache;
        if (computedOptions.cache) {
            var propertyName = expression.name;
            var getterFn = (function () {
                // not observing === no track === no confidence that the current value is correct
                return _this.observing ? _this.currentValue : _this.$get();
            });
            getterFn.computed = computedOptions;
            Object.defineProperty(obj, propertyName, {
                get: getterFn,
                set: descriptor.set,
                configurable: true,
                enumerable: true
            });
            this.$get = function () {
                return descriptor.get.call(obj);
            };
        }
        else {
            this.$get = function () {
                return expression.evaluate(_this.scope, emptyLookupFunctions);
            };
        }
    }
    ComputedObserver.prototype.getValue = function () {
        return this.cache && this.observing
            ? this.currentValue
            : this.$get();
    };
    ComputedObserver.prototype.setValue = function (newValue) {
        // supports getter
        this.expression.assign(this.scope, newValue, emptyLookupFunctions);
    };
    ComputedObserver.prototype.subscribe = function (context, callable) {
        var _this = this;
        if (!this.hasSubscribers()) {
            this.oldValue = this.$get();
            this.expression.connect(
            /* @connectable makes this class behave as Binding */ this, this.scope);
            this.observeDeps();
            this.observing = true;
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
    ComputedObserver.prototype.unsubscribe = function (context, callable) {
        if (this.removeSubscriber(context, callable) && !this.hasSubscribers()) {
            this.observing = false;
            this.unobserveDeps();
            this.notifyingDeps.length = 0;
            this.unobserve(true);
            this.oldValue = unset;
        }
    };
    ComputedObserver.prototype.call = function () {
        var newValue = this.currentValue = this.$get();
        var oldValue = this.oldValue;
        if (newValue !== oldValue) {
            this.oldValue = newValue;
            this.callSubscribers(newValue, oldValue === unset ? void 0 : oldValue);
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
    ComputedObserver.prototype.handleChange = function (dep) {
        var notifyingDeps = this.notifyingDeps;
        if (notifyingDeps.indexOf(dep) === -1) {
            notifyingDeps.push(dep);
        }
        if (this.isQueued) {
            return;
        }
        this.isQueued = true;
        this.observerLocator.taskQueue.queueMicroTask(this);
    };
    /**
     * @internal
     */
    ComputedObserver.prototype.observeDeps = function () {
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
    ComputedObserver.prototype.unobserveDeps = function () {
        var rootDeps = this.rootDeps;
        if (rootDeps != null) {
            rootDeps.forEach(releaseDep);
            this.rootDeps = void 0;
        }
    };
    return ComputedObserver;
}());
// use this instead of decorator to avoid extra generated code
connectable()(ComputedObserver);
aureliaBinding.subscriberCollection()(ComputedObserver);

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
        var container = config.container;
        var observerLocator = container.get(aureliaBinding.ObserverLocator);
        var parser = container.get(aureliaBinding.Parser);
        // addAdapter is a hook from observer locator to deal with computed properties (getter/getter + setter)
        observerLocator.addAdapter({
            getObserver: function (obj, propertyName, descriptor) {
                var computedOptions = descriptor.get.computed;
                if (computedOptions) {
                    return createComputedObserver(obj, propertyName, descriptor, observerLocator, parser);
                }
                return null;
            }
        });
    });
}
function deepComputedFrom() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    return function (target, key, descriptor) {
        descriptor.get.computed = buildOptions(args, true);
        return descriptor;
    };
}
function shallowComputedFrom() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    return function (target, key, descriptor) {
        descriptor.get.computed = buildOptions(args, false);
        return descriptor;
    };
}
function buildOptions(args, deep) {
    var isConfigObject = args.length === 1 && typeof args[0] === 'object';
    var deps = isConfigObject
        ? args[0].deps || []
        : args;
    var computedOptions = {
        deep: deep,
        deps: typeof deps === 'string' /* could be string when using config object, i.e deps: 'data' */
            ? [deps]
            : deps,
        cache: isConfigObject ? args[0].cache : false
    };
    return computedOptions;
}
function createComputedObserver(obj, propertyName, descriptor, observerLocator, parser) {
    var getterFn = descriptor.get;
    var computedOptions = getterFn.computed;
    var computedExpression = computedOptions.computedExpression;
    if (!(computedExpression instanceof ComputedExpression)) {
        var dependencies = computedOptions.deps;
        var i = dependencies.length;
        var parsedDeps = computedOptions.parsedDeps = Array(dependencies.length);
        while (i--) {
            parsedDeps[i] = parser.parse(dependencies[i]);
        }
        computedExpression = computedOptions.computedExpression = new ComputedExpression(propertyName, parsedDeps);
    }
    return new ComputedObserver(obj, computedExpression, observerLocator, descriptor, computedOptions);
}

exports.ComputedObserver = ComputedObserver;
exports.configure = configure;
exports.deepComputedFrom = deepComputedFrom;
exports.shallowComputedFrom = shallowComputedFrom;
//# sourceMappingURL=index.js.map
