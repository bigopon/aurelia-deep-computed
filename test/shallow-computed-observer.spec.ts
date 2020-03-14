import './setup';
import { deepComputedFrom, shallowComputedFrom } from "../src";
import { bootstrapComponent } from "./utils";

describe('shallow-computed-observer.spec.ts', () => {

  interface IModel {
    coins: {
      $1: number;
      $2: number;
    };
    notes: {
      $5: number;
      $10: number;
    }
  }

  const createModel = (): IModel => {
    return {
      coins: {
        $1: 1,
        $2: 1,
      },
      notes: {
        $5: 1,
        $10: 1
      }
    };
  };

  for (const cache of [true, false]) {
    it(`works with object + getter [cache:${cache}]`, async () => {
      class App {
        static $view = '<template>${json}</template>';

        data = createModel();

        jsonCallCount = 0;

        @shallowComputedFrom({
          deps: ['data'],
          cache: cache
        })
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

      // shallow observation won't observe deeply into coins/notes objects
      viewModel.data.coins.$1++;
      taskQueue.flushMicroTaskQueue();
      expect(viewModel.jsonCallCount).toBe(2);
      expect(host.textContent).toBe(JSON.stringify(createModel()));

      // now test replacing the root property
      const newModel = createModel();
      newModel.coins.$1 = 5;
      viewModel.data.coins = newModel.coins;
      taskQueue.flushMicroTaskQueue();
      expect(viewModel.jsonCallCount).toBe(cache ? 3 : 4);
      expect(host.textContent).toBe(JSON.stringify(newModel));
    });

    describe('array test caces', function todo() {

    });

    describe('set test cases', function todo() {

    });

    describe('map test cases', function todo() {

    });
  }
});
