export default async function ErrorPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const params = await searchParams;
  return <div className="loginWrap"><div className="card"><h1>Something went wrong</h1><p>{params.message || "Please return and try again."}</p></div></div>;
}
