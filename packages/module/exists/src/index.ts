export default async (url: string): Promise<boolean> => {
  try {
    return await fetch(url).then((response) => response.ok);
  } catch {
    return false;
  }
};
