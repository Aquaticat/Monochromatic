import Watcher from 'watcher';
import { onItemsChange, } from './html.ts';
import { sortedItemsObservable, } from './item.ts';
import { lIgnore as l, } from './log.ts';
import { IGNORE_PATH, } from './path.ts';

const ignoreWatcher = new Watcher(IGNORE_PATH, {
  ignoreInitial: true,
  debounce: 100,
},);

ignoreWatcher.on('all', async function onIgnoreChange() {
  l.debug`onIgnoreChange`;
  await onItemsChange(sortedItemsObservable.value,);
},);
