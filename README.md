## Aurelia Deep Computed

### Installation

```shell
npm install aurelia-deep-computed
```

then in your app entry:

For `aurelia-framework` 1.3 & later:

```ts
import { configure as configureDeepComputed } from 'aurelia-deep-computed';

export function configure(aurelia) {
  aurelia.use.plugin(configureDeepComputed);
}
```

For earlier `aurelia-framework` version:

```ts
import { PLATFORM } from 'aurelia-framework';

export function configure(aurelia: Aurelia) {
  aurelia.use.plugin(PLATFORM.moduleName('aurelia-deep-computed'));
}
```

### Usage

The main export of this plugin is a decorator to declare dependencies for a getter. This decorator is a dropin replaceable for built-in decorator `computedFrom`, as following example:

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
}
```

Besides observing for changes at `data` property of `App`, all properties of `data` will also be observed.
