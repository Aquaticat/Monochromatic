export default function isLang(str: string) {
  return (str.length === 2 && /^[a-z]+$/.test(str)) || (str.length === 5 && /^[a-z]{2}-[A-Z]{2}$/.test(str));
}
