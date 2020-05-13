## Aurelia Deep Computed

### Installation

```shell
npm install aurelia-deep-computed
```

then in your app entry:

```ts
import { PLATFORM } from 'aurelia-framework';

export function configure(aurelia: Aurelia) {
  aurelia.use.plugin(PLATFORM.moduleName('aurelia-deep-computed'));
  // Or, for `aurelia-framework` 1.3 & later, you can do instead:
  // aurelia.use.plugin(configureDeepComputed);
}
```

### Usage example

There are 2 mains exports of this plugin: `deepComputedFrom` and `shallowComputedFrom`. Following is an example of the difference between 2 decorators, when the result of computedExpression (`data` in the following example) is an object:

```ts
class App {

  data = { name: { first: 'bi', last: 'go' }, address: { number: 80, unit: 9 } }

  @deepComputedFrom('data')
  get contactDeep() {
    return JSON.stringify(this.data);
  }

  @shallowComputedFrom('data')
  get contactShallow() {
    return JSON.stringify(this.data);
  }
}
```

and template:
```html
Deep: ${contactDeep}

Shallow: ${contactShallow}
```

Rendered text will be:
```ts
{"name":{"first":"bi","last":"go"},"address":{"number":80,"unit":9}}

{"name":{"first":"bi","last":"go"},"address":{"number":80,"unit":9}}
```


1. When modify first name with:
```ts
app.data.name.first = 'b'
```
Rendered text will be:
```ts
{"name":{"first":"b","last":"go"},"address":{"number":80,"unit":9}}

// no change on this, because it doesn't observe deeper than the first level
// which are properties "name" and "address"
{"name":{"first":"bi","last":"go"},"address":{"number":80,"unit":9}}
```

2. When modify name with:
```ts
app.data.name = { first: 'b', last: 'c' }
```
Rendered text will be:
```ts
{"name":{"first":"b","last":"c"},"address":{"number":80,"unit":9}}

{"name":{"first":"b","last":"c"},"address":{"number":80,"unit":9}}
```

#### With `cache`:
One of the problems with getter function is that the value the function will be executed everytime the property is accessed. This could be an issue if the getter function takes a lot of time to complete. This plugin provides a way to overcome this, with an option name `cache`. If `cache` is on, the observer created for a getter function will assume that the value of the getter function will solely depend on the dependencies you gave it. And with this assumption, the observer will be able to efficiently cache the value from the last time it ran the getter function, unless there has been some changes in one of its observed dependencies.

__**One important caveat**__ of this is that it will only cache when it has start observing. This typically means if the view model/model that has an computed observer and is not yet connected to a view, it will still execute the getter function every time the property is accessed, as it cannot safely assume otherwise.

An example of cache usage would be:
```ts
class App {

  data = { name: { first: 'bi', last: 'go' }, address: { number: 80, unit: 9 } }

  @deepComputedFrom({
    deps: ['data'],
    cache: true
  })
  get contactDeep() {
    console.log('deep');
    return JSON.stringify(this.data);
  }

  @shallowComputedFrom({
    deps: ['data'],
    cache: true
  })
  get contactShallow() {
    console.log('shallow');
    return JSON.stringify(this.data);
  }
}
```
After the observer started observing, no matter how many times you read `contactDeep` or `contactShallow` properties, `console.log('deep')` or `console.log('shallow')` will be called only once.

### Notes

Both decorator exports of this pluginare dropin replacement for built-in decorator `computedFrom`, as following example:

Instead of:

```ts
import { computedFrom } from 'aurelia-framework';

class App {

  data = { firstName: 'Bi', lastName: 'pon', middleName: 'go' }

  @computedFrom('data')
  get fullName() {
    return JSON.stringify(this.data);
  }
}
```

```ts
import { deepComputedFrom } from 'aurelia-deep-computed';

export class App {

  data = { firstName: 'Bi', lastName: 'pon', middleName: 'go' }

  @deepComputedFrom('data')
  get fullName() {
    return JSON.stringify(this.data);
  }

  // or
  @shallowComputedFrom('data')
  get fullName() {
    return JSON.stringify(this.data);
  }
}
```
