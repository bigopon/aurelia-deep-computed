import { Aurelia, Controller, TaskQueue } from 'aurelia-framework';
import { configure as configureDeepComputed } from '../src';

interface Constructable<T> {
  new (...args: any[]): T;
}

export async function bootstrapComponent<T>(ViewModel: Constructable<T>, View: string = '', extraResources: any[] = []) {
  const aurelia = new Aurelia();
  aurelia.use
    .defaultBindingLanguage()
    .defaultResources()
    .eventAggregator()
    .plugin(configureDeepComputed)
    .globalResources(extraResources);

  const host = document.createElement('div');
  const klass = typeof ViewModel === 'function'
    ? ViewModel
    : class BoundViewModel {
      constructor () {
        return ViewModel
      }
    };

  if (View) {
    klass['$view'] = View;
  }

  await aurelia.start();
  await aurelia.setRoot(klass, host);

  const root = aurelia['root'] as Controller;
  return {
    host,
    viewModel: root.viewModel as T,
    taskQueue: aurelia.container.get(TaskQueue)
  };
}
