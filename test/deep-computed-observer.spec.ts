import './setup';
import { deepComputedFrom } from "../src";
import { bootstrapComponent } from "./utils";

describe('deep-computed-observer.spec.ts', () => {

  it('works with getter', async () => {
    class App {
      static $view = '<template>${json}</template>';

      data = { a: 5, b: 6 };

      jsonCallCount = 0;

      @deepComputedFrom('data')
      get json() {
        this.jsonCallCount++;
        return JSON.stringify(this.data);
      }
    }

    const { viewModel, host, taskQueue, dispose } = await bootstrapComponent(App);
    expect(host.textContent).toBe(JSON.stringify(viewModel.data));
    // there are 2 access calls to the getter
    // 1 is from initial value evaluation, and another is for when setting up the observer
    expect(viewModel.jsonCallCount).toBe(2);

    viewModel.data.a++;
    taskQueue.flushMicroTaskQueue();
    expect(viewModel.jsonCallCount).toBe(4);
    expect(host.textContent).toBe(JSON.stringify({ a: 6, b: 6 }));

    dispose();
  });

  it('works with getter/setter', async () => {
    class App {
      static $view = '<template>${json}</template>';

      data = { a: 5, b: 6 };

      jsonCallCount = 0;

      @deepComputedFrom('data')
      get json() {
        this.jsonCallCount++;
        return JSON.stringify(this.data);
      }

      set json(v: string) {
        const data = JSON.parse(v);
        this.data = data;
      }
    }

    const { viewModel, host, taskQueue, dispose } = await bootstrapComponent(App);
    expect(host.textContent).toBe(JSON.stringify(viewModel.data));
    // there are 2 access calls to the getter
    // 1 is from initial value evaluation, and another is for when setting up the observer
    expect(viewModel.jsonCallCount).toBe(2);

    viewModel.data.a++;
    taskQueue.flushMicroTaskQueue();
    expect(viewModel.jsonCallCount).toBe(4);
    expect(host.textContent).toBe(JSON.stringify({ a: 6, b: 6 }));

    viewModel.json = JSON.stringify({ a: 1, b: 2 });
    expect(viewModel.jsonCallCount).toBe(4);
    expect(host.textContent).toBe(JSON.stringify({ a: 6, b: 6 }));

    taskQueue.flushMicroTaskQueue();
    expect(viewModel.jsonCallCount).toBe(6);
    expect(host.textContent).toBe(JSON.stringify({ a: 1, b: 2 }));

    dispose();
  });

  describe('array test caces', function() {
    it('works with basic scenario', async () => {
      class App {
        static $view = '<template>${json}</template>';
  
        data = { sort: ['name', 'id'] }
  
        jsonCallCount = 0;
  
        @deepComputedFrom('data.sort')
        get json() {
          this.jsonCallCount++;
          return JSON.stringify(this.data);
        }
      }

      const { viewModel, host, taskQueue, dispose } = await bootstrapComponent(App);
      expect(host.textContent).toBe(JSON.stringify(viewModel.data));
      // there are 2 access calls to the getter
      // 1 is from initial value evaluation, and another is for when setting up the observer
      expect(viewModel.jsonCallCount).toBe(2);

      viewModel.data.sort.push('price');
      taskQueue.flushMicroTaskQueue();
      expect(viewModel.jsonCallCount).toBe(4);
      expect(host.textContent).toBe(JSON.stringify({ sort: ['name', 'id', 'price'] }));

      viewModel.data.sort = [];
      taskQueue.flushMicroTaskQueue();
      expect(viewModel.jsonCallCount).toBe(6);
      expect(host.textContent).toBe(JSON.stringify({ sort: [] }));

      dispose();
    });
  });

  describe('set test cases', function todo() {

  });

  describe('map test cases', function () {
    it('works with basic scenario', async () => {
      class App {
        static $view = '<template>${json}</template>';

        sort = new Map([
          ['name', 'asc'],
          ['id', 'asc']
        ]);

        jsonCallCount = 0;

        @deepComputedFrom('sort')
        get json() {
          this.jsonCallCount++;
          return JSON.stringify(Array.from(this.sort));
        }
      }

      const { viewModel, host, taskQueue, dispose } = await bootstrapComponent(App);
      expect(host.textContent).toBe(JSON.stringify([['name', 'asc'], ['id', 'asc']]));
      // there are 2 access calls to the getter
      // 1 is from initial value evaluation, and another is for when setting up the observer
      expect(viewModel.jsonCallCount).toBe(2);

      viewModel.sort.set('price', 'asc');
      taskQueue.flushMicroTaskQueue();
      expect(viewModel.jsonCallCount).toBe(4);
      expect(host.textContent).toBe(JSON.stringify([['name', 'asc'], ['id', 'asc'], ['price', 'asc']]));

      viewModel.sort = new Map();
      taskQueue.flushMicroTaskQueue();
      expect(viewModel.jsonCallCount).toBe(6);
      expect(host.textContent).toBe(JSON.stringify([]));

      viewModel.sort.set('price', { direction: 'asc' } as any);
      taskQueue.flushMicroTaskQueue();
      expect(viewModel.jsonCallCount).toBe(8);
      expect(host.textContent).toBe(JSON.stringify([['price', { direction: 'asc' }]]));
      
      (viewModel.sort.get('price') as any).direction = 'desc';
      taskQueue.flushMicroTaskQueue();
      expect(viewModel.jsonCallCount).toBe(10);
      expect(host.textContent).toBe(JSON.stringify([['price', { direction: 'desc' }]]));

      dispose();
    });
  });
});
