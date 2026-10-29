export default async function Page() {
  const res = await fetch("http://api:4000/api/me");
  const me = await res.json();
  return <main>{me.name}</main>;
}
