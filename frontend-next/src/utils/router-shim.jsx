"use client";
import NextLink from 'next/link';
import { useRouter as useNextRouter, usePathname, useParams as useNextParams, useSearchParams as useNextSearchParams } from 'next/navigation';
import { useEffect } from 'react';

export function Link({ to, href, ...props }) {
  return <NextLink href={to || href || "#"} {...props} />;
}

export function useNavigate() {
  const router = useNextRouter();
  return (path, options) => {
    if (options?.replace) router.replace(path);
    else router.push(path);
  };
}

export function useLocation() {
  const pathname = usePathname();
  const searchParams = useNextSearchParams();
  return {
    pathname,
    search: searchParams ? `?${searchParams.toString()}` : '',
    hash: ''
  };
}

export function useParams() {
  return useNextParams();
}

export function useSearchParams() {
  const router = useNextRouter();
  const pathname = usePathname();
  const searchParams = useNextSearchParams();

  return [
    searchParams,
    (newParams, options = {}) => {
      const normalizedParams = newParams instanceof URLSearchParams
        ? new URLSearchParams(newParams)
        : new URLSearchParams(newParams);
      const nextQuery = normalizedParams.toString();
      const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;

      if (options?.replace) {
        router.replace(nextUrl, { scroll: options.scroll ?? false });
        return;
      }

      router.push(nextUrl, { scroll: options.scroll ?? false });
    }
  ];
}

export function Navigate({ to, replace }) {
  const router = useNextRouter();
  useEffect(() => {
    if (replace) router.replace(to);
    else router.push(to);
  }, [to, replace, router]);
  return null;
}
