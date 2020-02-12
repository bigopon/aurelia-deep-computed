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

    const { viewModel, host, taskQueue } = await bootstrapComponent(App);
    expect(host.textContent).toBe(JSON.stringify(viewModel.data));
    // there are 2 access calls to the getter
    // 1 is from initial value evaluation, and another is for when setting up the observer
    expect(viewModel.jsonCallCount).toBe(2);

    viewModel.data.a++;
    taskQueue.flushMicroTaskQueue();
    expect(viewModel.jsonCallCount).toBe(4);
    expect(host.textContent).toBe(JSON.stringify({ a: 6, b: 6 }));
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

    const { viewModel, host, taskQueue } = await bootstrapComponent(App);
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

  });

  describe('array test caces', function todo() {

  });

  describe('set test cases', function todo() {

  });

  describe('map test cases', function todo() {

  });
});
