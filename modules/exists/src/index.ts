const exists = async (url: string) =>
  fetch(url)
    .then((response) => response.ok)
    .catch(() => false);
export default exists;
