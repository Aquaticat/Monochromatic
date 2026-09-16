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
import {
  mostCarriedReading,
  SEAT_HYPER_VISION,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  SEAT_SYNTHETIC_VISION_WITHHELD,
} from '../dist/final/node/index.mjs';

await describe({
  name: mostCarriedReading.name,
  children: [
    it({
      name: 'PICKS the transcript the other readers carry most, not the odd one out',
      fn: async () => {
        const chosen = mostCarriedReading({
          readings: [
            { modelId: SEAT_SYNTHETIC_VISION_WITHHELD, text: '猫在窗边安静地睡觉，阳光很好。', },
            { modelId: SEAT_SYNTHETIC_VISION_NO_OPENROUTER, text: '猫在窗边安静地睡觉，阳光很好，风铃在响。', },
            { modelId: SEAT_HYPER_VISION, text: '今天的菜单：鱼、鸡肉和牛奶。', },
          ],
        },);
        expect(chosen.modelId,).toBe(SEAT_SYNTHETIC_VISION_NO_OPENROUTER,);
      },
    },),
    it({
      name: 'PREFERS the longer transcript on a tie, since the overlap divides by the smaller side and a fuller '
        + 'reading the others vouch for scores the same as the shorter one it extends',
      fn: async () => {
        const chosen = mostCarriedReading({
          readings: [
            { modelId: SEAT_SYNTHETIC_VISION_WITHHELD, text: '手套猫：你好，姐姐。', },
            { modelId: SEAT_SYNTHETIC_VISION_NO_OPENROUTER, text: '手套猫：你好，姐姐。我们一起回家。', },
          ],
        },);
        expect(chosen.modelId,).toBe(SEAT_SYNTHETIC_VISION_NO_OPENROUTER,);
      },
    },),
    it({
      name: 'KEEPS the earliest transcript when nothing tells them apart',
      fn: async () => {
        const chosen = mostCarriedReading({
          readings: [
            { modelId: SEAT_SYNTHETIC_VISION_WITHHELD, text: '手套猫：你好，姐姐。', },
            { modelId: SEAT_SYNTHETIC_VISION_NO_OPENROUTER, text: '手套猫：你好，姐姐。', },
          ],
        },);
        expect(chosen.modelId,).toBe(SEAT_SYNTHETIC_VISION_WITHHELD,);
      },
    },),
    it({
      name: 'RETURNS a lone transcript as it is',
      fn: async () => {
        const chosen = mostCarriedReading({
          readings: [{ modelId: SEAT_HYPER_VISION, text: '一只猫。', },],
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
