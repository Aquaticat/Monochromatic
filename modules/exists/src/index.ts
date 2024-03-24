export default async (url: string) => {
  try {
    return await fetch(url).then((response) => response.ok);
  } catch {
    return false;
  }
};
