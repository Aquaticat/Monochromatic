/**
 Tests the one-transcript choice the archive block review reads for a
 corroborated picture. Fixtures are cat-themed invention.

 @module
 */
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { mostCarriedReading, } from '../dist/final/node/index.mjs';

await describe({
  name: mostCarriedReading.name,
  children: [
    it({
      name: 'PICKS the transcript the other readers carry most, not the odd one out',
      fn: async () => {
        const chosen = mostCarriedReading({
          readings: [
            { modelId: 'hf:moonshotai/Kimi-K3', text: '猫在窗边安静地睡觉，阳光很好。', },
            { modelId: 'hf:Qwen/Qwen3.8-27B', text: '猫在窗边安静地睡觉，阳光很好，风铃在响。', },
            { modelId: 'minimax-m3', text: '今天的菜单：鱼、鸡肉和牛奶。', },
          ],
        },);
        expect(chosen.modelId,).toBe('hf:Qwen/Qwen3.8-27B',);
      },
    },),
    it({
      name: 'PREFERS the longer transcript on a tie, since the overlap divides by the smaller side and a fuller '
        + 'reading the others vouch for scores the same as the shorter one it extends',
      fn: async () => {
        const chosen = mostCarriedReading({
          readings: [
            { modelId: 'hf:moonshotai/Kimi-K3', text: '手套猫：你好，姐姐。', },
            { modelId: 'hf:Qwen/Qwen3.8-27B', text: '手套猫：你好，姐姐。我们一起回家。', },
          ],
        },);
        expect(chosen.modelId,).toBe('hf:Qwen/Qwen3.8-27B',);
      },
    },),
    it({
      name: 'KEEPS the earliest transcript when nothing tells them apart',
      fn: async () => {
        const chosen = mostCarriedReading({
          readings: [
            { modelId: 'hf:moonshotai/Kimi-K3', text: '手套猫：你好，姐姐。', },
            { modelId: 'hf:Qwen/Qwen3.8-27B', text: '手套猫：你好，姐姐。', },
          ],
        },);
        expect(chosen.modelId,).toBe('hf:moonshotai/Kimi-K3',);
      },
    },),
    it({
      name: 'RETURNS a lone transcript as it is',
      fn: async () => {
        const chosen = mostCarriedReading({
          readings: [{ modelId: 'minimax-m3', text: '一只猫。', },],
        },);
        expect(chosen.text,).toBe('一只猫。',);
      },
    },),
    it({
      name: 'THROWS on no transcript at all',
      fn: async () => {
        expect(function none(): void {
          mostCarriedReading({ readings: [], },);
        },).toThrow();
      },
    },),
  ],
},);
