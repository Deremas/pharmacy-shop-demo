import { redirect } from "next/navigation";

export default async function LegacyTransfersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  const resolvedSearchParams = await searchParams;

  Object.entries(resolvedSearchParams || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => params.append(key, entry));
      return;
    }
    if (value !== undefined) params.set(key, value);
  });

  const query = params.toString();
  redirect(`/store/transfers${query ? `?${query}` : ""}`);
}
