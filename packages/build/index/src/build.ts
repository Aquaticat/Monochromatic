import publicApi from "./_/publicApi";
import staticAndCompress from "./_/staticAndCompress";
import { getLogger } from "@logtape/logtape";
const l = getLogger(['app', 'build']);

export default async (): Promise<void> => {
  const buildResult = await Promise.all(
    [
      staticAndCompress(),
      publicApi(),
    ],
  );

  l.info`built ${buildResult}`;
}
