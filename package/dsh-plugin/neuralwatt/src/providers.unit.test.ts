import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  createNeuralWattProviders,
  mapNeuralWattProviders,
  refreshNeuralWattProviders,
  NEURALWATT_ROUTE,
} from '../dist/final/node/index.mjs';

await describe({
  name: '',
  children: [
    //region Served provider dict

    describe({
      name: createNeuralWattProviders.name,
      children: [
        it({
          name: 'serves the mapping of its initial listing before any fetch runs',
          fn: async () => {
            const served = createNeuralWattProviders({
              listing: [{ id: 'seed', max_model_len: 10, },],
            },);
            expect(served.reference.get(),)
              .toEqual(mapNeuralWattProviders({
                listing: [{ id: 'seed', max_model_len: 10, },],
              },),);
          },
        },),
        it({
          name: 'swaps the served mapping for the next reference read',
          fn: async () => {
            const served = createNeuralWattProviders({ listing: [{ id: 'seed', },], },);
            served.replace({
              providers: mapNeuralWattProviders({
                listing: [{ id: 'landed', },],
              },),
            },);
            expect(served.reference.get()[NEURALWATT_ROUTE]?.models?.[0]?.id,)
              .toBe('landed',);
          },
        },),
      ],
    },),

    //endregion Served provider dict

    //region Mount refresh

    describe({
      name: refreshNeuralWattProviders.name,
      children: [
        it({
          name: 'lands the live listing on the served mapping',
          fn: async () => {
            const served = createNeuralWattProviders({ listing: [{ id: 'seed', },], },);
            await refreshNeuralWattProviders({
              providers: served,
              fetchListing: async () => [{ id: 'live-a', }, { id: 'live-b', },],
            },);
            expect(served.reference.get(),).toEqual(mapNeuralWattProviders({
              listing: [{ id: 'live-a', }, { id: 'live-b', },],
            },),);
          },
        },),
        it({
          name: 'keeps the served mapping and returns when the fetch fails',
          fn: async () => {
            const served = createNeuralWattProviders({ listing: [{ id: 'seed', },], },);
            const before = served.reference.get();
            await refreshNeuralWattProviders({
              providers: served,
              fetchListing: async () => {
                throw new Error('offline',);
              },
            },);
            expect(served.reference.get(),).toBe(before,);
          },
        },),
        it({
          name: 'keeps the served mapping when the live listing maps to no serviceable model',
          fn: async () => {
            const served = createNeuralWattProviders({ listing: [{ id: 'seed', },], },);
            const before = served.reference.get();
            await refreshNeuralWattProviders({
              providers: served,
              fetchListing: async () => [
                { id: 'gone', deprecated: true, },
                { metadata: { display_name: 'no id', }, },
              ],
            },);
            expect(served.reference.get(),).toBe(before,);
          },
        },),
        it({
          name: 'keeps the served mapping when the live listing is empty',
          fn: async () => {
            const served = createNeuralWattProviders({ listing: [{ id: 'seed', },], },);
            const before = served.reference.get();
            await refreshNeuralWattProviders({
              providers: served,
              fetchListing: async () => [],
            },);
            expect(served.reference.get(),).toBe(before,);
          },
        },),
      ],
    },),

    //endregion Mount refresh
  ],
},);
