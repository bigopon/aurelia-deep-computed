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
{"name":{"first":"b","last":"g"},"address":{"number":80,"unit":9}}

// no change on this, because it doesn't observe deeper than the first level
// which are properties "name" and "address"
{"name":{"first":"b","last":"g"},"address":{"number":80,"unit":9}}
```

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
